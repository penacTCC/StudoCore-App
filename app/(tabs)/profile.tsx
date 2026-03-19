import { useMemo } from "react";
import { View, Text, TouchableOpacity, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
    CalendarDays,
    ChevronRight,
    Star,
    Clock,
    BookOpen,
    Flame,
    Trophy,
    Users,
    LogOut,
} from "lucide-react-native";
import { router } from "expo-router";
import { COLORS } from "@/constants/colors";
import { mockBadges } from "@/constants/mock-data";
import { getAvatarColor } from "@/constants/helpers";
import type { LucideIcon } from "lucide-react-native";
import { supabase } from "@/supabase";

const iconMap: Record<string, LucideIcon> = {
    Star,
    Clock,
    BookOpen,
    Flame,
    Trophy,
    Users,
};

export default function ProfileScreen() {
    // Generate stable heatmap data
    const heatmapData = useMemo(() => {
        const seed = [0.3, 0.9, 0.1, 0.7, 0.5, 0.2, 0.8, 0.4, 0.6, 0.95,
            0.15, 0.85, 0.45, 0.65, 0.35, 0.55, 0.75, 0.25, 0.05, 0.92,
            0.48, 0.72, 0.18, 0.62, 0.38, 0.82, 0.28, 0.58, 0.88, 0.12,
            0.78, 0.42, 0.68, 0.22, 0.52];
        return seed.map((intensity) => {
            if (intensity > 0.8) return "#34d399";     // emerald-400
            if (intensity > 0.6) return "#10b981";     // emerald-500
            if (intensity > 0.4) return "#059669";     // emerald-600
            if (intensity > 0.2) return "#047857";     // emerald-700
            return COLORS.bgTertiary;
        });
    }, []);

    const handleSignOut = () => {
        Alert.alert(
            "Sair da conta",
            "Tem certeza que deseja sair?",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Sair",
                    style: "destructive",
                    onPress: async () => {
                        const { error } = await supabase.auth.signOut();
                        if (error) {
                            Alert.alert("Erro", "Não foi possível sair da conta.");
                        }
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-slate-950" edges={["top"]}>
            {/* Header */}
            <View className="bg-slate-950 border-b border-slate-800 px-4 py-3">
                <Text className="text-xl font-bold text-slate-200">Profile</Text>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Avatar & Level */}
                <View className="px-4 py-6">
                    <View className="flex-row items-center gap-4">
                        <View className="relative">
                            <View
                                className="w-20 h-20 rounded-full items-center justify-center"
                                style={{
                                    backgroundColor: getAvatarColor(4),
                                    borderWidth: 2,
                                    borderColor: COLORS.primary,
                                }}
                            >
                                <Text className="text-white text-2xl font-bold">YO</Text>
                            </View>
                            <View
                                className="absolute -bottom-1 -right-1 bg-brand-500 px-2 py-0.5 rounded-full"
                            >
                                <Text className="text-white text-xs font-bold">LV 12</Text>
                            </View>
                        </View>
                        <View>
                            <Text className="text-xl font-bold text-slate-200">Your Name</Text>
                            <Text className="text-sm text-slate-400">Joined December 2024</Text>
                        </View>
                    </View>
                </View>

                {/* Weekly Goal */}
                <View className="px-4 mb-4">
                    <View className="bg-slate-900 border border-slate-800 rounded-3xl p-4">
                        <View className="flex-row items-center justify-between mb-2">
                            <Text className="text-sm font-medium text-slate-400">Weekly Goal</Text>
                            <Text className="text-sm text-slate-200">10h / 12h</Text>
                        </View>
                        <View className="h-3 bg-slate-800 rounded-full overflow-hidden">
                            <View
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: "83%" }}
                            />
                        </View>
                        <Text className="text-xs text-emerald-400 mt-2">2 hours to reach your goal!</Text>
                    </View>
                </View>

                {/* Heatmap */}
                <View className="px-4 mb-4">
                    <View className="bg-slate-900 border border-slate-800 rounded-3xl p-4">
                        <Text className="text-sm font-medium text-slate-400 mb-3">Consistency Heatmap</Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 4 }}>
                            {heatmapData.map((color, i) => (
                                <View
                                    key={i}
                                    style={{
                                        width: "12%",
                                        aspectRatio: 1,
                                        backgroundColor: color,
                                        borderRadius: 4,
                                    }}
                                />
                            ))}
                        </View>
                        <View className="flex-row items-center justify-end gap-2 mt-4">
                            <Text className="text-xs text-slate-500">Less</Text>
                            <View className="flex-row gap-1">
                                <View className="w-3 h-3 rounded-sm bg-slate-800" />
                                <View className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#047857" }} />
                                <View className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#10b981" }} />
                                <View className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#34d399" }} />
                            </View>
                            <Text className="text-xs text-slate-500">More</Text>
                        </View>
                    </View>
                </View>

                {/* Badges */}
                <View className="px-4 mb-4">
                    <View className="bg-slate-900 border border-slate-800 rounded-3xl p-4">
                        <Text className="text-sm font-medium text-slate-400 mb-3">Achievements</Text>
                        <View className="flex-row flex-wrap gap-3">
                            {mockBadges.map((badge) => {
                                const BadgeIcon = iconMap[badge.icon] || Star;
                                return (
                                    <View
                                        key={badge.id}
                                        className="items-center gap-2 p-3 rounded-xl"
                                        style={{
                                            width: "30%",
                                            backgroundColor: badge.unlocked
                                                ? COLORS.primaryFaint
                                                : "rgba(30, 41, 59, 0.2)",
                                            opacity: badge.unlocked ? 1 : 0.5,
                                        }}
                                    >
                                        <View
                                            className="w-10 h-10 rounded-full items-center justify-center"
                                            style={{
                                                backgroundColor: badge.unlocked
                                                    ? "rgba(247, 152, 44, 0.2)"
                                                    : "rgba(51, 65, 85, 0.5)",
                                            }}
                                        >
                                            <BadgeIcon
                                                size={20}
                                                color={badge.unlocked ? COLORS.violetLight : COLORS.textMuted}
                                            />
                                        </View>
                                        <Text className="text-xs text-center text-slate-300">{badge.name}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                </View>

                {/* Stats */}
                <View className="px-4 mb-4">
                    <View className="bg-slate-900 border border-slate-800 rounded-3xl p-4">
                        <Text className="text-sm font-medium text-slate-400 mb-3">Statistics</Text>
                        <View className="flex-row flex-wrap gap-3">
                            <View className="flex-1 p-3 rounded-xl" style={{ backgroundColor: COLORS.primaryFaint, minWidth: "45%" }}>
                                <Text className="text-2xl font-bold text-slate-200">128h</Text>
                                <Text className="text-xs text-slate-400">Total Hours</Text>
                            </View>
                            <View className="flex-1 p-3 rounded-xl" style={{ backgroundColor: COLORS.primaryFaint, minWidth: "45%" }}>
                                <Text className="text-2xl font-bold text-slate-200">342</Text>
                                <Text className="text-xs text-slate-400">Questions</Text>
                            </View>
                        </View>
                        <View className="p-3 rounded-xl mt-3" style={{ backgroundColor: COLORS.primaryFaint }}>
                            <Text className="text-lg font-bold text-violet-400">Mathematics</Text>
                            <Text className="text-xs text-slate-400">Favorite Subject</Text>
                        </View>
                    </View>
                </View>

                {/* My Groups CTA */}
                <View className="px-4 mb-4">
                    <TouchableOpacity
                        onPress={() => router.push("/(groups)")}
                        className="bg-slate-900 border border-slate-800 rounded-3xl p-4 flex-row items-center gap-4"
                    >
                        <View
                            className="w-12 h-12 rounded-xl items-center justify-center"
                            style={{ backgroundColor: "rgba(139, 92, 246, 0.15)" }}
                        >
                            <Users size={24} color={COLORS.violetLight} />
                        </View>
                        <View className="flex-1">
                            <Text className="font-medium text-slate-200">Meus Grupos</Text>
                            <Text className="text-xs text-slate-400">Gerencie seus grupos</Text>
                        </View>
                        <ChevronRight size={20} color={COLORS.textMuted} />
                    </TouchableOpacity>
                </View>

                {/* Cronogram CTA */}
                <View className="px-4 mb-4">
                    <TouchableOpacity
                        onPress={() => router.push("/cronogram")}
                        className="bg-slate-900 border border-slate-800 rounded-3xl p-4 flex-row items-center gap-4"
                    >
                        <View
                            className="w-12 h-12 rounded-xl items-center justify-center"
                            style={{ backgroundColor: "rgba(247, 152, 44, 0.15)" }}
                        >
                            <CalendarDays size={24} color={COLORS.violetLight} />
                        </View>
                        <View className="flex-1">
                            <Text className="font-medium text-slate-200">Cronograma de Estudo</Text>
                            <Text className="text-xs text-slate-400">Planeje e organize seu cronograma</Text>
                        </View>
                        <ChevronRight size={20} color={COLORS.textMuted} />
                    </TouchableOpacity>
                </View>

                {/* Sign Out */}
                <View className="px-4 mb-8">
                    <TouchableOpacity
                        onPress={handleSignOut}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 10,
                            backgroundColor: "rgba(244, 63, 94, 0.08)",
                            borderWidth: 1,
                            borderColor: "rgba(244, 63, 94, 0.2)",
                            borderRadius: 20,
                            paddingVertical: 16,
                        }}
                    >
                        <LogOut size={18} color={COLORS.rose} />
                        <Text style={{ color: COLORS.rose, fontWeight: "700", fontSize: 15 }}>
                            Sair da conta
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
