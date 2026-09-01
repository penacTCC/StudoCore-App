import { DeviceEventEmitter } from "react-native";

jest.mock("@/lib/cache", () => ({ invalidarCache: jest.fn() }));

/**
 * O módulo guarda "já ligou" numa flag em memória (`ligado`), sem forma de resetar de fora.
 * `jest.resetModules()` + require dinâmico por teste dá a cada teste sua própria instância do
 * módulo, do jeito que o app real só tem uma (criada na subida do app).
 */
function carregarModuloFresco() {
    jest.resetModules();
    const cache = require("@/lib/cache");
    const { ligarInvalidacaoDeCache } = require("@/services/invalidacaoCache");
    return { ligarInvalidacaoDeCache, invalidarCacheMock: cache.invalidarCache as jest.Mock };
}

beforeEach(() => {
    DeviceEventEmitter.removeAllListeners("groupMembershipChanged");
    DeviceEventEmitter.removeAllListeners("badgesUnlocked");
});

describe("ligarInvalidacaoDeCache", () => {
    it("ao mudar a participação num grupo, invalida todas as chaves relacionadas a grupo", () => {
        const { ligarInvalidacaoDeCache, invalidarCacheMock } = carregarModuloFresco();
        ligarInvalidacaoDeCache();

        DeviceEventEmitter.emit("groupMembershipChanged");

        expect(invalidarCacheMock).toHaveBeenCalledWith("meus-grupos");
        expect(invalidarCacheMock).toHaveBeenCalledWith("ranking-horas:");
        expect(invalidarCacheMock).toHaveBeenCalledWith("sessoes-grupo:");
        expect(invalidarCacheMock.mock.calls.length).toBeGreaterThanOrEqual(9);
    });

    it("ao desbloquear uma medalha, invalida só o perfil e as estatísticas", () => {
        const { ligarInvalidacaoDeCache, invalidarCacheMock } = carregarModuloFresco();
        ligarInvalidacaoDeCache();

        DeviceEventEmitter.emit("badgesUnlocked");

        expect(invalidarCacheMock).toHaveBeenCalledWith("perfil-completo:");
        expect(invalidarCacheMock).toHaveBeenCalledWith("estatisticas-perfil");
        expect(invalidarCacheMock).toHaveBeenCalledTimes(2);
    });

    it("chamar mais de uma vez não duplica os listeners (registra uma única vez)", () => {
        const { ligarInvalidacaoDeCache, invalidarCacheMock } = carregarModuloFresco();

        ligarInvalidacaoDeCache();
        ligarInvalidacaoDeCache();
        ligarInvalidacaoDeCache();

        DeviceEventEmitter.emit("badgesUnlocked");

        // Se tivesse registrado 3x, cada invalidarCache seria chamado 3x (6 chamadas no total).
        expect(invalidarCacheMock).toHaveBeenCalledTimes(2);
    });
});
