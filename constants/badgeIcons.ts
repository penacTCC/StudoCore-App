import {
    Star, Clock, BookOpen, Flame, Trophy, Users, Zap, Play, BookMarked, Pencil,
    HelpCircle, CheckCircle, List, Search, CalendarCheck, TrendingUp, Award,
    BarChart2, Target, BookCheck, Activity, Eye, Repeat, Calendar, Medal,
    FileSearch, Hash, Shield, Layers, Lock, Cpu, GraduationCap, Milestone,
    Crosshair, Sword, Swords, Anchor, Dumbbell, Mountain, Compass, Sparkles,
    Globe, Crown, Gem, Infinity, Diamond, Timer, LayoutGrid, BrainCircuit,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

// Mapeia o nome de ícone salvo em cada BadgeType (constants/badges.ts) para o componente real.
// Compartilhado entre app/(tabs)/profile.tsx e app/(modals)/member-profile.tsx para não duplicar a lista.
export const BADGE_ICON_MAP: Record<string, LucideIcon> = {
    Star, Clock, BookOpen, Flame, Trophy, Users, Zap, Play, BookMarked, Pencil,
    HelpCircle, CheckCircle, List, Search, CalendarCheck, TrendingUp, Award,
    BarChart2, Target, BookCheck, Activity, Eye, Repeat, Calendar, Medal,
    FileSearch, Hash, Shield, Layers, Lock, Cpu, GraduationCap, Milestone,
    Crosshair, Sword, Swords, Anchor, Dumbbell, Mountain, Compass, Sparkles,
    Globe, Crown, Gem, Infinity, Diamond, Timer, LayoutGrid, BrainCircuit,
};

/**
 * Arte em PNG de cada medalha.
 *
 * A regra é o tipo da conquista escolhendo o desenho e o nível dela escolhendo a variante:
 * `horas_1` é a ampulheta simples, `horas_3` é a mesma ampulheta com moldura vermelha e
 * louros. Assim o mesmo objeto evolui junto com quem o conquista, em vez de cada medalha
 * ser um desenho sem relação com o anterior.
 *
 * As medalhas de marco fogem da regra e têm arte exclusiva: a primeira sessão (um broto) e
 * as cinco de elite. `elite` reaproveita a variante 3 — o gerador só produz três níveis.
 */
/**
 * Arte em PNG de cada medalha. O que não estiver aqui cai no ícone lucide de
 * `BADGE_ICON_MAP`, tingido pela cor do nível — ver components/badges/IconeMedalha.tsx.
 *
 * Os desenhos vêm em três variantes da mesma moldura (bege / dourada / vermelha com
 * louros), o que deixa o nível legível de longe, antes mesmo de ler o nome.
 */
export const BADGE_IMAGE_MAP: Record<string, number> = {
    // Básico — a arte original, um desenho por medalha.
    first_session: require("@/assets/badges/first_session.png"),
    hours_1:       require("@/assets/badges/hours_1.png"),
    hours_2:       require("@/assets/badges/hours_2.png"),
    hours_5:       require("@/assets/badges/hours_5.png"),
    hours_10:      require("@/assets/badges/hours_10.png"),
    questions_5:   require("@/assets/badges/questions_5.png"),
    questions_10:  require("@/assets/badges/questions_10.png"),
    questions_25:  require("@/assets/badges/questions_25.png"),
    weekly_goal:   require("@/assets/badges/weekly_goal.png"),

    // Intermediário — cada medalha tem o próprio desenho, na variante dourada.
    // `weekly_goal_12` ficou de fora: os desenhos acabaram e repetir um aqui só
    // para preencher tiraria o sentido de cada medalha ter o seu.
    hours_25:      require("@/assets/badges/ampulheta_livros_2.png"),
    hours_50:      require("@/assets/badges/ampulheta_alada_2.png"),
    hours_75:      require("@/assets/badges/roseta_relogio_2.png"),
    hours_100:     require("@/assets/badges/trofeu_2.png"),
    hours_150:     require("@/assets/badges/capelo_diploma_2.png"),
    questions_100: require("@/assets/badges/lupa_2.png"),
    questions_200: require("@/assets/badges/livro_aberto_2.png"),
    questions_300: require("@/assets/badges/prancheta_2.png"),
    questions_500: require("@/assets/badges/pilha_livros_2.png"),
    sessions_20:   require("@/assets/badges/luminaria_2.png"),
    sessions_30:   require("@/assets/badges/broto_2.png"),
    sessions_50:   require("@/assets/badges/capelo_roxo_2.png"),
    weekly_goal_5: require("@/assets/badges/estrela_check_2.png"),
    weekly_goal_8: require("@/assets/badges/chave_estrela_2.png"),

    // Elite — arte exclusiva para cada uma das cinco.
    hours_1000:     require("@/assets/badges/elite_horas_1000.png"),
    hours_2000:     require("@/assets/badges/elite_horas_2000.png"),
    questions_2000: require("@/assets/badges/elite_questoes_2000.png"),
    sessions_365:   require("@/assets/badges/elite_sessoes_365.png"),
    weekly_goal_52: require("@/assets/badges/elite_meta_52.png"),
};
