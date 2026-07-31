import * as Notifications from "expo-notifications";
import { supabase } from "@/repositories/supabase";
import type { BlocoPlano, BlocoRotina } from "@/types/cronograma";

const CANAL_ANDROID = "lembretes-cronograma";

let canalCriado = false;
async function garantirCanalAndroid() {
    if (canalCriado) return;
    canalCriado = true;
    await Notifications.setNotificationChannelAsync(CANAL_ANDROID, {
        name: "Lembretes do cronograma",
        importance: Notifications.AndroidImportance.HIGH,
    });
}

async function garantirPermissao(): Promise<boolean> {
    const atual = await Notifications.getPermissionsAsync();
    if (atual.status === "granted") return true;
    const pedido = await Notifications.requestPermissionsAsync();
    return pedido.status === "granted";
}

async function nomeDaMateria(materiaId: string | null): Promise<string | null> {
    if (!materiaId) return null;
    const { data } = await supabase
        .from("materias_usuario")
        .select("nome_exibicao")
        .eq("id", materiaId)
        .maybeSingle();
    return (data as { nome_exibicao: string } | null)?.nome_exibicao ?? null;
}

/** 0 = segunda ... 6 = domingo -> weekday do expo-notifications (1 = domingo ... 7 = sábado). */
function paraDisparoSemanal(diaSemana: number, horaInicio: string, antecedenciaMin: number) {
    const [h, m] = horaInicio.split(":").map(Number);
    let totalMin = h * 60 + m - antecedenciaMin;
    let dia = diaSemana;
    if (totalMin < 0) {
        totalMin += 1440;
        dia = (diaSemana + 6) % 7;
    }
    return {
        weekday: ((dia + 1) % 7) + 1,
        hour: Math.floor(totalMin / 60),
        minute: totalMin % 60,
    };
}

function calcularDataDisparo(dataISO: string, horaInicio: string, antecedenciaMin: number): Date {
    const [ano, mes, dia] = dataISO.split("-").map(Number);
    const [h, m] = horaInicio.split(":").map(Number);
    const data = new Date(ano, mes - 1, dia, h, m, 0, 0);
    data.setMinutes(data.getMinutes() - antecedenciaMin);
    return data;
}

async function cancelarPorFiltro(filtro: (dados: Record<string, unknown>) => boolean) {
    const agendadas = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
        agendadas
            .filter((n) => filtro((n.content.data as Record<string, unknown>) ?? {}))
            .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
    );
}

function tituloECorpo(materia: string | null, topico: string | null, antecedenciaMin: number) {
    return {
        title: materia ? `📚 ${materia}` : "📚 Hora de estudar",
        body: topico
            ? `${topico} começa em ${antecedenciaMin} min`
            : `Seu bloco de estudo começa em ${antecedenciaMin} min`,
    };
}

/** Cancela (se houver) e reagenda o lembrete recorrente semanal de um bloco da rotina. */
export async function sincronizarLembreteRotina(bloco: BlocoRotina): Promise<void> {
    await cancelarLembreteRotina(bloco.id);
    if (!bloco.notificar || !bloco.antecedencia_min || bloco.tipo !== "estudo") return;
    if (!(await garantirPermissao())) return;
    await garantirCanalAndroid();

    const materia = await nomeDaMateria(bloco.materia_id);
    const { weekday, hour, minute } = paraDisparoSemanal(bloco.dia_semana, bloco.hora_inicio, bloco.antecedencia_min);

    await Notifications.scheduleNotificationAsync({
        content: {
            ...tituloECorpo(materia, bloco.topico, bloco.antecedencia_min),
            data: { tipo: "rotina", blocoId: bloco.id },
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday,
            hour,
            minute,
            channelId: CANAL_ANDROID,
        },
    });
}

export async function cancelarLembreteRotina(blocoId: string): Promise<void> {
    await cancelarPorFiltro((d) => d.tipo === "rotina" && d.blocoId === blocoId);
}

/**
 * Reagenda os lembretes de todos os blocos de um plano, de acordo com a agenda
 * atual dele: 'data' -> um disparo pontual; 'fixado' -> recorrente nos dias
 * marcados; 'nenhuma' -> nenhum lembrete (plano ainda não está em vigor).
 */
export async function sincronizarLembretesPlano(
    plano: {
        id: string;
        agenda_tipo: "fixado" | "data" | "nenhuma";
        agenda_dias: number[] | null;
        agenda_data: string | null;
    },
    blocos: BlocoPlano[]
): Promise<void> {
    await cancelarLembretesPlano(
        plano.id,
        blocos.map((b) => b.id)
    );

    if (plano.agenda_tipo === "nenhuma") return;

    const blocosNotificaveis = blocos.filter((b) => b.notificar && b.antecedencia_min && b.tipo === "estudo");
    if (blocosNotificaveis.length === 0) return;
    if (!(await garantirPermissao())) return;
    await garantirCanalAndroid();

    for (const bloco of blocosNotificaveis) {
        const materia = await nomeDaMateria(bloco.materia_id);
        const conteudo = tituloECorpo(materia, bloco.topico, bloco.antecedencia_min!);

        if (plano.agenda_tipo === "data" && plano.agenda_data) {
            const disparo = calcularDataDisparo(plano.agenda_data, bloco.hora_inicio, bloco.antecedencia_min!);
            if (disparo.getTime() <= Date.now()) continue; // já passou — não agenda no passado

            await Notifications.scheduleNotificationAsync({
                content: { ...conteudo, data: { tipo: "plano", blocoId: bloco.id } },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: disparo,
                    channelId: CANAL_ANDROID,
                },
            });
        } else if (plano.agenda_tipo === "fixado" && plano.agenda_dias) {
            for (const dia of plano.agenda_dias) {
                const { weekday, hour, minute } = paraDisparoSemanal(dia, bloco.hora_inicio, bloco.antecedencia_min!);
                await Notifications.scheduleNotificationAsync({
                    content: { ...conteudo, data: { tipo: "plano", blocoId: bloco.id } },
                    trigger: {
                        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
                        weekday,
                        hour,
                        minute,
                        channelId: CANAL_ANDROID,
                    },
                });
            }
        }
    }
}

export async function cancelarLembretesPlano(planoId: string, blocoIds: string[]): Promise<void> {
    const idsSet = new Set(blocoIds);
    await cancelarPorFiltro((d) => d.tipo === "plano" && idsSet.has(d.blocoId as string));
}
