import { useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
    Crown,
    Flame,
    Plus,
    ChevronRight,
    Compass,
    Users,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { COLORS } from "@/constants/colors";
import { mockUsers, mockLiveFeed } from "@/constants/mock-data";
import { getAvatarColor } from "@/constants/helpers";

type LeaderboardFilter = "weekly" | "monthly" | "annual";

export default function GroupScreen() {
    const [leaderboardFilter, setLeaderboardFilter] = useState<LeaderboardFilter>("weekly");

    const renderAvatar = (initials: string, index: number, size: number = 40) => (
        <View
            className="rounded-full items-center justify-center"
            style={{
                width: size,
                height: size,
                backgroundColor: getAvatarColor(index),
            }}
        >
            <Text className="text-white font-bold" style={{ fontSize: size * 0.35 }}>
                {initials}
            </Text>
        </View>
    );

    return (
        <SafeAreaView className="flex-1 bg-slate-950" edges={["top"]}>
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View className="bg-slate-950 px-4 pt-4 pb-2">
                    <View className="flex-row items-center gap-3">
                        <View className="w-12 h-12 rounded-xl bg-slate-800 items-center justify-center border border-slate-700">
                             <Users size={24} color={COLORS.textMuted} />
                        </View>
                        <View>
                            <Text className="text-2xl font-bold text-slate-200">Study Squad Alpha</Text>
                        </View>
                    </View>
                </View>

                {/* Gradient Progress Bar */}
                <View className="px-4 pb-4 border-b border-slate-800 bg-slate-950">
                    <View className="flex-row justify-between items-center mb-2">
                        <Text className="text-sm text-slate-400 font-medium">Group Goal</Text>
                        <Text className="text-sm text-emerald-400 font-bold">80% Achieved</Text>
                    </View>
                    <View className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                        <LinearGradient
                            colors={['#8b5cf6', '#10b981']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{ height: '100%', width: '80%', borderRadius: 999 }}
                        />
                    </View>
                </View>

                {/* Leaderboard */}
                <View className="px-4 mt-4">
                    <View className="bg-slate-900 border border-slate-800 rounded-3xl p-4">
                        <View className="flex-row items-center justify-between mb-4">
                            <Text className="text-lg font-semibold text-slate-200">Leaderboard</Text>
                            <View className="flex-row gap-1">
                                {(["weekly", "monthly", "annual"] as LeaderboardFilter[]).map((filter) => (
                                    <TouchableOpacity
                                        key={filter}
                                        onPress={() => setLeaderboardFilter(filter)}
                                        className={`px-3 py-1 rounded-lg ${leaderboardFilter === filter
                                            ? "bg-brand-500"
                                            : "bg-slate-800"
                                            }`}
                                    >
                                        <Text
                                            className={`text-xs font-medium ${leaderboardFilter === filter
                                                ? "text-white"
                                                : "text-slate-400"
                                                }`}
                                        >
                                            {filter.charAt(0).toUpperCase() + filter.slice(1)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* User Rows */}
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
                                <View className="relative">
                                    {renderAvatar(user.initials, index)}
                                    {user.streak >= 10 && (
                                        <View className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full" />
                                    )}
                                </View>

                                {/* Info */}
                                <View className="flex-1">
                                    <Text
                                        className={`font-medium ${user.rank === 1 ? "text-amber-400" : "text-slate-200"
                                            }`}
                                    >
                                        {user.name}
                                    </Text>
                                    <Text className="text-xs text-slate-400">{user.hours}h this week</Text>
                                </View>

                                {/* Streak */}
                                <View className="flex-row items-center gap-1">
                                    <Flame size={14} color={COLORS.emeraldLight} />
                                    <Text className="text-sm font-bold text-emerald-400">{user.streak}</Text>
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
                            <TouchableOpacity className="flex-row items-center gap-1" onPress={() => router.push("/detailing")}>
                                <Text className="text-sm text-violet-400">See all</Text>
                                <ChevronRight size={16} color={COLORS.violetLight} />
                            </TouchableOpacity>
                        </View>

                        {mockLiveFeed.map((item) => (
                            <View
                                key={item.id}
                                className="flex-row items-center justify-between bg-slate-800/30 p-3 rounded-xl mb-2"
                            >
                                <View className="flex-1 mr-3">
                                    <Text className="text-sm text-slate-200">
                                        <Text className="text-violet-400 font-medium">{item.user}</Text>{" "}
                                        {item.action}
                                    </Text>
                                    <Text className="text-xs text-slate-500 mt-0.5">{item.time}</Text>
                                </View>
                                {item.isPublic && (
                                    <TouchableOpacity className="bg-brand-500 px-3 py-1.5 rounded-lg">
                                        <Text className="text-white text-xs font-medium">Join</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
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
                                <Text className="text-white text-xs font-medium">Invite</Text>
                            </TouchableOpacity>
                        </View>
                        <View className="flex-row flex-wrap gap-3">
                            {mockUsers.map((user, index) => (
                                <View
                                    key={user.id}
                                    className="flex-row items-center gap-2 bg-slate-800/30 px-3 py-2 rounded-xl"
                                >
                                    {renderAvatar(user.initials, index, 32)}
                                    <Text className="text-sm text-slate-200">{user.name}</Text>
                                    {user.streak >= 10 && <Flame size={14} color={COLORS.emeraldLight} />}
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
                        <View className="w-12 h-12 rounded-xl items-center justify-center" style={{ backgroundColor: "rgba(247, 152, 44, 0.15)" }}>
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
