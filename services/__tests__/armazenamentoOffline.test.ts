jest.mock("@/repositories/supabase", () => ({
    supabase: { auth: { getSession: jest.fn() } },
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/repositories/supabase";
import {
    carregarSnapshotSessao,
    carregarUltimoGrupoLocalmente,
    limparUltimoGrupoLocalmente,
    salvarSnapshotSessao,
    salvarUltimoGrupoLocalmente,
} from "@/services/armazenamentoOffline";
import type { SnapshotSessaoFoco } from "@/types/foco";

const getSessionMock = supabase.auth.getSession as jest.Mock;

const sessaoDe = (userId: string) => ({ data: { session: { user: { id: userId } } } });
const semSessao = { data: { session: null } };

beforeEach(async () => {
    await AsyncStorage.clear();
    getSessionMock.mockReset();
});

describe("snapshot da sessão de foco", () => {
    it("devolve null quando não há nada salvo", async () => {
        expect(await carregarSnapshotSessao()).toBeNull();
    });

    it("preenche os campos que faltam em snapshots antigos com o padrão de 'sem fila'", async () => {
        // Simula um snapshot gravado por uma versão anterior do app, sem fila/fase.
        await AsyncStorage.multiSet([
            ["@focus_session_start_time", "1700000000000"],
            ["@focus_session_data", JSON.stringify({ subject: "Química", content: "Estequiometria" })],
        ]);

        const snapshot = await carregarSnapshotSessao();

        expect(snapshot).toMatchObject({
            subject: "Química",
            content: "Estequiometria",
            fila: [],
            indiceFila: 0,
            fase: "foco",
            isPublic: true,
            modo: "cronometro",
        });
    });

    it("faz o roundtrip completo salvar → carregar", async () => {
        const snapshot: SnapshotSessaoFoco = {
            subject: "Física",
            content: "Cinemática",
            isPublic: false,
            groupId: "g1",
            modo: "pomodoro",
            inicioMs: 1700000000000,
            sessaoId: "s1",
            salaId: null,
            ehConvidado: false,
            fila: [],
            indiceFila: 2,
            fase: "descansoCurto",
            faseInicioMs: 1700000001000,
            faseDuracaoSeg: 300,
            focoAcumuladoSeg: 1200,
            execucaoId: "exec1",
            contexto: null,
            pausado: false,
            pausadoSeg: 0,
            pausadaEmMs: null,
        };

        await salvarSnapshotSessao(snapshot);

        expect(await carregarSnapshotSessao()).toEqual(snapshot);
    });
});

describe("último grupo salvo — não pode vazar entre contas no mesmo aparelho", () => {
    it("não salva nada quando não há sessão (sem dono para carimbar)", async () => {
        getSessionMock.mockResolvedValue(semSessao);

        await salvarUltimoGrupoLocalmente("grupo-1");

        expect(await AsyncStorage.getItem("@last_group_id")).toBeNull();
    });

    it("devolve o grupo salvo quando é a mesma conta que gravou", async () => {
        getSessionMock.mockResolvedValue(sessaoDe("user-a"));

        await salvarUltimoGrupoLocalmente("grupo-1");
        const grupo = await carregarUltimoGrupoLocalmente();

        expect(grupo).toBe("grupo-1");
    });

    it("NÃO devolve o grupo de outra conta que usou o aparelho antes (regressão da sessão fantasma)", async () => {
        getSessionMock.mockResolvedValue(sessaoDe("user-a"));
        await salvarUltimoGrupoLocalmente("grupo-da-conta-a");

        // Troca de conta no mesmo aparelho.
        getSessionMock.mockResolvedValue(sessaoDe("user-b"));
        const grupo = await carregarUltimoGrupoLocalmente();

        expect(grupo).toBeNull();
    });

    it("descarta um registro gravado no formato antigo (id cru, sem JSON, sem dono)", async () => {
        // Versões anteriores gravavam o id do grupo direto, sem JSON.stringify — não é um JSON válido.
        await AsyncStorage.setItem("@last_group_id", "grupo-cru-sem-dono");
        getSessionMock.mockResolvedValue(sessaoDe("user-a"));

        const grupo = await carregarUltimoGrupoLocalmente();

        expect(grupo).toBeNull();
        // E limpa o registro inválido para não tentar de novo a cada leitura.
        expect(await AsyncStorage.getItem("@last_group_id")).toBeNull();
    });

    it("limparUltimoGrupoLocalmente remove o registro", async () => {
        getSessionMock.mockResolvedValue(sessaoDe("user-a"));
        await salvarUltimoGrupoLocalmente("grupo-1");

        await limparUltimoGrupoLocalmente();

        expect(await AsyncStorage.getItem("@last_group_id")).toBeNull();
    });
});
