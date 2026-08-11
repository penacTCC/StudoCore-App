/**
 * Roadmap de estudos por IA — a proposta que a Edge Function `gerar-roadmap-estudo`
 * devolve e os dados de progresso coletivo do grupo. Ver docs/plano-roadmap-ia.md.
 */

/** Um bloco da proposta. O dia da semana segue a convenção de `agenda_dias`: 0 = segunda. */
export type BlocoRoadmapProposta = {
    diaSemana: number;
    horaInicio: string; // "HH:MM"
    duracaoMin: number;
    materia: string;
    topico: string;
};

/** A proposta inteira: um plano ainda não materializado, com os blocos para revisão humana. */
export type RoadmapProposta = {
    nome: string;
    resumoObjetivo: string;
    blocos: BlocoRoadmapProposta[];
};

export type EscopoRoadmap = "pessoal" | "grupo";

/** Linha devolvida pela RPC `grupo_progresso_roadmap`. */
export type ProgressoRoadmapGrupo = {
    plano_id: string;
    nome: string;
    cor: string;
    total_blocos_semana: number;
    total_membros: number;
    membros_completaram: number;
};
