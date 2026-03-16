import { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
    ChevronRight,
    Sparkles,
} from "lucide-react-native";
import { COLORS } from "@/constants/colors";
import { mockFailedQuestions } from "@/constants/mock-data";

type BrainTab = "database" | "analytics";

export default function BrainScreen() {
    const [brainTab, setBrainTab] = useState<BrainTab>("database");

    const studyDistribution = [
        { subject: "Mathematics", hours: 12, color: "#8b5cf6" },
        { subject: "Physics", hours: 8, color: "#10b981" },
        { subject: "Chemistry", hours: 5, color: "#fbbf24" },
        { subject: "Biology", hours: 3, color: "#f43f5e" },
    ];

    return (
        <SafeAreaView className="flex-1 bg-slate-950" edges={["top"]}>
            {/* Header */}
            <View className="bg-slate-950 border-b border-slate-800 px-4 py-3">
                <Text className="text-xl font-bold text-slate-200">Brain Hub</Text>
                <Text className="text-sm text-slate-400">Your learning analytics</Text>
            </View>

            {/* Tabs */}
            <View className="px-4 py-3">
                <View className="flex-row gap-2 bg-slate-900 p-1 rounded-xl">
                    <TouchableOpacity
                        onPress={() => setBrainTab("database")}
                        className={`flex-1 py-2 rounded-lg items-center ${brainTab === "database" ? "bg-violet-600" : ""}`}
                    >
                        <Text className={`text-sm font-medium ${brainTab === "database" ? "text-white" : "text-slate-400"}`}>
                            Database
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setBrainTab("analytics")}
                        className={`flex-1 py-2 rounded-lg items-center ${brainTab === "analytics" ? "bg-violet-600" : ""}`}
                    >
                        <Text className={`text-sm font-medium ${brainTab === "analytics" ? "text-white" : "text-slate-400"}`}>
                            Analytics
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {brainTab === "database" && (
                    <View className="px-4 pb-4">
                        <View className="bg-slate-900 border border-slate-800 rounded-3xl p-4">
                            <View className="flex-row items-center justify-between mb-4">
                                <Text className="text-lg font-semibold text-slate-200">Failed Questions</Text>
                                <View className="px-2 py-1 rounded-lg" style={{ backgroundColor: "rgba(244, 63, 94, 0.2)" }}>
                                    <Text className="text-xs font-medium text-rose-400">
                                        {mockFailedQuestions.length} to review
                                    </Text>
                                </View>
                            </View>

                            {mockFailedQuestions.length > 0 ? (
                                mockFailedQuestions.map((q) => (
                                    <View
                                        key={q.id}
                                        className="p-4 rounded-xl mb-3"
                                        style={{
                                            backgroundColor: "rgba(30, 41, 59, 0.5)",
                                            borderWidth: 1,
                                            borderColor: "rgba(244, 63, 94, 0.3)",
                                        }}
                                    >
                                        <View className="flex-row items-center justify-between mb-2">
                                            <View className="px-2 py-0.5 rounded" style={{ backgroundColor: "rgba(244, 63, 94, 0.2)" }}>
                                                <Text className="text-xs font-medium text-rose-400">{q.subject}</Text>
                                            </View>
                                            <Text className="text-xs text-slate-500">{q.date}</Text>
                                        </View>
                                        <Text className="text-sm text-slate-200">{q.question}</Text>
                                        <TouchableOpacity className="flex-row items-center gap-1 mt-3">
                                            <Text className="text-sm font-medium text-violet-400">Retry</Text>
                                            <ChevronRight size={14} color={COLORS.violetLight} />
                                        </TouchableOpacity>
                                    </View>
                                ))
                            ) : (
                                <View className="items-center py-8">
                                    <Text className="text-lg font-semibold text-emerald-400 mb-1">All clear! 🎉</Text>
                                    <Text className="text-sm text-slate-400 text-center">
                                        No failed questions. Keep up the great work!
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                )}

                {brainTab === "analytics" && (
                    <View className="px-4 pb-4 gap-4">
                        {/* AI Insight Card */}
                        <View
                            className="border border-slate-800 rounded-3xl p-4"
                            style={{
                                backgroundColor: "rgba(124, 58, 237, 0.08)",
                            }}
                        >
                            <View className="flex-row items-center gap-3">
                                <View
                                    className="w-12 h-12 rounded-xl items-center justify-center"
                                    style={{ backgroundColor: "rgba(139, 92, 246, 0.3)" }}
                                >
                                    <Sparkles size={24} color={COLORS.violetLight} />
                                </View>
                                <View>
                                    <Text className="text-sm text-slate-400">AI Insight</Text>
                                    <Text className="text-lg font-semibold text-emerald-400">+15% vs last month</Text>
                                </View>
                            </View>
                        </View>

                        {/* Study Distribution */}
                        <View className="bg-slate-900 border border-slate-800 rounded-3xl p-4">
                            <Text className="text-lg font-semibold text-slate-200 mb-4">Study Distribution</Text>
                            <View className="gap-3">
                                {studyDistribution.map((item) => (
                                    <View key={item.subject}>
                                        <View className="flex-row items-center justify-between mb-1">
                                            <Text className="text-sm text-slate-300">{item.subject}</Text>
                                            <Text className="text-sm text-slate-400">{item.hours}h</Text>
                                        </View>
                                        <View className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                            <View
                                                className="h-full rounded-full"
                                                style={{
                                                    width: `${(item.hours / 12) * 100}%`,
                                                    backgroundColor: item.color,
                                                }}
                                            />
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>

                        {/* Weekly Summary */}
                        <View className="bg-slate-900 border border-slate-800 rounded-3xl p-4">
                            <Text className="text-lg font-semibold text-slate-200 mb-4">This Week</Text>
                            <View className="flex-row gap-3">
                                <View className="flex-1 p-3 rounded-xl" style={{ backgroundColor: "rgba(30, 41, 59, 0.5)" }}>
                                    <Text className="text-2xl font-bold text-slate-200 text-center">28</Text>
                                    <Text className="text-xs text-slate-400 text-center">Hours</Text>
                                </View>
                                <View className="flex-1 p-3 rounded-xl" style={{ backgroundColor: "rgba(30, 41, 59, 0.5)" }}>
                                    <Text className="text-2xl font-bold text-emerald-400 text-center">10</Text>
                                    <Text className="text-xs text-slate-400 text-center">Streak</Text>
                                </View>
                                <View className="flex-1 p-3 rounded-xl" style={{ backgroundColor: "rgba(30, 41, 59, 0.5)" }}>
                                    <Text className="text-2xl font-bold text-violet-400 text-center">45</Text>
                                    <Text className="text-xs text-slate-400 text-center">Questions</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
