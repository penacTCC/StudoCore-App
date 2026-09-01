jest.mock("@/services/sessions", () => ({
    contarSessoesPendentes: jest.fn(),
}));

import { contarSessoesPendentes } from "@/services/sessions";
import {
    assinarFormulariosPendentes,
    carregarFormulariosPendentes,
    definirFormulariosPendentes,
    obterFormulariosPendentes,
} from "@/services/formulariosPendentes";

const contarMock = contarSessoesPendentes as jest.Mock;

beforeEach(() => {
    contarMock.mockReset();
    definirFormulariosPendentes(0); // reseta o estado global do módulo entre os testes
});

describe("definirFormulariosPendentes / obterFormulariosPendentes", () => {
    it("guarda o valor e devolve pelo getter", () => {
        definirFormulariosPendentes(3);
        expect(obterFormulariosPendentes()).toBe(3);
    });

    it("não notifica os listeners quando o valor não muda (evita re-render à toa)", () => {
        definirFormulariosPendentes(2);
        const listener = jest.fn();
        assinarFormulariosPendentes(listener)();
        const listener2 = jest.fn();
        const unsubscribe = assinarFormulariosPendentes(listener2);

        definirFormulariosPendentes(2);

        expect(listener2).not.toHaveBeenCalled();
        unsubscribe();
    });

    it("notifica os listeners quando o valor muda", () => {
        const listener = jest.fn();
        const unsubscribe = assinarFormulariosPendentes(listener);

        definirFormulariosPendentes(5);

        expect(listener).toHaveBeenCalledWith(5);
        unsubscribe();
    });
});

describe("carregarFormulariosPendentes", () => {
    it("define a contagem vinda do banco", async () => {
        contarMock.mockResolvedValue({ count: 4, error: null });

        await carregarFormulariosPendentes("user-1");

        expect(obterFormulariosPendentes()).toBe(4);
    });

    it("usa 0 quando a contagem vem nula", async () => {
        contarMock.mockResolvedValue({ count: null, error: null });

        await carregarFormulariosPendentes("user-1");

        expect(obterFormulariosPendentes()).toBe(0);
    });

    it("não altera a contagem quando a busca falha", async () => {
        definirFormulariosPendentes(7);
        contarMock.mockResolvedValue({ count: null, error: { message: "falhou" } });

        await carregarFormulariosPendentes("user-1");

        expect(obterFormulariosPendentes()).toBe(7);
    });
});
