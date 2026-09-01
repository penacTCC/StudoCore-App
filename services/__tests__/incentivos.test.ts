import { criarQueryBuilderMock } from "@/test/helpers/supabaseQueryMock";

jest.mock("@/repositories/supabase", () => ({
    supabase: {
        from: jest.fn(),
        functions: { invoke: jest.fn() },
        channel: jest.fn(),
        removeChannel: jest.fn(),
    },
}));

import { supabase } from "@/repositories/supabase";
import { buscarIncentivosDaSala, buscarPerfilRemetenteDoIncentivo, mandarForca, observarForcasRecebidas, observarIncentivosDaSala } from "@/services/incentivos";

const fromMock = supabase.from as jest.Mock;
const invokeMock = supabase.functions.invoke as jest.Mock;
const channelMock = supabase.channel as jest.Mock;

beforeEach(() => {
    fromMock.mockReset();
    invokeMock.mockReset();
    channelMock.mockReset();
});

describe("mandarForca", () => {
    it("repassa o resultado da Edge Function quando dá certo", async () => {
        invokeMock.mockResolvedValue({ data: { ok: true }, error: null });

        const resultado = await mandarForca("sala1", "user2");

        expect(invokeMock).toHaveBeenCalledWith("mandar-forca", { body: { salaId: "sala1", destinatarioId: "user2" } });
        expect(resultado).toEqual({ data: { ok: true }, error: null, retryAfterSeconds: undefined });
    });

    it("extrai a mensagem de erro e o cooldown do corpo JSON da resposta de erro", async () => {
        const contexto = { json: jest.fn().mockResolvedValue({ error: "Aguarde antes de mandar de novo", retryAfterSeconds: 42 }) };
        invokeMock.mockResolvedValue({ data: null, error: { message: "erro genérico", context: contexto } });

        const resultado = await mandarForca("sala1", "user2");

        expect(resultado).toEqual({ data: null, error: "Aguarde antes de mandar de novo", retryAfterSeconds: 42 });
    });

    it("cai para a mensagem genérica do erro quando o corpo não tem JSON válido", async () => {
        const contexto = { json: jest.fn().mockRejectedValue(new Error("not json")) };
        invokeMock.mockResolvedValue({ data: null, error: { message: "erro genérico", context: contexto } });

        const resultado = await mandarForca("sala1", "user2");

        expect(resultado.error).toBe("erro genérico");
    });
});

describe("buscarIncentivosDaSala", () => {
    it("devolve lista vazia (não null) quando não há dado", async () => {
        fromMock.mockReturnValue(criarQueryBuilderMock({ data: null, error: null }));

        const { data } = await buscarIncentivosDaSala("sala1");

        expect(data).toEqual([]);
    });

    it("filtra pela sala e ordena do mais antigo para o mais novo", async () => {
        const builder = criarQueryBuilderMock({ data: [{ id: "i1" }], error: null });
        fromMock.mockReturnValue(builder);

        await buscarIncentivosDaSala("sala1");

        expect(builder.eq).toHaveBeenCalledWith("sala_id", "sala1");
        expect(builder.order).toHaveBeenCalledWith("created_at", { ascending: true });
    });
});

describe("buscarPerfilRemetenteDoIncentivo", () => {
    it("devolve o perfil encontrado", async () => {
        fromMock.mockReturnValue(criarQueryBuilderMock({ data: { nome_real: "Ana" }, error: null }));

        expect(await buscarPerfilRemetenteDoIncentivo("u1")).toEqual({ nome_real: "Ana" });
    });

    it("devolve null quando não encontra", async () => {
        fromMock.mockReturnValue(criarQueryBuilderMock({ data: null, error: null }));

        expect(await buscarPerfilRemetenteDoIncentivo("u1")).toBeNull();
    });
});

describe("canais realtime", () => {
    function criarCanalMock() {
        const canal: any = {};
        canal.on = jest.fn(() => canal);
        canal.subscribe = jest.fn(() => canal);
        return canal;
    }

    it("observarIncentivosDaSala usa um nome de canal diferente a cada chamada, mesmo pra mesma sala", () => {
        channelMock.mockImplementation(() => criarCanalMock());

        observarIncentivosDaSala("sala1", jest.fn());
        observarIncentivosDaSala("sala1", jest.fn());

        const [primeiroNome] = channelMock.mock.calls[0];
        const [segundoNome] = channelMock.mock.calls[1];
        expect(primeiroNome).not.toBe(segundoNome);
    });

    it("observarIncentivosDaSala devolve uma função de cleanup que remove o canal", () => {
        const canal = criarCanalMock();
        channelMock.mockReturnValue(canal);

        const cleanup = observarIncentivosDaSala("sala1", jest.fn());
        cleanup();

        expect(supabase.removeChannel).toHaveBeenCalledWith(canal);
    });

    it("observarForcasRecebidas busca o remetente e monta o nome de exibição (usuário antes do nome real)", async () => {
        const canal = criarCanalMock();
        channelMock.mockReturnValue(canal);
        fromMock.mockReturnValue(criarQueryBuilderMock({ data: { nome_usuario: "ana123", nome_real: "Ana Silva" }, error: null }));

        const aoReceber = jest.fn();
        observarForcasRecebidas("user1", aoReceber);

        const handler = canal.on.mock.calls[0][2];
        await handler({ new: { remetente_id: "r1", sala_id: "sala1" } });

        expect(aoReceber).toHaveBeenCalledWith({ nomeRemetente: "ana123", salaId: "sala1" });
    });

    it("observarForcasRecebidas cai para 'Alguém' quando não acha o perfil de quem mandou", async () => {
        const canal = criarCanalMock();
        channelMock.mockReturnValue(canal);
        fromMock.mockReturnValue(criarQueryBuilderMock({ data: null, error: null }));

        const aoReceber = jest.fn();
        observarForcasRecebidas("user1", aoReceber);

        const handler = canal.on.mock.calls[0][2];
        await handler({ new: { remetente_id: "r1", sala_id: null } });

        expect(aoReceber).toHaveBeenCalledWith({ nomeRemetente: "Alguém", salaId: null });
    });
});
