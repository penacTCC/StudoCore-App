import { MENSAGEM_DE_LIMITE } from "@/services/assinatura";

export type PaywallProOptions = {
    recurso?: string;
    mensagem?: string;
};

type Listener = (options: PaywallProOptions) => void;

const listeners = new Set<Listener>();

export function subscribePaywallPro(listener: Listener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export const paywallPro = {
    show: (options: PaywallProOptions = {}) => {
        listeners.forEach((listener) => listener(options));
    },
};

const MENSAGENS_DE_LIMITE = new Set<string>(Object.values(MENSAGEM_DE_LIMITE));

export function mostrarPaywallProSeLimite(mensagem: string | null | undefined): boolean {
    if (!mensagem || !MENSAGENS_DE_LIMITE.has(mensagem)) return false;
    paywallPro.show({ mensagem });
    return true;
}
