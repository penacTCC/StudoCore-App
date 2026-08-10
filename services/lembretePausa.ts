import * as Notifications from "expo-notifications";

import { preferenciasDoUsuarioAtual } from "@/services/preferencias";
import { dentroDoNaoPerturbar } from "@/utils/tempo";

/**
 * "Seu cronômetro está parado" — o cutucão de quem pausou e esqueceu.
 *
 * O caso real é sempre o mesmo: a pessoa pausa para pegar água, abre outro app e a sessão
 * fica aberta a tarde inteira. A sessão em si não se perde (o tempo de foco está
 * congelado desde a pausa, e a recuperação de sessões abandonadas fecha o que passar de
 * HORAS_ATE_ABANDONO), mas ela também não vira estudo — e a pessoa só descobre isso
 * quando volta.
 *
 * É notificação LOCAL, e não push, porque quem sabe da pausa é o aparelho: o banco
 * registra `status = 'pausado'`, mas nada no servidor fica contando quanto tempo faz. Um
 * cron varrendo sessões pausadas de todo mundo resolveria o mesmo problema custando
 * infinitamente mais.
 *
 * Também é notificação e nada mais: não entra na caixa de notificações. A caixa guarda o
 * que outras pessoas fizeram com as suas coisas; isto é um recado do app para você,
 * válido por trinta minutos e inútil depois disso.
 *
 * O agendamento aguenta o app ser fechado — quem dispara é o sistema operacional, não um
 * `setTimeout` desta tela. Por isso o par cancelar/agendar tem de ser fiel: toda saída da
 * pausa (retomar, encerrar, trocar de fase) precisa cancelar, senão o lembrete chega com
 * a pessoa estudando.
 */

const MINUTOS_ATE_LEMBRAR = 30;

/** Marca as notificações deste serviço, para cancelar sem tocar nas dos outros. */
const TIPO = "pausa";

async function garantirPermissao(): Promise<boolean> {
    const atual = await Notifications.getPermissionsAsync();
    if (atual.status === "granted") return true;
    const pedido = await Notifications.requestPermissionsAsync();
    return pedido.status === "granted";
}

export async function cancelarLembreteDePausa(): Promise<void> {
    try {
        const agendadas = await Notifications.getAllScheduledNotificationsAsync();
        await Promise.all(
            agendadas
                .filter((n) => (n.content.data as Record<string, unknown>)?.tipo === TIPO)
                .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
        );
    } catch (erro) {
        console.warn("Erro ao cancelar lembrete de pausa:", erro);
    }
}

/**
 * Agenda o lembrete para 30 minutos depois do início da pausa.
 *
 * `pausadaEmMs` é quando a pausa começou. Passar isso (em vez de contar sempre 30 minutos
 * a partir de agora) é o que faz a restauração de sessão acertar: reabrir o app com uma
 * pausa de 25 minutos deve lembrar em 5, não em 30. Pausa que já passou da hora não
 * agenda nada — disparar atrasado é a notificação que a pessoa lê já olhando para a tela.
 *
 * Cancela antes de agendar, então chamar duas vezes não gera dois lembretes.
 */
export async function agendarLembreteDePausa(pausadaEmMs?: number | null): Promise<void> {
    try {
        await cancelarLembreteDePausa();

        const prefs = await preferenciasDoUsuarioAtual();
        if (!prefs.notificacoesAtivas) return;

        const inicio = pausadaEmMs ?? Date.now();
        const disparo = new Date(inicio + MINUTOS_ATE_LEMBRAR * 60_000);

        const faltaSeg = Math.round((disparo.getTime() - Date.now()) / 1000);
        if (faltaSeg <= 0) return;

        if (
            prefs.naoPerturbar &&
            dentroDoNaoPerturbar(
                disparo.getHours(),
                disparo.getMinutes(),
                prefs.naoPerturbarInicio,
                prefs.naoPerturbarFim
            )
        ) {
            return;
        }

        if (!(await garantirPermissao())) return;

        await Notifications.scheduleNotificationAsync({
            content: {
                title: "⏸️ Cronômetro parado",
                body: "Sua sessão está pausada há 30 minutos. Volta pro foco ou encerra por aqui?",
                data: { tipo: TIPO },
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: disparo,
            },
        });
    } catch (erro) {
        // Best-effort, como os outros lembretes: falhar aqui não pode atrapalhar a pausa.
        console.warn("Erro ao agendar lembrete de pausa:", erro);
    }
}
