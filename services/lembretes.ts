import * as Notifications from "expo-notifications";
import { supabase } from "@/repositories/supabase";
import { dentroDoNaoPerturbar } from "@/utils/tempo";
import { preferenciasDoUsuarioAtual } from "@/services/preferencias";
import { diaSemanaDe } from "@/services/agenda";
import type { BlocoPlano, BlocoRotina, PreferenciasCronograma } from "@/types/cronograma";

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

/** Envelope do helper compartilhado (utils/tempo.ts) que já respeita o desligado. */
function noNaoPerturbar(hora: number, minuto: number, prefs: PreferenciasCronograma) {
    if (!prefs.naoPerturbar) return false;
    return dentroDoNaoPerturbar(hora, minuto, prefs.naoPerturbarInicio, prefs.naoPerturbarFim);
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
    if (!bloco.notificar || bloco.tipo !== "estudo") return;

    const prefs = await preferenciasDoUsuarioAtual();
    if (!prefs.notificacoesAtivas) return;

    // Sem antecedência no bloco, vale a antecedência padrão das preferências.
    const antecedencia = bloco.antecedencia_min ?? prefs.antecedenciaMin;
    if (!antecedencia) return;

    if (!(await garantirPermissao())) return;
    await garantirCanalAndroid();

    const materia = await nomeDaMateria(bloco.materia_id);
    const { weekday, hour, minute } = paraDisparoSemanal(bloco.dia_semana, bloco.hora_inicio, antecedencia);
    if (noNaoPerturbar(hour, minute, prefs)) return;

    await Notifications.scheduleNotificationAsync({
        content: {
            ...tituloECorpo(materia, bloco.topico, antecedencia),
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

    const prefs = await preferenciasDoUsuarioAtual();
    if (!prefs.notificacoesAtivas) return;

    const antecedenciaDe = (b: BlocoPlano) => b.antecedencia_min ?? prefs.antecedenciaMin;
    const blocosNotificaveis = blocos.filter((b) => b.notificar && b.tipo === "estudo" && antecedenciaDe(b) > 0);
    if (blocosNotificaveis.length === 0) return;
    if (!(await garantirPermissao())) return;
    await garantirCanalAndroid();

    for (const bloco of blocosNotificaveis) {
        const antecedencia = antecedenciaDe(bloco);
        const materia = await nomeDaMateria(bloco.materia_id);
        const conteudo = tituloECorpo(materia, bloco.topico, antecedencia);

        // Bloco com `dia_semana` fixo (roadmap por IA) só dispara no dia dele — NULL
        // vale em todos os dias da agenda do plano.
        const valeNoDia = (dia: number) => bloco.dia_semana == null || bloco.dia_semana === dia;

        if (plano.agenda_tipo === "data" && plano.agenda_data) {
            if (!valeNoDia(diaSemanaDe(plano.agenda_data))) continue;
            const disparo = calcularDataDisparo(plano.agenda_data, bloco.hora_inicio, antecedencia);
            if (disparo.getTime() <= Date.now()) continue; // já passou — não agenda no passado
            if (noNaoPerturbar(disparo.getHours(), disparo.getMinutes(), prefs)) continue;

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
                if (!valeNoDia(dia)) continue;
                const { weekday, hour, minute } = paraDisparoSemanal(dia, bloco.hora_inicio, antecedencia);
                if (noNaoPerturbar(hour, minute, prefs)) continue;
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

/** Derruba todos os lembretes do cronograma (rotina e planos) deste aparelho. */
export async function cancelarTodosLembretesCronograma(): Promise<void> {
    await cancelarPorFiltro((d) => d.tipo === "rotina" || d.tipo === "plano");
}

/**
 * Reagenda do zero todos os lembretes do usuário.
 *
 * Chamado quando muda uma preferência que vale pra fila inteira — desligar as
 * notificações, mexer na antecedência padrão ou na janela de não perturbar.
 * Sem isso, a preferência só passaria a valer no próximo bloco editado, e
 * "desligar as notificações" não desligava nada do que já estava agendado.
 */
export async function ressincronizarTodosLembretes(usuarioId: string): Promise<void> {
    await cancelarTodosLembretesCronograma();

    const prefs = await preferenciasDoUsuarioAtual();
    if (!prefs.notificacoesAtivas) return;

    const [rotina, planos] = await Promise.all([
        supabase.from("rotina_semanal_blocos").select("*").eq("usuario_id", usuarioId),
        supabase
            .from("planos")
            .select("id, agenda_tipo, agenda_dias, agenda_data, planos_blocos(*)")
            .eq("usuario_id", usuarioId)
            .neq("agenda_tipo", "nenhuma"),
    ]);

    if (rotina.error) console.error("Erro ao reagendar lembretes da rotina:", rotina.error.message);
    if (planos.error) console.error("Erro ao reagendar lembretes dos planos:", planos.error.message);

    for (const bloco of ((rotina.data as BlocoRotina[] | null) ?? [])) {
        await sincronizarLembreteRotina(bloco);
    }

    type PlanoAgendado = {
        id: string;
        agenda_tipo: "fixado" | "data" | "nenhuma";
        agenda_dias: number[] | null;
        agenda_data: string | null;
        planos_blocos: BlocoPlano[];
    };

    for (const plano of ((planos.data as PlanoAgendado[] | null) ?? [])) {
        await sincronizarLembretesPlano(plano, plano.planos_blocos ?? []);
    }
}
