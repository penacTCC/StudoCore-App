import { supabase } from "@/repositories/supabase";
import { toast } from "@/services/toast";
import type { BlocoPlano, BlocoRotina, TipoBloco } from "@/types/cronograma";

export type OrigemAgenda = "plano" | "rotina";

/** Bloco já resolvido pra um dia específico, seja lá de qual fonte veio. */
export type BlocoAgenda = {
    id: string;
    horaInicio: string; // "HH:MM"
    duracaoMin: number;
    tipo: TipoBloco;
    materiaId: string | null;
    topico: string | null;
    notificar: boolean;
    antecedenciaMin: number | null;
    origem: OrigemAgenda;
    planoId?: string;
};

/** 0 = segunda ... 6 = domingo — mesma convenção de dia_semana/agenda_dias. */
function diaSemanaDe(dataISO: string): number {
    const [ano, mes, dia] = dataISO.split("-").map(Number);
    const diaSemanaJS = new Date(ano, mes - 1, dia).getDay(); // 0 = domingo
    return (diaSemanaJS + 6) % 7;
}

function ordenarPorHorario(blocos: BlocoAgenda[]): BlocoAgenda[] {
    return [...blocos].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
}

function paraBlocosDePlano(plano: { id: string; planos_blocos: BlocoPlano[] }): BlocoAgenda[] {
    return plano.planos_blocos.map((row) => ({
        id: row.id,
        horaInicio: row.hora_inicio.slice(0, 5),
        duracaoMin: row.duracao_min,
        tipo: row.tipo,
        materiaId: row.materia_id,
        topico: row.topico,
        notificar: row.notificar,
        antecedenciaMin: row.antecedencia_min,
        origem: "plano" as const,
        planoId: plano.id,
    }));
}

/**
 * Resolve a agenda de um dia específico seguindo a prioridade documentada em
 * `planos.agenda_tipo` (migration `criar_planos_e_blocos`): plano aplicado
 * àquela data > plano fixado nesse dia da semana > rotina semanal. Só uma
 * dessas três fontes vale por dia — nunca combina.
 */
export async function resolverAgendaDoDia(usuarioId: string, dataISO: string): Promise<BlocoAgenda[]> {
    const diaSemana = diaSemanaDe(dataISO);
    let houveErro = false;

    // 1) Plano aplicado a essa data específica — vence tudo.
    const { data: planoData, error: erroPlanoData } = await supabase
        .from("planos")
        .select("id, planos_blocos(*)")
        .eq("usuario_id", usuarioId)
        .eq("agenda_tipo", "data")
        .eq("agenda_data", dataISO)
        .maybeSingle();

    if (erroPlanoData) {
        console.error("Erro ao buscar plano do dia:", erroPlanoData.message);
        houveErro = true;
    }
    if (planoData) {
        return ordenarPorHorario(paraBlocosDePlano(planoData as { id: string; planos_blocos: BlocoPlano[] }));
    }

    // 2) Plano fixado nesse dia da semana — vence a rotina.
    const { data: planoFixado, error: erroFixado } = await supabase
        .from("planos")
        .select("id, planos_blocos(*)")
        .eq("usuario_id", usuarioId)
        .eq("agenda_tipo", "fixado")
        .contains("agenda_dias", [diaSemana])
        .maybeSingle();

    if (erroFixado) {
        console.error("Erro ao buscar plano fixado do dia:", erroFixado.message);
        houveErro = true;
    }
    if (planoFixado) {
        return ordenarPorHorario(paraBlocosDePlano(planoFixado as { id: string; planos_blocos: BlocoPlano[] }));
    }

    // 3) Rotina semanal — o padrão de fundo, quando nada mais se aplica.
    const { data: rotina, error: erroRotina } = await supabase
        .from("rotina_semanal_blocos")
        .select("*")
        .eq("usuario_id", usuarioId)
        .eq("dia_semana", diaSemana);

    if (erroRotina) {
        console.error("Erro ao buscar rotina do dia:", erroRotina.message);
        houveErro = true;
    }

    if (houveErro) {
        toast.error("Não foi possível carregar a agenda de hoje.");
    }

    return ordenarPorHorario(
        ((rotina as BlocoRotina[] | null) ?? []).map((row) => ({
            id: row.id,
            horaInicio: row.hora_inicio.slice(0, 5),
            duracaoMin: row.duracao_min,
            tipo: row.tipo,
            materiaId: row.materia_id,
            topico: row.topico,
            notificar: row.notificar,
            antecedenciaMin: row.antecedencia_min,
            origem: "rotina" as const,
        }))
    );
}
