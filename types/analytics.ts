export type MateriaDistribuicao = {
    subject: string;
    hours: number;
    color: string;
}

export interface AnalisePessoal {
    // Esta semana
    horasEstaSemana: string; // "12h30"
    horasEstaSemanaMinutos: number;
    questoesEstaSemana: number;
    diasEstaSemana: number;
    // Ofensiva (vem da gamificação, não é calculada aqui)
    sequencia: number;
    melhorSequencia: number;
    // Semana passada (para comparativos)
    horasSemanaPasada: string;
    horasSemanaPasadaMinutos: number;
    questoesSemanaPasada: number;
    diasSemanaPasada: number;
    // Distribuição por matéria (esta semana, ordenada por horas desc)
    distribuicao: MateriaDistribuicao[];
    maxHours: number;
    // Variação de horas vs. semana passada. `null` quando não há base de
    // comparação (semana passada zerada) — evita exibir "+Infinity%".
    variacaoHorasPct: number | null;
}

export type ComecoSemana = "domingo" | "segunda";

export type PontoSerieDia = { dia: string; minutos: number };

export type ParDiaSemana = { dia: string; atual: number; anterior: number };


