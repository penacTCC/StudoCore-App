export type ConfirmOptions = {
    title: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    destructive?: boolean;
    onConfirm: () => void | Promise<void>;
    onCancel?: () => void;
};

export type ConfirmInternal = Required<
    Pick<ConfirmOptions, "title" | "confirmText" | "cancelText" | "destructive" | "onConfirm">
> &
    Pick<ConfirmOptions, "message" | "onCancel"> & { id: string };

type Listener = (dialog: ConfirmInternal) => void;

const listeners = new Set<Listener>();

/** Usado só pelo ConfirmDialogHost pra ouvir novos pedidos; não chamar fora dele. */
export function subscribeConfirm(listener: Listener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** Substitui os Alert.alert de confirmação (Cancelar + ação) por um modal no visual HADES. */
export function confirm(options: ConfirmOptions) {
    const internal: ConfirmInternal = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: options.title,
        message: options.message,
        confirmText: options.confirmText ?? "Confirmar",
        cancelText: options.cancelText ?? "Cancelar",
        destructive: options.destructive ?? false,
        onConfirm: options.onConfirm,
        onCancel: options.onCancel,
    };
    listeners.forEach((listener) => listener(internal));
}
