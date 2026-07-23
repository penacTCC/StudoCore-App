import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, findNodeHandle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Calendar, ChevronDown } from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import { HADES } from "@/constants/hades";
import { LEADERBOARD_TABS, LeaderboardFilter, ROTULO_PERIODO, formatarMinutos } from "@/constants/ranking";
import Avatar from "@/components/ui/Avatar";
import PodioRanking, { LinhaRanking } from "@/components/grupo/PodioRanking";
import { useMembrosGrupo } from "@/hooks/useMembrosGrupo";
import { useRankingHorasGrupo } from "@/hooks/useRankingHorasGrupo";
import { useAuth } from "@/hooks/useAuth";

export default function RankingCompletoScreen() {
    const { groupId, filtro, grupoNome } = useLocalSearchParams<{
        groupId?: string;
        filtro?: string;
        grupoNome?: string;
    }>();

    const [periodo, setPeriodo] = useState<LeaderboardFilter>(
        (filtro as LeaderboardFilter) || "semanal"
    );

    const { membros } = useMembrosGrupo({ grupoId: groupId as string });
    const { rankingMembros } = useRankingHorasGrupo(groupId, periodo, membros);
    const { userId } = useAuth();

    const linhas: LinhaRanking[] = useMemo(
        () =>
            rankingMembros
                .filter((item) => item.membro)
                .map((item) => ({
                    userId: item.user_id,
                    nome: item.membro!.userData?.nome_usuario || "Sem nome",
                    foto: item.membro!.userData?.foto_usuario,
                    minutos: item.total_minutos,
                    ofensiva: item.membro!.ofensiva ?? 0,
                    admin: !!item.membro!.administrador,
                    online: false,
                    ehVoce: item.user_id === userId,
                })),
        [rankingMembros, userId]
    );

    const resto = linhas.slice(3);

    const seuIndex = linhas.findIndex((l) => l.ehVoce);
    const faltaTexto = useMemo(() => {
        if (seuIndex <= 0) return null;
        const acima = linhas[seuIndex - 1];
        const voce = linhas[seuIndex];
        const diff = acima.minutos - voce.minutos;
        if (diff <= 0) return null;
        return `falta ${formatarMinutos(diff)} para o ${seuIndex}º`;
    }, [linhas, seuIndex]);

    const abrirMembro = (linha: LinhaRanking, rank: number) =>
        router.push({
            pathname: "/(modals)/member-profile",
            params: {
                userId: linha.userId,
                administrador: String(linha.admin),
                rank: String(rank),
            },
        });

    // Rastreio da posição do "Você" na lista, pra saber quando mostrar o marcador flutuante.
    const scrollRef = useRef<ScrollView>(null);
    const youNodeRef = useRef<View>(null);
    const [containerHeight, setContainerHeight] = useState(0);
    const [scrollY, setScrollY] = useState(0);
    const [youY, setYouY] = useState<number | null>(null);
    const [youHeight, setYouHeight] = useState(0);

    const medirPosicaoVoce = () => {
        requestAnimationFrame(() => {
            const scrollNode = findNodeHandle(scrollRef.current);
            if (!scrollNode) return;
            youNodeRef.current?.measureLayout(
                scrollNode as any,
                (_x: number, y: number, _w: number, h: number) => {
                    setYouY(y);
                    setYouHeight(h);
                },
                () => {}
            );
        });
    };

    useEffect(() => {
        if (seuIndex >= 3) medirPosicaoVoce();
    }, [linhas, seuIndex]);

    const seuVisivel =
        youY === null ||
        (scrollY + 8 < youY + youHeight && scrollY + containerHeight - 8 > youY);

    const irParaSuaPosicao = () => {
        if (youY === null) return;
        scrollRef.current?.scrollTo({ y: Math.max(youY - 120, 0), animated: true });
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top"]}>
            {/* Header */}
            <View
                style={{
                    paddingTop: 6,
                    paddingHorizontal: 20,
                    paddingBottom: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                }}
            >
                <TouchableOpacity
                    onPress={() => router.back()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{
                        width: 38,
                        height: 38,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <ArrowLeft size={19} color={HADES.textSecondary} />
                </TouchableOpacity>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 18, fontWeight: "700", color: HADES.text, letterSpacing: -0.2 }}>
                        Ranking completo
                    </Text>
                </View>
            </View>

            {/* Abas de período */}
            <View
                style={{
                    flexDirection: "row",
                    gap: 3,
                    marginHorizontal: 20,
                    marginBottom: 15,
                    padding: 4,
                    backgroundColor: HADES.surfaceRaised,
                    borderWidth: 1,
                    borderColor: HADES.border,
                    borderRadius: 13,
                }}
            >
                {LEADERBOARD_TABS.map((tab) => {
                    const ativo = tab.key === periodo;
                    return (
                        <TouchableOpacity
                            key={tab.key}
                            onPress={() => setPeriodo(tab.key)}
                            activeOpacity={0.8}
                            style={{
                                flex: 1,
                                alignItems: "center",
                                paddingVertical: 9,
                                borderRadius: 10,
                                backgroundColor: ativo ? HADES.accentSolid : "transparent",
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 12.5,
                                    fontWeight: ativo ? "700" : "600",
                                    color: ativo ? "#000" : HADES.textMuted,
                                }}
                            >
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <View style={{ flex: 1 }}>
                <ScrollView
                    ref={scrollRef}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
                    showsVerticalScrollIndicator={false}
                    onLayout={(e) => setContainerHeight(e.nativeEvent.layout.height)}
                    onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
                    scrollEventThrottle={16}
                >
                    <PodioRanking
                        linhas={linhas}
                        formatarMinutos={formatarMinutos}
                        onAbrirMembro={abrirMembro}
                        variante="completa"
                    />

                    <View style={{ flexDirection: "column" }}>
                        {resto.map((linha, i) => {
                            const rank = i + 4;
                            const isVoce = linha.ehVoce;

                            return (
                                <View
                                    key={linha.userId}
                                    ref={isVoce ? youNodeRef : undefined}
                                    onLayout={isVoce ? medirPosicaoVoce : undefined}
                                >
                                    <TouchableOpacity
                                        onPress={() => abrirMembro(linha, rank)}
                                        activeOpacity={0.75}
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            gap: 13,
                                            paddingVertical: 14,
                                            paddingHorizontal: isVoce ? 10 : 6,
                                            marginVertical: isVoce ? 2 : 0,
                                            backgroundColor: isVoce ? "rgba(255,154,0,0.10)" : "transparent",
                                            borderWidth: isVoce ? 1 : 0,
                                            borderColor: isVoce ? "rgba(255,154,0,0.35)" : "transparent",
                                            borderRadius: isVoce ? 12 : 0,
                                            borderBottomWidth: isVoce || i === resto.length - 1 ? 0 : 1,
                                            borderBottomColor: "rgba(255,255,255,0.055)",
                                        }}
                                    >
                                        <Text
                                            style={{
                                                width: 20,
                                                textAlign: "center",
                                                fontSize: isVoce ? 15 : 14,
                                                fontWeight: isVoce ? "800" : "700",
                                                color: isVoce ? HADES.accentSolid : HADES.textFaint,
                                            }}
                                        >
                                            {rank}
                                        </Text>

                                        <Avatar foto={linha.foto} nome={linha.nome} size={38} />

                                        <View style={{ flex: 1, minWidth: 0 }}>
                                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                                <Text
                                                    style={{
                                                        fontSize: 14,
                                                        fontWeight: isVoce ? "700" : "600",
                                                        color: HADES.text,
                                                    }}
                                                    numberOfLines={1}
                                                >
                                                    {linha.nome}
                                                </Text>
                                                {isVoce && (
                                                    <Text
                                                        style={{
                                                            fontSize: 8,
                                                            fontWeight: "800",
                                                            letterSpacing: 0.4,
                                                            color: "#000",
                                                            backgroundColor: HADES.accentSolid,
                                                            borderRadius: 4,
                                                            paddingVertical: 2,
                                                            paddingHorizontal: 5,
                                                        }}
                                                    >
                                                        VOCÊ
                                                    </Text>
                                                )}
                                            </View>
                                            {isVoce && faltaTexto && (
                                                <Text style={{ fontSize: 11, color: "#cf9a4e", marginTop: 2 }}>
                                                    {faltaTexto}
                                                </Text>
                                            )}
                                        </View>

                                        <Text
                                            style={{
                                                fontSize: 14,
                                                fontWeight: isVoce ? "800" : "700",
                                                color: isVoce ? HADES.accentSolid : HADES.textSecondary,
                                            }}
                                        >
                                            {formatarMinutos(linha.minutos)}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            );
                        })}
                    </View>
                </ScrollView>

                {/* Marcador flutuante "Você", só quando sua posição está fora da tela */}
                {youY !== null && !seuVisivel && seuIndex >= 0 && (
                    <TouchableOpacity
                        onPress={irParaSuaPosicao}
                        activeOpacity={0.85}
                        style={{
                            position: "absolute",
                            left: 20,
                            right: 20,
                            bottom: 14,
                            height: 54,
                            borderRadius: 15,
                            backgroundColor: "rgba(28,22,8,0.92)",
                            borderWidth: 1.5,
                            borderColor: HADES.accentSolid,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 11,
                            paddingHorizontal: 13,
                            shadowColor: "#000",
                            shadowOpacity: 0.4,
                            shadowRadius: 16,
                            shadowOffset: { width: 0, height: 6 },
                            elevation: 8,
                        }}
                    >
                        <Text style={{ width: 22, textAlign: "center", fontSize: 14, fontWeight: "800", color: HADES.accentSolid }}>
                            {seuIndex + 1}
                        </Text>
                        <Avatar foto={linhas[seuIndex]?.foto} nome={linhas[seuIndex]?.nome} size={34} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={{ fontSize: 13.5, fontWeight: "700", color: HADES.text }}>Você</Text>
                            <Text style={{ fontSize: 11, color: "#cf9a4e", marginTop: 1 }} numberOfLines={1}>
                                sua posição no ranking
                            </Text>
                        </View>
                        <Text style={{ fontSize: 13, fontWeight: "800", color: HADES.accentSolid }}>
                            {formatarMinutos(linhas[seuIndex]?.minutos ?? 0)}
                        </Text>
                        <View
                            style={{
                                width: 30,
                                height: 30,
                                borderRadius: 15,
                                backgroundColor: HADES.accentSolid,
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <ChevronDown size={17} color="#000" />
                        </View>
                    </TouchableOpacity>
                )}
            </View>
        </SafeAreaView>
    );
}
