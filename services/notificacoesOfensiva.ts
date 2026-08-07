import * as Notifications from "expo-notifications";
import { preferenciasDoUsuarioAtual } from "@/services/preferencias";
import { paraDataISO } from "@/utils/tempo";
import type { Gamificacao } from "@/types/gamificacao";

/**
 * "Sua ofensiva está em risco" — o lembrete da noite pra quem ainda não estudou hoje.
 *
 * É LOCAL de propósito, e não push como a força: a decisão depende de "que horas são pra
 * essa pessoa" e "ela já estudou hoje?", duas coisas que o aparelho sabe de graça e que no
 * servidor exigiriam um cron varrendo todo mundo de hora em hora, mais o fuso de cada um.
 *
 * O agendamento é sempre PONTUAL (um disparo, data marcada), nunca recorrente diário: o
 * lembrete só faz sentido se a pessoa não estudou, e isso muda todo dia. Reagendar do zero
 * a cada abertura do app e a cada sessão concluída é mais simples do que manter uma
 * recorrente e ficar cancelando a ocorrência de hoje.
 */

const HORA_DO_LEMBRETE = 20; // 20h local, antes da janela padrão de não perturbar (22h).

function paraMinutosDoDia(hora: string) {
    const [h, m] = hora.split(":").map(Number);
    return h * 60 + m;
}

/** Mesma regra de services/lembretes.ts: a janela pode virar a meia-noite. */
function dentroDoNaoPerturbar(hora: number, minuto: number, inicio: string, fim: string) {
    const alvo = hora * 60 + minuto;
    const inicioMin = paraMinutosDoDia(inicio);
    const fimMin = paraMinutosDoDia(fim);

    return inicioMin <= fimMin ? alvo >= inicioMin && alvo < fimMin : alvo >= inicioMin || alvo < fimMin;
}

async function garantirPermissao(): Promise<boolean> {
    const atual = await Notifications.getPermissionsAsync();
    if (atual.status === "granted") return true;
    const pedido = await Notifications.requestPermissionsAsync();
    return pedido.status === "granted";
}

export async function cancelarLembreteDeOfensiva(): Promise<void> {
    const agendadas = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
        agendadas
            .filter((n) => (n.content.data as Record<string, unknown>)?.tipo === "ofensiva")
            .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
    );
}

function textoDoLembrete(ofensiva: number) {
    return {
        title: `🔥 ${ofensiva} ${ofensiva === 1 ? "dia" : "dias"} seguidos`,
        body:
            ofensiva === 1
                ? "Você começou ontem. Estude hoje pra não voltar à estaca zero."
                : `Sua ofensiva de ${ofensiva} dias acaba à meia-noite. Bora manter?`,
    };
}

/**
 * Cancela o lembrete anterior e agenda o próximo, se fizer sentido.
 *
 * Chamado na abertura do app e ao concluir uma sessão. Silencioso quando não há o que
 * lembrar — sem ofensiva pra perder, notificações desligadas ou permissão negada.
 *
 * Recebe a gamificação já carregada em vez de buscar: quem chama de dentro de
 * `registrarSessaoConcluida` acabou de gravar a linha nova (buscar de novo aqui leria o
 * estado velho, e importar `gamificacao` daqui fecharia um ciclo de imports).
 */
export async function sincronizarLembreteDeOfensiva(gamificacao: Gamificacao | null): Promise<void> {
    try {
        await cancelarLembreteDeOfensiva();

        const prefs = await preferenciasDoUsuarioAtual();
        if (!prefs.notificacoesAtivas) return;

        // Nada a perder ainda: cobrar ofensiva de quem nunca estudou é só barulho.
        const ofensiva = gamificacao?.ofensiva ?? 0;
        if (ofensiva < 1) return;

        if (
            prefs.naoPerturbar &&
            dentroDoNaoPerturbar(HORA_DO_LEMBRETE, 0, prefs.naoPerturbarInicio, prefs.naoPerturbarFim)
        ) {
            return;
        }

        const agora = new Date();
        const estudouHoje = gamificacao?.ultima_data_estudo === paraDataISO(agora);

        const disparo = new Date(agora);
        disparo.setHours(HORA_DO_LEMBRETE, 0, 0, 0);

        /*
          Se já estudou hoje, o lembrete de hoje não tem função — o próximo alvo é amanhã.
          E se ainda não estudou mas já passou das 20h, também vai pra amanhã: disparar
          agora, atrasado, é a notificação que a pessoa lê pensando "eu sei, obrigado".
          Nos dois casos o app reagenda quando for aberto de novo.
        */
        if (estudouHoje || disparo.getTime() <= agora.getTime()) {
            disparo.setDate(disparo.getDate() + 1);
        }

        if (!(await garantirPermissao())) return;

        await Notifications.scheduleNotificationAsync({
            content: {
                ...textoDoLembrete(ofensiva),
                data: { tipo: "ofensiva" },
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: disparo,
            },
        });
    } catch (erro) {
        // Best-effort: um lembrete que não agendou não pode atrapalhar a abertura do app
        // nem o fim de uma sessão de estudo.
        console.warn("Erro ao agendar lembrete de ofensiva:", erro);
    }
}
