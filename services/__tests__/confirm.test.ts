import { confirm, subscribeConfirm } from "@/services/confirm";

describe("confirm / subscribeConfirm", () => {
    it("notifica os listeners inscritos com os dados do diálogo", () => {
        const listener = jest.fn();
        const unsubscribe = subscribeConfirm(listener);

        confirm({ title: "Excluir?", onConfirm: jest.fn() });

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener.mock.calls[0][0]).toMatchObject({ title: "Excluir?" });

        unsubscribe();
    });

    it("preenche os defaults quando a tela não informa texto de botão/destrutivo", () => {
        const listener = jest.fn();
        subscribeConfirm(listener)();
        // Reassina porque o unsubscribe acima já desliga — precisa de um novo listener.
        const listener2 = jest.fn();
        const unsubscribe = subscribeConfirm(listener2);

        confirm({ title: "Sair do grupo", onConfirm: jest.fn() });

        const dialogo = listener2.mock.calls[0][0];
        expect(dialogo.confirmText).toBe("Confirmar");
        expect(dialogo.cancelText).toBe("Cancelar");
        expect(dialogo.destructive).toBe(false);

        unsubscribe();
    });

    it("gera um id diferente a cada chamada", () => {
        const listener = jest.fn();
        const unsubscribe = subscribeConfirm(listener);

        confirm({ title: "A", onConfirm: jest.fn() });
        confirm({ title: "B", onConfirm: jest.fn() });

        const [primeiro, segundo] = listener.mock.calls.map((chamada) => chamada[0].id);
        expect(primeiro).not.toBe(segundo);

        unsubscribe();
    });

    it("para de notificar depois do unsubscribe", () => {
        const listener = jest.fn();
        const unsubscribe = subscribeConfirm(listener);
        unsubscribe();

        confirm({ title: "Não deveria chegar", onConfirm: jest.fn() });

        expect(listener).not.toHaveBeenCalled();
    });
});
