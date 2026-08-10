import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, DeviceEventEmitter, RefreshControl } from "react-native";
import { SafeAreaView } from "@/components/ui/TelaSegura";
import { router, useFocusEffect } from "expo-router";
import { useDadosCache } from "@/hooks/useDadosCache";
import { ArrowLeft, Lock } from "@/components/ui/icons";
import { HADES } from "@/constants/hades";
import {
    APP_BADGES, BADGE_LEVEL_LABELS, BADGE_LEVEL_COLORS,
    BadgeType, BadgeLevel,
} from "@/constants/badges";
import { IconeMedalhaTile } from "@/components/badges/IconeMedalha";
import { loadProfileStats } from "@/services/profileStats";
import type { UserStats } from "@/types/profile";
import DetalheMedalhaSheet from "@/components/badges/DetalheMedalhaSheet";
import { Skeleton } from "@/components/ui/Skeleton";

const LEVELS: BadgeLevel[] = ['basico', 'intermediario', 'avancado', 'elite'];

// Grade de 3 colunas: a arte ocupa quase toda a largura da célula e o nome vem embaixo,
// em duas linhas no máximo. A altura fixa mantém as linhas alinhadas mesmo com nomes curtos.
const TILE_SIZE = 83;
const NOME_LINE_HEIGHT = 17;
// O nome sempre reserva as duas linhas e fica centralizado nelas: assim um nome de uma
// linha não deixa sobra embaixo e todos os cards da linha terminam na mesma altura.
// Os 3px a mais são folga para as descidas (g, ç, ã) da segunda linha, que o Android
// corta quando o bloco tem exatamente a altura das duas linhas.
const NOME_BLOCK_HEIGHT = NOME_LINE_HEIGHT * 2 + 3;
const CELL_PAD_TOP = 14;
const CELL_PAD_BOTTOM = 12;
const TILE_GAP = 10;
const CELL_HEIGHT = CELL_PAD_TOP + TILE_SIZE + TILE_GAP + NOME_BLOCK_HEIGHT + CELL_PAD_BOTTOM;
const GRID_GAP = 10;

/*
  Nome composto pode quebrar entre as palavras, então ganha as duas linhas. Nome de uma
  palavra só não tem onde quebrar — sem isso o RN parte a palavra no meio ("Responded/or").
  Travando em uma linha, o ellipsizeMode="tail" corta com reticências.
*/
function linhasDoNome(nome: string): number {
    return nome.trim().includes(" ") ? 2 : 1;
}

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

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 32 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={atualizando} onRefresh={handleRefresh} tintColor={HADES.accentSolid} />
                }
            >
                {/* Resumo por nível — dentro da rolagem: some junto com o resto ao descer. */}
                <View style={{ flexDirection: "row", gap: 6, marginBottom: 14 }}>
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
                                <Text style={{ fontSize: 10, fontWeight: "700", color: HADES.textSecondary }}>{LEVEL_SHORT[level]}</Text>
                                <Text style={{ fontSize: 10, fontWeight: "700", color }}>{lvlUnlocked}/{levelBadges.length}</Text>
                            </View>
                        );
                    })}
                </View>

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

                            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: GRID_GAP }}>
                                {levelBadges.map(badge => {
                                    const isUnlocked = stats.badgesUnlocked.includes(badge.id);

                                    return (
                                        <TouchableOpacity
                                            key={badge.id}
                                            activeOpacity={0.75}
                                            onPress={() => setSelected(badge)}
                                            style={{
                                                width: "31.5%",
                                                height: CELL_HEIGHT,
                                                backgroundColor: HADES.surface,
                                                borderRadius: 12,
                                                paddingTop: CELL_PAD_TOP,
                                                paddingBottom: CELL_PAD_BOTTOM,
                                                paddingHorizontal: 5,
                                                alignItems: "center",
                                                gap: TILE_GAP,
                                            }}
                                        >
                                            <View>
                                                <IconeMedalhaTile
                                                    badgeId={badge.id}
                                                    icon={badge.icon}
                                                    size={TILE_SIZE}
                                                    color={levelColor}
                                                    locked={!isUnlocked}
                                                />
                                                {!isUnlocked && (
                                                    <View
                                                        style={{
                                                            position: "absolute", bottom: -3, right: -3,
                                                            width: 20, height: 20, borderRadius: 10,
                                                            backgroundColor: HADES.surfaceRaised,
                                                            borderWidth: 2, borderColor: HADES.surface,
                                                            alignItems: "center", justifyContent: "center",
                                                        }}
                                                    >
                                                        <Lock size={10} color={HADES.textDim} />
                                                    </View>
                                                )}
                                            </View>

                                            <View style={{ height: NOME_BLOCK_HEIGHT, justifyContent: "center", alignSelf: "stretch" }}>
                                                <Text
                                                    numberOfLines={linhasDoNome(badge.name)}
                                                    ellipsizeMode="tail"
                                                    style={{
                                                        fontSize: 13,
                                                        fontWeight: "700",
                                                        lineHeight: NOME_LINE_HEIGHT,
                                                        textAlign: "center",
                                                        color: isUnlocked ? HADES.text : HADES.textFaint,
                                                    }}
                                                >
                                                    {badge.name}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}

                                {/* Células vazias para a última linha incompleta não esparramar pelo space-between */}
                                {Array.from({ length: (3 - (levelBadges.length % 3)) % 3 }).map((_, i) => (
                                    <View key={`vazio-${i}`} style={{ width: "31.5%" }} />
                                ))}
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
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 22, fontWeight: "700", color: HADES.text, letterSpacing: -0.3 }}>Medalhas</Text>
                    <Skeleton width={110} height={12.5} hades style={{ marginTop: 1 }} />
                </View>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
                {/* Resumo por nível */}
                <View style={{ flexDirection: "row", gap: 6, marginBottom: 14 }}>
                    {[0, 1, 2, 3].map((i) => (
                        <View
                            key={i}
                            style={{
                                flex: 1,
                                alignItems: "center",
                                gap: 4,
                                paddingVertical: 9,
                                paddingHorizontal: 4,
                                borderRadius: 11,
                                backgroundColor: HADES.surfaceRaised,
                                borderWidth: 1,
                                borderColor: HADES.border,
                            }}
                        >
                            <Skeleton width={34} height={10} hades />
                            <Skeleton width={24} height={10} hades />
                        </View>
                    ))}
                </View>

                {/* Progresso total */}
                <View style={{ backgroundColor: HADES.surface, borderWidth: 1, borderColor: HADES.border, borderRadius: 16, padding: 16 }}>
                    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 13 }}>
                        <View>
                            <Skeleton width={90} height={12} hades />
                            <Skeleton width={110} height={13} hades style={{ marginTop: 3 }} />
                        </View>
                        <Skeleton width={54} height={32} hades />
                    </View>
                    <Skeleton width="100%" height={10} borderRadius={6} hades />
                    {/* A legenda "Cada faixa colorida..." também ocupa lugar no cartão. */}
                    <Skeleton width="90%" height={11.5} hades style={{ marginTop: 10 }} />
                    <Skeleton width="45%" height={11.5} hades style={{ marginTop: 4 }} />
                </View>

                {/* Seções por nível */}
                {[0, 1].map((secao) => (
                    <View key={secao} style={{ marginTop: 22 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 12 }}>
                            <Skeleton width={9} height={9} borderRadius={3} hades />
                            <View style={{ flex: 1 }}>
                                <Skeleton width={110} height={15} hades />
                                <Skeleton width={140} height={11} hades style={{ marginTop: 1 }} />
                            </View>
                            <Skeleton width={40} height={18} borderRadius={7} hades />
                        </View>

                        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: GRID_GAP }}>
                            {[0, 1, 2].map((i) => (
                                <View
                                    key={i}
                                    style={{
                                        width: "31.5%",
                                        height: CELL_HEIGHT,
                                        backgroundColor: HADES.surface,
                                        borderRadius: 12,
                                        paddingTop: CELL_PAD_TOP,
                                        paddingBottom: CELL_PAD_BOTTOM,
                                        paddingHorizontal: 5,
                                        alignItems: "center",
                                        gap: TILE_GAP,
                                    }}
                                >
                                    <Skeleton width={TILE_SIZE} height={TILE_SIZE} borderRadius={19} hades />
                                    <View style={{ height: NOME_BLOCK_HEIGHT, justifyContent: "center", alignItems: "center", alignSelf: "stretch", gap: 4 }}>
                                        <Skeleton width="80%" height={11} hades />
                                        <Skeleton width="55%" height={11} hades />
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}
