import { View, Text, TouchableOpacity } from "react-native";
import { Globe, Lock, Flame, Clock, CheckCircle } from "lucide-react-native";
import { router } from "expo-router";
import { COLORS } from "@/constants/colors";
import { getSubjectColor, formatDuration } from "@/constants/helpers";
import Avatar from "@/components/ui/Avatar";

interface SessionCardItem {
    id: number;
    user: string;
    initials: string;
    timeAgo: string;
    isPublic: boolean;
    verified: boolean;
    subject: string;
    content: string;
    durationHours: number;
    durationMinutes: number;
    timestamp: string;
    streak: number;
    reactions: number;
}

interface SessionCardProps {
    session: SessionCardItem;
    colorIndex: number;
}

/**
 * Card de sessão de estudo do feed de detalhamento.
 * Exibe avatar, matéria, conteúdo estudado, duração, streak e reações.
 * Extraído do .map() de detailing.tsx.
 */
export default function SessionCard({ session, colorIndex }: SessionCardProps) {
    const subjectColors = getSubjectColor(session.subject);

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
                    foto={session.initials}
                    colorIndex={colorIndex}
                    size={40}
                    showOnlineDot={session.streak >= 10}
                />

                <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                        <Text className="font-medium text-slate-200" numberOfLines={1}>
                            {session.user}
                        </Text>
                        {session.verified && (
                            <CheckCircle size={14} color={COLORS.emeraldLight} />
                        )}
                    </View>
                    <Text className="text-xs text-slate-500">{session.timeAgo}</Text>
                </View>

                {/* Public / Private badge */}
                <View className="flex-row items-center gap-1 bg-slate-800 px-2 py-1 rounded-lg">
                    {session.isPublic ? (
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
                            {session.subject}
                        </Text>
                        <Text
                            className="text-sm text-slate-300 mt-0.5"
                            numberOfLines={1}
                        >
                            {session.content}
                        </Text>
                    </View>
                    <View className="items-end">
                        <Text className="text-2xl font-bold text-slate-100">
                            {formatDuration(session.durationHours, session.durationMinutes)}
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
                    <Text className="text-xs text-slate-500">{session.timestamp}</Text>
                </View>
                <View className="flex-row items-center gap-3">
                    {session.streak > 0 && (
                        <View className="flex-row items-center gap-1">
                            <Flame size={14} color={COLORS.amber} />
                            <Text className="text-xs font-bold text-amber-400">
                                {session.streak}
                            </Text>
                        </View>
                    )}
                    {session.reactions > 0 && (
                        <Text className="text-xs text-slate-500">
                            🔥 {session.reactions}
                        </Text>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
}
