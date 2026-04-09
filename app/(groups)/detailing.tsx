import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TrendingUp } from "lucide-react-native";
import { COLORS } from "@/constants/colors";
import SessionCard from "@/components/groups/SessionCard";
import { useSessoesFoco } from "@/hooks/useSessoesFoco";

export default function DetailingScreen() {
    const { sessions, loading } = useSessoesFoco(50);

    return (
        <SafeAreaView className="flex-1 bg-slate-950" edges={["top"]}>
            {/* Header */}
            <View className="bg-slate-950 border-b border-slate-800 px-4 py-3">
                <View className="flex-row items-center justify-between">
                    <View>
                        <Text className="text-xl font-bold text-slate-200">Detalhes</Text>
                        <Text className="text-sm text-slate-400">Sessões recentes de estudo</Text>
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
                        <Text className="text-xs font-medium text-emerald-400">
                            3 studying now
                        </Text>
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

                <View className="px-4 pb-6">
                    <View className="gap-3">
                        {loading ? (
                            <Text className="text-sm text-slate-500 text-center py-4">Carregando sessões...</Text>
                        ) : sessions.length === 0 ? (
                            <Text className="text-sm text-slate-500 text-center py-4">Nenhuma sessão registrada ainda.</Text>
                        ) : (
                            sessions.map((session, index) => (
                                <SessionCard
                                    key={session.id}
                                    session={session}
                                    colorIndex={index}
                                />
                            ))
                        )}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
