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
