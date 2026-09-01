jest.mock("@/repositories/supabase", () => ({
    supabase: { from: jest.fn(), auth: { getUser: jest.fn() } },
}));

import { supabase } from "@/repositories/supabase";
import { criarQueryBuilderMock } from "@/test/helpers/supabaseQueryMock";
import {
    PADRAO_PREFERENCIAS,
    buscarPreferencias,
    invalidarCachePreferencias,
    preferenciasDoUsuarioAtual,
    salvarPreferencias,
} from "@/services/preferencias";

const fromMock = supabase.from as jest.Mock;
const getUserMock = supabase.auth.getUser as jest.Mock;

const linhaBase = {
    usuario_id: "u1",
    foco_min: 25,
    descanso_curto_min: 5,
    descanso_longo_min: 15,
    ciclos_ate_longo: 4,
    auto_descanso: true,
    auto_foco: false,
    notificacoes_ativas: true,
    antecedencia_min: 10,
    avisar_fim_de_fase: true,
    resumo_dia_seguinte: false,
    nao_perturbar: true,
    nao_perturbar_inicio: "22:00:00",
    nao_perturbar_fim: "07:00:00",
    som_fim_foco: false,
    vibrar: true,
    manter_tela_ligada: false,
    inicio_semana: "segunda" as const,
    duracao_padrao_bloco_min: 50,
    duracao_padrao_descanso_min: 10,
    contar_descanso_como_estudado: false,
    anotar_apos_quiz: true,
    foto_apos_sessao: true,
    aparecer_no_ranking: true,
    sessao_publica_padrao: true,
    feed_publico: false,
};

beforeEach(() => {
    fromMock.mockReset();
    getUserMock.mockReset();
    invalidarCachePreferencias();
});

describe("buscarPreferencias", () => {
    it("devolve os padrões quando o usuário ainda não tem linha salva", async () => {
        fromMock.mockReturnValue(criarQueryBuilderMock({ data: null, error: null }));

        const prefs = await buscarPreferencias("u1");

        expect(prefs).toEqual(PADRAO_PREFERENCIAS);
    });

    it("devolve os padrões (sem quebrar a tela) quando a consulta falha", async () => {
        fromMock.mockReturnValue(criarQueryBuilderMock({ data: null, error: { message: "boom" } }));

        const prefs = await buscarPreferencias("u1");

        expect(prefs).toEqual(PADRAO_PREFERENCIAS);
    });

    it("corta os segundos dos horários de não perturbar (HH:MM:SS -> HH:MM)", async () => {
        fromMock.mockReturnValue(criarQueryBuilderMock({ data: linhaBase, error: null }));

        const prefs = await buscarPreferencias("u1");

        expect(prefs.naoPerturbarInicio).toBe("22:00");
        expect(prefs.naoPerturbarFim).toBe("07:00");
    });

    it("normaliza uma duração de foco gravada abaixo do piso atual do cronograma", async () => {
        // Linha antiga, de antes dos limites compartilhados existirem (ver comentário do service).
        fromMock.mockReturnValue(criarQueryBuilderMock({ data: { ...linhaBase, foco_min: 5 }, error: null }));

        const prefs = await buscarPreferencias("u1");

        expect(prefs.focoMin).toBe(25); // DURACAO_POMODORO_MIN
    });

    it("normaliza uma duração de foco gravada acima do teto atual", async () => {
        fromMock.mockReturnValue(criarQueryBuilderMock({ data: { ...linhaBase, foco_min: 999 }, error: null }));

        const prefs = await buscarPreferencias("u1");

        expect(prefs.focoMin).toBe(120); // DURACAO_POMODORO_MAX
    });

    it("cai para desligado quando feed_publico ainda não existe na linha (coluna anterior à migration)", async () => {
        const { feed_publico, ...semColuna } = linhaBase;
        fromMock.mockReturnValue(criarQueryBuilderMock({ data: semColuna, error: null }));

        const prefs = await buscarPreferencias("u1");

        expect(prefs.feedPublico).toBe(false);
    });
});

describe("salvarPreferencias", () => {
    it("propaga erro do banco sem lançar exceção", async () => {
        fromMock.mockReturnValue({ upsert: jest.fn(() => Promise.resolve({ error: { message: "boom" } })) });

        const resultado = await salvarPreferencias("u1", PADRAO_PREFERENCIAS);

        expect(resultado).toEqual({ sucesso: false, erro: "Não foi possível salvar as preferências." });
    });

    it("preenche interruptores removidos do app com valor fixo, não com o que a tela mandou", async () => {
        const upsertMock = jest.fn(() => Promise.resolve({ error: null }));
        fromMock.mockReturnValue({ upsert: upsertMock });

        await salvarPreferencias("u1", PADRAO_PREFERENCIAS);

        expect(upsertMock).toHaveBeenCalledWith(
            expect.objectContaining({ som_fim_foco: false, resumo_dia_seguinte: false, inicio_semana: "segunda" })
        );
    });
});

describe("preferenciasDoUsuarioAtual", () => {
    it("devolve os padrões quando não há sessão", async () => {
        getUserMock.mockResolvedValue({ data: { user: null } });

        const prefs = await preferenciasDoUsuarioAtual();

        expect(prefs).toEqual(PADRAO_PREFERENCIAS);
        expect(fromMock).not.toHaveBeenCalled();
    });

    it("busca no banco na primeira chamada e usa o cache na segunda, sem nova ida ao banco", async () => {
        getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
        fromMock.mockReturnValue(criarQueryBuilderMock({ data: linhaBase, error: null }));

        await preferenciasDoUsuarioAtual();
        await preferenciasDoUsuarioAtual();

        expect(fromMock).toHaveBeenCalledTimes(1);
    });

    it("invalidarCachePreferencias força uma nova ida ao banco", async () => {
        getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
        fromMock.mockReturnValue(criarQueryBuilderMock({ data: linhaBase, error: null }));

        await preferenciasDoUsuarioAtual();
        invalidarCachePreferencias();
        await preferenciasDoUsuarioAtual();

        expect(fromMock).toHaveBeenCalledTimes(2);
    });
});
