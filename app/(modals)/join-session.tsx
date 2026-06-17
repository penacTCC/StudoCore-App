import { useEffect, useMemo, useState } from "react";

// Componentes do React Native
import { View, Text, TouchableOpacity, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Clock, Play, Flame } from "lucide-react-native";

// Componentes do expo router
import { router, useLocalSearchParams } from "expo-router";

// Constantes
import { COLORS } from "@/constants/colors";
import { getSubjectColor, formatDuration } from "@/constants/helpers";
import { SessionCardItem } from "@/types/sessions";

// tempo
function getTimeAgo(createdAt: string) {
    const diff = Date.now() - new Date(createdAt).getTime();
    if (Number.isNaN(diff) || diff < 0) {
        return "Agora";
    }

    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Agora";
    if (minutes < 60) return `${minutes}m atrás`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h atrás`;

    const days = Math.floor(hours / 24);
    return `${days}d atrás`;
}
// Função para extrair iniciais do nome do usuário
function getInitials(text: string) {
    return text
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
}

export default function JoinSessionScreen() {
    const { session: sessionParam } = useLocalSearchParams<{ session?: string }>();

    // Parse session data enviada pelo SessionCard.
    const session = useMemo<SessionCardItem | null>(() => {
        if (!sessionParam) return null;

        try {
            return JSON.parse(sessionParam as string) as SessionCardItem;
        } catch (error) {
            console.warn("Erro ao parsear sessão:", error);
            return null;
        }
    }, [sessionParam]);

    const handleJoin = () => {
        // Aqui podemos registrar a presença do usuário na sessão e redirecionar para o foco.
        router.dismissAll();
        router.replace({ pathname: "/(tabs)/focus", params: { session: JSON.stringify(session) } }); //Manda pro focus com parametro da sessão para ele carregar os dados corretos.
    };

    if (!session) {
        return (
            <SafeAreaView className="flex-1 bg-navy-950" edges={["top"]}>
                <View className="px-4 py-3 flex-row items-center justify-between border-b border-navy-800">
                    <Text className="text-xl font-bold text-slate-200">Entrar na sessão</Text>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center"
                    >
                        <X size={18} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                </View>

                <View className="flex-1 items-center justify-center px-6">
                    <Text className="text-center text-slate-300 text-base mb-4">
                        Dados da sessão não foram carregados corretamente.
                    </Text>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="bg-brand-500 px-6 py-3 rounded-2xl"
                    >
                        <Text className="text-white font-semibold">Voltar</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const colors = getSubjectColor(session.disciplina);
    const userName = session.profiles?.nome_real || session.profiles?.nome_usuario || "Usuário";
    const initials = getInitials(userName);
    const startedAgo = getTimeAgo(session.created_at);

    const [elapsed, setElapsed] = useState(() => {
        const seconds = Math.floor((Date.now() - new Date(session.created_at).getTime()) / 1000);
        return Number.isNaN(seconds) ? 0 : Math.max(0, seconds);
    });

    useEffect(() => {
        const interval = setInterval(() => {
            const seconds = Math.floor((Date.now() - new Date(session.created_at).getTime()) / 1000);
            setElapsed(Number.isNaN(seconds) ? 0 : Math.max(0, seconds));
        }, 1000);

        return () => clearInterval(interval);
    }, [session.created_at]);

    const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const seconds = String(elapsed % 60).padStart(2, "0");
    const visibilityLabel = session.is_public ? "Pública" : "Privada";
    const statusLabel = session.concluido_em ? "Concluída" : "Estudando Agora";
    const durationLabel = formatDuration(Math.floor(session.tempo_minutos / 60), session.tempo_minutos % 60);

    return (
        <SafeAreaView className="flex-1 bg-navy-950" edges={["top"]}>
            {/* Header */}
            <View className="px-4 py-3 flex-row items-center justify-between border-b border-navy-800">
                <Text className="text-xl font-bold text-slate-200">Entrar na sessão</Text>
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center"
                >
                    <X size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
                {/* Session info real */}
                <View className="bg-navy-900 border border-navy-800 p-4 rounded-xl mb-6">
                    <View className="flex-row items-center gap-3 mb-4">
                        <View className="w-12 h-12 rounded-full bg-slate-800 items-center justify-center">
                            <Text className="text-white font-bold text-lg">{initials}</Text>
                        </View>
                        <View className="flex-1">
                            <View className="flex-row items-center w-full justify-between">
                                <Text className="font-medium text-slate-200" numberOfLines={1}>
                                    {userName}
                                </Text>
                                <View
                                    style={{
                                        backgroundColor: "rgba(180, 83, 9, 0.4)",
                                        borderWidth: 1,
                                        borderColor: "rgba(251, 146, 60, 0.2)",
                                    }}
                                    className="flex-row items-center gap-1 px-2 py-1 rounded-lg"
                                >
                                    <Flame size={14} color={COLORS.amber} />
                                    <Text className="text-xs font-bold text-amber-400">
                                        {session.questoes_acertadas}
                                    </Text>
                                </View>
                            </View>
                            <Text className="text-sm text-emerald-400">{statusLabel}</Text>
                        </View>
                    </View>

                    <View className="flex-row items-center gap-6">
                        <View className="flex-row items-center gap-1.5">
                            <Clock size={14} color={COLORS.textMuted} />
                            {session.concluido_em ? (
                                <Text className="text-xs text-slate-500">
                                    Concluída em {session.concluido_em}
                                </Text>
                            ) : (
                                <Text className="text-sm text-slate-400">
                                    Começou há <Text className="text-brand-400">{startedAgo}</Text>
                                </Text>
                            )}
                        </View>
                    </View>

                    <View
                        style={{ backgroundColor: colors.bg, borderColor: colors.border }}
                        className="border p-4 mt-3 rounded-xl"
                    >
                        <View className="flex-row items-center justify-between">
                            <View className="flex-1 mr-4">
                                <Text style={{ color: colors.text }} className="text-xs font-bold tracking-widest mb-1">
                                    {session.disciplina.toUpperCase()}
                                </Text>
                                <Text className="text-white text-sm font-semibold" numberOfLines={2}>
                                    {session.conteudo_especifico || "Sessão livre"}
                                </Text>
                            </View>
                            {!session.concluido_em ? (
                                <View className="items-end">
                                    <Text className="text-white text-2xl font-bold">{durationLabel}</Text>
                                    <Text className="text-slate-500 text-xs font-bold tracking-widest">Tempo de Estudo</Text>
                                </View>
                            ) : (
                                <View className="items-end">
                                    <Text className="text-white text-2xl font-bold">{minutes}:{seconds}</Text>
                                    <Text className="text-slate-500 text-xs font-bold tracking-widest">AO VIVO</Text>
                                </View>
                            )

                            }
                        </View>
                    </View>
                </View>

                {/* Dados numéricos reais */}
                {!session.concluido_em ? (
                    <View className="flex-row gap-3">
                        <View className="flex-1 bg-navy-900 border border-navy-800 p-4 rounded-xl items-center">
                            <Text className="text-white text-lg font-semibold">{durationLabel}</Text>
                            <Text numberOfLines={1} className="text-slate-500 text-xs font-medium tracking-widest">
                                duração
                            </Text>
                        </View>

                        <View className="flex-1 bg-navy-900 border border-navy-800 p-4 rounded-xl items-center">
                            <Text className="text-white text-lg font-semibold">{session.questoes_acertadas}</Text>
                            <Text numberOfLines={1} className="text-slate-500 text-xs font-medium tracking-widest">
                                acertos
                            </Text>
                        </View>
                    </View>

                ) : (null)
                }

                <View className="flex-1 bg-navy-900 border border-navy-800 p-4 rounded-xl items-center mt-3">
                    <Text className="text-white text-lg font-semibold">{visibilityLabel}</Text>
                    <Text numberOfLines={1} className="text-slate-500 text-xs font-medium tracking-widest">
                        visibilidade
                    </Text>
                </View>


                {/* Participantes conhecidos */}
                <View className="flex-row gap-3 mt-6">
                    <View className="flex-1 bg-navy-900 border border-navy-800 p-4 rounded-xl">
                        <Text className="text-[0.8rem] font-bold tracking-widest text-slate-400">PARTICIPANTES</Text>

                        <View className="flex-row items-center gap-3 mb-4 mt-4">
                            <View
                                style={{ backgroundColor: "#1e3a5f" }}
                                className="w-12 h-12 rounded-full items-center justify-center"
                            >
                                <Text className="text-white font-bold text-sm">{initials}</Text>
                            </View>
                            <View className="flex-1 flex-row justify-between">
                                <View>
                                    <Text className="font-medium text-sm text-slate-200">{userName}</Text>
                                    <Text className="text-xs text-slate-500 tracking-wide">anfitrião</Text>
                                </View>
                                <View className="flex-row items-center gap-1">
                                    <Text className="text-xs text-slate-500">{startedAgo}</Text>
                                </View>
                            </View>
                        </View>

                        <Text className="text-xs text-slate-500">
                            Mostrar outros participantes depende de suporte de evento em tempo real.
                        </Text>
                    </View>
                </View>
            </ScrollView>

            {/* Botão de entrar */}
            <View className="px-4 pb-6 pt-2 border-t border-navy-800" style={{ backgroundColor: COLORS.bgPrimary }}>
                <TouchableOpacity
                    onPress={handleJoin}
                    className="bg-brand-500 py-4 rounded-2xl flex-row items-center justify-center gap-2"
                >
                    <Play size={20} color={COLORS.white} />
                    <Text className="font-semibold text-lg text-white">Entrar na Sessão</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

