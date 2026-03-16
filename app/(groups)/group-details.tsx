import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
    ArrowLeft,
    Globe,
    Users,
    Flame,
} from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import { COLORS } from "@/constants/colors";
import { mockPublicGroups, mockUsers, mockLiveFeed } from "@/constants/mock-data";
import { getAvatarColor } from "@/constants/helpers";

export default function GroupDetailsScreen() {
    const { groupId } = useLocalSearchParams<{ groupId: string }>();
    const group = mockPublicGroups.find((g) => g.id === parseInt(groupId || "1"));

    if (!group) {
        return (
            <SafeAreaView className="flex-1 bg-navy-950 items-center justify-center">
                <Text className="text-slate-400">Group not found</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-navy-950" edges={["top"]}>
            {/* Header */}
            <View className="bg-navy-950 border-b border-navy-800 px-4 py-3">
                <View className="flex-row items-center gap-3">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center"
                    >
                        <ArrowLeft size={18} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                    <View className="flex-1">
                        <Text className="text-xl font-bold text-slate-200">{group.name}</Text>
                        <Text className="text-sm text-slate-400">{group.members} members</Text>
                    </View>
                </View>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Group Banner */}
                <View className="px-4 py-4">
                    <View
                        className="border border-navy-800 rounded-3xl p-6 overflow-hidden"
                        style={{ backgroundColor: "rgba(247, 152, 44, 0.08)" }}
                    >
                        <View className="flex-row items-center gap-4">
                            <View className="relative">
                                <View
                                    className="w-20 h-20 rounded-2xl items-center justify-center"
                                    style={{
                                        backgroundColor: getAvatarColor(group.id - 1),
                                        borderWidth: 2,
                                        borderColor: "rgba(247, 152, 44, 0.4)",
                                    }}
                                >
                                    <Text className="text-white text-2xl font-bold">{group.initials}</Text>
                                </View>
                                {group.isOnline && (
                                    <View className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-2 border-slate-900 rounded-full items-center justify-center">
                                        <View className="w-2 h-2 bg-white rounded-full" />
                                    </View>
                                )}
                            </View>
                            <View className="flex-1">
                                <View className="flex-row items-center gap-2 mb-1">
                                    <Globe size={14} color={COLORS.emeraldLight} />
                                    <Text className="text-xs text-emerald-400 font-medium">Public Group</Text>
                                </View>
                                <Text className="text-sm text-slate-300 leading-5">{group.description}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Stats Grid */}
                <View className="px-4 mb-4">
                    <View className="flex-row gap-3">
                        <View className="flex-1 bg-navy-900 border border-navy-800 rounded-2xl p-4 items-center">
                            <Text className="text-2xl font-bold text-violet-400">{group.members}</Text>
                            <Text className="text-xs text-slate-400">Members</Text>
                        </View>
                        <View className="flex-1 bg-navy-900 border border-navy-800 rounded-2xl p-4 items-center">
                            <Text className="text-2xl font-bold text-emerald-400">{group.activeNow}</Text>
                            <Text className="text-xs text-slate-400">Active Now</Text>
                        </View>
                        <View className="flex-1 bg-navy-900 border border-navy-800 rounded-2xl p-4 items-center">
                            <Text className="text-2xl font-bold text-amber-400">{group.weeklyTarget}h</Text>
                            <Text className="text-xs text-slate-400">Weekly Goal</Text>
                        </View>
                    </View>
                </View>

                {/* Active Members */}
                <View className="px-4 mb-4">
                    <View className="bg-navy-900 border border-navy-800 rounded-3xl p-4">
                        <View className="flex-row items-center justify-between mb-3">
                            <Text className="text-sm font-medium text-slate-200">Active Members</Text>
                            {group.activeNow > 0 && (
                                <View className="flex-row items-center gap-1 px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(16, 185, 129, 0.2)" }}>
                                    <View className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                                    <Text className="text-xs text-emerald-400">{group.activeNow} studying</Text>
                                </View>
                            )}
                        </View>
                        {group.activeNow > 0 ? (
                            <View className="flex-row flex-wrap gap-2">
                                {mockUsers.slice(0, Math.min(group.activeNow, 5)).map((user, index) => (
                                    <View key={user.id} className="flex-row items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: COLORS.primaryFaint }}>
                                        <View className="relative">
                                            <View
                                                className="w-8 h-8 rounded-full items-center justify-center"
                                                style={{ backgroundColor: getAvatarColor(index) }}
                                            >
                                                <Text className="text-white text-xs font-bold">{user.initials}</Text>
                                            </View>
                                            <View className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-800 rounded-full" />
                                        </View>
                                        <Text className="text-sm text-slate-200">{user.name}</Text>
                                    </View>
                                ))}
                                {group.activeNow > 5 && (
                                    <View className="items-center justify-center px-3 py-2 rounded-xl" style={{ backgroundColor: COLORS.primaryFaint }}>
                                        <Text className="text-sm text-slate-400">+{group.activeNow - 5} more</Text>
                                    </View>
                                )}
                            </View>
                        ) : (
                            <Text className="text-sm text-slate-500 text-center py-4">No members currently studying</Text>
                        )}
                    </View>
                </View>

                {/* Live Sessions */}
                {group.activeNow > 0 && (
                    <View className="px-4 mb-4">
                        <View className="bg-navy-900 border border-navy-800 rounded-3xl p-4">
                            <Text className="text-sm font-medium text-slate-200 mb-3">Live Sessions</Text>
                            <View className="gap-2">
                                {mockLiveFeed.filter((f) => f.isPublic).slice(0, 2).map((session) => (
                                    <View key={session.id} className="flex-row items-center justify-between p-3 rounded-xl" style={{ backgroundColor: COLORS.primaryFaint }}>
                                        <View className="flex-1">
                                            <Text className="text-sm text-slate-200">
                                                <Text className="text-violet-400 font-medium">{session.user}</Text>{" "}
                                                {session.action}
                                            </Text>
                                            <Text className="text-xs text-slate-500">{session.time}</Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => router.push("/join-session")}
                                            className="px-3 py-1.5 rounded-lg"
                                            style={{ backgroundColor: "rgba(139, 92, 246, 0.2)" }}
                                        >
                                            <Text className="text-xs font-medium text-violet-400">Watch</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        </View>
                    </View>
                )}

                {/* Weekly Progress */}
                <View className="px-4 mb-4">
                    <View className="bg-navy-900 border border-navy-800 rounded-3xl p-4">
                        <View className="flex-row items-center justify-between mb-3">
                            <Text className="text-sm font-medium text-slate-200">Weekly Progress</Text>
                            <Text className="text-xs text-emerald-400">75% achieved</Text>
                        </View>
                        <View className="h-3 bg-navy-800 rounded-full overflow-hidden mb-2">
                            <View
                                className="h-full rounded-full"
                                style={{
                                    width: "75%",
                                    backgroundColor: COLORS.emerald,
                                }}
                            />
                        </View>
                        <Text className="text-xs text-slate-500">
                            {Math.round(group.weeklyTarget * 0.75)}h / {group.weeklyTarget}h this week
                        </Text>
                    </View>
                </View>

                {/* Spacer for bottom button */}
                <View className="h-20" />
            </ScrollView>

            {/* Join Button */}
            <View className="absolute bottom-0 left-0 right-0 px-4 pb-6 pt-2" style={{ backgroundColor: COLORS.bgPrimary }}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="bg-brand-500 py-4 rounded-2xl flex-row items-center justify-center gap-2"
                    style={{
                        shadowColor: COLORS.primary,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 12,
                        elevation: 8,
                    }}
                >
                    <Users size={20} color={COLORS.white} />
                    <Text className="text-white font-semibold text-lg">Join This Group</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
