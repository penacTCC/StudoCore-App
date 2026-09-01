jest.mock("expo-notifications", () => ({
    getPermissionsAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
    getAllScheduledNotificationsAsync: jest.fn(),
    cancelScheduledNotificationAsync: jest.fn(),
    scheduleNotificationAsync: jest.fn(),
    SchedulableTriggerInputTypes: { DATE: "date" },
}));

jest.mock("@/services/preferencias", () => ({
    preferenciasDoUsuarioAtual: jest.fn(),
}));

import * as Notifications from "expo-notifications";
import { preferenciasDoUsuarioAtual } from "@/services/preferencias";
import { cancelarLembreteDeOfensiva, sincronizarLembreteDeOfensiva } from "@/services/notificacoesOfensiva";
import type { PreferenciasCronograma } from "@/types/cronograma";
import type { Gamificacao } from "@/types/gamificacao";

const prefsMock = preferenciasDoUsuarioAtual as jest.Mock;
const getAllScheduledMock = Notifications.getAllScheduledNotificationsAsync as jest.Mock;
const cancelScheduledMock = Notifications.cancelScheduledNotificationAsync as jest.Mock;
const scheduleMock = Notifications.scheduleNotificationAsync as jest.Mock;
const getPermissionsMock = Notifications.getPermissionsAsync as jest.Mock;
const requestPermissionsMock = Notifications.requestPermissionsAsync as jest.Mock;

const prefsPadrao: PreferenciasCronograma = {
    focoMin: 25,
    descansoCurtoMin: 5,
    descansoLongoMin: 15,
    ciclosAteLongo: 4,
    autoDescanso: true,
    autoFoco: false,
    notificacoesAtivas: true,
    antecedenciaMin: 10,
    avisarFimDeFase: true,
    naoPerturbar: false,
    naoPerturbarInicio: "22:00",
    naoPerturbarFim: "07:00",
    vibrar: true,
    manterTelaLigada: false,
    duracaoPadraoBlocoMin: 50,
    duracaoPadraoDescansoMin: 10,
    contarDescansoComoEstudado: false,
    anotarAposQuiz: true,
    fotoAposSessao: true,
    aparecerNoRanking: true,
    sessaoPublicaPadrao: true,
    feedPublico: false,
};

const gamificacao = (parcial: Partial<Gamificacao>) => parcial as Gamificacao;

beforeEach(() => {
    prefsMock.mockReset();
    getAllScheduledMock.mockReset().mockResolvedValue([]);
    cancelScheduledMock.mockReset();
    scheduleMock.mockReset();
    getPermissionsMock.mockReset().mockResolvedValue({ status: "granted" });
    requestPermissionsMock.mockReset().mockResolvedValue({ status: "denied" });
    prefsMock.mockResolvedValue(prefsPadrao);
});

describe("cancelarLembreteDeOfensiva", () => {
    it("só cancela notificações agendadas do tipo 'ofensiva'", async () => {
        getAllScheduledMock.mockResolvedValue([
            { identifier: "a", content: { data: { tipo: "ofensiva" } } },
            { identifier: "b", content: { data: { tipo: "forca" } } },
        ]);

        await cancelarLembreteDeOfensiva();

        expect(cancelScheduledMock).toHaveBeenCalledTimes(1);
        expect(cancelScheduledMock).toHaveBeenCalledWith("a");
    });
});

describe("sincronizarLembreteDeOfensiva", () => {
    it("não agenda nada sem ofensiva pra perder", async () => {
        await sincronizarLembreteDeOfensiva(gamificacao({ ofensiva: 0 }));
        expect(scheduleMock).not.toHaveBeenCalled();
    });

    it("não agenda nada com notificações desligadas", async () => {
        prefsMock.mockResolvedValue({ ...prefsPadrao, notificacoesAtivas: false });
        await sincronizarLembreteDeOfensiva(gamificacao({ ofensiva: 3 }));
        expect(scheduleMock).not.toHaveBeenCalled();
    });

    it("não agenda nada quando as 20h caem dentro da janela de não perturbar", async () => {
        prefsMock.mockResolvedValue({
            ...prefsPadrao,
            naoPerturbar: true,
            naoPerturbarInicio: "19:00",
            naoPerturbarFim: "23:00",
        });
        await sincronizarLembreteDeOfensiva(gamificacao({ ofensiva: 3 }));
        expect(scheduleMock).not.toHaveBeenCalled();
    });

    it("agenda pra hoje às 20h quando ainda não estudou e são antes das 20h", async () => {
        jest.useFakeTimers().setSystemTime(new Date(2026, 7, 1, 15, 0, 0)); // 1º ago, 15h local

        await sincronizarLembreteDeOfensiva(gamificacao({ ofensiva: 2, ultima_data_estudo: "2026-07-31" }));

        expect(scheduleMock).toHaveBeenCalledTimes(1);
        const disparo: Date = scheduleMock.mock.calls[0][0].trigger.date;
        expect(disparo.getDate()).toBe(1);
        expect(disparo.getHours()).toBe(20);

        jest.useRealTimers();
    });

    it("empurra pra amanhã quando a pessoa já estudou hoje", async () => {
        jest.useFakeTimers().setSystemTime(new Date(2026, 7, 1, 15, 0, 0));

        await sincronizarLembreteDeOfensiva(gamificacao({ ofensiva: 2, ultima_data_estudo: "2026-08-01" }));

        const disparo: Date = scheduleMock.mock.calls[0][0].trigger.date;
        expect(disparo.getDate()).toBe(2); // dia seguinte

        jest.useRealTimers();
    });

    it("empurra pra amanhã quando já passou das 20h e a pessoa ainda não estudou (não dispara atrasado)", async () => {
        jest.useFakeTimers().setSystemTime(new Date(2026, 7, 1, 21, 30, 0));

        await sincronizarLembreteDeOfensiva(gamificacao({ ofensiva: 2, ultima_data_estudo: "2026-07-31" }));

        const disparo: Date = scheduleMock.mock.calls[0][0].trigger.date;
        expect(disparo.getDate()).toBe(2);

        jest.useRealTimers();
    });

    it("não agenda e não lança quando a permissão é negada", async () => {
        getPermissionsMock.mockResolvedValue({ status: "denied" });
        await expect(
            sincronizarLembreteDeOfensiva(gamificacao({ ofensiva: 2 }))
        ).resolves.toBeUndefined();
        expect(scheduleMock).not.toHaveBeenCalled();
    });

    it("nunca lança mesmo se o agendamento falhar (best-effort)", async () => {
        scheduleMock.mockRejectedValue(new Error("falhou"));
        await expect(
            sincronizarLembreteDeOfensiva(gamificacao({ ofensiva: 2 }))
        ).resolves.toBeUndefined();
    });
});
