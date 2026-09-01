jest.mock("@/repositories/supabase", () => ({
    supabase: {
        rpc: jest.fn(),
        functions: { invoke: jest.fn() },
        channel: jest.fn(),
        removeChannel: jest.fn(),
    },
}));

jest.mock("@/services/fotosSessao", () => ({
    assinarCaminhosDeFoto: jest.fn(),
}));

import { supabase } from "@/repositories/supabase";
import { assinarCaminhosDeFoto } from "@/services/fotosSessao";
import {
    avisarInteracao,
    buscarNotificacoes,
    carregarNotificacoesNaoLidas,
    definirNotificacoesNaoLidas,
    marcarNotificacoesLidas,
    obterNotificacoesNaoLidas,
    observarNotificacoes,
    assinarNotificacoesNaoLidas,
} from "@/services/notificacoes";

const rpcMock = supabase.rpc as jest.Mock;
const invokeMock = supabase.functions.invoke as jest.Mock;
const channelMock = supabase.channel as jest.Mock;
const removeChannelMock = supabase.removeChannel as jest.Mock;
const assinarCaminhosMock = assinarCaminhosDeFoto as jest.Mock;

function criarCanalFake() {
    const canal: any = {};
    canal.on = jest.fn(() => canal);
    canal.subscribe = jest.fn(() => canal);
    return canal;
}

beforeEach(() => {
    rpcMock.mockReset();
    invokeMock.mockReset();
    channelMock.mockReset();
    removeChannelMock.mockReset();
    assinarCaminhosMock.mockReset().mockResolvedValue(new Map());
    definirNotificacoesNaoLidas(0);
});

describe("buscarNotificacoes", () => {
    const linha = {
        id: "n1",
        categoria: "social",
        tipo: "curtida",
        origem: "sessao",
        referencia_id: "r1",
        ator_id: "u2",
        ator_nome: "Fulano",
        ator_foto: null,
        texto: null,
        resumo: null,
        foto_path: null,
        lida: false,
        criado_em: "2026-08-01T10:00:00Z",
    };

    it("lança quando a RPC falha", async () => {
        rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });
        await expect(buscarNotificacoes()).rejects.toThrow("boom");
    });

    it("sem cursor, chama a RPC com posição nula", async () => {
        rpcMock.mockResolvedValue({ data: [], error: null });
        await buscarNotificacoes();
        expect(rpcMock).toHaveBeenCalledWith("notificacoes_listar", {
            p_limite: 20,
            p_cursor_data: null,
            p_cursor_id: null,
        });
    });

    it("decodifica o cursor recebido e repassa pra RPC", async () => {
        rpcMock.mockResolvedValue({ data: [], error: null });
        const cursor = JSON.stringify({ criadoEm: "2026-08-01T09:00:00Z", id: "nX" });

        await buscarNotificacoes(cursor);

        expect(rpcMock).toHaveBeenCalledWith("notificacoes_listar", {
            p_limite: 20,
            p_cursor_data: "2026-08-01T09:00:00Z",
            p_cursor_id: "nX",
        });
    });

    it("cursor inválido (corrompido) não quebra a busca — cai pra posição nula", async () => {
        rpcMock.mockResolvedValue({ data: [], error: null });
        await buscarNotificacoes("{ json quebrado");
        expect(rpcMock).toHaveBeenCalledWith("notificacoes_listar", {
            p_limite: 20,
            p_cursor_data: null,
            p_cursor_id: null,
        });
    });

    it("proximoCursor é null quando a página veio incompleta (fim da lista)", async () => {
        rpcMock.mockResolvedValue({ data: [linha], error: null });
        const pagina = await buscarNotificacoes();
        expect(pagina.proximoCursor).toBeNull();
        expect(pagina.itens).toHaveLength(1);
        expect(pagina.itens[0].autor.nome).toBe("Fulano");
    });

    it("proximoCursor aponta pra última linha quando a página veio cheia", async () => {
        const linhas = Array.from({ length: 20 }, (_, i) => ({
            ...linha,
            id: `n${i}`,
            criado_em: `2026-08-01T10:${String(i).padStart(2, "0")}:00Z`,
        }));
        rpcMock.mockResolvedValue({ data: linhas, error: null });

        const pagina = await buscarNotificacoes();

        expect(pagina.proximoCursor).toBe(
            JSON.stringify({ criadoEm: linhas[19].criado_em, id: "n19" })
        );
    });

    it("autor sem nome cai para 'Sem nome'", async () => {
        rpcMock.mockResolvedValue({ data: [{ ...linha, ator_nome: null }], error: null });
        const pagina = await buscarNotificacoes();
        expect(pagina.itens[0].autor.nome).toBe("Sem nome");
    });

    it("resolve a URL assinada da foto quando a linha tem foto_path", async () => {
        rpcMock.mockResolvedValue({ data: [{ ...linha, foto_path: "caminho/x.jpg" }], error: null });
        assinarCaminhosMock.mockResolvedValue(new Map([["caminho/x.jpg", "https://assinada/x.jpg"]]));

        const pagina = await buscarNotificacoes();

        expect(assinarCaminhosMock).toHaveBeenCalledWith(["caminho/x.jpg"]);
        expect(pagina.itens[0].fotoUrl).toBe("https://assinada/x.jpg");
    });
});

describe("marcarNotificacoesLidas", () => {
    it("zera o contador quando a RPC tem sucesso", async () => {
        rpcMock.mockResolvedValue({ error: null });
        definirNotificacoesNaoLidas(5);

        await marcarNotificacoesLidas();

        expect(obterNotificacoesNaoLidas()).toBe(0);
    });

    it("mantém o contador quando a RPC falha", async () => {
        rpcMock.mockResolvedValue({ error: { message: "boom" } });
        definirNotificacoesNaoLidas(5);

        await marcarNotificacoesLidas();

        expect(obterNotificacoesNaoLidas()).toBe(5);
    });
});

describe("carregarNotificacoesNaoLidas", () => {
    it("atualiza o contador com o valor da RPC", async () => {
        rpcMock.mockResolvedValue({ data: 7, error: null });
        await carregarNotificacoesNaoLidas();
        expect(obterNotificacoesNaoLidas()).toBe(7);
    });

    it("trata data nulo/NaN como zero", async () => {
        rpcMock.mockResolvedValue({ data: null, error: null });
        await carregarNotificacoesNaoLidas();
        expect(obterNotificacoesNaoLidas()).toBe(0);
    });
});

describe("contador do badge (definir/assinar)", () => {
    it("não notifica os ouvintes quando o valor não muda", () => {
        const listener = jest.fn();
        const unsub = assinarNotificacoesNaoLidas(listener);
        definirNotificacoesNaoLidas(3);
        definirNotificacoesNaoLidas(3);
        expect(listener).toHaveBeenCalledTimes(1);
        unsub();
    });

    it("para de notificar depois do unsubscribe", () => {
        const listener = jest.fn();
        const unsub = assinarNotificacoesNaoLidas(listener);
        unsub();
        definirNotificacoesNaoLidas(9);
        expect(listener).not.toHaveBeenCalled();
    });
});

describe("observarNotificacoes", () => {
    it("compartilha o mesmo canal entre dois ouvintes do mesmo usuário", () => {
        channelMock.mockReturnValue(criarCanalFake());

        const unsub1 = observarNotificacoes("u1", jest.fn());
        const unsub2 = observarNotificacoes("u1", jest.fn());

        expect(channelMock).toHaveBeenCalledTimes(1);
        unsub1();
        unsub2();
    });

    it("só remove o canal quando o último ouvinte sai", () => {
        channelMock.mockReturnValue(criarCanalFake());

        const unsub1 = observarNotificacoes("u1", jest.fn());
        const unsub2 = observarNotificacoes("u1", jest.fn());

        unsub1();
        expect(removeChannelMock).not.toHaveBeenCalled();

        unsub2();
        expect(removeChannelMock).toHaveBeenCalledTimes(1);
    });

    it("troca de canal quando o usuário logado muda", () => {
        channelMock.mockReturnValue(criarCanalFake());

        const unsub1 = observarNotificacoes("u1", jest.fn());
        observarNotificacoes("u2", jest.fn());

        expect(removeChannelMock).toHaveBeenCalledTimes(1); // canal do u1 fechado
        expect(channelMock).toHaveBeenCalledTimes(2);
        unsub1();
    });
});

describe("avisarInteracao", () => {
    it("chama a Edge Function com o payload esperado", () => {
        invokeMock.mockResolvedValue({ data: null, error: null });

        avisarInteracao({ origem: "sessao", referenciaId: "r1" } as any, "curtida");

        expect(invokeMock).toHaveBeenCalledWith("avisar-interacao", {
            body: { tipo: "curtida", origem: "sessao", referenciaId: "r1" },
        });
    });

    it("é best-effort: uma falha na Edge Function não lança (nem derruba quem chamou)", () => {
        invokeMock.mockRejectedValue(new Error("edge function fora do ar"));

        expect(() => avisarInteracao({ origem: "sessao", referenciaId: "r1" } as any, "comentario")).not.toThrow();
    });
});
