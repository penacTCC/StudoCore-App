import { criarQueryBuilderMock } from "@/test/helpers/supabaseQueryMock";

jest.mock("@/repositories/supabase", () => ({
    supabase: { functions: { invoke: jest.fn() }, rpc: jest.fn(), from: jest.fn() },
}));
jest.mock("@/services/planos", () => ({
    criarPlano: jest.fn(),
    salvarBlocoPlano: jest.fn(),
}));
jest.mock("@/services/materias", () => ({
    buscarMateriasUsuario: jest.fn(),
    criarMateria: jest.fn(),
    normalizarNomeMateria: jest.fn((nome: string) => nome.trim().toLowerCase()),
}));

import { supabase } from "@/repositories/supabase";
import { criarPlano, salvarBlocoPlano } from "@/services/planos";
import { buscarMateriasUsuario, criarMateria } from "@/services/materias";
import {
    aceitarRoadmapPessoal,
    buscarBlocosConcluidos,
    buscarBlocosRoadmapGrupo,
    buscarProgressoRoadmapGrupo,
    buscarProgressoRoadmapMembros,
    distribuirRoadmapGrupo,
    gerarRoadmap,
    marcarBlocoRoadmapConcluido,
    publicarRoadmapGrupo,
} from "@/services/roadmapIA";
import type { RoadmapProposta } from "@/types/roadmap";

const invokeMock = supabase.functions.invoke as jest.Mock;
const rpcMock = supabase.rpc as jest.Mock;
const fromMock = supabase.from as jest.Mock;

beforeEach(() => {
    invokeMock.mockReset();
    rpcMock.mockReset();
    fromMock.mockReset();
    (criarPlano as jest.Mock).mockReset();
    (salvarBlocoPlano as jest.Mock).mockReset();
    (buscarMateriasUsuario as jest.Mock).mockReset();
    (criarMateria as jest.Mock).mockReset();
});

describe("gerarRoadmap", () => {
    it("devolve a proposta quando a Edge Function responde bem", async () => {
        invokeMock.mockResolvedValue({
            data: { nome: "Roadmap", resumoObjetivo: "resumo", blocos: [{ materia: "Física" }] },
            error: null,
        });

        const resultado = await gerarRoadmap({ objetivo: "Passar no ENEM", escopo: "pessoal" } as any);

        expect(resultado.data?.nome).toBe("Roadmap");
        expect(resultado.error).toBeNull();
    });

    it("nunca lança: falha da IA vira { data: null, error } pro fallback 'criar plano manual'", async () => {
        invokeMock.mockResolvedValue({
            data: null,
            error: { message: "Edge Function returned a non-2xx status code", context: { json: async () => ({ detalhe: "PDF ilegível" }) } },
        });

        const resultado = await gerarRoadmap({ objetivo: "x", escopo: "pessoal" } as any);

        expect(resultado).toEqual({ data: null, error: "PDF ilegível" });
    });

    it("rejeita proposta sem blocos", async () => {
        invokeMock.mockResolvedValue({ data: { nome: "Roadmap", blocos: [] }, error: null });

        const resultado = await gerarRoadmap({ objetivo: "x", escopo: "pessoal" } as any);

        expect(resultado.data).toBeNull();
        expect(resultado.error).toBe("Proposta vazia ou inválida.");
    });
});

describe("distribuirRoadmapGrupo", () => {
    it("devolve a quantidade de cópias feitas pela RPC", async () => {
        rpcMock.mockResolvedValue({ data: 4, error: null });

        const resultado = await distribuirRoadmapGrupo("plano-1");

        expect(rpcMock).toHaveBeenCalledWith("grupo_distribuir_roadmap", { p_plano_id: "plano-1" });
        expect(resultado).toEqual({ sucesso: true, copias: 4 });
    });

    it("propaga o erro da RPC sem lançar", async () => {
        rpcMock.mockResolvedValue({ data: null, error: { message: "sem permissão" } });

        const resultado = await distribuirRoadmapGrupo("plano-1");

        expect(resultado).toEqual({ sucesso: false, erro: "sem permissão" });
    });
});

describe("marcarBlocoRoadmapConcluido", () => {
    it("insere ao marcar como concluído", async () => {
        const insertMock = jest.fn(() => criarQueryBuilderMock({ data: null, error: null }));
        fromMock.mockReturnValue({ insert: insertMock });

        const resultado = await marcarBlocoRoadmapConcluido("u1", "bloco-1", true);

        expect(insertMock).toHaveBeenCalledWith({ usuario_id: "u1", bloco_id: "bloco-1" });
        expect(resultado).toEqual({ sucesso: true });
    });

    it("apaga ao desmarcar", async () => {
        const builder = criarQueryBuilderMock({ data: null, error: null });
        fromMock.mockReturnValue({ delete: jest.fn(() => builder) });

        const resultado = await marcarBlocoRoadmapConcluido("u1", "bloco-1", false);

        expect(builder.eq).toHaveBeenCalledWith("bloco_id", "bloco-1");
        expect(resultado).toEqual({ sucesso: true });
    });
});

describe("buscarBlocosConcluidos", () => {
    it("devolve um Set vazio quando o plano não tem blocos (sem bater no banco de novo)", async () => {
        fromMock.mockReturnValueOnce(criarQueryBuilderMock({ data: [], error: null }));

        const resultado = await buscarBlocosConcluidos("plano-1");

        expect(resultado).toEqual(new Set());
        expect(fromMock).toHaveBeenCalledTimes(1);
    });

    it("devolve o Set dos ids de bloco concluídos", async () => {
        fromMock
            .mockReturnValueOnce(criarQueryBuilderMock({ data: [{ id: "b1" }, { id: "b2" }], error: null }))
            .mockReturnValueOnce(criarQueryBuilderMock({ data: [{ bloco_id: "b1" }], error: null }));

        const resultado = await buscarBlocosConcluidos("plano-1");

        expect(resultado).toEqual(new Set(["b1"]));
    });

    it("devolve Set vazio (não lança) quando a busca de blocos falha", async () => {
        fromMock.mockReturnValueOnce(criarQueryBuilderMock({ data: null, error: { message: "erro" } }));

        const resultado = await buscarBlocosConcluidos("plano-1");

        expect(resultado).toEqual(new Set());
    });
});

describe("buscarProgressoRoadmapGrupo", () => {
    it("devolve null quando a RPC não traz nenhuma linha", async () => {
        rpcMock.mockResolvedValue({ data: [], error: null });

        expect(await buscarProgressoRoadmapGrupo("g1")).toBeNull();
    });

    it("devolve null (não lança) quando a RPC falha", async () => {
        rpcMock.mockResolvedValue({ data: null, error: { message: "erro" } });

        expect(await buscarProgressoRoadmapGrupo("g1")).toBeNull();
    });

    it("converte os totais pra number, defensivamente", async () => {
        rpcMock.mockResolvedValue({
            data: [{ plano_id: "p1", nome: "R", cor: "#fff", total_blocos_semana: "10", total_membros: "3", membros_completaram: "1" }],
            error: null,
        });

        const resultado = await buscarProgressoRoadmapGrupo("g1");

        expect(resultado).toEqual({
            plano_id: "p1",
            nome: "R",
            cor: "#fff",
            total_blocos_semana: 10,
            total_membros: 3,
            membros_completaram: 1,
        });
    });
});

describe("buscarProgressoRoadmapMembros", () => {
    it("mapeia cada linha por membro (progresso individual cruza com membros no banco, via RPC)", async () => {
        rpcMock.mockResolvedValue({
            data: [{ user_id: "u1", blocos_concluidos: "2", blocos_estudo: "5" }],
            error: null,
        });

        const resultado = await buscarProgressoRoadmapMembros("g1");

        expect(resultado).toEqual([{ user_id: "u1", blocos_concluidos: 2, blocos_estudo: 5 }]);
    });

    it("devolve lista vazia quando a RPC falha", async () => {
        rpcMock.mockResolvedValue({ data: null, error: { message: "erro" } });

        expect(await buscarProgressoRoadmapMembros("g1")).toEqual([]);
    });
});

describe("buscarBlocosRoadmapGrupo", () => {
    it("preserva dia_semana null (bloco de qualquer dia) sem virar 0", async () => {
        rpcMock.mockResolvedValue({
            data: [{ dia_semana: null, hora_inicio: "08:00", duracao_min: "30", tipo: "estudo" }],
            error: null,
        });

        const [bloco] = await buscarBlocosRoadmapGrupo("g1");

        expect(bloco.diaSemana).toBeNull();
        expect(bloco.duracaoMin).toBe(30);
    });
});

describe("aceitarRoadmapPessoal", () => {
    const proposta: RoadmapProposta = {
        nome: "Roadmap",
        resumoObjetivo: "",
        blocos: [{ materia: "Física", horaInicio: "08:00", duracaoMin: 30, topico: null, diaSemana: 0 } as any],
    };

    it("cria a matéria quando não existe equivalente no acervo do usuário, e salva o bloco", async () => {
        (criarPlano as jest.Mock).mockResolvedValue({ sucesso: true, plano: { id: "plano-1" } });
        (buscarMateriasUsuario as jest.Mock).mockResolvedValue([]);
        (criarMateria as jest.Mock).mockResolvedValue({ sucesso: true, materia: { id: "mat-1" } });
        (salvarBlocoPlano as jest.Mock).mockResolvedValue({ error: null });

        const resultado = await aceitarRoadmapPessoal("u1", proposta);

        expect(criarMateria).toHaveBeenCalledWith("u1", "Física");
        expect(salvarBlocoPlano).toHaveBeenCalledWith(expect.objectContaining({ materia_id: "mat-1", plano_id: "plano-1" }));
        expect(resultado).toEqual({ sucesso: true, planoId: "plano-1" });
    });

    it("propaga a falha ao criar o plano, sem tentar salvar blocos", async () => {
        (criarPlano as jest.Mock).mockResolvedValue({ sucesso: false, erro: "sem crédito" });

        const resultado = await aceitarRoadmapPessoal("u1", proposta);

        expect(resultado).toEqual({ sucesso: false, erro: "sem crédito" });
        expect(buscarMateriasUsuario).not.toHaveBeenCalled();
    });

    it("interrompe e reporta erro se um bloco falhar ao salvar", async () => {
        (criarPlano as jest.Mock).mockResolvedValue({ sucesso: true, plano: { id: "plano-1" } });
        (buscarMateriasUsuario as jest.Mock).mockResolvedValue([]);
        (criarMateria as jest.Mock).mockResolvedValue({ sucesso: true, materia: { id: "mat-1" } });
        (salvarBlocoPlano as jest.Mock).mockResolvedValue({ error: { message: "falhou" } });

        const resultado = await aceitarRoadmapPessoal("u1", proposta);

        expect(resultado.sucesso).toBe(false);
    });
});

describe("publicarRoadmapGrupo", () => {
    it("cria o plano canônico, salva blocos e distribui pro grupo", async () => {
        (criarPlano as jest.Mock).mockResolvedValue({ sucesso: true, plano: { id: "plano-1" } });
        (buscarMateriasUsuario as jest.Mock).mockResolvedValue([{ id: "mat-1", nomeNormalizado: "física" }]);
        (salvarBlocoPlano as jest.Mock).mockResolvedValue({ error: null });
        rpcMock.mockResolvedValue({ data: 5, error: null });

        const proposta: RoadmapProposta = {
            nome: "Roadmap",
            resumoObjetivo: "",
            blocos: [{ materia: "Física", horaInicio: "08:00", duracaoMin: 30, topico: null, diaSemana: 0 } as any],
        };

        const resultado = await publicarRoadmapGrupo("admin-1", "g1", proposta);

        expect(criarPlano).toHaveBeenCalledWith("admin-1", "Roadmap", expect.any(String), false, "g1", true);
        expect(resultado).toEqual({ sucesso: true, copias: 5 });
    });

    it("propaga erro da distribuição sem quebrar", async () => {
        (criarPlano as jest.Mock).mockResolvedValue({ sucesso: true, plano: { id: "plano-1" } });
        (buscarMateriasUsuario as jest.Mock).mockResolvedValue([{ id: "mat-1", nomeNormalizado: "física" }]);
        (salvarBlocoPlano as jest.Mock).mockResolvedValue({ error: null });
        rpcMock.mockResolvedValue({ data: null, error: { message: "sem permissão" } });

        const proposta: RoadmapProposta = {
            nome: "Roadmap",
            resumoObjetivo: "",
            blocos: [{ materia: "Física", horaInicio: "08:00", duracaoMin: 30, topico: null, diaSemana: 0 } as any],
        };

        const resultado = await publicarRoadmapGrupo("admin-1", "g1", proposta);

        expect(resultado.sucesso).toBe(false);
    });
});
