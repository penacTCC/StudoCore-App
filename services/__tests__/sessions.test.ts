import { criarQueryBuilderMock } from "@/test/helpers/supabaseQueryMock";

jest.mock("@/repositories/supabase", () => ({
    supabase: { from: jest.fn(), storage: { from: jest.fn() } },
}));

import { supabase } from "@/repositories/supabase";
import { definirModoTeste } from "@/services/modoTeste";
import {
    calculateFocusSessionMinutes,
    compilarSessoesPorExecucao,
    ehSessaoDestaque,
    salvarSessaoFoco,
} from "@/services/sessions";
import type { SessionCardItem } from "@/types/sessions";

const fromMock = supabase.from as jest.Mock;

beforeEach(() => {
    fromMock.mockReset();
});

describe("calculateFocusSessionMinutes", () => {
    beforeEach(async () => {
        await definirModoTeste(false);
    });

    it("devolve 0 quando não houve tempo estudado (sem inventar o piso de 1 minuto)", async () => {
        expect(await calculateFocusSessionMinutes(0)).toBe(0);
    });

    it("aplica o piso de 1 minuto pra uma sessão curta de verdade", async () => {
        // 5s reais não fecham 1 minuto, mas não são zero — não pode virar "0 minutos estudados".
        expect(await calculateFocusSessionMinutes(5)).toBe(1);
    });

    it("arredonda para o minuto mais próximo", async () => {
        expect(await calculateFocusSessionMinutes(90)).toBe(2); // 1.5min -> 2
        expect(await calculateFocusSessionMinutes(89)).toBe(1); // 1.48min -> 1
    });

    it("aplica a escala do modo de testes (360x) antes de converter para minutos", async () => {
        await definirModoTeste(true);
        // 10s reais * 360 = 3600s = 60 minutos.
        expect(await calculateFocusSessionMinutes(10)).toBe(60);
    });
});

describe("ehSessaoDestaque", () => {
    it("é destaque com mais de 70% de acerto", () => {
        expect(ehSessaoDestaque({ questoes_respondidas: 10, questoes_acertadas: 8 })).toBe(true);
    });

    it("não é destaque com exatamente 70%", () => {
        expect(ehSessaoDestaque({ questoes_respondidas: 10, questoes_acertadas: 7 })).toBe(false);
    });

    it("não é destaque sem nenhuma questão respondida (não divide por zero)", () => {
        expect(ehSessaoDestaque({ questoes_respondidas: 0, questoes_acertadas: 0 })).toBe(false);
    });
});

describe("compilarSessoesPorExecucao", () => {
    const linhaBase = {
        id: "x",
        user_id: "u1",
        disciplina: "Matemática",
        conteudo_especifico: null,
        tempo_minutos: 10,
        questoes_respondidas: 2,
        questoes_acertadas: 1,
        questoes_externas: 0,
        acertos_externos: 0,
        created_at: "2026-08-01T10:00:00Z",
        execucao_id: null,
    } as unknown as SessionCardItem;

    it("mantém sessões sem execucao_id como cards separados", () => {
        const linhas = [
            { ...linhaBase, id: "1", created_at: "2026-08-01T10:00:00Z" },
            { ...linhaBase, id: "2", created_at: "2026-08-01T11:00:00Z" },
        ];

        const resultado = compilarSessoesPorExecucao(linhas);

        expect(resultado).toHaveLength(2);
        // Mais recente primeiro.
        expect(resultado[0].id).toBe("2");
    });

    it("soma tempo e questões das linhas da mesma execução num único card", () => {
        const linhas = [
            { ...linhaBase, id: "1", execucao_id: "exec-1", disciplina: "Matemática", tempo_minutos: 10, questoes_respondidas: 4, questoes_acertadas: 2, created_at: "2026-08-01T10:00:00Z" },
            { ...linhaBase, id: "2", execucao_id: "exec-1", disciplina: "Física", tempo_minutos: 15, questoes_respondidas: 6, questoes_acertadas: 5, created_at: "2026-08-01T10:30:00Z" },
        ];

        const [card] = compilarSessoesPorExecucao(linhas);

        expect(card.tempo_minutos).toBe(25);
        expect(card.questoes_respondidas).toBe(10);
        expect(card.questoes_acertadas).toBe(7);
        // A linha mais recente da execução representa o card.
        expect(card.id).toBe("2");
        // Ordem de inserção das linhas, não a mais recente primeiro.
        expect(card.disciplina).toBe("Matemática e Física");
    });

    it("resume mais de 2 matérias como 'A +N'", () => {
        const linhas = ["Matemática", "Física", "Química"].map((disciplina, i) => ({
            ...linhaBase,
            id: String(i),
            execucao_id: "exec-2",
            disciplina,
            created_at: `2026-08-01T10:0${i}:00Z`,
        }));

        const [card] = compilarSessoesPorExecucao(linhas);

        expect(card.disciplina).toBe("Matemática +2");
    });
});

describe("salvarSessaoFoco", () => {
    it("carimba data_sessao no fuso local quando o payload não informa uma", async () => {
        jest.useFakeTimers().setSystemTime(new Date("2026-08-01T23:30:00.000Z")); // 20:30 em UTC-3

        const insertMock = jest.fn(() => criarQueryBuilderMock({ data: [{ id: "s1" }], error: null }));
        fromMock.mockImplementation((tabela: string) => {
            if (tabela === "sessoes_foco") return { insert: insertMock };
            return criarQueryBuilderMock({ data: null, error: null }); // "membros": sem grupo_id, não é chamado
        });

        await salvarSessaoFoco({ user_id: "u1", disciplina: "Matemática" } as any);

        expect(insertMock).toHaveBeenCalledWith(
            expect.objectContaining({ data_sessao: expect.any(String) })
        );

        jest.useRealTimers();
    });

    it("descarta grupo_id quando o usuário não é membro daquele grupo", async () => {
        const insertMock = jest.fn(() => criarQueryBuilderMock({ data: [{ id: "s1" }], error: null }));
        fromMock.mockImplementation((tabela: string) => {
            if (tabela === "membros") return criarQueryBuilderMock({ data: null, error: null });
            if (tabela === "sessoes_foco") return { insert: insertMock };
            throw new Error(`tabela inesperada: ${tabela}`);
        });

        await salvarSessaoFoco({ user_id: "u1", grupo_id: "grupo-nao-membro", disciplina: "Matemática" } as any);

        expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ grupo_id: null }));
    });

    it("faz fallback sem grupo_id quando o banco remoto ainda não tem a coluna", async () => {
        const erroColunaFaltando = { code: "42703", message: 'column "grupo_id" does not exist' };
        const insertComGrupo = jest.fn(() => criarQueryBuilderMock({ data: null, error: erroColunaFaltando }));
        const insertSemGrupo = jest.fn(() => criarQueryBuilderMock({ data: [{ id: "s1" }], error: null }));

        let chamadasEmSessoesFoco = 0;
        fromMock.mockImplementation((tabela: string) => {
            if (tabela === "membros") return criarQueryBuilderMock({ data: { id: "m1" }, error: null });
            if (tabela === "sessoes_foco") {
                chamadasEmSessoesFoco += 1;
                return { insert: chamadasEmSessoesFoco === 1 ? insertComGrupo : insertSemGrupo };
            }
            throw new Error(`tabela inesperada: ${tabela}`);
        });

        const resultado = await salvarSessaoFoco({ user_id: "u1", grupo_id: "g1", disciplina: "Matemática" } as any);

        expect(insertSemGrupo).toHaveBeenCalledWith(expect.not.objectContaining({ grupo_id: expect.anything() }));
        expect(resultado.error).toBeNull();
    });
});
