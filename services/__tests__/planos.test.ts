import { criarQueryBuilderMock } from "@/test/helpers/supabaseQueryMock";

jest.mock("@/repositories/supabase", () => ({
    supabase: { from: jest.fn() },
}));

jest.mock("@/services/lembretes", () => ({
    sincronizarLembretesPlano: jest.fn(),
    cancelarLembretesPlano: jest.fn(),
}));

import { supabase } from "@/repositories/supabase";
import { cancelarLembretesPlano } from "@/services/lembretes";
import {
    adiarBlocoPlano,
    alternarPlanoPublico,
    aplicarPlanoData,
    criarPlano,
    excluirPlano,
    fixarPlanoEmDias,
} from "@/services/planos";

const fromMock = supabase.from as jest.Mock;
const cancelarLembretesMock = cancelarLembretesPlano as jest.Mock;

beforeEach(() => {
    fromMock.mockReset();
    cancelarLembretesMock.mockReset();
});

describe("criarPlano", () => {
    it("recusa nome vazio (só espaços) sem chamar o banco", async () => {
        const resultado = await criarPlano("u1", "   ", "#fff");

        expect(resultado).toEqual({ sucesso: false, erro: "O nome do plano não pode estar vazio." });
        expect(fromMock).not.toHaveBeenCalled();
    });

    it("cria o plano com o nome já sem espaços nas pontas e sem blocos (duração 0m)", async () => {
        const singleMock = jest.fn(() =>
            Promise.resolve({ data: { id: "p1", nome: "Revisão", cor: "#fff", agenda_tipo: "nenhuma" }, error: null })
        );
        const insertBuilder: any = { select: jest.fn(() => insertBuilder), single: singleMock };
        const insertMock = jest.fn(() => insertBuilder);
        fromMock.mockReturnValue({ insert: insertMock });

        const resultado = await criarPlano("u1", "  Revisão  ", "#fff");

        expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ nome: "Revisão" }));
        expect(resultado.sucesso).toBe(true);
        expect(resultado.plano?.duracaoTotal).toBe("0m");
        expect(resultado.plano?.qtdBlocos).toBe(0);
    });

    it("só inclui origem_grupo_id no payload quando informado", async () => {
        const insertBuilder: any = {
            select: jest.fn(function (this: any) { return this; }),
            single: jest.fn(() => Promise.resolve({ data: { id: "p1", nome: "X", cor: "#fff" }, error: null })),
        };
        const insertMock = jest.fn(() => insertBuilder);
        fromMock.mockReturnValue({ insert: insertMock });

        await criarPlano("u1", "X", "#fff");

        expect(insertMock).toHaveBeenCalledWith(expect.not.objectContaining({ origem_grupo_id: expect.anything() }));
    });
});

describe("alternarPlanoPublico", () => {
    it("delega pra atualizarPlano com { publico }", async () => {
        const builder = criarQueryBuilderMock({
            data: { id: "p1", nome: "X", cor: "#fff", usuario_id: "u1", agenda_tipo: "nenhuma", planos_blocos: [] },
            error: null,
        });
        const updateMock = jest.fn(() => builder);
        fromMock.mockImplementation((tabela: string) => {
            if (tabela === "planos") return { update: updateMock };
            return criarQueryBuilderMock({ data: [], error: null }); // planos_blocos_concluidos
        });

        await alternarPlanoPublico("p1", true);

        expect(updateMock).toHaveBeenCalledWith({ publico: true });
    });
});

describe("adiarBlocoPlano", () => {
    async function rodarAdiamento(horaAtual: string, minutos: number) {
        const blocoBuscado = criarQueryBuilderMock({
            data: { id: "b1", hora_inicio: horaAtual, plano_id: "p1" },
            error: null,
        });
        const updateBuilder = criarQueryBuilderMock({ data: null, error: null });
        const updateMock = jest.fn(() => updateBuilder);

        let primeiraChamada = true;
        fromMock.mockImplementation((tabela: string) => {
            if (tabela === "planos_blocos") {
                if (primeiraChamada) {
                    primeiraChamada = false;
                    return blocoBuscado; // .select().eq().maybeSingle()
                }
                return { update: updateMock };
            }
            return criarQueryBuilderMock({ data: null, error: null }); // ressincronizarLembretesDoPlano -> "planos"
        });

        await adiarBlocoPlano("b1", minutos);
        return updateMock;
    }

    it("empurra o horário sem virar a meia-noite", async () => {
        const updateMock = await rodarAdiamento("14:00", 20);
        expect(updateMock).toHaveBeenCalledWith({ hora_inicio: "14:20" });
    });

    it("vira o dia (adiantar) quando passa das 23:59", async () => {
        const updateMock = await rodarAdiamento("23:50", 20);
        expect(updateMock).toHaveBeenCalledWith({ hora_inicio: "00:10" });
    });

    it("aceita minutos negativos (adiantar o bloco) e também vira o dia pra trás", async () => {
        const updateMock = await rodarAdiamento("00:10", -20);
        expect(updateMock).toHaveBeenCalledWith({ hora_inicio: "23:50" });
    });

    it("devolve erro sem tentar atualizar quando o bloco não existe", async () => {
        fromMock.mockReturnValue(criarQueryBuilderMock({ data: null, error: null }));

        const resultado = await adiarBlocoPlano("inexistente", 10);

        expect(resultado.error).toBeDefined();
    });
});

describe("aplicarPlanoData", () => {
    it("libera outro plano que já ocupava a mesma data antes de aplicar este", async () => {
        const liberarBuilder = criarQueryBuilderMock({ data: [{ id: "outro-plano" }], error: null });
        const aplicarBuilder = criarQueryBuilderMock({
            data: { id: "p1", nome: "X", cor: "#fff", usuario_id: "u1", agenda_tipo: "data", planos_blocos: [] },
            error: null,
        });

        let chamadasEmPlanos = 0;
        fromMock.mockImplementation((tabela: string) => {
            if (tabela === "planos") {
                chamadasEmPlanos += 1;
                if (chamadasEmPlanos === 1) return { update: jest.fn(() => liberarBuilder) };
                if (chamadasEmPlanos === 2) return { update: jest.fn(() => aplicarBuilder) };
                return criarQueryBuilderMock({ data: { agenda_tipo: "nenhuma" }, error: null }); // ressincronizar
            }
            if (tabela === "planos_blocos") return criarQueryBuilderMock({ data: [], error: null });
            return criarQueryBuilderMock({ data: [], error: null });
        });

        await aplicarPlanoData("u1", "p1", "2026-08-10");

        expect(liberarBuilder.neq).toHaveBeenCalledWith("id", "p1");
        expect(cancelarLembretesMock).toHaveBeenCalledWith("outro-plano", []);
    });
});

describe("fixarPlanoEmDias", () => {
    it("traduz o conflito de agenda (P0001) numa mensagem específica", async () => {
        const builder = criarQueryBuilderMock({ data: null, error: { code: "P0001", message: "conflito" } });
        fromMock.mockReturnValue({ update: jest.fn(() => builder) });

        const resultado = await fixarPlanoEmDias("p1", [0, 2]);

        expect(resultado).toEqual({
            sucesso: false,
            erro: "Já existe outro plano fixado em um desses dias.",
        });
    });

    it("mensagem genérica pra qualquer outro erro", async () => {
        const builder = criarQueryBuilderMock({ data: null, error: { code: "500", message: "boom" } });
        fromMock.mockReturnValue({ update: jest.fn(() => builder) });

        const resultado = await fixarPlanoEmDias("p1", [0]);

        expect(resultado.erro).toBe("Não foi possível fixar o plano nesses dias.");
    });
});

describe("excluirPlano", () => {
    it("cancela os lembretes dos blocos do plano depois de excluir", async () => {
        fromMock.mockImplementation((tabela: string) => {
            if (tabela === "planos_blocos") return criarQueryBuilderMock({ data: [{ id: "b1" }, { id: "b2" }], error: null });
            if (tabela === "planos") return { delete: jest.fn(() => criarQueryBuilderMock({ data: null, error: null })) };
            throw new Error(`tabela inesperada: ${tabela}`);
        });

        const resultado = await excluirPlano("p1");

        expect(resultado.sucesso).toBe(true);
        expect(cancelarLembretesMock).toHaveBeenCalledWith("p1", ["b1", "b2"]);
    });

    it("não exclui os lembretes quando o delete falha", async () => {
        fromMock.mockImplementation((tabela: string) => {
            if (tabela === "planos_blocos") return criarQueryBuilderMock({ data: [{ id: "b1" }], error: null });
            if (tabela === "planos") return { delete: jest.fn(() => criarQueryBuilderMock({ data: null, error: { message: "boom" } })) };
            throw new Error(`tabela inesperada: ${tabela}`);
        });

        const resultado = await excluirPlano("p1");

        expect(resultado.sucesso).toBe(false);
        expect(cancelarLembretesMock).not.toHaveBeenCalled();
    });
});
