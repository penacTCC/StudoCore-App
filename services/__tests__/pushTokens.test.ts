jest.mock("@/repositories/supabase", () => ({
    supabase: { from: jest.fn() },
}));

jest.mock("expo-notifications", () => ({
    getPermissionsAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
    setNotificationChannelAsync: jest.fn(),
    getExpoPushTokenAsync: jest.fn(),
    AndroidImportance: { HIGH: 4, DEFAULT: 3 },
}));

jest.mock("expo-constants", () => ({
    __esModule: true,
    default: { expoConfig: { extra: { eas: { projectId: "projeto-teste" } } }, easConfig: {} },
}));

import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { supabase } from "@/repositories/supabase";
import { criarQueryBuilderMock } from "@/test/helpers/supabaseQueryMock";
import { registrarTokenPush, removerTokenPush, temPushRemoto } from "@/services/pushTokens";

const fromMock = supabase.from as jest.Mock;
const getPermissionsAsyncMock = Notifications.getPermissionsAsync as jest.Mock;
const requestPermissionsAsyncMock = Notifications.requestPermissionsAsync as jest.Mock;
const getExpoPushTokenAsyncMock = Notifications.getExpoPushTokenAsync as jest.Mock;

beforeEach(() => {
    fromMock.mockReset();
    getPermissionsAsyncMock.mockReset();
    requestPermissionsAsyncMock.mockReset();
    getExpoPushTokenAsyncMock.mockReset();
    (Constants as any).expoConfig = { extra: { eas: { projectId: "projeto-teste" } } };
});

describe("registrarTokenPush", () => {
    it("não registra nada quando a permissão é negada", async () => {
        getPermissionsAsyncMock.mockResolvedValue({ status: "denied" });
        requestPermissionsAsyncMock.mockResolvedValue({ status: "denied" });

        await registrarTokenPush("u1");

        expect(getExpoPushTokenAsyncMock).not.toHaveBeenCalled();
        expect(fromMock).not.toHaveBeenCalled();
        expect(temPushRemoto()).toBe(false);
    });

    it("não registra nada quando falta o projectId do EAS", async () => {
        getPermissionsAsyncMock.mockResolvedValue({ status: "granted" });
        (Constants as any).expoConfig = { extra: {} };
        (Constants as any).easConfig = undefined;

        await registrarTokenPush("u1");

        expect(getExpoPushTokenAsyncMock).not.toHaveBeenCalled();
        expect(fromMock).not.toHaveBeenCalled();
    });

    it("salva o token no banco e passa a reportar push remoto ativo", async () => {
        getPermissionsAsyncMock.mockResolvedValue({ status: "granted" });
        getExpoPushTokenAsyncMock.mockResolvedValue({ data: "token-abc" });
        const upsertMock = jest.fn(() => Promise.resolve({ error: null }));
        fromMock.mockReturnValue({ upsert: upsertMock });

        await registrarTokenPush("u1");

        expect(upsertMock).toHaveBeenCalledWith(
            expect.objectContaining({ user_id: "u1", expo_push_token: "token-abc" }),
            { onConflict: "user_id" }
        );
        expect(temPushRemoto()).toBe(true);
    });

    it("não propaga exceção quando getExpoPushTokenAsync falha (emulador sem Play Services etc.)", async () => {
        getPermissionsAsyncMock.mockResolvedValue({ status: "granted" });
        getExpoPushTokenAsyncMock.mockRejectedValue(new Error("sem Play Services"));

        await expect(registrarTokenPush("u1")).resolves.toBeUndefined();
    });
});

describe("removerTokenPush", () => {
    it("apaga o token da conta e volta a reportar push remoto inativo", async () => {
        getPermissionsAsyncMock.mockResolvedValue({ status: "granted" });
        getExpoPushTokenAsyncMock.mockResolvedValue({ data: "token-abc" });
        fromMock.mockReturnValue({ upsert: jest.fn(() => Promise.resolve({ error: null })) });
        await registrarTokenPush("u1");
        expect(temPushRemoto()).toBe(true);

        const deleteBuilder = criarQueryBuilderMock({ data: null, error: null });
        fromMock.mockReturnValue(deleteBuilder);

        await removerTokenPush("u1");

        expect(deleteBuilder.eq).toHaveBeenCalledWith("user_id", "u1");
        expect(temPushRemoto()).toBe(false);
    });
});
