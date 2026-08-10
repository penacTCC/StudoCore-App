export type Profile = {
    id: string;
    nome_usuario: string | null;
    nome_real: string | null;
    foto_usuario: string | null;
    /** Bio escrita pelo usuário na tela de editar perfil. Cai no `objetivo` quando vazia. */
    bio?: string | null;
    /** Deixa outras pessoas verem as estatísticas no perfil de membro. */
    perfil_publico?: boolean | null;
    /** Exibe o selo de dias seguidos no avatar. */
    mostrar_ofensiva?: boolean | null;
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

/**
 * O que o duelo consegue ver de alguém (RPC `estatisticas_para_duelo`).
 *
 * Identidade e `perfil_publico` vêm sempre; os números vêm nulos quando o perfil está
 * fechado — quem corta é o banco, não a tela.
 */
export type EstatisticasDuelo = ProfilePreview & {
  perfil_publico: boolean;
  horas_totais: number | null;
  questoes_feitas: number | null;
  medalhas_desbloqueadas: string[] | null;
  materia_favorita: string | null;
  ofensiva: number | null;
  melhor_ofensiva: number | null;
  /** Último dia estudado ("YYYY-MM-DD"): sem ele não dá pra saber se a ofensiva ainda vale. */
  ultima_data_estudo: string | null;
};

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
