import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Share } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ChevronLeft, Share2, Crown, Clock, ListChecks, Trophy, Medal, Flame, BookOpen, Swords } from "lucide-react-native";
import { HADES } from "@/constants/hades";
import { useAuth } from "@/hooks/useAuth";
import Avatar from "@/components/ui/Avatar";
import { buscarPerfil } from "@/services/auth";
import { buscarGamificacao } from "@/services/gamificacao";
import { APP_BADGES } from "@/constants/badges";
import { getAvatarColor } from "@/constants/helpers";
import type { Profile } from "@/types/profile";
import type { Gamificacao } from "@/types/gamificacao";
import type { LucideIcon } from "lucide-react-native";

type PerfilComparavel = {
    profile: Profile;
    gamificacao: Gamificacao | null;
};

// Mesma fórmula usada dentro do componente Avatar pra colorir o fallback de iniciais —
// repetida aqui pra usar a "cor do usuário" também nas barras e nos destaques deste duelo.
const corDoUsuario = (nome?: string | null) => getAvatarColor(nome ? nome.charCodeAt(0) % 5 : 0);

type Lado = "eu" | "ele" | "empate";
const decidirLado = (meu: number, dele: number): Lado => (meu > dele ? "eu" : dele > meu ? "ele" : "empate");

const formatarNumero = (valor: number) => valor.toLocaleString("pt-BR");

export default function CompareProfileScreen() {
    const router = useRouter();
    const { userId } = useLocalSearchParams<{ userId: string }>();
    const { userId: meuId } = useAuth();

    const [eu, setEu] = useState<PerfilComparavel | null>(null);
    const [ele, setEle] = useState<PerfilComparavel | null>(null);

    useEffect(() => {
        if (!meuId || !userId) return;

        const carregarLado = async (id: string): Promise<PerfilComparavel | null> => {
            const { data: profile } = await buscarPerfil(id);
            if (!profile) return null;
            const gamificacao = await buscarGamificacao(id);
            return { profile, gamificacao };
        };

        carregarLado(meuId).then(setEu);
        carregarLado(userId).then(setEle);
    }, [meuId, userId]);

    if (!eu || !ele) {
        return (
            <SafeAreaView
                style={{ flex: 1, backgroundColor: HADES.bg, alignItems: "center", justifyContent: "center" }}
            >
                <ActivityIndicator color={HADES.accentSolid} />
            </SafeAreaView>
        );
    }

    const corEu = corDoUsuario(eu.profile.nome_usuario);
    const corEle = corDoUsuario(ele.profile.nome_usuario);

    const minhasMedalhas = APP_BADGES.filter((b) => eu.profile.medalhas_desbloqueadas?.includes(b.id)).length;
    const medalhasDele = APP_BADGES.filter((b) => ele.profile.medalhas_desbloqueadas?.includes(b.id)).length;

    const metricas: { label: string; icon: LucideIcon; meu: number; dele: number; sufixo?: string }[] = [
        { label: "Horas Totais", icon: Clock, meu: eu.profile.horas_totais ?? 0, dele: ele.profile.horas_totais ?? 0, sufixo: "h" },
        { label: "Questões", icon: ListChecks, meu: eu.profile.questoes_feitas ?? 0, dele: ele.profile.questoes_feitas ?? 0 },
        { label: "Melhor Ofensiva", icon: Trophy, meu: eu.gamificacao?.melhor_ofensiva ?? 0, dele: ele.gamificacao?.melhor_ofensiva ?? 0, sufixo: " dias" },
        { label: "Medalhas", icon: Medal, meu: minhasMedalhas, dele: medalhasDele },
        { label: "Ofensiva Atual", icon: Flame, meu: eu.gamificacao?.ofensiva ?? 0, dele: ele.gamificacao?.ofensiva ?? 0, sufixo: " dias" },
    ];

    const vitoriasEu = metricas.filter((m) => decidirLado(m.meu, m.dele) === "eu").length;
    const vitoriasEle = metricas.filter((m) => decidirLado(m.meu, m.dele) === "ele").length;
    const liderante: Lado = vitoriasEu > vitoriasEle ? "eu" : vitoriasEle > vitoriasEu ? "ele" : "empate";

    const compartilhar = () => {
        Share.share({
            message: `Duelo no StudoCore: Você ${vitoriasEu} x ${vitoriasEle} ${ele.profile.nome_usuario} 🔥`,
        });
    };

    const desafiar = () => {
        Alert.alert("Em breve", "O modo Desafio (1x1) ainda está em desenvolvimento.");
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top", "bottom"]}>
            {/* Header */}
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: 20,
                    paddingTop: 6,
                    paddingBottom: 12,
                }}
            >
                <TouchableOpacity onPress={() => router.back()} style={estilos.botaoCircular}>
                    <ChevronLeft size={20} color={HADES.textSecondary} />
                </TouchableOpacity>
                <Text style={{ fontSize: 16, fontWeight: "600", color: HADES.text }}>Duelo</Text>
                <TouchableOpacity onPress={compartilhar} style={estilos.botaoCircular}>
                    <Share2 size={16} color={HADES.textSecondary} />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
            >
                {/* VS hero */}
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingVertical: 24 }}>
                    {/* Eu */}
                    <View style={{ width: 110, alignItems: "center", gap: 10 }}>
                        <View>
                            {liderante === "eu" && (
                                <Crown size={18} color={HADES.amber} style={{ position: "absolute", top: -16, left: 0, right: 0, alignSelf: "center" }} />
                            )}
                            <View style={{ borderRadius: 999, padding: 3, backgroundColor: corEu }}>
                                <View style={{ borderWidth: 3, borderColor: HADES.bg, borderRadius: 999 }}>
                                    <Avatar foto={eu.profile.foto_usuario} nome={eu.profile.nome_usuario} size={78} />
                                </View>
                            </View>
                        </View>
                        <View style={{ alignItems: "center" }}>
                            <Text style={{ fontSize: 16, fontWeight: "700", color: HADES.text }} numberOfLines={1}>
                                {eu.profile.nome_usuario}
                            </Text>
                            <Text style={{ fontSize: 12, fontWeight: "600", marginTop: 1, color: corEu }}>Você</Text>
                        </View>
                    </View>

                    {/* Placar central */}
                    <View style={{ flex: 1, alignItems: "center", paddingTop: 20 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                            <Text style={{ fontSize: 36, fontWeight: "800", color: corEu }}>{vitoriasEu}</Text>
                            <Text style={{ fontSize: 14, fontWeight: "700", color: HADES.textFaint }}>VS</Text>
                            <Text style={{ fontSize: 36, fontWeight: "800", color: corEle }}>{vitoriasEle}</Text>
                        </View>
                        <Text style={{ fontSize: 11, fontWeight: "600", color: HADES.textFaint, letterSpacing: 2, marginTop: 8 }}>
                            VITÓRIAS
                        </Text>
                    </View>

                    {/* Ele */}
                    <View style={{ width: 110, alignItems: "center", gap: 10 }}>
                        <View>
                            {liderante === "ele" && (
                                <Crown size={18} color={HADES.amber} style={{ position: "absolute", top: -16, left: 0, right: 0, alignSelf: "center" }} />
                            )}
                            <View style={{ borderRadius: 999, padding: 3, backgroundColor: corEle }}>
                                <View style={{ borderWidth: 3, borderColor: HADES.bg, borderRadius: 999 }}>
                                    <Avatar foto={ele.profile.foto_usuario} nome={ele.profile.nome_usuario} size={78} />
                                </View>
                            </View>
                        </View>
                        <View style={{ alignItems: "center" }}>
                            <Text style={{ fontSize: 16, fontWeight: "700", color: HADES.text }} numberOfLines={1}>
                                {ele.profile.nome_usuario}
                            </Text>
                            <Text style={{ fontSize: 12, fontWeight: "600", marginTop: 1, color: corEle }}>Rival</Text>
                        </View>
                    </View>
                </View>

                {/* Linhas de comparação, uma barra por métrica */}
                <View style={{ gap: 20, paddingTop: 4 }}>
                    {metricas.map((m) => {
                        const lado = decidirLado(m.meu, m.dele);
                        const Icon = m.icon;
                        const total = Math.max(m.meu + m.dele, 0.0001);
                        const pctEu = (m.meu / total) * 100;
                        const pctEle = 100 - pctEu;
                        return (
                            <View key={m.label}>
                                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                                        {m.label === "Ofensiva Atual" && lado === "eu" && <Flame size={14} color={HADES.amber} />}
                                        <Text style={{ fontSize: 18, fontWeight: "700", color: lado === "eu" ? corEu : HADES.textMuted }}>
                                            {formatarNumero(m.meu)}
                                            {m.sufixo || ""}
                                        </Text>
                                    </View>
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8 }}>
                                        <Icon size={13} color={HADES.textFaint} />
                                        <Text style={{ fontSize: 10, fontWeight: "600", color: HADES.textFaint, letterSpacing: 0.8 }} numberOfLines={1}>
                                            {m.label.toUpperCase()}
                                        </Text>
                                    </View>
                                    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                                        <Text style={{ fontSize: 18, fontWeight: "700", color: lado === "ele" ? corEle : HADES.textMuted }}>
                                            {formatarNumero(m.dele)}
                                            {m.sufixo || ""}
                                        </Text>
                                        {m.label === "Ofensiva Atual" && lado === "ele" && <Flame size={14} color={HADES.amber} />}
                                    </View>
                                </View>
                                <View style={{ flexDirection: "row", gap: 4, height: 8 }}>
                                    <View style={{ height: "100%", width: `${pctEu}%`, backgroundColor: corEu, opacity: lado === "ele" ? 0.3 : 1, borderRadius: 4 }} />
                                    <View style={{ height: "100%", width: `${pctEle}%`, backgroundColor: corEle, opacity: lado === "eu" ? 0.3 : 1, borderRadius: 4 }} />
                                </View>
                            </View>
                        );
                    })}
                </View>

                {/* Matéria favorita (neutro, cor de cada lado) */}
                <View style={{ marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: HADES.border }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 12 }}>
                        <BookOpen size={13} color={HADES.textFaint} />
                        <Text style={{ fontSize: 10, fontWeight: "600", color: HADES.textFaint, letterSpacing: 0.8 }}>
                            MATÉRIA FAVORITA
                        </Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                        <View style={{ flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center", backgroundColor: `${corEu}1a`, borderWidth: 1, borderColor: `${corEu}40` }}>
                            <Text style={{ fontSize: 14, fontWeight: "600", color: corEu }} numberOfLines={1}>
                                {eu.profile.materia_favorita || "—"}
                            </Text>
                        </View>
                        <View style={{ flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center", backgroundColor: `${corEle}1a`, borderWidth: 1, borderColor: `${corEle}40` }}>
                            <Text style={{ fontSize: 14, fontWeight: "600", color: corEle }} numberOfLines={1}>
                                {ele.profile.materia_favorita || "—"}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={{ height: 20 }} />
            </ScrollView>

            {/* CTA */}
            <View style={{ paddingHorizontal: 20, paddingBottom: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: HADES.border }}>
                <TouchableOpacity
                    onPress={desafiar}
                    activeOpacity={0.85}
                    style={{ height: 54, borderRadius: 15, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, backgroundColor: corEu }}
                >
                    <Swords size={18} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Desafiar {ele.profile.nome_usuario}</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const estilos = {
    botaoCircular: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: HADES.surfaceRaised,
        alignItems: "center" as const,
        justifyContent: "center" as const,
    },
};
