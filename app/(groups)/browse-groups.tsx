import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
    ArrowLeft,
    Search,
    Globe,
    Users,
    Target,
    Compass,
    Link as LinkIcon,
} from "lucide-react-native";
import { router } from "expo-router";
import { COLORS } from "@/constants/colors";
import { mockPublicGroups } from "@/constants/mock-data";
import { getAvatarColor } from "@/constants/helpers";

export default function BrowseGroupsScreen() {
    const [searchQuery, setSearchQuery] = useState("");

    const filteredGroups = mockPublicGroups.filter(
        (g) =>
            g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            g.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totalActive = mockPublicGroups.reduce((acc, g) => acc + g.activeNow, 0);

    return (
        <SafeAreaView className="flex-1 bg-navy-950" edges={["top"]}>
            {/* Header */}
            <View className="bg-navy-950 border-b border-navy-800 px-4 py-3">
                <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-3">
                        <TouchableOpacity
                            onPress={() => router.back()}
                            className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center"
                        >
                            <ArrowLeft size={18} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                        <View>
                            <Text className="text-xl font-bold text-slate-200">Browse Groups</Text>
                            <Text className="text-sm text-slate-400">Join public study groups</Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={() => router.push("/join-by-code")}
                        className="w-10 h-10 rounded-full bg-brand-500/10 items-center justify-center border border-brand-500/20"
                    >
                        <LinkIcon size={20} color={COLORS.primary} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Search */}
            <View className="px-4 py-3">
                <View className="relative">
                    <View className="absolute left-4 top-0 bottom-0 justify-center z-10">
                        <Search size={18} color={COLORS.textMuted} />
                    </View>
                    <TextInput
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Search public groups..."
                        placeholderTextColor={COLORS.textMuted}
                        className="bg-navy-900 border border-navy-800 rounded-xl pl-11 pr-4 py-3 text-slate-200 text-base"
                    />
                </View>
            </View>

            {/* Stats Banner */}
            <View className="px-4 mb-3">
                <View
                    className="flex-row items-center gap-4 border border-brand-500/20 rounded-2xl p-4"
                    style={{ backgroundColor: "rgba(247, 152, 44, 0.08)" }}
                >
                    <View
                        className="w-12 h-12 rounded-xl items-center justify-center"
                        style={{ backgroundColor: "rgba(247, 152, 44, 0.15)" }}
                    >
                        <Globe size={24} color={COLORS.violetLight} />
                    </View>
                    <View>
                        <Text className="text-lg font-bold text-slate-200">
                            {totalActive} studying now
                        </Text>
                        <Text className="text-sm text-slate-400">
                            {mockPublicGroups.length} public groups available
                        </Text>
                    </View>
                </View>
            </View>

            <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
                <View className="gap-3 pb-6">
                    {filteredGroups.map((group, index) => (
                        <TouchableOpacity
                            key={group.id}
                            onPress={() => router.push({ pathname: "/group-details", params: { groupId: group.id.toString() } })}
                            className="bg-navy-900 border border-navy-800 rounded-2xl p-4"
                        >
                            <View className="flex-row items-start gap-3">
                                {/* Group Avatar */}
                                <View className="relative">
                                    <View
                                        className="w-14 h-14 rounded-xl items-center justify-center"
                                        style={{ backgroundColor: getAvatarColor(index) }}
                                    >
                                        <Text className="text-white text-lg font-bold">{group.initials}</Text>
                                    </View>
                                    {group.isOnline && (
                                        <View className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-slate-900 rounded-full" />
                                    )}
                                </View>

                                {/* Group Info */}
                                <View className="flex-1">
                                    <View className="flex-row items-center gap-2 mb-1">
                                        <Text className="font-semibold text-slate-200" numberOfLines={1}>
                                            {group.name}
                                        </Text>
                                        {group.activeNow > 0 && (
                                            <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(16, 185, 129, 0.2)" }}>
                                                <Text className="text-xs text-emerald-400">{group.activeNow} active</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text className="text-sm text-slate-400 mb-2" numberOfLines={2}>
                                        {group.description}
                                    </Text>
                                    <View className="flex-row items-center gap-4">
                                        <View className="flex-row items-center gap-1">
                                            <Users size={12} color={COLORS.textMuted} />
                                            <Text className="text-xs text-slate-500">{group.members} members</Text>
                                        </View>
                                        <View className="flex-row items-center gap-1">
                                            <Target size={12} color={COLORS.textMuted} />
                                            <Text className="text-xs text-slate-500">{group.weeklyTarget}h/week</Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Join Button */}
                                <TouchableOpacity
                                    onPress={() => router.push("/(tabs)")}
                                    className="bg-brand-500 px-4 py-2 rounded-xl"
                                >
                                    <Text className="text-white text-sm font-medium">Join</Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableOpacity>
                    ))}

                    {filteredGroups.length === 0 && (
                        <View className="items-center py-8">
                            <Compass size={48} color={COLORS.textFaint} />
                            <Text className="text-slate-400 font-medium mt-3">No groups found</Text>
                            <Text className="text-sm text-slate-500">Try a different search term</Text>
                        </View>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
