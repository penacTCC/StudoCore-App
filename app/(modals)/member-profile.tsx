import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, Flame, Clock, Scale, Trophy, Star, Globe, CheckCircle2 } from "lucide-react-native";
import { HADES } from "@/constants/hades";
import Avatar from "@/components/ui/Avatar";
import { buscarPerfil } from "@/services/auth";
import { buscarGamificacao } from "@/services/gamificacao";
import { useSessoesUsuario } from "@/hooks/useSessoesFoco";
import { APP_BADGES, BADGE_LEVEL_COLORS } from "@/constants/badges";
import { BADGE_ICON_MAP } from "@/constants/badgeIcons";
import { getSubjectColor, formatDuration, getTimeAgo } from "@/constants/helpers";
import type { Profile } from "@/types/profile";
import type { Gamificacao } from "@/types/gamificacao";

// Início da semana atual (segunda-feira), igual ao cálculo usado em profileStats/brain.
const getInicioDaSemana = () => {
    const hoje = new Date();
    const diaDaSemana = hoje.getDay();
    const offsetSegunda = diaDaSemana === 0 ? -6 : 1 - diaDaSemana;
    const inicio = new Date(hoje);
    inicio.setHours(0, 0, 0, 0);
    inicio.setDate(hoje.getDate() + offsetSegunda);
    return inicio;
};

export default function MemberProfileScreen() {
    const router = useRouter();
    const { userId, administrador, rank } = useLocalSearchParams<{
        userId: string;
        administrador?: string;
        rank?: string;
    }>();

    const [profile, setProfile] = useState<Profile | null>(null);
    const [gamificacao, setGamificacao] = useState<Gamificacao | null>(null);

    const { savedSessions, loading: loadingSessions } = useSessoesUsuario(userId);

    useEffect(() => {
        if (!userId) return;
        buscarPerfil(userId).then(({ data }) => setProfile(data));
        buscarGamificacao(userId).then(setGamificacao);
    }, [userId]);

    const joinDate = profile?.created_at
        ? new Intl.DateTimeFormat("pt-BR").format(new Date(profile.created_at))
        : "...";

    const unlockedBadges = APP_BADGES.filter((b) => profile?.medalhas_desbloqueadas?.includes(b.id));

    // Progresso da meta semanal a partir das sessões públicas já carregadas (RLS filtra as privadas de outro usuário).
    const inicioDaSemana = getInicioDaSemana();
    const minutosEstaSemana = savedSessions
        .filter((s) => new Date(s.created_at || s.data_sessao) >= inicioDaSemana)
        .reduce((total, s) => total + (s.tempo_minutos || 0), 0);
    const metaSemanaMinutos = profile?.minutos_semana ?? 720;
    const progressoSemanal = Math.min(Math.round((minutosEstaSemana / metaSemanaMinutos) * 100), 100);

    if (!profile) {
        return (
            <SafeAreaView
                style={{ flex: 1, backgroundColor: HADES.bg, alignItems: "center", justifyContent: "center" }}
            >
                <ActivityIndicator color={HADES.accentSolid} />
            </SafeAreaView>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: HADES.bg }}>
            {/* Banner + avatar sobreposto */}
            <View>
                <LinearGradient
                    colors={["#241a44", HADES.bg]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ height: 150 }}
                />
                <SafeAreaView edges={["top"]} style={{ position: "absolute", top: 0, left: 0, right: 0 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8 }}>
                        <TouchableOpacity
                            onPress={() => router.back()}
                            style={{
                                width: 38,
                                height: 38,
                                borderRadius: 19,
                                backgroundColor: "rgba(0,0,0,0.3)",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <ChevronLeft size={22} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
                <View style={{ position: "absolute", bottom: -44, left: 0, right: 0, alignItems: "center" }}>
                    <View style={{ borderRadius: 999, borderWidth: 3, borderColor: HADES.bg }}>
                        <Avatar foto={profile.foto_usuario} nome={profile.nome_usuario} size={88} />
                    </View>
                </View>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingTop: 52, paddingBottom: 32, paddingHorizontal: 20 }}
            >
                {/* Nome & handle */}
                <View style={{ alignItems: "center", marginBottom: 16 }}>
                    <Text style={{ fontSize: 20, fontWeight: "700", color: HADES.text, marginTop: 8 }}>
                        {profile.nome_real || profile.nome_usuario}
                    </Text>
                    <Text style={{ fontSize: 14, color: HADES.textMuted }}>@{profile.nome_usuario}</Text>
                    <Text style={{ fontSize: 12, color: HADES.textDim, marginTop: 2 }}>Desde {joinDate}</Text>
                    {administrador === "true" && (
                        <View
                            style={{
                                backgroundColor: HADES.amberTint,
                                paddingHorizontal: 12,
                                paddingVertical: 4,
                                borderRadius: 999,
                                marginTop: 8,
                                borderWidth: 1,
                                borderColor: "rgba(242,176,61,0.25)",
                            }}
                        >
                            <Text style={{ color: HADES.amber, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 }}>
                                ADMINISTRADOR
                            </Text>
                        </View>
                    )}
                </View>

                {/* Stats leves */}
                <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
                    <View style={estilos.statChip}>
                        <Clock size={20} color={HADES.accentSolid} />
                        <View>
                            <Text style={estilos.statValor}>{profile.horas_totais ?? 0}h</Text>
                            <Text style={estilos.statRotulo}>Horas Totais</Text>
                        </View>
                    </View>
                    <View style={estilos.statChip}>
                        <Flame size={20} color={HADES.green} />
                        <View>
                            <Text style={estilos.statValor}>{gamificacao?.melhor_ofensiva ?? 0}</Text>
                            <Text style={estilos.statRotulo}>Melhor Ofensiva</Text>
                        </View>
                    </View>
                </View>

                {/* Botão comparar */}
                <TouchableOpacity
                    onPress={() => router.push({ pathname: "/(modals)/compare-profile", params: { userId } })}
                    activeOpacity={0.85}
                    style={{
                        backgroundColor: HADES.violet,
                        height: 50,
                        borderRadius: 15,
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "row",
                        gap: 8,
                        marginBottom: 16,
                    }}
                >
                    <Scale size={18} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Comparar Perfil</Text>
                </TouchableOpacity>

                {/* Ranking + meta semanal */}
                <View style={[estilos.card, { marginBottom: 16 }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <Text style={{ fontSize: 11, fontWeight: "600", color: HADES.textMuted, letterSpacing: 0.8, textTransform: "uppercase" }}>
                            Ranking no Grupo
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, opacity: 0.5 }}>
                            <Trophy size={12} color={HADES.textMuted} />
                            <Text style={{ fontSize: 10, color: HADES.textDim }}>Elo em breve</Text>
                        </View>
                    </View>

                    <Text style={{ fontSize: 30, fontWeight: "800", color: HADES.text, marginBottom: 12 }}>
                        {rank ? `#${rank}` : "—"}
                    </Text>

                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <Text style={{ fontSize: 12, color: HADES.textMuted }}>Meta semanal</Text>
                        <Text style={{ fontSize: 12, color: HADES.textMuted }}>{progressoSemanal}%</Text>
                    </View>
                    <View style={{ height: 10, backgroundColor: HADES.surfaceOverlay, borderRadius: 5, overflow: "hidden" }}>
                        <View style={{ height: "100%", backgroundColor: HADES.green, borderRadius: 5, width: `${progressoSemanal}%` }} />
                    </View>
                </View>

                {/* Medalhas */}
                <View style={[estilos.card, { marginBottom: 16 }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: HADES.text }}>Medalhas</Text>
                        <Text style={{ fontSize: 12, color: HADES.textDim }}>
                            {unlockedBadges.length}/{APP_BADGES.length}
                        </Text>
                    </View>
                    {unlockedBadges.length === 0 ? (
                        <Text style={{ fontSize: 12, color: HADES.textDim, textAlign: "center", paddingVertical: 16 }}>
                            Nenhuma medalha conquistada ainda.
                        </Text>
                    ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
                            {unlockedBadges.map((badge) => {
                                const BadgeIcon = BADGE_ICON_MAP[badge.icon] || Star;
                                const levelColor = BADGE_LEVEL_COLORS[badge.level];
                                return (
                                    <View key={badge.id} style={{ alignItems: "center", gap: 6, width: 64 }}>
                                        <View
                                            style={{
                                                width: 56,
                                                height: 56,
                                                borderRadius: 28,
                                                alignItems: "center",
                                                justifyContent: "center",
                                                backgroundColor: `${levelColor}25`,
                                                borderWidth: 2,
                                                borderColor: levelColor,
                                            }}
                                        >
                                            <BadgeIcon size={22} color={levelColor} />
                                        </View>
                                        <Text style={{ fontSize: 10, textAlign: "center", color: HADES.textMuted }} numberOfLines={2}>
                                            {badge.name}
                                        </Text>
                                    </View>
                                );
                            })}
                        </ScrollView>
                    )}
                </View>

                {/* Sessões públicas anteriores, estilo "post" */}
                <Text style={{ fontSize: 14, fontWeight: "500", color: HADES.textMuted, marginBottom: 12 }}>
                    Sessões Públicas Anteriores
                </Text>
                {loadingSessions ? (
                    <Text style={{ fontSize: 12, color: HADES.textDim, textAlign: "center", paddingVertical: 16 }}>
                        Carregando...
                    </Text>
                ) : savedSessions.length === 0 ? (
                    <View style={[estilos.card, { alignItems: "center", paddingVertical: 24 }]}>
                        <Text style={{ fontSize: 12, color: HADES.textDim, textAlign: "center" }}>
                            Nenhuma sessão pública para mostrar.
                        </Text>
                    </View>
                ) : (
                    <View style={{ gap: 12 }}>
                        {savedSessions.slice(0, 10).map((session) => {
                            const subjectColors = getSubjectColor(session.disciplina);
                            const hours = Math.floor(session.tempo_minutos / 60);
                            const minutes = session.tempo_minutos % 60;
                            const verificada = session.questoes_acertadas > 7;
                            return (
                                <View key={session.id} style={estilos.card}>
                                    {/* Header do post */}
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                        <Avatar foto={profile.foto_usuario} nome={profile.nome_usuario} size={32} />
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                                <Text style={{ fontSize: 14, fontWeight: "500", color: HADES.text }}>
                                                    {profile.nome_usuario}
                                                </Text>
                                                {verificada && <CheckCircle2 size={12} color={HADES.green} />}
                                            </View>
                                            <Text style={{ fontSize: 12, color: HADES.textDim }}>
                                                {getTimeAgo(session.created_at)}
                                            </Text>
                                        </View>
                                        <Globe size={12} color={HADES.textFaint} />
                                    </View>

                                    {/* Conteúdo do post */}
                                    <Text style={{ fontSize: 14, fontWeight: "700", color: HADES.text, marginBottom: 6 }} numberOfLines={1}>
                                        {session.conteudo_especifico || `Sessão de ${session.disciplina}`}
                                    </Text>
                                    <View
                                        style={{
                                            alignSelf: "flex-start",
                                            paddingHorizontal: 8,
                                            paddingVertical: 2,
                                            borderRadius: 6,
                                            marginBottom: 12,
                                            backgroundColor: subjectColors.bg,
                                        }}
                                    >
                                        <Text style={{ fontSize: 11, fontWeight: "500", color: subjectColors.text }}>
                                            {session.disciplina}
                                        </Text>
                                    </View>

                                    {/* Stats em 3 colunas */}
                                    <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: HADES.border, paddingTop: 12 }}>
                                        <View style={{ flex: 1, alignItems: "center" }}>
                                            <Text style={estilos.postStatValor}>{formatDuration(hours, minutes)}</Text>
                                            <Text style={estilos.postStatRotulo}>Tempo</Text>
                                        </View>
                                        <View style={{ flex: 1, alignItems: "center", borderLeftWidth: 1, borderLeftColor: HADES.border }}>
                                            <Text style={estilos.postStatValor}>{session.questoes_respondidas}</Text>
                                            <Text style={estilos.postStatRotulo}>Questões</Text>
                                        </View>
                                        <View style={{ flex: 1, alignItems: "center", borderLeftWidth: 1, borderLeftColor: HADES.border }}>
                                            <Text style={estilos.postStatValor}>{session.questoes_acertadas}</Text>
                                            <Text style={estilos.postStatRotulo}>Acertos</Text>
                                        </View>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const estilos = {
    card: {
        backgroundColor: HADES.surface,
        borderWidth: 1,
        borderColor: HADES.border,
        borderRadius: 16,
        padding: 16,
    },
    statChip: {
        flex: 1,
        padding: 12,
        borderRadius: 14,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 10,
        backgroundColor: HADES.surface,
        borderWidth: 1,
        borderColor: HADES.border,
    },
    statValor: {
        fontSize: 19,
        fontWeight: "700" as const,
        color: HADES.text,
    },
    statRotulo: {
        fontSize: 12,
        color: HADES.textMuted,
    },
    postStatValor: {
        fontSize: 14,
        fontWeight: "700" as const,
        color: HADES.text,
    },
    postStatRotulo: {
        fontSize: 10,
        color: HADES.textDim,
        textTransform: "uppercase" as const,
    },
};
