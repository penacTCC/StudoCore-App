import * as Notifications from "expo-notifications";
import { preferenciasDoUsuarioAtual } from "@/services/preferencias";

/**
 * "Seu Wrapped do mês chegou" — o push que avisa no dia 1 que o resumo do mês fechado
 * está pronto (ver lib/wrappedMensal.ts pra janela de acesso e app/(modals)/wrapped-mensal.tsx
 * pra tela).
 *
 * Ao contrário do lembrete de ofensiva, este é RECORRENTE (trigger MONTHLY): a data é
 * sempre a mesma (dia 1, 9h) e não depende de nenhum dado do usuário, então não precisa
 * ser recalculado a cada abertura do app — só (re)agendado quando a permissão ou a
 * preferência de notificações pode ter mudado.
 */

const HORA_DO_WRAPPED = 9;

async function garantirPermissao(): Promise<boolean> {
    const atual = await Notifications.getPermissionsAsync();
    if (atual.status === "granted") return true;
    const pedido = await Notifications.requestPermissionsAsync();
    return pedido.status === "granted";
}

export async function cancelarLembreteWrapped(): Promise<void> {
    const agendadas = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
        agendadas
            .filter((n) => (n.content.data as Record<string, unknown>)?.tipo === "wrapped")
            .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
    );
}

/** Cancela o agendamento anterior e recria o recorrente, se notificações estiverem ligadas. */
export async function sincronizarLembreteWrapped(): Promise<void> {
    try {
        await cancelarLembreteWrapped();

        const prefs = await preferenciasDoUsuarioAtual();
        if (!prefs.notificacoesAtivas) return;
        if (!(await garantirPermissao())) return;

        await Notifications.scheduleNotificationAsync({
            content: {
                title: "🎉 Seu Wrapped do mês chegou",
                body: "O resumo dos seus estudos do mês passado já está pronto — disponível só até o dia 3.",
                data: { tipo: "wrapped" },
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
                day: 1,
                hour: HORA_DO_WRAPPED,
                minute: 0,
            },
        });
    } catch (erro) {
        // Best-effort: um lembrete que não agendou não pode atrapalhar a abertura do app.
        console.warn("Erro ao agendar lembrete do Wrapped:", erro);
    }
}
