export type BadgeLevel = 'basico' | 'intermediario' | 'avancado' | 'elite';

export type BadgeType = {
    id: string;
    name: string;
    description: string;
    icon: string;
    level: BadgeLevel;
    requirementType: 'hours' | 'questions' | 'weekly_goal' | 'sessions';
    requirementValue: number;
};

// ────────────────────────────────────────────────
// BÁSICO (15) — primeiros passos
// ────────────────────────────────────────────────
const BASICO: BadgeType[] = [
    { id: 'first_session',  name: 'Primeira Sessão',    description: 'Completou sua primeira sessão de foco.',       icon: 'Play',          level: 'basico',        requirementType: 'sessions',  requirementValue: 1 },
    { id: 'hours_1',        name: 'Curioso',             description: 'Acumulou 1 hora de estudo.',                   icon: 'BookOpen',      level: 'basico',        requirementType: 'hours',     requirementValue: 1 },
    { id: 'hours_2',        name: 'Aprendiz',            description: 'Acumulou 2 horas de estudo.',                  icon: 'BookMarked',    level: 'basico',        requirementType: 'hours',     requirementValue: 2 },
    { id: 'hours_5',        name: 'Estudioso',           description: 'Chegou a 5 horas totais.',                     icon: 'Pencil',        level: 'basico',        requirementType: 'hours',     requirementValue: 5 },
    { id: 'hours_10',       name: 'Dedicado',            description: 'Atingiu 10 horas de estudo.',                  icon: 'Star',          level: 'basico',        requirementType: 'hours',     requirementValue: 10 },
    { id: 'questions_5',    name: 'Testando Águas',      description: 'Respondeu 5 questões.',                        icon: 'HelpCircle',    level: 'basico',        requirementType: 'questions', requirementValue: 5 },
    { id: 'questions_10',   name: 'Curioso de Plantão',  description: 'Respondeu 10 questões.',                       icon: 'CheckCircle',   level: 'basico',        requirementType: 'questions', requirementValue: 10 },
    { id: 'questions_25',   name: 'Respondedor',         description: 'Respondeu 25 questões.',                       icon: 'List',          level: 'basico',        requirementType: 'questions', requirementValue: 25 },
    { id: 'weekly_goal',    name: 'Dever Cumprido',      description: 'Atingiu sua meta semanal de horas.',           icon: 'Trophy',        level: 'basico',        requirementType: 'weekly_goal', requirementValue: 1 },
    { id: 'sessions_3',     name: 'Em Série',            description: 'Completou 3 sessões de foco.',                 icon: 'Flame',         level: 'basico',        requirementType: 'sessions',  requirementValue: 3 },
    { id: 'sessions_5',     name: 'Persistente',         description: 'Completou 5 sessões de foco.',                 icon: 'Zap',           level: 'basico',        requirementType: 'sessions',  requirementValue: 5 },
    { id: 'sessions_10',    name: 'Maratonista Nível 1', description: 'Completou 10 sessões de foco.',                icon: 'Timer',         level: 'basico',        requirementType: 'sessions',  requirementValue: 10 },
    { id: 'questions_50',   name: 'Questionador',        description: 'Respondeu 50 questões.',                       icon: 'Search',        level: 'basico',        requirementType: 'questions', requirementValue: 50 },
    { id: 'hours_15',       name: 'Comprometido',        description: 'Acumulou 15 horas de estudo.',                 icon: 'Clock',         level: 'basico',        requirementType: 'hours',     requirementValue: 15 },
    { id: 'weekly_goal_2',  name: 'Meta Dupla',          description: 'Atingiu sua meta semanal por 2 semanas.',      icon: 'CalendarCheck', level: 'basico',        requirementType: 'weekly_goal', requirementValue: 2 },
];

// ────────────────────────────────────────────────
// INTERMEDIÁRIO (15) — evolução constante
// ────────────────────────────────────────────────
const INTERMEDIARIO: BadgeType[] = [
    { id: 'hours_25',       name: 'Entusiasta',          description: 'Chegou a 25 horas totais de estudo.',          icon: 'TrendingUp',    level: 'intermediario', requirementType: 'hours',     requirementValue: 25 },
    { id: 'hours_50',       name: 'Metade do Caminho',   description: 'Acumulou 50 horas de estudo.',                 icon: 'Award',         level: 'intermediario', requirementType: 'hours',     requirementValue: 50 },
    { id: 'hours_75',       name: 'Avançando Forte',     description: 'Atingiu 75 horas totais.',                     icon: 'BarChart2',     level: 'intermediario', requirementType: 'hours',     requirementValue: 75 },
    { id: 'questions_100',  name: 'Centurião',           description: 'Respondeu 100 questões.',                      icon: 'Target',        level: 'intermediario', requirementType: 'questions', requirementValue: 100 },
    { id: 'questions_200',  name: 'Nativo',              description: 'Respondeu 200 questões.',                      icon: 'BookCheck',     level: 'intermediario', requirementType: 'questions', requirementValue: 200 },
    { id: 'sessions_20',    name: 'Maratonista Nível 2', description: 'Completou 20 sessões de foco.',                icon: 'Activity',      level: 'intermediario', requirementType: 'sessions',  requirementValue: 20 },
    { id: 'sessions_30',    name: 'Mentalidade Foco',    description: 'Completou 30 sessões de foco.',                icon: 'Eye',           level: 'intermediario', requirementType: 'sessions',  requirementValue: 30 },
    { id: 'weekly_goal_5',  name: 'Consistente',         description: 'Atingiu sua meta semanal por 5 semanas.',      icon: 'Repeat',        level: 'intermediario', requirementType: 'weekly_goal', requirementValue: 5 },
    { id: 'weekly_goal_8',  name: 'Hábito Formado',      description: 'Meta semanal cumprida por 8 semanas.',         icon: 'Calendar',      level: 'intermediario', requirementType: 'weekly_goal', requirementValue: 8 },
    { id: 'hours_100',      name: 'Centenário',          description: 'Acumulou incríveis 100 horas de estudo!',      icon: 'Medal',         level: 'intermediario', requirementType: 'hours',     requirementValue: 100 },
    { id: 'questions_300',  name: 'Examinador',          description: 'Respondeu 300 questões.',                      icon: 'FileSearch',    level: 'intermediario', requirementType: 'questions', requirementValue: 300 },
    { id: 'sessions_50',    name: 'Meio Século',         description: 'Completou 50 sessões de foco.',                icon: 'Hash',          level: 'intermediario', requirementType: 'sessions',  requirementValue: 50 },
    { id: 'hours_150',      name: 'Veterano',            description: 'Atingiu 150 horas totais.',                    icon: 'Shield',        level: 'intermediario', requirementType: 'hours',     requirementValue: 150 },
    { id: 'questions_500',  name: 'Quinhentos',          description: 'Respondeu 500 questões no total.',             icon: 'Layers',        level: 'intermediario', requirementType: 'questions', requirementValue: 500 },
    { id: 'weekly_goal_12', name: 'Disciplinado',        description: 'Meta semanal cumprida por 12 semanas.',        icon: 'Lock',          level: 'intermediario', requirementType: 'weekly_goal', requirementValue: 12 },
];

// ────────────────────────────────────────────────
// AVANÇADO (15) — alto desempenho
// ────────────────────────────────────────────────
const AVANCADO: BadgeType[] = [
    { id: 'hours_200',      name: 'Expert',              description: 'Alcançou 200 horas de estudo.',                icon: 'Cpu',           level: 'avancado', requirementType: 'hours',     requirementValue: 200 },
    { id: 'hours_300',      name: 'Mestre',              description: 'Impressionante! 300 horas acumuladas.',        icon: 'GraduationCap', level: 'avancado', requirementType: 'hours',     requirementValue: 300 },
    { id: 'hours_400',      name: 'Professor Honorário', description: 'Atingiu 400 horas de estudo.',                 icon: 'BookOpenCheck', level: 'avancado', requirementType: 'hours',     requirementValue: 400 },
    { id: 'hours_500',      name: 'Meio Milhar',         description: '500 horas de estudo. Fenomenal!',             icon: 'Milestone',     level: 'avancado', requirementType: 'hours',     requirementValue: 500 },
    { id: 'questions_750',  name: 'Caçador de Questões', description: 'Respondeu 750 questões.',                      icon: 'Crosshair',     level: 'avancado', requirementType: 'questions', requirementValue: 750 },
    { id: 'questions_1000', name: 'Um Milhar',           description: 'Respondeu 1000 questões! Lendário.',          icon: 'Sword',         level: 'avancado', requirementType: 'questions', requirementValue: 1000 },
    { id: 'sessions_100',   name: 'Centurião do Foco',   description: 'Completou 100 sessões de foco.',               icon: 'Swords',        level: 'avancado', requirementType: 'sessions',  requirementValue: 100 },
    { id: 'sessions_150',   name: 'Foco Inabalável',     description: 'Completou 150 sessões de foco.',               icon: 'Anchor',        level: 'avancado', requirementType: 'sessions',  requirementValue: 150 },
    { id: 'weekly_goal_20', name: 'Imbatível',           description: 'Meta semanal cumprida por 20 semanas.',        icon: 'Dumbbell',      level: 'avancado', requirementType: 'weekly_goal', requirementValue: 20 },
    { id: 'weekly_goal_26', name: 'Meio Ano Sólido',     description: 'Meta semanal cumprida por 26 semanas.',        icon: 'Mountain',      level: 'avancado', requirementType: 'weekly_goal', requirementValue: 26 },
    { id: 'hours_600',      name: 'Guru',                description: '600 horas de puro estudo.',                   icon: 'Compass',       level: 'avancado', requirementType: 'hours',     requirementValue: 600 },
    { id: 'questions_1500', name: 'Imparável',           description: 'Respondeu 1500 questões.',                     icon: 'BrainCircuit',  level: 'avancado', requirementType: 'questions', requirementValue: 1500 },
    { id: 'sessions_200',   name: 'Duzentas Sessões',    description: 'Completou 200 sessões de foco.',               icon: 'LayoutGrid',    level: 'avancado', requirementType: 'sessions',  requirementValue: 200 },
    { id: 'hours_750',      name: 'Ascendido',           description: 'Chegou a 750 horas de estudo.',                icon: 'Sparkles',      level: 'avancado', requirementType: 'hours',     requirementValue: 750 },
    { id: 'weekly_goal_36', name: 'Quase 1 Ano',         description: 'Meta semanal cumprida por 36 semanas.',        icon: 'Globe',         level: 'avancado', requirementType: 'weekly_goal', requirementValue: 36 },
];

// ────────────────────────────────────────────────
// ELITE (5) — raridade máxima
// ────────────────────────────────────────────────
const ELITE: BadgeType[] = [
    { id: 'hours_1000',     name: 'Um Milhar de Horas',  description: '1000 horas de estudo. Você é uma lenda viva.', icon: 'Crown',    level: 'elite', requirementType: 'hours',     requirementValue: 1000 },
    { id: 'questions_2000', name: 'Dois Mil Questões',   description: 'Respondeu 2000 questões. Status excepcional.',  icon: 'Gem',      level: 'elite', requirementType: 'questions', requirementValue: 2000 },
    { id: 'sessions_365',   name: 'Um Ano de Foco',      description: '365 sessões completadas. Inacreditável.',       icon: 'Star',     level: 'elite', requirementType: 'sessions',  requirementValue: 365 },
    { id: 'weekly_goal_52', name: 'Um Ano Sem Parar',    description: 'Meta semanal cumprida por 52 semanas.',         icon: 'Infinity', level: 'elite', requirementType: 'weekly_goal', requirementValue: 52 },
    { id: 'hours_2000',     name: 'Dois Mil Horas',      description: '2000 horas de estudo. Nível de mestrado real!', icon: 'Diamond',  level: 'elite', requirementType: 'hours',     requirementValue: 2000 },
];

export const APP_BADGES: BadgeType[] = [
    ...BASICO,
    ...INTERMEDIARIO,
    ...AVANCADO,
    ...ELITE,
];

export const BADGE_LEVEL_LABELS: Record<BadgeLevel, string> = {
    basico: 'Básico',
    intermediario: 'Intermediário',
    avancado: 'Avançado',
    elite: 'Elite',
};

export const BADGE_LEVEL_COLORS: Record<BadgeLevel, string> = {
    basico: '#64748b',
    intermediario: '#3b82f6',
    avancado: '#8b5cf6',
    elite: '#f59e0b',
};
