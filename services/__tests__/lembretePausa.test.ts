jest.mock("expo-notifications", () => ({
    getPermissionsAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
    scheduleNotificationAsync: jest.fn(),
    getAllScheduledNotificationsAsync: jest.fn(),
    cancelScheduledNotificationAsync: jest.fn(),
    SchedulableTriggerInputTypes: { DATE: "date" },
}));
jest.mock("@/services/preferencias", () => ({ preferenciasDoUsuarioAtual: jest.fn() }));

import * as Notifications from "expo-notifications";
import { preferenciasDoUsuarioAtual } from "@/services/preferencias";
import { agendarLembreteDePausa, cancelarLembreteDePausa } from "@/services/lembretePausa";

const prefsMock = preferenciasDoUsuarioAtual as jest.Mock;
const getPermissionsMock = Notifications.getPermissionsAsync as jest.Mock;
const scheduleMock = Notifications.scheduleNotificationAsync as jest.Mock;
const getAllScheduledMock = Notifications.getAllScheduledNotificationsAsync as jest.Mock;
const cancelMock = Notifications.cancelScheduledNotificationAsync as jest.Mock;

const PREFS_PADRAO = {
    notificacoesAtivas: true,
    naoPerturbar: false,
    naoPerturbarInicio: "22:00",
    naoPerturbarFim: "07:00",
};

beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    prefsMock.mockResolvedValue(PREFS_PADRAO);
    getPermissionsMock.mockResolvedValue({ status: "granted" });
    getAllScheduledMock.mockResolvedValue([]);
});

afterEach(() => {
    jest.useRealTimers();
});

describe("agendarLembreteDePausa", () => {
    it("agenda o disparo 30 minutos após o início da pausa", async () => {
        jest.setSystemTime(new Date("2026-08-01T12:00:00.000Z"));

        await agendarLembreteDePausa(Date.now());

        expect(scheduleMock).toHaveBeenCalledWith(
            expect.objectContaining({
                trigger: expect.objectContaining({ date: new Date("2026-08-01T12:30:00.000Z") }),
            })
        );
    });

    it("uma pausa que já durou parte do tempo agenda só o restante (não reinicia os 30 min)", async () => {
        jest.setSystemTime(new Date("2026-08-01T12:25:00.000Z"));
        const pausadaEm = new Date("2026-08-01T12:00:00.000Z").getTime(); // pausou 25min atrás

        await agendarLembreteDePausa(pausadaEm);

        expect(scheduleMock).toHaveBeenCalledWith(
            expect.objectContaining({
                trigger: expect.objectContaining({ date: new Date("2026-08-01T12:30:00.000Z") }),
            })
        );
    });

    it("não agenda nada quando a pausa já passou dos 30 minutos (disparo no passado)", async () => {
        jest.setSystemTime(new Date("2026-08-01T13:00:00.000Z"));
        const pausadaEm = new Date("2026-08-01T12:00:00.000Z").getTime(); // 60min atrás

        await agendarLembreteDePausa(pausadaEm);

        expect(scheduleMock).not.toHaveBeenCalled();
    });

    it("não agenda quando as notificações estão desligadas nas preferências", async () => {
        prefsMock.mockResolvedValue({ ...PREFS_PADRAO, notificacoesAtivas: false });

        await agendarLembreteDePausa(Date.now());

        expect(scheduleMock).not.toHaveBeenCalled();
    });

    it("não agenda quando o disparo cairia dentro da janela de não perturbar", async () => {
        // Pausa às 21:45 -> disparo às 22:15, dentro de 22:00-07:00.
        jest.setSystemTime(new Date("2026-08-01T21:45:00.000-03:00"));
        prefsMock.mockResolvedValue({ ...PREFS_PADRAO, naoPerturbar: true });

        await agendarLembreteDePausa(Date.now());

        expect(scheduleMock).not.toHaveBeenCalled();
    });

    it("não agenda sem permissão de notificação", async () => {
        getPermissionsMock.mockResolvedValue({ status: "denied" });
        jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({ status: "denied" } as any);

        await agendarLembreteDePausa(Date.now());

        expect(scheduleMock).not.toHaveBeenCalled();
    });

    it("cancela qualquer lembrete de pausa anterior antes de agendar (chamar duas vezes não duplica)", async () => {
        getAllScheduledMock.mockResolvedValue([
            { identifier: "antigo", content: { data: { tipo: "pausa" } } },
            { identifier: "de-outro-tipo", content: { data: { tipo: "rotina" } } },
        ]);

        await agendarLembreteDePausa(Date.now());

        expect(cancelMock).toHaveBeenCalledWith("antigo");
        expect(cancelMock).not.toHaveBeenCalledWith("de-outro-tipo");
    });

    it("é best-effort: erro inesperado não propaga", async () => {
        prefsMock.mockRejectedValue(new Error("boom"));

        await expect(agendarLembreteDePausa(Date.now())).resolves.toBeUndefined();
    });
});

describe("cancelarLembreteDePausa", () => {
    it("cancela só as notificações marcadas com tipo 'pausa'", async () => {
        getAllScheduledMock.mockResolvedValue([
            { identifier: "1", content: { data: { tipo: "pausa" } } },
            { identifier: "2", content: { data: { tipo: "rotina" } } },
            { identifier: "3", content: { data: { tipo: "pausa" } } },
        ]);

        await cancelarLembreteDePausa();

        expect(cancelMock).toHaveBeenCalledWith("1");
        expect(cancelMock).toHaveBeenCalledWith("3");
        expect(cancelMock).not.toHaveBeenCalledWith("2");
    });
});
