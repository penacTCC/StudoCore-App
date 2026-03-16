import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
    TrendingUp,
    Clock,
    Flame,
    Globe,
    Lock,
    CheckCircle,
} from "lucide-react-native";
import { router } from "expo-router";
import { COLORS } from "@/constants/colors";
import { mockDetailingFeed } from "@/constants/mock-data";
import { getSubjectColor, formatDuration, getAvatarColor } from "@/constants/helpers";

export default function DetailingScreen() {
    return (
        <SafeAreaView className="flex-1 bg-slate-950" edges={["top"]}>
            {/* Header */}
            <View className="bg-slate-950 border-b border-slate-800 px-4 py-3">
                <View className="flex-row items-center justify-between">
                    <View>
                        <Text className="text-xl font-bold text-slate-200">Detailing</Text>
                        <Text className="text-sm text-slate-400">Recent study sessions</Text>
                    </View>
                    <View
                        className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full"
                        style={{
                            backgroundColor: "rgba(16, 185, 129, 0.15)",
                            borderWidth: 1,
                            borderColor: "rgba(16, 185, 129, 0.3)",
                        }}
                    >
                        <View className="w-2 h-2 bg-emerald-400 rounded-full" />
                        <Text className="text-xs font-medium text-emerald-400">3 studying now</Text>
                    </View>
                </View>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Today's Summary Bar */}
                <View className="px-4 py-3">
                    <View
                        className="border rounded-2xl p-4"
                        style={{
                            backgroundColor: "rgba(124, 58, 237, 0.08)",
                            borderColor: "rgba(139, 92, 246, 0.2)",
                        }}
                    >
                        <View className="flex-row items-center gap-4">
                            <View
                                className="w-12 h-12 rounded-xl items-center justify-center"
                                style={{ backgroundColor: "rgba(139, 92, 246, 0.2)" }}
                            >
                                <TrendingUp size={24} color={COLORS.violetLight} />
                            </View>
                            <View className="flex-1">
                                <Text className="text-sm text-slate-400">Today's total</Text>
                                <Text className="text-2xl font-bold text-slate-200">8h 38m</Text>
                            </View>
                            <View className="items-end">
                                <Text className="text-sm text-emerald-400 font-medium">+12%</Text>
                                <Text className="text-xs text-slate-500">vs yesterday</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Feed */}
                <View className="px-4 pb-6">
                    <View className="gap-3">
                        {mockDetailingFeed.map((session, index) => {
                            const subjectColors = getSubjectColor(session.subject);
                            return (
                                <TouchableOpacity
                                    key={session.id}
                                    onPress={() => router.push("/join-session")}
                                    className="bg-slate-900 border border-slate-800 rounded-2xl p-4"
                                >
                                    {/* User row */}
                                    <View className="flex-row items-center gap-3 mb-3">
                                        <View className="relative">
                                            <View
                                                className="w-10 h-10 rounded-full items-center justify-center"
                                                style={{ backgroundColor: getAvatarColor(index) }}
                                            >
                                                <Text className="text-white text-sm font-bold">{session.initials}</Text>
                                            </View>
                                            {session.streak >= 10 && (
                                                <View className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full" />
                                            )}
                                        </View>
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
                                        {session.isPublic ? (
                                            <View className="flex-row items-center gap-1 bg-slate-800 px-2 py-1 rounded-lg">
                                                <Globe size={10} color={COLORS.textSecondary} />
                                                <Text className="text-xs text-slate-400">Public</Text>
                                            </View>
                                        ) : (
                                            <View className="flex-row items-center gap-1 bg-slate-800 px-2 py-1 rounded-lg">
                                                <Lock size={10} color={COLORS.textMuted} />
                                                <Text className="text-xs text-slate-500">Private</Text>
                                            </View>
                                        )}
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
                                                <Text className="text-xs font-medium" style={{ color: subjectColors.text }}>
                                                    {session.subject}
                                                </Text>
                                                <Text className="text-sm text-slate-300 mt-0.5" numberOfLines={1}>
                                                    {session.content}
                                                </Text>
                                            </View>
                                            <View className="items-end">
                                                <Text className="text-2xl font-bold text-slate-100">
                                                    {formatDuration(session.durationHours, session.durationMinutes)}
                                                </Text>
                                                <Text className="text-slate-500 uppercase" style={{ fontSize: 10, letterSpacing: 1 }}>
                                                    duration
                                                </Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Footer row */}
                                    <View className="flex-row items-center justify-between">
                                        <View className="flex-row items-center gap-1">
                                            <Clock size={12} color={COLORS.textMuted} />
                                            <Text className="text-xs text-slate-500">{session.timestamp}</Text>
                                        </View>
                                        <View className="flex-row items-center gap-3">
                                            {session.streak > 0 && (
                                                <View className="flex-row items-center gap-1">
                                                    <Flame size={14} color={COLORS.amber} />
                                                    <Text className="text-xs font-bold text-amber-400">{session.streak}</Text>
                                                </View>
                                            )}
                                            {session.reactions > 0 && (
                                                <Text className="text-xs text-slate-500">🔥 {session.reactions}</Text>
                                            )}
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
