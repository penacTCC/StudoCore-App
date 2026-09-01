import { criarQueryBuilderMock } from "@/test/helpers/supabaseQueryMock";

jest.mock("@/repositories/supabase", () => ({
    supabase: { from: jest.fn(), auth: { getUser: jest.fn() }, rpc: jest.fn() },
}));
jest.mock("@/services/toast", () => ({ toast: { error: jest.fn() } }));

import { supabase } from "@/repositories/supabase";
import {
    buscarGruposPublicosDisponiveis,
    buscarMembrosDosGrupos,
    buscarMembrosGrupo,
    buscarMeusGrupos,
    contarMembrosGrupo,
    horasSemanaisGrupo,
    registrarOfensivaGrupo,
    usuarioParticipaDeGrupo,
    usuarioParticipaDoGrupo,
} from "@/services/grupos";

const fromMock = supabase.from as jest.Mock;
const getUserMock = supabase.auth.getUser as jest.Mock;
const rpcMock = supabase.rpc as jest.Mock;

beforeEach(() => {
    fromMock.mockReset();
    getUserMock.mockReset();
    rpcMock.mockReset();
    jest.useFakeTimers().setSystemTime(new Date("2026-08-15T15:00:00.000Z"));
});

afterEach(() => jest.useRealTimers());

describe("contarMembrosGrupo", () => {
    it("devolve a contagem do banco", async () => {
        fromMock.mockReturnValue(criarQueryBuilderMock({ count: 7, error: null }));
        expect(await contarMembrosGrupo("g1")).toBe(7);
    });

    it("devolve 0 quando a busca falha", async () => {
        fromMock.mockReturnValue(criarQueryBuilderMock({ count: null, error: { message: "falhou" } }));
        expect(await contarMembrosGrupo("g1")).toBe(0);
    });
});

describe("buscarMeusGrupos", () => {
    it("devolve [] sem usuário logado", async () => {
        getUserMock.mockResolvedValue({ data: { user: null } });
        expect(await buscarMeusGrupos()).toEqual([]);
    });

    it("lida com `grupos` vindo como objeto único ou como array (quirk do PostgREST)", async () => {
        getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
        fromMock.mockReturnValue(
            criarQueryBuilderMock({
                data: [
                    { grupo_id: "g1", grupos: { id: "g1", nome_grupo: "A" } },
                    { grupo_id: "g2", grupos: [{ id: "g2", nome_grupo: "B" }] },
                    { grupo_id: "g3", grupos: null }, // vínculo órfão: grupo apagado
                ],
                error: null,
            })
        );

        const grupos = await buscarMeusGrupos();

        expect(grupos.map((g) => g.id)).toEqual(["g1", "g2"]);
    });

    it("devolve [] quando a busca falha", async () => {
        getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
        fromMock.mockReturnValue(criarQueryBuilderMock({ data: null, error: { message: "falhou" } }));
        expect(await buscarMeusGrupos()).toEqual([]);
    });
});

describe("buscarGruposPublicosDisponiveis", () => {
    it("exclui grupos dos quais o usuário já é membro", async () => {
        getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
        fromMock.mockImplementation((tabela: string) => {
            if (tabela === "grupos") {
                return criarQueryBuilderMock({
                    data: [
                        { id: "g1", nome_grupo: "A", membros: [{ count: 3 }] },
                        { id: "g2", nome_grupo: "B", membros: [{ count: 1 }] },
                    ],
                    error: null,
                });
            }
            // "membros": grupos dos quais o usuário já participa.
            return criarQueryBuilderMock({ data: [{ grupo_id: "g1" }], error: null });
        });

        const resultado = await buscarGruposPublicosDisponiveis();

        expect(resultado.map((g: any) => g.id)).toEqual(["g2"]);
        expect(resultado[0].members).toBe(1);
    });
});

describe("buscarMembrosGrupo / buscarMembrosDosGrupos", () => {
    const membroBase = (gamificacao: any) => ({
        user_id: "m1",
        grupo_id: "g1",
        profiles: { id: "m1", nome_usuario: "Fulano", gamificacoes: gamificacao },
    });

    it("calcula a ofensiva vigente e aceita gamificacoes como objeto ou array", async () => {
        fromMock.mockReturnValue(
            criarQueryBuilderMock({
                data: [
                    membroBase({ ofensiva: 3, ultima_data_estudo: "2026-08-15" }), // objeto
                    { ...membroBase(null), user_id: "m2", profiles: { id: "m2", gamificacoes: [{ ofensiva: 2, ultima_data_estudo: "2026-08-10" }] } }, // array, quebrada
                ],
                error: null,
            })
        );

        const membros = await buscarMembrosGrupo("g1");

        expect(membros[0].ofensiva).toBe(3);
        expect(membros[1].ofensiva).toBe(0); // sequência quebrada (mais de 1 dia sem estudar)
    });

    it("devolve [] sem grupoId", async () => {
        expect(await buscarMembrosGrupo("")).toEqual([]);
    });

    it("buscarMembrosDosGrupos agrupa os membros por grupo_id", async () => {
        fromMock.mockReturnValue(
            criarQueryBuilderMock({
                data: [
                    { user_id: "m1", grupo_id: "g1", profiles: { gamificacoes: null } },
                    { user_id: "m2", grupo_id: "g2", profiles: { gamificacoes: null } },
                ],
                error: null,
            })
        );

        const porGrupo = await buscarMembrosDosGrupos(["g1", "g2"]);

        expect(Object.keys(porGrupo).sort()).toEqual(["g1", "g2"]);
        expect(porGrupo.g1).toHaveLength(1);
    });

    it("buscarMembrosDosGrupos devolve {} sem ids", async () => {
        expect(await buscarMembrosDosGrupos([])).toEqual({});
    });
});

describe("usuarioParticipaDeGrupo / usuarioParticipaDoGrupo", () => {
    it("é true quando encontra a linha em membros", async () => {
        fromMock.mockReturnValue(criarQueryBuilderMock({ data: { id: "m1" }, error: null }));
        expect(await usuarioParticipaDeGrupo("u1")).toBe(true);
        expect(await usuarioParticipaDoGrupo("u1", "g1")).toBe(true);
    });

    it("é false sem vínculo", async () => {
        fromMock.mockReturnValue(criarQueryBuilderMock({ data: null, error: null }));
        expect(await usuarioParticipaDeGrupo("u1")).toBe(false);
        expect(await usuarioParticipaDoGrupo("u1", "g1")).toBe(false);
    });
});

describe("horasSemanaisGrupo", () => {
    it("devolve 0 quando o grupo não tem membros atuais", async () => {
        fromMock.mockReturnValue(criarQueryBuilderMock({ data: [], error: null }));
        expect(await horasSemanaisGrupo("g1")).toBe(0);
    });

    it("soma os minutos das sessões dos membros atuais e converte pra horas", async () => {
        fromMock.mockImplementation((tabela: string) => {
            if (tabela === "membros") {
                return criarQueryBuilderMock({
                    data: [{ user_id: "m1", grupo_id: "g1", profiles: { gamificacoes: null } }],
                    error: null,
                });
            }
            // "sessoes_foco"
            return criarQueryBuilderMock({ data: [{ tempo_minutos: 60 }, { tempo_minutos: 30 }], error: null });
        });

        expect(await horasSemanaisGrupo("g1")).toBe(1.5);
    });

    it("faz fallback por membros quando grupo_id ainda não existe no schema remoto", async () => {
        let chamadaSessoes = 0;
        fromMock.mockImplementation((tabela: string) => {
            if (tabela === "membros") {
                return criarQueryBuilderMock({
                    data: [{ user_id: "m1", grupo_id: "g1", profiles: { gamificacoes: null } }],
                    error: null,
                });
            }
            chamadaSessoes += 1;
            if (chamadaSessoes === 1) {
                return criarQueryBuilderMock({
                    data: null,
                    error: { code: "42703", message: 'column "grupo_id" does not exist' },
                });
            }
            return criarQueryBuilderMock({ data: [{ tempo_minutos: 120 }], error: null });
        });

        expect(await horasSemanaisGrupo("g1")).toBe(2);
    });
});

describe("registrarOfensivaGrupo", () => {
    it("propaga o resultado da RPC", async () => {
        rpcMock.mockReturnValue(
            criarQueryBuilderMock({ data: { ofensiva_atual: 4 }, error: null })
        );
        expect(await registrarOfensivaGrupo("g1")).toEqual({ ofensiva_atual: 4 });
    });

    it("devolve null quando a RPC falha", async () => {
        rpcMock.mockReturnValue(criarQueryBuilderMock({ data: null, error: { message: "falhou" } }));
        expect(await registrarOfensivaGrupo("g1")).toBeNull();
    });
});
