import { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Crown, Flame, Plus, ChevronRight, Compass, Users, Settings } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { COLORS } from "@/constants/colors";
import { mockUsers, mockDetailingFeed } from "@/constants/mock-data";
import Avatar from "@/components/ui/Avatar";
import TabSelector from "@/components/ui/TabSelector";
import SessionCard from "@/components/groups/SessionCard";

type LeaderboardFilter = "weekly" | "monthly" | "annual";

const LEADERBOARD_TABS = [
    { key: "weekly", label: "Weekly" },
    { key: "monthly", label: "Monthly" },
    { key: "annual", label: "Annual" },
];

export default function GroupScreen() {
    const [leaderboardFilter, setLeaderboardFilter] = useState<LeaderboardFilter>("weekly");

    return (
        <SafeAreaView className="flex-1 bg-slate-950" edges={["top"]}>
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View className="bg-slate-950 px-4 pt-4 pb-2">
                    <View className="flex-row items-center gap-3 justify-between">
                        <View className="flex-row items-center gap-4">
                            <View className="w-12 h-12 rounded-xl bg-slate-800 items-center justify-center border border-slate-700">
                                <Users size={24} color={COLORS.textMuted} />
                            </View>
                            <View className="flex-row items-center">
                                <Text className="text-2xl font-bold text-slate-200">
                                    Study Squad Alpha
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={() => router.push("/(groups)/settings")}>
                            <Settings size={20} color={COLORS.textMuted} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Gradient Progress Bar */}
                <View className="px-4 pb-4 border-b border-slate-800 bg-slate-950 mt-5">
                    <View className="flex-row justify-between items-center mb-2">
                        <Text className="text-sm text-slate-400 font-medium">Group Goal</Text>
                        <Text className="text-sm text-emerald-400 font-bold">80% Achieved</Text>
                    </View>
                    <View className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                        <LinearGradient
                            colors={["#8b5cf6", "#10b981"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{ height: "100%", width: "80%", borderRadius: 999 }}
                        />
                    </View>
                </View>

                {/* Leaderboard */}
                <View className="px-4 mt-4">
                    <View className="bg-slate-900 border border-slate-800 rounded-3xl p-4">
                        <View className="flex-row items-center justify-between mb-4">
                            <Text className="text-lg font-semibold text-slate-200">Leaderboard</Text>
                            <TabSelector
                                tabs={LEADERBOARD_TABS}
                                active={leaderboardFilter}
                                onSelect={(k) => setLeaderboardFilter(k as LeaderboardFilter)}
                                activeColor="brand"
                            />
                        </View>

                        {mockUsers.map((user, index) => (
                            <TouchableOpacity
                                key={user.id}
                                className={`flex-row items-center gap-3 p-3 rounded-2xl mb-2 ${user.rank === 1 ? "bg-slate-800/50" : "bg-slate-800/30"
                                    }`}
                                style={
                                    user.rank === 1
                                        ? {
                                            borderWidth: 2,
                                            borderColor: COLORS.amber,
                                            shadowColor: COLORS.amber,
                                            shadowOffset: { width: 0, height: 0 },
                                            shadowOpacity: 0.4,
                                            shadowRadius: 10,
                                            elevation: 5,
                                        }
                                        : undefined
                                }
                            >
                                {/* Rank */}
                                <View className="relative">
                                    {user.rank === 1 && (
                                        <View className="absolute -top-3 -right-1 z-10">
                                            <Crown size={14} color={COLORS.amber} />
                                        </View>
                                    )}
                                    <Text
                                        className={`text-sm font-bold ${user.rank === 1 ? "text-amber-400" : "text-slate-500"
                                            }`}
                                    >
                                        #{user.rank}
                                    </Text>
                                </View>

                                {/* Avatar */}
                                <Avatar
                                    initials={user.initials}
                                    colorIndex={index}
                                    size={40}
                                    showOnlineDot={user.streak >= 10}
                                />

                                {/* Info */}
                                <View className="flex-1">
                                    <Text
                                        className={`font-medium ${user.rank === 1 ? "text-amber-400" : "text-slate-200"
                                            }`}
                                    >
                                        {user.name}
                                    </Text>
                                    <Text className="text-xs text-slate-400">
                                        {user.hours}h this week
                                    </Text>
                                </View>

                                {/* Streak */}
                                <View className="flex-row items-center gap-1">
                                    <Flame size={14} color={COLORS.emeraldLight} />
                                    <Text className="text-sm font-bold text-emerald-400">
                                        {user.streak}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Live Feed */}
                <View className="px-4 mt-4">
                    <View className="bg-slate-900 border border-slate-800 rounded-3xl p-4">
                        <View className="flex-row items-center justify-between mb-3">
                            <Text className="text-lg font-semibold text-slate-200">Live Feed</Text>
                            <TouchableOpacity
                                className="flex-row items-center gap-1"
                                onPress={() => router.push("/detailing")}
                            >
                                <Text className="text-sm text-violet-400">See all</Text>
                                <ChevronRight size={16} color={COLORS.violetLight} />
                            </TouchableOpacity>
                        </View>

                        {mockDetailingFeed.slice(0, 2).map((session, index) => (
                            <SessionCard
                                key={session.id}
                                session={session}
                                colorIndex={index}
                            />
                        ))}
                    </View>
                </View>

                {/* Members */}
                <View className="px-4 mt-4">
                    <View className="bg-slate-900 border border-slate-800 rounded-3xl p-4">
                        <View className="flex-row items-center justify-between mb-3">
                            <Text className="text-lg font-semibold text-slate-200">Members</Text>
                            <TouchableOpacity
                                onPress={() => router.push("/invite")}
                                className="flex-row items-center gap-1 bg-brand-500 px-3 py-1.5 rounded-lg"
                            >
                                <Plus size={16} color={COLORS.white} />
                                <Text className="text-white text-xs font-medium">Convidar</Text>
                            </TouchableOpacity>
                        </View>
                        <View className="flex-row flex-wrap gap-3">
                            {mockUsers.map((user, index) => (
                                <View
                                    key={user.id}
                                    className="flex-row items-center gap-2 bg-slate-800/30 px-3 py-2 rounded-xl"
                                >
                                    <Avatar initials={user.initials} colorIndex={index} size={32} />
                                    <Text className="text-sm text-slate-200">{user.name}</Text>
                                    {user.streak >= 10 && (
                                        <Flame size={14} color={COLORS.emeraldLight} />
                                    )}
                                </View>
                            ))}
                        </View>
                    </View>
                </View>

                {/* Browse Groups CTA */}
                <View className="px-4 mt-4 mb-6">
                    <TouchableOpacity
                        onPress={() => router.push("/browse-groups")}
                        className="flex-row items-center gap-4 p-4 rounded-2xl border border-brand-500/30"
                        style={{ backgroundColor: "rgba(247, 152, 44, 0.1)" }}
                    >
                        <View
                            className="w-12 h-12 rounded-xl items-center justify-center"
                            style={{ backgroundColor: "rgba(247, 152, 44, 0.15)" }}
                        >
                            <Compass size={24} color={COLORS.violetLight} />
                        </View>
                        <View className="flex-1">
                            <Text className="font-medium text-slate-200">Browse Public Groups</Text>
                            <Text className="text-xs text-slate-400">Find and join study groups</Text>
                        </View>
                        <ChevronRight size={20} color={COLORS.violetLight} />
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
