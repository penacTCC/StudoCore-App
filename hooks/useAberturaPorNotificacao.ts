import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";

/**
 * Leva a pessoa ao lugar certo quando ela TOCA numa notificação do sistema.
 *
 * Sem isto, tocar num "fulano curtiu sua foto" abre o app na última tela em que ele
 * estava — o que faz a notificação parecer quebrada.
 *
 * Vão para a caixa de notificações as que TÊM linha lá: curtida, comentário e força. A de
 * sala aberta fica de fora de propósito — o push dela já carrega `salaId`/`grupoId`, e o
 * destino certo é a sala, não uma lista falando dela. Enquanto essa rota não existe, ela
 * abre o app onde estava, que é melhor do que um desvio para a lista.
 *
 * Depende do `userId` de propósito: com o app fechado, o toque chega antes de a sessão
 * ser restaurada, e navegar nesse instante brigaria com o roteamento de entrada
 * (ver useRouteGuard).
 */
export function useAberturaPorNotificacao(userId: string | null | undefined) {
    // O toque que abriu o app fica guardado pelo sistema e é devolvido em toda montagem.
    // Sem esta trava, voltar da caixa e remontar o layout abriria a caixa de novo.
    const jaTratouAbertura = useRef(false);

    useEffect(() => {
        if (!userId) return;

        const abrir = (resposta: Notifications.NotificationResponse | null) => {
            const dados = resposta?.notification?.request?.content?.data as
                | { tipo?: string }
                | undefined;
            if (dados?.tipo !== "comunidade" && dados?.tipo !== "forca") return;
            router.push("/(modals)/notificacoes");
        };

        if (!jaTratouAbertura.current) {
            jaTratouAbertura.current = true;
            Notifications.getLastNotificationResponseAsync().then(abrir).catch(() => {});
        }

        const inscricao = Notifications.addNotificationResponseReceivedListener(abrir);
        return () => inscricao.remove();
    }, [userId]);
}
