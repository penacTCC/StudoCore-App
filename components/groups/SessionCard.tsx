import { View, Text, TouchableOpacity } from "react-native";
import { Globe, Lock, Flame, Clock, CheckCircle, MessageCircle, ThumbsUp, Share2 } from "lucide-react-native";
import { router } from "expo-router";
import { COLORS } from "@/constants/colors";
import { getSubjectColor, formatDuration } from "@/constants/helpers";
import Avatar from "@/components/ui/Avatar";
import { SessionCardProps } from "@/types/sessions";

// Calcula "Xh ago" / "Xm ago" / "Just now" a partir do created_at
function getTimeAgo(createdAt: string): string {
    const diff = Date.now() - new Date(createdAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Agora";
    if (mins < 60) return `${mins}m atrás`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h atrás`;
    const days = Math.floor(hours / 24);
    return `${days}d atrás`;
}

/**
 * Card de sessão de estudo do feed de detalhamento.
 * Exibe avatar, matéria, conteúdo estudado, duração, score do quiz.
 */
export default function SessionCard({ session, colorIndex }: SessionCardProps) {
    const subjectColors = getSubjectColor(session.disciplina);

    const userName = session.profiles?.nome_real || session.profiles?.nome_usuario || "Usuário";
    const initials = userName.substring(0, 2).toUpperCase();
    const durationHours = Math.floor(session.tempo_minutos / 60);
    const durationMinutes = session.tempo_minutos % 60;
    const timeAgo = getTimeAgo(session.created_at);
    const timestamp = new Date(session.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const verified = session.questoes_acertadas > 7;

    return (
        <TouchableOpacity
            onPress={() => router.push({
                pathname: "/join-session",
                params: { subjectColors: JSON.stringify(subjectColors) }
            })}
            activeOpacity={0.85}
            className="mb-3 border-b border-white/10 bg-black px-1 pb-4"
        >
            {/* User row */}
            <View className="flex-row items-center gap-3 mb-3">
                <Avatar
                    foto={session.profiles?.foto_usuario || initials}
                    size={40}
                    showOnlineDot={false}
                />

                <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                        <Text className="font-medium text-slate-200" numberOfLines={1}>
                            {userName}
                        </Text>
                        {verified && (
                            <CheckCircle size={14} color={COLORS.emeraldLight} />
                        )}
                    </View>
                    <Text className="text-xs text-slate-500">{timeAgo}</Text>
                </View>

                <View className="flex-row items-center gap-1 rounded-full bg-white/5 px-2.5 py-1">
                    {session.is_public ? (
                        <>
                            <Globe size={10} color={COLORS.primary} />
                            <Text className="text-xs text-slate-400">Pública</Text>
                        </>
                    ) : (
                        <>
                            <Lock size={10} color={COLORS.textMuted} />
                            <Text className="text-xs text-slate-500">Privada</Text>
                        </>
                    )}
                </View>
            </View>

            {/* Session info */}
            <View
                className="mb-3 rounded-2xl border p-4"
                style={{
                    backgroundColor: "rgba(255,255,255,0.04)",
                    borderColor: "rgba(255,255,255,0.08)",
                }}
            >
                <View className="mb-3 flex-row items-center gap-2">
                    <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: subjectColors.text }} />
                    <Text className="text-xs font-bold uppercase text-slate-500">
                        {session.disciplina}
                    </Text>
                </View>
                <Text className="text-xl font-bold text-slate-100" numberOfLines={2}>
                    {session.conteudo_especifico || "Sessão livre"}
                </Text>
                <View className="mt-4 flex-row gap-4">
                    <View>
                        <Text className="text-xs text-slate-500">Tempo</Text>
                        <Text className="text-lg font-bold text-slate-100">
                            {formatDuration(durationHours, durationMinutes)}
                        </Text>
                    </View>
                    <View>
                        <Text className="text-xs text-slate-500">Questões</Text>
                        <Text className="text-lg font-bold text-slate-100">
                            {session.questoes_respondidas || 0}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Footer */}
            <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1">
                    <Clock size={12} color={COLORS.textMuted} />
                    <Text className="text-xs text-slate-500">{timestamp}</Text>
                </View>
                <View className="flex-row items-center gap-5">
                    {session.questoes_acertadas > 0 && (
                        <View className="flex-row items-center gap-1">
                            <Flame size={14} color={COLORS.amber} />
                            <Text className="text-xs font-bold text-amber-400">
                                {session.questoes_acertadas}/{session.questoes_respondidas}
                            </Text>
                        </View>
                    )}
                    <ThumbsUp size={18} color={COLORS.textSecondary} />
                    <MessageCircle size={18} color={COLORS.textSecondary} />
                    <Share2 size={18} color={COLORS.textSecondary} />
                </View>
            </View>
        </TouchableOpacity>
    );
}
