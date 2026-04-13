import { useEffect, useState, useCallback } from "react";
import {
    View, Text, ScrollView, TouchableOpacity, Alert, DeviceEventEmitter
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import {
    ArrowLeft, Star, BookOpen, Flame, Trophy, Clock, Zap, Play,
    BookMarked, Pencil, HelpCircle, CheckCircle, List, Search,
    CalendarCheck, TrendingUp, Award, BarChart2, Target, BookCheck,
    Activity, Eye, Repeat, Calendar, Medal, FileSearch, Hash,
    Shield, Layers, Lock, Cpu, GraduationCap, Milestone,
    Crosshair, Sword, Swords, Anchor, Dumbbell, Mountain,
    Compass, Sparkles, Globe, Crown, Gem, Infinity, Diamond,
    Timer, LayoutGrid, BrainCircuit,
} from "lucide-react-native";
import { COLORS } from "@/constants/colors";
import {
    APP_BADGES, BADGE_LEVEL_LABELS, BADGE_LEVEL_COLORS,
    BadgeType, BadgeLevel,
} from "@/constants/badges";
import { loadProfileStats, UserStats } from "@/services/profileStats";

const iconMap: Record<string, any> = {
    Star, BookOpen, Flame, Trophy, Clock, Zap, Play, BookMarked, Pencil,
    HelpCircle, CheckCircle, List, Search, CalendarCheck, TrendingUp, Award,
    BarChart2, Target, BookCheck, Activity, Eye, Repeat, Calendar, Medal,
    FileSearch, Hash, Shield, Layers, Lock, Cpu, GraduationCap, Milestone,
    Crosshair, Sword, Swords, Anchor, Dumbbell, Mountain, Compass, Sparkles,
    Globe, Crown, Gem, Infinity, Diamond, Timer, LayoutGrid, BrainCircuit,
};

function getBadgeProgress(badge: BadgeType, stats: UserStats): number {
    switch (badge.requirementType) {
        case 'hours':     return Math.min(stats.totalHours / badge.requirementValue, 1);
        case 'questions': return Math.min(stats.totalQuestions / badge.requirementValue, 1);
        case 'sessions':  return Math.min(stats.totalSessions / badge.requirementValue, 1);
        case 'weekly_goal': return Math.min(stats.weeklyCurrent / stats.weeklyGoal, 1);
        default: return 0;
    }
}

const LEVELS: BadgeLevel[] = ['basico', 'intermediario', 'avancado', 'elite'];

export default function BadgesScreen() {
    const [stats, setStats] = useState<UserStats | null>(null);

    const loadData = async () => {
        const s = await loadProfileStats();
        setStats(s);
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
            
            const sub = DeviceEventEmitter.addListener('badgesUnlocked', () => {
                loadData();
            });
            return () => sub.remove();
        }, [])
    );

    if (!stats) return null;

    const unlockedCount = stats.badgesUnlocked.length;

    // Calcula o progresso real fracionado somando o avanço em cada badge
    const totalProgressSum = APP_BADGES.reduce((sum, badge) => {
        if (stats.badgesUnlocked.includes(badge.id)) return sum + 1;
        return sum + getBadgeProgress(badge, stats);
    }, 0);
    const overallProgressPct = Math.min((totalProgressSum / APP_BADGES.length) * 100, 100);

    return (
        <SafeAreaView className="flex-1 bg-slate-950" edges={["top"]}>
            {/* Header */}
            <View className="flex-row items-center px-4 py-3 border-b border-slate-800">
                <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 mr-2">
                    <ArrowLeft size={22} color="#cbd5e1" />
                </TouchableOpacity>
                <View className="flex-1">
                    <Text className="text-xl font-bold text-slate-200">Medalhas</Text>
                    <Text className="text-xs text-slate-500">{unlockedCount}/{APP_BADGES.length} conquistadas</Text>
                </View>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Barra global de progresso */}
                <View className="px-4 pt-4 pb-2">
                    <View className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                        <View className="flex-row justify-between mb-2">
                            <Text className="text-sm font-semibold text-slate-300">Progresso Total</Text>
                            <Text className="text-sm font-bold" style={{ color: COLORS.violetLight }}>
                                {overallProgressPct.toFixed(1)}%
                            </Text>
                        </View>
                        <View className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                            <View
                                className="h-full rounded-full"
                                style={{
                                    width: `${overallProgressPct}%`,
                                    backgroundColor: COLORS.violetLight,
                                }}
                            />
                        </View>
                        <View className="flex-row justify-between mt-3">
                            {LEVELS.map(lvl => {
                                const lvlBadges = APP_BADGES.filter(b => b.level === lvl);
                                const lvlUnlocked = lvlBadges.filter(b => stats.badgesUnlocked.includes(b.id)).length;
                                return (
                                    <View key={lvl} className="items-center">
                                        <Text className="text-xs font-bold" style={{ color: BADGE_LEVEL_COLORS[lvl] }}>
                                            {lvlUnlocked}/{lvlBadges.length}
                                        </Text>
                                        <Text className="text-[10px] text-slate-500">{BADGE_LEVEL_LABELS[lvl]}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                </View>

                {/* Grupos por nível */}
                {LEVELS.map(level => {
                    const levelBadges = APP_BADGES.filter(b => b.level === level);
                    const levelColor = BADGE_LEVEL_COLORS[level];
                    const lvlUnlocked = levelBadges.filter(b => stats.badgesUnlocked.includes(b.id)).length;

                    return (
                        <View key={level} className="px-4 pt-4">
                            {/* Header do nível */}
                            <View className="flex-row items-center gap-2 mb-3">
                                <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: levelColor }} />
                                <Text className="text-sm font-bold uppercase tracking-widest" style={{ color: levelColor }}>
                                    {BADGE_LEVEL_LABELS[level]}
                                </Text>
                                <Text className="text-xs text-slate-500">
                                    {lvlUnlocked}/{levelBadges.length}
                                </Text>
                            </View>

                            {/* Lista de badges neste nível */}
                            <View className="gap-2 mb-2">
                                {levelBadges.map(badge => {
                                    const BadgeIcon = iconMap[badge.icon] || Star;
                                    const isUnlocked = stats.badgesUnlocked.includes(badge.id);
                                    const progress = getBadgeProgress(badge, stats);
                                    const progressPct = Math.round(progress * 100);

                                    let currentVal = 0;
                                    switch (badge.requirementType) {
                                        case 'hours': currentVal = stats.totalHours; break;
                                        case 'questions': currentVal = stats.totalQuestions; break;
                                        case 'sessions': currentVal = stats.totalSessions; break;
                                        case 'weekly_goal': currentVal = stats.weeklyCurrent; break;
                                    }

                                    return (
                                            <TouchableOpacity
                                                key={badge.id}
                                                onPress={() => Alert.alert(
                                                    badge.name,
                                                    badge.description +
                                                    (isUnlocked
                                                        ? '\n\n✨ Você já conquistou esta medalha!'
                                                        : `\n\n📊 Progresso: ${progressPct}%`)
                                                )}
                                                className="flex-row items-center gap-3 p-3 rounded-2xl"
                                                style={{
                                                    backgroundColor: isUnlocked
                                                        ? `${levelColor}20` // Mais brilhante
                                                        : 'rgba(15, 23, 42, 0.6)',
                                                    borderWidth: 1,
                                                    borderColor: isUnlocked ? `${levelColor}70` : 'rgba(51, 65, 85, 0.3)', // Borda muito mais visível
                                                    opacity: isUnlocked ? 1 : 0.65,
                                                }}
                                            >
                                                {/* Ícone */}
                                                <View
                                                    className="w-11 h-11 rounded-full items-center justify-center flex-shrink-0"
                                                    style={{
                                                        backgroundColor: isUnlocked ? `${levelColor}30` : 'rgba(51, 65, 85, 0.5)',
                                                    }}
                                                >
                                                    <BadgeIcon size={20} color={isUnlocked ? levelColor : '#475569'} />
                                                </View>

                                                {/* Texto + barra */}
                                                <View className="flex-1">
                                                    <View className="flex-row items-center justify-between mb-0.5">
                                                        <Text className="text-sm font-semibold text-slate-200">{badge.name}</Text>
                                                        {isUnlocked ? (
                                                            <View className="flex-row items-center gap-1 bg-slate-950 px-2 py-0.5 rounded-full border" style={{ borderColor: `${levelColor}40` }}>
                                                                <Star size={10} color={levelColor} />
                                                                <Text className="text-[9px] font-bold tracking-widest" style={{ color: levelColor }}>CONQUISTADA</Text>
                                                            </View>
                                                        ) : (
                                                            <Text className="text-xs text-slate-500">{progressPct}%</Text>
                                                        )}
                                                    </View>
                                                <Text className="text-xs text-slate-500 mt-0.5" numberOfLines={1}>
                                                    {badge.description}
                                                </Text>

                                                {/* Barra de progresso (só se ainda não desbloqueada) */}
                                                {!isUnlocked && (
                                                    <View className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                        <View
                                                            className="h-full rounded-full"
                                                            style={{
                                                                width: `${progressPct}%`,
                                                                backgroundColor: levelColor,
                                                            }}
                                                        />
                                                    </View>
                                                )}
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    );
                })}

                <View className="h-8" />
            </ScrollView>
        </SafeAreaView>
    );
}
