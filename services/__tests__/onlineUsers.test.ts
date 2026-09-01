jest.mock("@/repositories/supabase", () => ({
    supabase: { channel: jest.fn(), removeChannel: jest.fn(), rpc: jest.fn() },
}));

import { supabase } from "@/repositories/supabase";
import {
    contarEstudandoAgora,
    obterUsuariosOnlineCache,
    observarUsuariosOnline,
} from "@/services/onlineUsers";

const channelMock = supabase.channel as jest.Mock;
const removeChannelMock = supabase.removeChannel as jest.Mock;
const rpcMock = supabase.rpc as jest.Mock;

/** Canal fake que guarda o handler de "presence sync" pra podermos disparar manualmente. */
function criarCanalFake() {
    const canal: any = { presenceState: jest.fn(() => ({})) };
    let handlerSync: (() => void) | null = null;
    canal.on = jest.fn((tipo: string, filtro: any, handler: () => void) => {
        if (tipo === "presence" && filtro.event === "sync") handlerSync = handler;
        return canal;
    });
    canal.subscribe = jest.fn((callback?: (status: string) => void) => {
        callback?.("SUBSCRIBED");
        return canal;
    });
    canal.track = jest.fn(() => Promise.resolve());
    canal.untrack = jest.fn(() => Promise.resolve());
    canal.__dispararSync = () => handlerSync?.();
    return canal;
}

let contadorDeGrupos = 0;
/** `salas` é um Map em nível de módulo (estado real do service) — cada teste usa seu próprio
 *  grupoId pra não herdar a sala que um teste anterior deixou aberta. */
function novoGrupoId() {
    contadorDeGrupos += 1;
    return `grupo-teste-${contadorDeGrupos}`;
}

beforeEach(() => {
    channelMock.mockReset();
    removeChannelMock.mockReset();
    rpcMock.mockReset();
});

describe("obterUsuariosOnlineCache", () => {
    it("devolve lista vazia pra um grupo sem sala aberta", () => {
        expect(obterUsuariosOnlineCache("grupo-desconhecido")).toEqual([]);
    });
});

describe("observarUsuariosOnline", () => {
    it("abre um canal de presence por grupo e anuncia a presença por padrão", () => {
        const grupo = novoGrupoId();
        const canal = criarCanalFake();
        channelMock.mockReturnValue(canal);

        observarUsuariosOnline(grupo, "u1", jest.fn());

        expect(channelMock).toHaveBeenCalledWith(`presence:grupo:${grupo}`);
        expect(canal.track).toHaveBeenCalledWith(
            expect.objectContaining({ user_id: "u1" })
        );
    });

    it("não anuncia presença quando anunciarPresenca=false (só observando)", () => {
        const canal = criarCanalFake();
        channelMock.mockReturnValue(canal);

        observarUsuariosOnline(novoGrupoId(), "u1", jest.fn(), false);

        expect(canal.track).not.toHaveBeenCalled();
    });

    it("dá saída do track (untrack) quando a preferência é desligada com o canal já aberto", () => {
        const grupo = novoGrupoId();
        const canal = criarCanalFake();
        channelMock.mockReturnValue(canal);

        observarUsuariosOnline(grupo, "u1", jest.fn()); // 1º: cria a sala, anuncia
        observarUsuariosOnline(grupo, "u2", jest.fn(), false); // 2º: sala já existe, desliga

        expect(canal.untrack).toHaveBeenCalledTimes(1);
    });

    it("deduplica usuários que aparecem em mais de uma chave de presença", () => {
        const canal = criarCanalFake();
        canal.presenceState.mockReturnValue({
            conexao1: [{ user_id: "u1", online_at: "x" }],
            conexao2: [{ user_id: "u1", online_at: "y" }, { user_id: "u2", online_at: "z" }],
        });
        channelMock.mockReturnValue(canal);

        const listener = jest.fn();
        observarUsuariosOnline(novoGrupoId(), "u1", listener);
        listener.mockClear(); // ignora a chamada inicial com a lista vazia

        canal.__dispararSync();

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener.mock.calls[0][0].sort()).toEqual(["u1", "u2"]);
    });

    it("compartilha um único canal entre dois ouvintes do mesmo grupo", () => {
        const grupo = novoGrupoId();
        channelMock.mockReturnValue(criarCanalFake());

        observarUsuariosOnline(grupo, "u1", jest.fn());
        observarUsuariosOnline(grupo, "u2", jest.fn());

        expect(channelMock).toHaveBeenCalledTimes(1);
    });

    it("só fecha o canal quando o último ouvinte cancela a assinatura", () => {
        const grupo = novoGrupoId();
        channelMock.mockReturnValue(criarCanalFake());

        const cancelar1 = observarUsuariosOnline(grupo, "u1", jest.fn());
        const cancelar2 = observarUsuariosOnline(grupo, "u2", jest.fn());

        cancelar1();
        expect(removeChannelMock).not.toHaveBeenCalled();

        cancelar2();
        expect(removeChannelMock).toHaveBeenCalledTimes(1);
        expect(obterUsuariosOnlineCache(grupo)).toEqual([]);
    });

    it("grupos diferentes usam canais (salas) independentes", () => {
        const grupoA = novoGrupoId();
        const grupoB = novoGrupoId();
        channelMock.mockReturnValueOnce(criarCanalFake()).mockReturnValueOnce(criarCanalFake());

        observarUsuariosOnline(grupoA, "u1", jest.fn());
        observarUsuariosOnline(grupoB, "u1", jest.fn());

        expect(channelMock).toHaveBeenCalledTimes(2);
        expect(channelMock).toHaveBeenCalledWith(`presence:grupo:${grupoA}`);
        expect(channelMock).toHaveBeenCalledWith(`presence:grupo:${grupoB}`);
    });
});

describe("contarEstudandoAgora", () => {
    it("devolve o número da RPC", async () => {
        rpcMock.mockResolvedValue({ data: 42, error: null });
        expect(await contarEstudandoAgora()).toBe(42);
    });

    it("devolve 0 (sem quebrar a tela) quando a RPC falha", async () => {
        rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });
        expect(await contarEstudandoAgora()).toBe(0);
    });

    it("devolve 0 quando a RPC não retorna nada", async () => {
        rpcMock.mockResolvedValue({ data: null, error: null });
        expect(await contarEstudandoAgora()).toBe(0);
    });
});
