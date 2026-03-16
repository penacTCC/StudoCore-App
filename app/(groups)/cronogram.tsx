import { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
    Plus,
    ChevronRight,
} from "lucide-react-native";
import { COLORS } from "@/constants/colors";
import { mockStudySchedule, weekDays } from "@/constants/mock-data";

export default function CronogramScreen() {
    const [cronogramView, setCronogramView] = useState<"week" | "month">("week");
    const [selectedDay, setSelectedDay] = useState<number | null>(null);

    const filteredSchedule = mockStudySchedule.filter(
        (item) => selectedDay === null || item.day === selectedDay
    );

    return (
        <SafeAreaView className="flex-1 bg-navy-950" edges={["top"]}>
            {/* Header */}
            <View className="bg-navy-950 border-b border-navy-800 px-4 py-3">
                <View className="flex-row items-center justify-between">
                    <View>
                        <Text className="text-xl font-bold text-slate-200">Cronogram</Text>
                        <Text className="text-sm text-slate-400">Plan your studies</Text>
                    </View>
                    <TouchableOpacity className="flex-row items-center gap-1 bg-brand-500 px-3 py-2 rounded-xl">
                        <Plus size={16} color={COLORS.white} />
                        <Text className="text-white text-sm font-medium">Add</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* View Toggle */}
            <View className="px-4 py-3">
                <View className="flex-row gap-2 bg-navy-900 p-1 rounded-xl">
                    <TouchableOpacity
                        onPress={() => setCronogramView("week")}
                        className={`flex-1 py-2 rounded-lg items-center ${cronogramView === "week" ? "bg-brand-500" : ""}`}
                    >
                        <Text className={`text-sm font-medium ${cronogramView === "week" ? "text-white" : "text-slate-400"}`}>
                            Week
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setCronogramView("month")}
                        className={`flex-1 py-2 rounded-lg items-center ${cronogramView === "month" ? "bg-brand-500" : ""}`}
                    >
                        <Text className={`text-sm font-medium ${cronogramView === "month" ? "text-white" : "text-slate-400"}`}>
                            Month
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
                {/* Day Headers */}
                <View className="flex-row gap-1 mb-4">
                    {weekDays.map((day, idx) => (
                        <TouchableOpacity
                            key={day}
                            onPress={() => setSelectedDay(selectedDay === idx ? null : idx)}
                            className={`flex-1 items-center py-3 rounded-xl ${selectedDay === idx ? "bg-brand-500" : ""}`}
                            style={selectedDay !== idx ? { backgroundColor: COLORS.primaryFaint } : undefined}
                        >
                            <Text className={`text-xs font-medium ${selectedDay === idx ? "text-white" : "text-slate-400"}`}>
                                {day}
                            </Text>
                            <Text className={`text-lg font-bold ${selectedDay === idx ? "text-white" : "text-slate-400"}`}>
                                {20 + idx}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Schedule Cards */}
                <View className="bg-navy-900 border border-navy-800 rounded-3xl p-4">
                    <Text className="text-sm font-medium text-slate-400 mb-3">
                        {selectedDay !== null ? weekDays[selectedDay] : "All"}'s Schedule
                    </Text>
                    <View className="gap-3">
                        {filteredSchedule.map((item) => (
                            <View
                                key={item.id}
                                className="flex-row items-center gap-3 p-3 rounded-xl"
                                style={{ backgroundColor: COLORS.primaryFaint }}
                            >
                                <View className="items-center" style={{ minWidth: 50 }}>
                                    <Text className="text-sm font-bold text-violet-400">{item.time}</Text>
                                    <Text className="text-xs text-slate-500">{item.duration}min</Text>
                                </View>
                                <View
                                    className="rounded-full"
                                    style={{ width: 4, height: 40, backgroundColor: COLORS.primary }}
                                />
                                <View className="flex-1">
                                    <Text className="font-medium text-slate-200">{item.subject}</Text>
                                    <Text className="text-xs text-slate-500">Focus session</Text>
                                </View>
                                <ChevronRight size={18} color={COLORS.textMuted} />
                            </View>
                        ))}
                        {filteredSchedule.length === 0 && (
                            <Text className="text-center text-slate-500 text-sm py-4">No sessions scheduled</Text>
                        )}
                    </View>
                </View>

                {/* Weekly Goals */}
                <View className="bg-navy-900 border border-navy-800 rounded-3xl p-4 mt-4 mb-6">
                    <Text className="text-sm font-medium text-slate-400 mb-3">Weekly Goals</Text>
                    <View className="flex-row gap-3">
                        <View className="flex-1 p-3 rounded-xl items-center" style={{ backgroundColor: COLORS.primaryFaint }}>
                            <Text className="text-2xl font-bold text-emerald-400">18h</Text>
                            <Text className="text-xs text-slate-400">Planned</Text>
                        </View>
                        <View className="flex-1 p-3 rounded-xl items-center" style={{ backgroundColor: COLORS.primaryFaint }}>
                            <Text className="text-2xl font-bold text-brand-500">12h</Text>
                            <Text className="text-xs text-slate-400">Completed</Text>
                        </View>
                    </View>
                    <View className="mt-3">
                        <View className="flex-row items-center justify-between mb-1">
                            <Text className="text-xs text-slate-400">Progress</Text>
                            <Text className="text-xs text-emerald-400">67%</Text>
                        </View>
                        <View className="h-2 bg-navy-800 rounded-full overflow-hidden">
                            <View
                                className="h-full rounded-full"
                                style={{ width: "67%", backgroundColor: COLORS.emerald }}
                            />
                        </View>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
