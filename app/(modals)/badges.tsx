import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, DeviceEventEmitter, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { useDadosCache } from "@/hooks/useDadosCache";
import { ArrowLeft, Check, Lock, Star } from "lucide-react-native";
import { HADES } from "@/constants/hades";
import {
    APP_BADGES, BADGE_LEVEL_LABELS, BADGE_LEVEL_COLORS,
    BadgeType, BadgeLevel,
} from "@/constants/badges";
import { BADGE_ICON_MAP as iconMap } from "@/constants/badgeIcons";
import { loadProfileStats } from "@/services/profileStats";
import type { UserStats } from "@/types/profile";
import DetalheMedalhaSheet from "@/components/badges/DetalheMedalhaSheet";
import { Skeleton, SkeletonCircle } from "@/components/ui/Skeleton";

const LEVELS: BadgeLevel[] = ['basico', 'intermediario', 'avancado', 'elite'];

const LEVEL_BLURB: Record<BadgeLevel, string> = {
    basico: 'Os primeiros marcos',
    intermediario: 'Ritmo de quem pegou o jeito',
    avancado: 'Território de quem leva a sério',
    elite: 'Só para lendas do HADES',
};

const LEVEL_SHORT: Record<BadgeLevel, string> = {
    basico: 'Básico',
    intermediario: 'Interm.',
    avancado: 'Avanç.',
    elite: 'Elite',
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

function getCurrentVal(badge: BadgeType, stats: UserStats): number {
    switch (badge.requirementType) {
        case 'hours':       return stats.totalHours;
        case 'questions':   return stats.totalQuestions;
        case 'sessions':    return stats.totalSessions;
        case 'weekly_goal': return stats.weeklyCurrent;
        default: return 0;
    }
}

export default function BadgesScreen() {
    const [selected, setSelected] = useState<BadgeType | null>(null);
    const [atualizando, setAtualizando] = useState(false);

    /*
      As estatísticas ficam no cache, então reabrir a galeria de medalhas não volta ao
      skeleton. `tempoFresco: 0` mantém a releitura a cada foco — é aqui que se confere
      uma medalha recém-desbloqueada.
    */
    const { dados: stats, recarregar: loadData } = useDadosCache(
        "estatisticas-perfil",
        () => loadProfileStats(),
        { tempoFresco: 0 }
    );

    useFocusEffect(
        useCallback(() => {
            const sub = DeviceEventEmitter.addListener('badgesUnlocked', () => {
                loadData();
            });
            return () => sub.remove();
        }, [loadData])
    );

    const handleRefresh = async () => {
        setAtualizando(true);
        try {
            await loadData();
        } finally {
            setAtualizando(false);
        }
    };

    if (!stats) return <BadgesSkeleton />;

    const unlockedCount = stats.badgesUnlocked.length;
    const totalCount = APP_BADGES.length;

    const selectedUnlocked = selected ? stats.badgesUnlocked.includes(selected.id) : false;
    const selectedProgress = selected ? getBadgeProgress(selected, stats) : 0;
    const selectedCurrentVal = selected ? getCurrentVal(selected, stats) : 0;

    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: HADES.bg }} edges={["top"]}>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 }}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    activeOpacity={0.7}
                    style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: HADES.surfaceRaised, alignItems: "center", justifyContent: "center" }}
                >
                    <ArrowLeft size={19} color={HADES.textSecondary} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 22, fontWeight: "700", color: HADES.text, letterSpacing: -0.3 }}>Medalhas</Text>
                    <Text style={{ fontSize: 12.5, color: HADES.textMuted, marginTop: 1 }}>
                        <Text style={{ color: HADES.accentSolid, fontWeight: "700" }}>{unlockedCount}</Text>/{totalCount} conquistadas
                    </Text>
                </View>
            </View>

            {/* Resumo por nível */}
            <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingBottom: 10 }}>
                {LEVELS.map(level => {
                    const color = BADGE_LEVEL_COLORS[level];
                    const levelBadges = APP_BADGES.filter(b => b.level === level);
                    const lvlUnlocked = levelBadges.filter(b => stats.badgesUnlocked.includes(b.id)).length;
                    const hasProgress = lvlUnlocked > 0;
                    return (
                        <View
                            key={level}
                            style={{
                                flex: 1,
                                alignItems: "center",
                                gap: 4,
                                paddingVertical: 9,
                                paddingHorizontal: 4,
                                borderRadius: 11,
                                backgroundColor: hasProgress ? `${color}24` : HADES.surfaceRaised,
                                borderWidth: 1,
                                borderColor: hasProgress ? `${color}57` : HADES.border,
                            }}
                        >
                            <View style={{ width: 8, height: 8, borderRadius: 3, backgroundColor: color }} />
                            <Text style={{ fontSize: 10, fontWeight: "700", color: HADES.textSecondary }}>{LEVEL_SHORT[level]}</Text>
                            <Text style={{ fontSize: 10, fontWeight: "700", color }}>{lvlUnlocked}/{levelBadges.length}</Text>
                        </View>
                    );
                })}
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 32 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={atualizando} onRefresh={handleRefresh} tintColor={HADES.accentSolid} />
                }
            >
                {/* Progresso total */}
                <View style={{ backgroundColor: HADES.surface, borderWidth: 1, borderColor: HADES.border, borderRadius: 16, padding: 16 }}>
                    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 13 }}>
                        <View>
                            <Text style={{ fontSize: 12, color: HADES.textMuted, fontWeight: "600" }}>Progresso total</Text>
                            <Text style={{ fontSize: 13, color: HADES.textSecondary, marginTop: 3 }}>
                                <Text style={{ color: HADES.text, fontWeight: "700" }}>{unlockedCount}</Text> de {totalCount} medalhas
                            </Text>
                        </View>
                        <Text style={{ fontSize: 32, fontWeight: "800", color: HADES.accentSolid, letterSpacing: -1 }}>
                            {Math.round((unlockedCount / totalCount) * 100)}%
                        </Text>
                    </View>
                    <View style={{ height: 10, borderRadius: 6, backgroundColor: HADES.surfaceOverlay, overflow: "hidden", flexDirection: "row" }}>
                        {LEVELS.map(level => {
                            const levelBadges = APP_BADGES.filter(b => b.level === level);
                            const lvlUnlocked = levelBadges.filter(b => stats.badgesUnlocked.includes(b.id)).length;
                            const widthPct = (lvlUnlocked / totalCount) * 100;
                            if (widthPct <= 0) return null;
                            return (
                                <View key={level} style={{ height: "100%", width: `${widthPct}%`, backgroundColor: BADGE_LEVEL_COLORS[level] }} />
                            );
                        })}
                    </View>
                    <Text style={{ fontSize: 11.5, color: HADES.textDim, marginTop: 10, lineHeight: 16 }}>
                        Cada faixa colorida é o quanto cada nível já soma ao total.
                    </Text>
                </View>

                {/* Seções por nível */}
                {LEVELS.map(level => {
                    const levelColor = BADGE_LEVEL_COLORS[level];
                    const levelBadges = APP_BADGES.filter(b => b.level === level);
                    const lvlUnlocked = levelBadges.filter(b => stats.badgesUnlocked.includes(b.id)).length;

                    return (
                        <View key={level} style={{ marginTop: 22 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 12 }}>
                                <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: levelColor }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 15, fontWeight: "700", color: HADES.text, letterSpacing: -0.2 }}>
                                        {BADGE_LEVEL_LABELS[level]}
                                    </Text>
                                    <Text style={{ fontSize: 11, color: HADES.textDim, marginTop: 1 }}>{LEVEL_BLURB[level]}</Text>
                                </View>
                                <Text style={{ fontSize: 11, fontWeight: "800", borderRadius: 7, paddingVertical: 3, paddingHorizontal: 8, color: levelColor, backgroundColor: `${levelColor}24` }}>
                                    {lvlUnlocked}/{levelBadges.length}
                                </Text>
                            </View>

                            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8 }}>
                                {levelBadges.map(badge => {
                                    const BadgeIcon = iconMap[badge.icon] || Star;
                                    const isUnlocked = stats.badgesUnlocked.includes(badge.id);
                                    const progress = getBadgeProgress(badge, stats);
                                    const progressPct = Math.round(progress * 100);
                                    const circleBg = isUnlocked ? `${levelColor}24` : HADES.surfaceRaised;
                                    const circleRing = isUnlocked ? `${levelColor}57` : HADES.border;
                                    const iconColor = isUnlocked ? levelColor : HADES.textDim;

                                    return (
                                        <TouchableOpacity
                                            key={badge.id}
                                            activeOpacity={0.75}
                                            onPress={() => setSelected(badge)}
                                            style={{
                                                width: "31.5%",
                                                backgroundColor: HADES.surface,
                                                borderWidth: 1,
                                                borderColor: HADES.border,
                                                borderRadius: 13,
                                                paddingVertical: 12,
                                                paddingHorizontal: 6,
                                                alignItems: "center",
                                                gap: 6,
                                            }}
                                        >
                                            <View>
                                                <View
                                                    style={{
                                                        width: 38, height: 38, borderRadius: 19,
                                                        backgroundColor: circleBg,
                                                        borderWidth: 1,
                                                        borderColor: circleRing,
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                    }}
                                                >
                                                    <BadgeIcon size={19} color={iconColor} />
                                                </View>
                                                {!isUnlocked && (
                                                    <View
                                                        style={{
                                                            position: "absolute", bottom: -2, right: -3,
                                                            width: 15, height: 15, borderRadius: 8,
                                                            backgroundColor: HADES.surfaceRaised,
                                                            borderWidth: 1.5, borderColor: HADES.surface,
                                                            alignItems: "center", justifyContent: "center",
                                                        }}
                                                    >
                                                        <Lock size={8} color={HADES.textDim} />
                                                    </View>
                                                )}
                                            </View>

                                            <Text
                                                numberOfLines={2}
                                                style={{ fontSize: 11, fontWeight: "700", lineHeight: 13.5, textAlign: "center", color: isUnlocked ? HADES.textSecondary : HADES.textFaint }}
                                            >
                                                {badge.name}
                                            </Text>

                                            {isUnlocked ? (
                                                <View style={{ flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 6, paddingVertical: 2, paddingLeft: 5, paddingRight: 6, backgroundColor: circleBg }}>
                                                    <Check size={9} color={levelColor} />
                                                    <Text style={{ fontSize: 8, fontWeight: "800", letterSpacing: 0.3, color: levelColor }}>CONQUISTADA</Text>
                                                </View>
                                            ) : (
                                                <View style={{ width: "100%" }}>
                                                    <View style={{ height: 3, borderRadius: 2, backgroundColor: HADES.surfaceOverlay, overflow: "hidden" }}>
                                                        <View style={{ height: "100%", width: `${progressPct}%`, borderRadius: 2, backgroundColor: levelColor }} />
                                                    </View>
                                                    <Text style={{ fontSize: 8.5, fontWeight: "700", color: HADES.textDim, marginTop: 4 }}>{progressPct}%</Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    );
                })}
            </ScrollView>

            <DetalheMedalhaSheet
                badge={selected}
                isUnlocked={selectedUnlocked}
                progress={selectedProgress}
                currentVal={selectedCurrentVal}
                onClose={() => setSelected(null)}
            />
        </SafeAreaView>
    );
}

/** Placeholder da tela de medalhas enquanto as estatísticas ainda não resolveram. */
function BadgesSkeleton() {
    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: HADES.bg }} edges={["top"]}>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 }}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    activeOpacity={0.7}
                    style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: HADES.surfaceRaised, alignItems: "center", justifyContent: "center" }}
                >
                    <ArrowLeft size={19} color={HADES.textSecondary} />
                </TouchableOpacity>
                <View style={{ flex: 1, gap: 6 }}>
                    <Text style={{ fontSize: 22, fontWeight: "700", color: HADES.text, letterSpacing: -0.3 }}>Medalhas</Text>
                    <Skeleton width={110} height={13} hades />
                </View>
            </View>

            {/* Resumo por nível */}
            <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingBottom: 10 }}>
                {[0, 1, 2, 3].map((i) => (
                    <View
                        key={i}
                        style={{
                            flex: 1,
                            alignItems: "center",
                            gap: 6,
                            paddingVertical: 9,
                            paddingHorizontal: 4,
                            borderRadius: 11,
                            backgroundColor: HADES.surfaceRaised,
                            borderWidth: 1,
                            borderColor: HADES.border,
                        }}
                    >
                        <Skeleton width={8} height={8} borderRadius={3} hades />
                        <Skeleton width={34} height={10} hades />
                        <Skeleton width={24} height={10} hades />
                    </View>
                ))}
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
                {/* Progresso total */}
                <View style={{ backgroundColor: HADES.surface, borderWidth: 1, borderColor: HADES.border, borderRadius: 16, padding: 16 }}>
                    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 13 }}>
                        <View style={{ gap: 6 }}>
                            <Skeleton width={90} height={12} hades />
                            <Skeleton width={110} height={13} hades />
                        </View>
                        <Skeleton width={54} height={32} hades />
                    </View>
                    <Skeleton width="100%" height={10} borderRadius={6} hades />
                </View>

                {/* Seções por nível */}
                {[0, 1].map((secao) => (
                    <View key={secao} style={{ marginTop: 22 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 12 }}>
                            <Skeleton width={9} height={9} borderRadius={3} hades />
                            <View style={{ flex: 1, gap: 5 }}>
                                <Skeleton width={110} height={15} hades />
                                <Skeleton width={140} height={11} hades />
                            </View>
                            <Skeleton width={40} height={18} borderRadius={7} hades />
                        </View>

                        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8 }}>
                            {[0, 1, 2].map((i) => (
                                <View
                                    key={i}
                                    style={{
                                        width: "31.5%",
                                        backgroundColor: HADES.surface,
                                        borderWidth: 1,
                                        borderColor: HADES.border,
                                        borderRadius: 13,
                                        paddingVertical: 12,
                                        paddingHorizontal: 6,
                                        alignItems: "center",
                                        gap: 8,
                                    }}
                                >
                                    <SkeletonCircle size={38} hades />
                                    <Skeleton width="80%" height={11} hades />
                                    <Skeleton width="60%" height={9} hades />
                                </View>
                            ))}
                        </View>
                    </View>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}
