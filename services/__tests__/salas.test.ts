import { criarQueryBuilderMock } from "@/test/helpers/supabaseQueryMock";

jest.mock("@/repositories/supabase", () => ({
    supabase: { from: jest.fn(), rpc: jest.fn(), functions: { invoke: jest.fn() } },
}));

import { supabase } from "@/repositories/supabase";
import {
    atualizarParticipacao,
    criarSala,
    encerrarSala,
    entrarNaSala,
    sairDaSala,
    transferirAnfitriaoDaSala,
} from "@/services/salas";

const fromMock = supabase.from as jest.Mock;
const rpcMock = supabase.rpc as jest.Mock;
const invokeMock = supabase.functions.invoke as jest.Mock;

beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({ data: null, error: null });
});

describe("criarSala", () => {
    it("abre a sala e avisa o grupo sem bloquear quem está criando (fire-and-forget)", async () => {
        const builder = criarQueryBuilderMock({ data: { id: "sala-1", grupo_id: "g1" }, error: null });
        fromMock.mockReturnValue({ insert: jest.fn(() => builder) });

        const resultado = await criarSala({ grupoId: "g1", anfitriaoId: "u1" });

        expect(resultado).toEqual({ sala: { id: "sala-1", grupo_id: "g1" }, error: null });
        // A notificação é disparada mas o await de criarSala não depende dela.
        expect(invokeMock).toHaveBeenCalledWith("avisar-sala-aberta", { body: { salaId: "sala-1" } });
    });

    it("não notifica o grupo quando a sessão é solo (sem grupo_id)", async () => {
        const builder = criarQueryBuilderMock({ data: { id: "sala-1", grupo_id: null }, error: null });
        fromMock.mockReturnValue({ insert: jest.fn(() => builder) });

        await criarSala({ grupoId: null, anfitriaoId: "u1" });

        expect(invokeMock).not.toHaveBeenCalled();
    });

    it("propaga o erro sem criar a sala", async () => {
        const builder = criarQueryBuilderMock({ data: null, error: { message: "falhou" } });
        fromMock.mockReturnValue({ insert: jest.fn(() => builder) });

        const resultado = await criarSala({ grupoId: "g1", anfitriaoId: "u1" });

        expect(resultado.sala).toBeNull();
        expect(invokeMock).not.toHaveBeenCalled();
    });
});

describe("entrarNaSala", () => {
    const params = { salaId: "sala-1", membroId: "u1", sessaoId: "sessao-1" };

    it("insere a participação quando é a primeira vez entrando", async () => {
        fromMock.mockReturnValue({ insert: jest.fn(() => Promise.resolve({ error: null })) });

        const resultado = await entrarNaSala(params);

        expect(resultado).toEqual({ error: null });
    });

    it("ao reentrar (violação de unicidade 23505), atualiza a participação existente em vez de falhar", async () => {
        fromMock.mockImplementation((tabela: string) => {
            if (tabela === "tab_sessao_membros") {
                return {
                    insert: jest.fn(() => Promise.resolve({ error: { code: "23505" } })),
                    update: jest.fn(() => criarQueryBuilderMock({ data: null, error: null })),
                };
            }
            throw new Error(`tabela inesperada: ${tabela}`);
        });

        const resultado = await entrarNaSala(params);

        expect(resultado).toEqual({ error: null });
    });

    it("propaga outros erros sem tentar o fallback de reentrada", async () => {
        fromMock.mockReturnValue({ insert: jest.fn(() => Promise.resolve({ error: { code: "500", message: "erro real" } })) });

        const resultado = await entrarNaSala(params);

        expect(resultado.error).toEqual({ code: "500", message: "erro real" });
    });
});

describe("atualizarParticipacao", () => {
    it("atualiza filtrando por sala e membro", async () => {
        const builder = criarQueryBuilderMock({ data: null, error: null });
        fromMock.mockReturnValue({ update: jest.fn(() => builder) });

        await atualizarParticipacao("sala-1", "u1", { status: "pausado" });

        expect(builder.eq).toHaveBeenCalledWith("sala_id", "sala-1");
        expect(builder.eq).toHaveBeenCalledWith("membro_id", "u1");
    });
});

describe("sairDaSala", () => {
    it("devolve salaFechada=true quando a RPC diz que foi o último a sair", async () => {
        rpcMock.mockResolvedValue({ data: true, error: null });

        const resultado = await sairDaSala("sala-1", 120);

        expect(rpcMock).toHaveBeenCalledWith("sair_da_sala", { p_sala_id: "sala-1", p_tempo_segundos: 120 });
        expect(resultado).toEqual({ salaFechada: true, error: null });
    });

    it("salaFechada=false quando ainda sobra gente na sala", async () => {
        rpcMock.mockResolvedValue({ data: false, error: null });

        expect(await sairDaSala("sala-1")).toEqual({ salaFechada: false, error: null });
    });
});

describe("transferirAnfitriaoDaSala", () => {
    it("devolve null quando não sobrou ninguém pra herdar a sala", async () => {
        rpcMock.mockResolvedValue({ data: null, error: null });

        expect(await transferirAnfitriaoDaSala("sala-1")).toEqual({ novoAnfitriaoId: null, error: null });
    });
});

describe("encerrarSala", () => {
    it("devolve 0 (não lança) quando a RPC falha", async () => {
        rpcMock.mockResolvedValue({ data: null, error: { message: "erro" } });

        expect(await encerrarSala("sala-1")).toEqual({ encerradas: 0, error: { message: "erro" } });
    });
});
