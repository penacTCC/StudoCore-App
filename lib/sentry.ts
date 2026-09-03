import * as Sentry from "@sentry/react-native";

// Fica desligado até você criar um projeto grátis em sentry.io e colocar o DSN
// no .env (EXPO_PUBLIC_SENTRY_DSN). Sem DSN, isso é um no-op — nada quebra.
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const sentryHabilitado = Boolean(dsn);

export function iniciarSentry() {
    if (!dsn) return;

    Sentry.init({
        dsn,
        enabled: true,
        tracesSampleRate: 0.2,
        // Beta de teste com usuários reais fora do dev: queremos saber de tudo,
        // não só de uma amostra.
        sendDefaultPii: false,
    });
}

export function reportarErro(error: unknown, contexto?: Record<string, unknown>) {
    console.error(error);
    if (!dsn) return;
    Sentry.captureException(error, contexto ? { extra: contexto } : undefined);
}
