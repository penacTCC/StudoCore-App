import { View, Text, TouchableOpacity } from "react-native";
import { Globe, Lock, Flame, Clock, CheckCircle } from "lucide-react-native";
import { router } from "expo-router";
import { COLORS } from "@/constants/colors";
import { getSubjectColor, formatDuration } from "@/constants/helpers";
import Avatar from "@/components/ui/Avatar";

// Interface compatível com a linha do Supabase + JOIN profiles
interface SessionCardItem {
    id: string;
    user_id: string;
    disciplina: string;
    conteudo_especifico: string | null;
    tempo_minutos: number;
    questoes_respondidas: number;
    questoes_acertadas: number;
    is_public: boolean;
    data_sessao: string;
    created_at: string;
    profiles?: {
        nome_real: string | null;
        nome_usuario: string | null;
        foto_usuario: string | null;
    };
}

interface SessionCardProps {
    session: SessionCardItem;
    colorIndex: number;
}

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
            className="bg-slate-900 border border-slate-800 rounded-2xl p-4"
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

                {/* Public / Private badge */}
                <View className="flex-row items-center gap-1 bg-slate-800 px-2 py-1 rounded-lg">
                    {session.is_public ? (
                        <>
                            <Globe size={10} color={COLORS.textSecondary} />
                            <Text className="text-xs text-slate-400">Public</Text>
                        </>
                    ) : (
                        <>
                            <Lock size={10} color={COLORS.textMuted} />
                            <Text className="text-xs text-slate-500">Private</Text>
                        </>
                    )}
                </View>
            </View>

            {/* Session info */}
            <View
                className="rounded-xl p-3 mb-3"
                style={{
                    backgroundColor: subjectColors.bg,
                    borderWidth: 1,
                    borderColor: subjectColors.border,
                }}
            >
                <View className="flex-row items-center justify-between">
                    <View className="flex-1 mr-3">
                        <Text
                            className="text-xs font-medium"
                            style={{ color: subjectColors.text }}
                        >
                            {session.disciplina}
                        </Text>
                        <Text
                            className="text-sm text-slate-300 mt-0.5"
                            numberOfLines={1}
                        >
                            {session.conteudo_especifico || "Sessão livre"}
                        </Text>
                    </View>
                    <View className="items-end">
                        <Text className="text-2xl font-bold text-slate-100">
                            {formatDuration(durationHours, durationMinutes)}
                        </Text>
                        <Text
                            className="text-slate-500 uppercase"
                            style={{ fontSize: 10, letterSpacing: 1 }}
                        >
                            duration
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
                <View className="flex-row items-center gap-3">
                    {session.questoes_acertadas > 0 && (
                        <View className="flex-row items-center gap-1">
                            <Flame size={14} color={COLORS.amber} />
                            <Text className="text-xs font-bold text-amber-400">
                                {session.questoes_acertadas}/{session.questoes_respondidas}
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
}
