export type LeaderboardFilter = "total" | "semanal" | "mensal" | "anual";

export const LEADERBOARD_TABS: { key: LeaderboardFilter; label: string }[] = [
    // Filtro principal atual, baseado nas horas de estudo do membro.
    { key: "total", label: "Total" },

    // Filtros de período mantidos no layout para a evolução do ranking.
    { key: "semanal", label: "Semana" },
    { key: "mensal", label: "Mês" },
    { key: "anual", label: "Ano" },
];

export const ROTULO_PERIODO: Record<LeaderboardFilter, string> = {
    total: "todos os tempos",
    semanal: "esta semana",
    mensal: "este mês",
    anual: "este ano",
};

export const formatarMinutos = (totalMinutos: number) => {
    const horas = Math.floor(totalMinutos / 60);
    const minutos = totalMinutos % 60;

    if (horas === 0) return `${minutos}m`;
    if (minutos === 0) return `${horas}h`;

    return `${horas}h ${minutos}m`;
};
