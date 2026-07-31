export type ToastType = "success" | "error" | "warning" | "info";

export type ToastOptions = {
    title?: string;
    message: string;
    type?: ToastType;
    duration?: number;
};

export type ToastInternal = Required<Pick<ToastOptions, "message" | "type" | "duration">> &
    Pick<ToastOptions, "title"> & { id: string };

type Listener = (toast: ToastInternal) => void;

const listeners = new Set<Listener>();

function emit(options: ToastOptions) {
    const internal: ToastInternal = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: options.type ?? "info",
        duration: options.duration ?? 3500,
        title: options.title,
        message: options.message,
    };
    listeners.forEach((listener) => listener(internal));
}

/** Usado só pelo ToastHost pra ouvir novos toasts; não chamar fora dele. */
export function subscribeToast(listener: Listener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** API imperativa de feedback (toasts), pode ser chamada de qualquer tela, hook ou service. */
export const toast = {
    show: (options: ToastOptions) => emit(options),
    success: (message: string, title?: string, duration?: number) =>
        emit({ type: "success", message, title, duration }),
    error: (message: string, title?: string, duration?: number) =>
        emit({ type: "error", message, title, duration }),
    warning: (message: string, title?: string, duration?: number) =>
        emit({ type: "warning", message, title, duration }),
    info: (message: string, title?: string, duration?: number) =>
        emit({ type: "info", message, title, duration }),
};
