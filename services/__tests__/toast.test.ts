import { subscribeToast, toast } from "@/services/toast";

describe("toast", () => {
    it("entrega o toast a todos os listeners inscritos", () => {
        const listener = jest.fn();
        subscribeToast(listener);

        toast.success("Salvo com sucesso");

        expect(listener).toHaveBeenCalledWith(
            expect.objectContaining({ type: "success", message: "Salvo com sucesso", duration: 3500 })
        );
    });

    it("para de entregar depois de cancelar a inscrição", () => {
        const listener = jest.fn();
        const cancelar = subscribeToast(listener);
        cancelar();

        toast.error("Algo deu errado");

        expect(listener).not.toHaveBeenCalled();
    });

    it("cada tipo (success/error/warning/info) preenche o 'type' certo", () => {
        const listener = jest.fn();
        subscribeToast(listener);

        toast.warning("aviso");
        toast.info("informação");

        expect(listener).toHaveBeenNthCalledWith(1, expect.objectContaining({ type: "warning" }));
        expect(listener).toHaveBeenNthCalledWith(2, expect.objectContaining({ type: "info" }));
    });

    it("toast.show respeita type e duration explícitos, sem cair no default", () => {
        const listener = jest.fn();
        subscribeToast(listener);

        toast.show({ message: "customizado", type: "error", duration: 1000, title: "Ops" });

        expect(listener).toHaveBeenCalledWith(
            expect.objectContaining({ type: "error", duration: 1000, title: "Ops", message: "customizado" })
        );
    });

    it("usa 'info' como type padrão quando nenhum é informado", () => {
        const listener = jest.fn();
        subscribeToast(listener);

        toast.show({ message: "sem tipo" });

        expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: "info" }));
    });

    it("gera um id diferente a cada toast", () => {
        const listener = jest.fn();
        subscribeToast(listener);

        toast.info("primeiro");
        toast.info("segundo");

        const [primeiraChamada, segundaChamada] = listener.mock.calls;
        expect(primeiraChamada[0].id).not.toBe(segundaChamada[0].id);
    });
});
