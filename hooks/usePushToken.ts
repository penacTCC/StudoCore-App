import { useEffect } from "react";
import { registrarTokenPush } from "@/services/pushTokens";

/**
 * Registra o token de push deste aparelho na conta logada, uma vez por sessão.
 *
 * Roda no _layout junto com [useForcasRecebidas]: os dois são as duas metades do mesmo
 * recurso — este garante o push remoto (chega com o app fechado) e o outro cobre o caso de
 * o token não ter saído, caindo na notificação local pelo Realtime.
 *
 * É best-effort de propósito: `registrarTokenPush` engole os próprios erros, então nada
 * aqui bloqueia ou atrasa a abertura do app.
 */
export function usePushToken(userId: string | null | undefined) {
    useEffect(() => {
        if (!userId) return;
        registrarTokenPush(userId);
    }, [userId]);
}
