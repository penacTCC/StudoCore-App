export type Profile = {
    id: string;
    nome_usuario: string | null;
    nome_real: string | null;
    foto_usuario: string | null;
    data_nascimento?: string | null;
    objetivo?: string | null;
    nivel_ensino?: string | null;
    areas_foco?: string[] | null;
    ritmo_estudo?: string | null;
    dificuldade?: string | null;
    materia_favorita?: string | null;
    minutos_semana?: number | null;
    questoes_feitas?: number | null;
    horas_totais?: number | null;
    medalhas_desbloqueadas?: string[] | null;
    created_at?: string | null;
};

export type ProfilePreview = Pick<
  Profile,
  "id" | "nome_real" | "nome_usuario" | "foto_usuario"
>;

export type UserStats = {
    totalHours: number;
    totalQuestions: number;
    favoriteSubject: string;
    weeklyCurrent: number;
    weeklyGoal: number;
    studyHistory: Record<string, number>; // Record<"YYYY-MM-DD", hours>
    badgesUnlocked: string[];
    totalSessions: number;
};
