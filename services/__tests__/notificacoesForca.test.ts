jest.mock("expo-notifications", () => ({
    setNotificationHandler: jest.fn(),
    getPermissionsAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
    scheduleNotificationAsync: jest.fn(),
}));
jest.mock("@/services/pushTokens", () => ({ temPushRemoto: jest.fn() }));

import * as Notifications from "expo-notifications";
import { temPushRemoto } from "@/services/pushTokens";
import { notificarForcaRecebida } from "@/services/notificacoesForca";

const temPushRemotoMock = temPushRemoto as jest.Mock;
const getPermissionsMock = Notifications.getPermissionsAsync as jest.Mock;
const requestPermissionsMock = Notifications.requestPermissionsAsync as jest.Mock;
const scheduleMock = Notifications.scheduleNotificationAsync as jest.Mock;

beforeEach(() => {
    jest.clearAllMocks();
});

describe("notificarForcaRecebida", () => {
    it("não notifica localmente quando o aparelho já recebe push remoto (evita duplicar a mesma força)", async () => {
        temPushRemotoMock.mockReturnValue(true);

        await notificarForcaRecebida("Ana");

        expect(scheduleMock).not.toHaveBeenCalled();
        expect(getPermissionsMock).not.toHaveBeenCalled();
    });

    it("sem push remoto e com permissão já concedida, dispara a notificação local imediatamente", async () => {
        temPushRemotoMock.mockReturnValue(false);
        getPermissionsMock.mockResolvedValue({ status: "granted" });

        await notificarForcaRecebida("Ana");

        expect(requestPermissionsMock).not.toHaveBeenCalled();
        expect(scheduleMock).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.objectContaining({ body: "Ana está te chamando pra estudar." }),
                trigger: null,
            })
        );
    });

    it("sem permissão concedida, pede permissão antes de notificar", async () => {
        temPushRemotoMock.mockReturnValue(false);
        getPermissionsMock.mockResolvedValue({ status: "undetermined" });
        requestPermissionsMock.mockResolvedValue({ status: "granted" });

        await notificarForcaRecebida("Ana");

        expect(requestPermissionsMock).toHaveBeenCalled();
        expect(scheduleMock).toHaveBeenCalled();
    });

    it("permissão negada não dispara notificação nem lança erro", async () => {
        temPushRemotoMock.mockReturnValue(false);
        getPermissionsMock.mockResolvedValue({ status: "denied" });
        requestPermissionsMock.mockResolvedValue({ status: "denied" });

        await expect(notificarForcaRecebida("Ana")).resolves.toBeUndefined();
        expect(scheduleMock).not.toHaveBeenCalled();
    });

    it("é best-effort: uma falha ao agendar não propaga (não pode derrubar quem recebeu a força)", async () => {
        temPushRemotoMock.mockReturnValue(false);
        getPermissionsMock.mockResolvedValue({ status: "granted" });
        scheduleMock.mockRejectedValue(new Error("falha do SO"));

        await expect(notificarForcaRecebida("Ana")).resolves.toBeUndefined();
    });
});
