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

/** Um bucket do gráfico "Planejado × Realizado" (dia da semana, semana ou trimestre). */
export type ParPlanejadoRealizado = { rotulo: string; planejado: number; realizado: number };

/** Números do cabeçalho do "Planejado × Realizado", em minutos. */
export type ResumoAderencia = {
    /** Realizado ÷ planejado em %. Pode passar de 100 quando estudou além do plano. */
    pct: number;
    minutosPlanejados: number;
    minutosRealizados: number;
};

/** Uma linha do gráfico "Aderência por matéria" — minutos, não horas. */
export type AderenciaMateria = {
    materia: string;
    cor: string;
    planejado: number;
    realizado: number;
    /** Realizado ÷ planejado em %, sem teto (pode passar de 100). */
    pct: number;
};

/**
 * Desempenho de uma matéria no período: alimenta tanto "Taxa de acerto por matéria"
 * quanto o gráfico de quadrantes "Tempo × desempenho".
 */
export type DesempenhoMateria = {
    materia: string;
    cor: string;
    minutos: number;
    horas: number;
    questoes: number;
    acertos: number;
    /** 0 quando a matéria não teve nenhuma questão respondida no período. */
    pctAcerto: number;
};

/** Matéria dentro do Wrapped mensal — mesma ideia de `MateriaDistribuicao`, mas com
 *  tempo/porcentagem já formatados pro card (ver `calcularWrappedMensal`). */
export type MateriaWrapped = {
    nome: string;
    tempo: string;
    pct: number;
    cor: string;
};

/** Números do "Wrapped de [mês]" (app/(modals)/wrapped-mensal.tsx), todos derivados das
 *  sessões finalizadas do mês de referência — ver `calcularWrappedMensal`. */
export type DadosWrapped = {
    mesRotulo: string;
    horasTotais: string;
    variacaoHoras: string;
    variacaoHorasPositiva: boolean;
    mesAnterior: string;
    progressoHoras: number;
    mediaDiaria: string;
    picoDiario: string;
    diasNoMes: number;
    barrasDiarias: number[];
    questoesTotais: string;
    questoesCorretas: string;
    pctAcerto: number;
    ofensivaDias: number;
    ofensivaRecorde: boolean;
    trilhaOfensiva: boolean[];
    materias: MateriaWrapped[];
};

export type  membrosRankingAnalytics = {
    userId: string;
    nome: string;
    foto?: string | null | undefined;
    minutos: number;
    ofensiva: number;
    ehVoce: boolean;
}