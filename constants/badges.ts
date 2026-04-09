import { BookOpen, Flame, Star, Trophy } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

export type BadgeType = {
    id: string;
    name: string;
    description: string;
    icon: string;
    requirementValue: number;
};

export const APP_BADGES: BadgeType[] = [
    { id: "hours_2", name: "Aprendiz", description: "Estudou 2 horas no total", icon: "BookOpen", requirementValue: 2 },
    { id: "hours_5", name: "Estudioso", description: "Alcançou 5 horas totais", icon: "Star", requirementValue: 5 },
    { id: "hours_10", name: "Mestre", description: "Impressionante! 10 horas totais", icon: "Flame", requirementValue: 10 },
    { id: "weekly_goal", name: "Dever Cumprido", description: "Atingiu sua própria meta semanal!", icon: "Trophy", requirementValue: 0 },
];
