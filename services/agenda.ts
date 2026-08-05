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
    /** Nome do plano que gerou o bloco. Só quando origem === "plano". */
    planoNome?: string;
};

/** 0 = segunda ... 6 = domingo — mesma convenção de dia_semana/agenda_dias. */
export function diaSemanaDe(dataISO: string): number {
    const [ano, mes, dia] = dataISO.split("-").map(Number);
    const diaSemanaJS = new Date(ano, mes - 1, dia).getDay(); // 0 = domingo
    return (diaSemanaJS + 6) % 7;
}

function ordenarPorHorario(blocos: BlocoAgenda[]): BlocoAgenda[] {
    return [...blocos].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
}

function paraBlocosDePlano(plano: { id: string; nome?: string; planos_blocos: BlocoPlano[] }): BlocoAgenda[] {
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
        planoNome: plano.nome,
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
        ((rotina as BlocoRotina[] | null) ?? []).map((row) => paraBlocoDeRotina(row))
    );
}

function paraBlocoDeRotina(row: BlocoRotina): BlocoAgenda {
    return {
        id: row.id,
        horaInicio: row.hora_inicio.slice(0, 5),
        duracaoMin: row.duracao_min,
        tipo: row.tipo,
        materiaId: row.materia_id,
        topico: row.topico,
        notificar: row.notificar,
        antecedenciaMin: row.antecedencia_min,
        origem: "rotina" as const,
    };
}

/** Um dia já resolvido, com a fonte que venceu naquele dia. */
export type DiaResolvido = {
    dataISO: string;
    /** 0 = segunda ... 6 = domingo. */
    diaSemana: number;
    blocos: BlocoAgenda[];
};

/**
 * Mesma prioridade de `resolverAgendaDoDia` (data > fixado > rotina), só que
 * para um conjunto de datas de uma vez.
 *
 * Existe porque chamar o resolvedor de dia sete vezes custaria 21 idas ao banco
 * para desenhar uma semana. Aqui são três consultas no total: os planos com data
 * dentro do intervalo, os planos fixados do usuário e a rotina — o cruzamento
 * dia a dia acontece em memória.
 */
export async function resolverAgendaDaSemana(
    usuarioId: string,
    datasISO: string[]
): Promise<DiaResolvido[]> {
    let houveErro = false;

    const [planosPorData, planosFixados, rotina] = await Promise.all([
        supabase
            .from("planos")
            .select("id, nome, agenda_data, planos_blocos(*)")
            .eq("usuario_id", usuarioId)
            .eq("agenda_tipo", "data")
            .in("agenda_data", datasISO),
        supabase
            .from("planos")
            .select("id, nome, agenda_dias, planos_blocos(*)")
            .eq("usuario_id", usuarioId)
            .eq("agenda_tipo", "fixado"),
        supabase.from("rotina_semanal_blocos").select("*").eq("usuario_id", usuarioId),
    ]);

    for (const [rotulo, resultado] of [
        ["planos do dia", planosPorData],
        ["planos fixados", planosFixados],
        ["rotina", rotina],
    ] as const) {
        if (resultado.error) {
            console.error(`Erro ao buscar ${rotulo} da semana:`, resultado.error.message);
            houveErro = true;
        }
    }

    if (houveErro) {
        toast.error("Não foi possível carregar sua semana.");
    }

    type PlanoComBlocos = { id: string; nome: string; planos_blocos: BlocoPlano[] };

    const porData = new Map<string, PlanoComBlocos>();
    for (const linha of (planosPorData.data ?? []) as (PlanoComBlocos & { agenda_data: string })[]) {
        porData.set(linha.agenda_data, linha);
    }

    const porDiaFixado = new Map<number, PlanoComBlocos>();
    for (const linha of (planosFixados.data ?? []) as (PlanoComBlocos & { agenda_dias: number[] | null })[]) {
        for (const dia of linha.agenda_dias ?? []) {
            // Um trigger no Postgres garante que só um plano ocupa cada dia,
            // então o primeiro a chegar é o único.
            if (!porDiaFixado.has(dia)) porDiaFixado.set(dia, linha);
        }
    }

    const rotinaPorDia = new Map<number, BlocoRotina[]>();
    for (const row of ((rotina.data as BlocoRotina[] | null) ?? [])) {
        const doDia = rotinaPorDia.get(row.dia_semana) ?? [];
        doDia.push(row);
        rotinaPorDia.set(row.dia_semana, doDia);
    }

    return datasISO.map((dataISO) => {
        const diaSemana = diaSemanaDe(dataISO);
        const planoDaData = porData.get(dataISO);
        const planoFixado = porDiaFixado.get(diaSemana);

        const blocos = planoDaData
            ? paraBlocosDePlano(planoDaData)
            : planoFixado
                ? paraBlocosDePlano(planoFixado)
                : (rotinaPorDia.get(diaSemana) ?? []).map(paraBlocoDeRotina);

        return { dataISO, diaSemana, blocos: ordenarPorHorario(blocos) };
    });
}
