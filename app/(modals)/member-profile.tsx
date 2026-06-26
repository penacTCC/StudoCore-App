import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, Flame, Clock, Scale, Trophy, Star, Globe, CheckCircle2 } from "lucide-react-native";
import { COLORS } from "@/constants/colors";
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
        ? new Intl.DateTimeFormat('pt-BR').format(new Date(profile.created_at))
        : "...";

    const unlockedBadges = APP_BADGES.filter(b => profile?.medalhas_desbloqueadas?.includes(b.id));

    // Progresso da meta semanal a partir das sessões públicas já carregadas (RLS filtra as privadas de outro usuário).
    const inicioDaSemana = getInicioDaSemana();
    const minutosEstaSemana = savedSessions
        .filter(s => new Date(s.created_at || s.data_sessao) >= inicioDaSemana)
        .reduce((total, s) => total + (s.tempo_minutos || 0), 0);
    const metaSemanaMinutos = profile?.minutos_semana ?? 720;
    const progressoSemanal = Math.min(Math.round((minutosEstaSemana / metaSemanaMinutos) * 100), 100);

    if (!profile) {
        return (
            <SafeAreaView className="flex-1 bg-slate-950 items-center justify-center">
                <ActivityIndicator color={COLORS.primary} />
            </SafeAreaView>
        );
    }

    return (
        <View className="flex-1 bg-slate-950">
            {/* Banner + avatar sobreposto */}
            <View>
                <LinearGradient
                    colors={[COLORS.violetDarker, COLORS.bgPrimary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ height: 150 }}
                />
                <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
                    <View className="flex-row justify-between px-4 pt-2">
                        <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 rounded-full bg-black/30 items-center justify-center">
                            <ChevronLeft size={22} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
                <View className="absolute bottom-[-44px] left-0 right-0 items-center">
                    <View className="rounded-full" style={{ borderWidth: 3, borderColor: COLORS.bgPrimary }}>
                        <Avatar foto={profile.foto_usuario} nome={profile.nome_usuario} size={88} />
                    </View>
                </View>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 52, paddingBottom: 32 }}>
                {/* Nome & handle */}
                <View className="items-center px-4 mb-4">
                    <Text className="text-xl font-bold text-slate-200 mt-2">
                        {profile.nome_real || profile.nome_usuario}
                    </Text>
                    <Text className="text-sm text-slate-400">@{profile.nome_usuario}</Text>
                    <Text className="text-xs text-slate-500 mt-1">Desde {joinDate}</Text>
                    {administrador === "true" && (
                        <View className="bg-amber-500/10 px-3 py-1 rounded-full mt-2 border border-amber-500/20">
                            <Text className="text-amber-400 text-xs font-bold">ADMINISTRADOR</Text>
                        </View>
                    )}
                </View>

                {/* Stats leves */}
                <View className="px-4 mb-4 flex-row gap-3">
                    <View className="flex-1 p-3 rounded-xl flex-row items-center gap-2" style={{ backgroundColor: COLORS.primaryFaint }}>
                        <Clock size={20} color={COLORS.primaryLight} />
                        <View>
                            <Text className="text-xl font-bold text-slate-200">{profile.horas_totais ?? 0}h</Text>
                            <Text className="text-xs text-slate-400">Horas Totais</Text>
                        </View>
                    </View>
                    <View className="flex-1 p-3 rounded-xl flex-row items-center gap-2" style={{ backgroundColor: COLORS.primaryFaint }}>
                        <Flame size={20} color={COLORS.emeraldLight} />
                        <View>
                            <Text className="text-xl font-bold text-slate-200">{gamificacao?.melhor_ofensiva ?? 0}</Text>
                            <Text className="text-xs text-slate-400">Melhor Ofensiva</Text>
                        </View>
                    </View>
                </View>

                {/* Botão comparar */}
                <View className="px-4 mb-4">
                    <TouchableOpacity
                        onPress={() => router.push({ pathname: "/(modals)/compare-profile", params: { userId } })}
                        className="bg-violet-600 py-3.5 rounded-2xl items-center flex-row justify-center gap-2"
                    >
                        <Scale size={18} color={COLORS.white} />
                        <Text className="text-white font-bold">Comparar Perfil</Text>
                    </TouchableOpacity>
                </View>

                {/* Ranking + meta semanal */}
                <View className="px-4 mb-4">
                    <View className="bg-slate-900 border border-slate-800 rounded-3xl p-4">
                        <View className="flex-row items-center justify-between mb-3">
                            <Text className="text-xs font-medium text-slate-400 uppercase tracking-wider">Ranking no Grupo</Text>
                            <View className="flex-row items-center gap-1 opacity-50">
                                <Trophy size={12} color={COLORS.textMuted} />
                                <Text className="text-[10px] text-slate-500">Elo em breve</Text>
                            </View>
                        </View>

                        <Text className="text-3xl font-black text-slate-200 mb-3">
                            {rank ? `#${rank}` : "—"}
                        </Text>

                        <View className="flex-row items-center justify-between mb-1">
                            <Text className="text-xs text-slate-400">Meta semanal</Text>
                            <Text className="text-xs text-slate-400">{progressoSemanal}%</Text>
                        </View>
                        <View className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                            <View
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${progressoSemanal}%` }}
                            />
                        </View>
                    </View>
                </View>

                {/* Medalhas */}
                <View className="px-4 mb-4">
                    <View className="bg-slate-900 border border-slate-800 rounded-3xl p-4">
                        <View className="flex-row items-center justify-between mb-3">
                            <Text className="text-sm font-semibold text-slate-200">Medalhas</Text>
                            <Text className="text-xs text-slate-500">{unlockedBadges.length}/{APP_BADGES.length}</Text>
                        </View>
                        {unlockedBadges.length === 0 ? (
                            <Text className="text-xs text-slate-500 text-center py-4">Nenhuma medalha conquistada ainda.</Text>
                        ) : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
                                {unlockedBadges.map(badge => {
                                    const BadgeIcon = BADGE_ICON_MAP[badge.icon] || Star;
                                    const levelColor = BADGE_LEVEL_COLORS[badge.level];
                                    return (
                                        <View key={badge.id} className="items-center gap-1.5 w-16">
                                            <View
                                                className="w-14 h-14 rounded-full items-center justify-center"
                                                style={{ backgroundColor: `${levelColor}25`, borderWidth: 2, borderColor: levelColor }}
                                            >
                                                <BadgeIcon size={22} color={levelColor} />
                                            </View>
                                            <Text className="text-[10px] text-center text-slate-400" numberOfLines={2}>
                                                {badge.name}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </ScrollView>
                        )}
                    </View>
                </View>

                {/* Sessões públicas anteriores, estilo "post" */}
                <View className="px-4 mb-4">
                    <Text className="text-sm font-medium text-slate-400 mb-3">Sessões Públicas Anteriores</Text>
                    {loadingSessions ? (
                        <Text className="text-xs text-slate-500 text-center py-4">Carregando...</Text>
                    ) : savedSessions.length === 0 ? (
                        <View className="bg-slate-900 border border-slate-800 rounded-2xl p-6 items-center">
                            <Text className="text-xs text-slate-500 text-center">
                                Nenhuma sessão pública para mostrar.
                            </Text>
                        </View>
                    ) : (
                        <View className="gap-3">
                            {savedSessions.slice(0, 10).map(session => {
                                const subjectColors = getSubjectColor(session.disciplina);
                                const hours = Math.floor(session.tempo_minutos / 60);
                                const minutes = session.tempo_minutos % 60;
                                const verificada = session.questoes_acertadas > 7;
                                return (
                                    <View key={session.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                                        {/* Header do post */}
                                        <View className="flex-row items-center gap-2 mb-3">
                                            <Avatar foto={profile.foto_usuario} nome={profile.nome_usuario} size={32} />
                                            <View className="flex-1">
                                                <View className="flex-row items-center gap-1">
                                                    <Text className="text-sm font-medium text-slate-200">{profile.nome_usuario}</Text>
                                                    {verificada && <CheckCircle2 size={12} color={COLORS.emeraldLight} />}
                                                </View>
                                                <Text className="text-xs text-slate-500">{getTimeAgo(session.created_at)}</Text>
                                            </View>
                                            <Globe size={12} color={COLORS.textMuted} />
                                        </View>

                                        {/* Conteúdo do post */}
                                        <Text className="text-sm font-bold text-slate-200 mb-1" numberOfLines={1}>
                                            {session.conteudo_especifico || `Sessão de ${session.disciplina}`}
                                        </Text>
                                        <View className="self-start px-2 py-0.5 rounded-md mb-3" style={{ backgroundColor: subjectColors.bg }}>
                                            <Text className="text-[11px] font-medium" style={{ color: subjectColors.text }}>
                                                {session.disciplina}
                                            </Text>
                                        </View>

                                        {/* Stats em 3 colunas */}
                                        <View className="flex-row border-t border-slate-800 pt-3">
                                            <View className="flex-1 items-center">
                                                <Text className="text-sm font-bold text-slate-200">{formatDuration(hours, minutes)}</Text>
                                                <Text className="text-[10px] text-slate-500 uppercase">Tempo</Text>
                                            </View>
                                            <View className="flex-1 items-center border-l border-slate-800">
                                                <Text className="text-sm font-bold text-slate-200">{session.questoes_respondidas}</Text>
                                                <Text className="text-[10px] text-slate-500 uppercase">Questões</Text>
                                            </View>
                                            <View className="flex-1 items-center border-l border-slate-800">
                                                <Text className="text-sm font-bold text-slate-200">{session.questoes_acertadas}</Text>
                                                <Text className="text-[10px] text-slate-500 uppercase">Acertos</Text>
                                            </View>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}
