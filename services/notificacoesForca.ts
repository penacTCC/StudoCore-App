import * as Notifications from "expo-notifications";

/**
 * Notificação local do "mandar força".
 *
 * É local de propósito: push remoto (Expo Push / FCM) exigiria credenciais do Firebase no
 * Android, que este projeto não usa. Em vez disso, quem recebe a força escuta o INSERT em
 * `incentivos` por Realtime (ver services/incentivos.ts -> observarForcasRecebidas) e o
 * próprio aparelho dispara a notificação. Sem Firebase, sem token, sem tabela extra.
 *
 * Limite conhecido: só dispara com o app rodando (em primeiro plano ou recém-mandado pra
 * segundo plano, enquanto o socket do Realtime sobrevive). Com o app fechado, a força
 * continua sendo registrada e aparece na torcida quando a pessoa abrir o app.
 */

// Necessário pra notificação aparecer com o app aberto (sem isso ela chega, mas silenciosa).
// Fica aqui, e não numa tela, porque este módulo é carregado no _layout (via
// hooks/useForcasRecebidas) — ou seja, sempre, independente de qual aba a pessoa abriu.
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

async function garantirPermissao(): Promise<boolean> {
    const atual = await Notifications.getPermissionsAsync();
    if (atual.status === "granted") return true;
    const pedido = await Notifications.requestPermissionsAsync();
    return pedido.status === "granted";
}

/**
 * Mostra "fulano está te chamando pra estudar" no aparelho de quem recebeu a força.
 * Best-effort: permissão negada ou qualquer falha aqui não pode quebrar nada — a força
 * em si já está registrada no banco.
 */
export async function notificarForcaRecebida(nomeRemetente: string): Promise<void> {
    try {
        if (!(await garantirPermissao())) return;

        await Notifications.scheduleNotificationAsync({
            content: {
                title: "💪 Hora de focar!",
                body: `${nomeRemetente} está te chamando pra estudar.`,
                data: { tipo: "forca" },
            },
            // `trigger: null` = dispara agora, mesmo formato do aviso de materiais do Vault
            // em app/(tabs)/focus.tsx, que já funciona nos aparelhos do time.
            trigger: null,
        });
    } catch (erro) {
        console.warn("Erro ao notificar força recebida:", erro);
    }
}
