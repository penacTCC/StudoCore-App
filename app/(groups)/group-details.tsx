import { View, Text, TouchableOpacity, ScrollView, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Globe, Users } from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import { COLORS } from "@/constants/colors";
import { mockUsers, mockDetailingFeed } from "@/constants/mock-data";
import { getAvatarColor } from "@/constants/helpers";
import Avatar from "@/components/ui/Avatar";
import ProgressBar from "@/components/ui/ProgressBar";
import StatCard from "@/components/ui/StatCard";
import { fetchGroupById, joinPublicGroup } from "@/services/groups";
import { saveLastGroupLocally } from "@/services/offlineStorage";
import { useEffect, useState } from "react";
import { useGroupMembers } from "@/hooks/useGroupMembers";
import { useOnlineUsers } from "@/hooks/useOnlineUsers";
import { useAuth } from "@/hooks/useAuth";

export default function GroupDetailsScreen() {
    const { groupId } = useLocalSearchParams<{ groupId: string }>();
    const [group, setGroup] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    //Pega membros do grupo
    const { members } = useGroupMembers({ groupId });

    //Pega o id do usuário logado
    const { userId } = useAuth();

    //Pega as informações do grupo pelo ID
    useEffect(() => {
        const loadGroup = async () => {
            setIsLoading(true);
            const fetchedGroup = await fetchGroupById(groupId!);
            setGroup(fetchedGroup);
            setIsLoading(false);
        };
        loadGroup();
    }, [groupId]);

    //Pega usuários online
    const { onlineUsers } = useOnlineUsers(groupId);
    //Filtra o próprio usuário da lista de onlineUsers
    const onlineOthers = onlineUsers.filter(id => id !== userId);

    if (isLoading || !group) {
        return (
            <SafeAreaView className="flex-1 bg-navy-950 items-center justify-center">
                <Text className="text-slate-400">{isLoading ? "Carregando detalhes..." : "Group not found"}</Text>
            </SafeAreaView>
        );
    }

    const weeklyProgress = 0.75;
    const initials = group.nome_grupo ? group.nome_grupo.substring(0, 2).toUpperCase() : "GR";

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
                        <Text className="text-xl font-bold text-slate-200">{group.nome_grupo}</Text>
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
                                        backgroundColor: getAvatarColor((group.id || 1) - 1),
                                        borderWidth: 2,
                                        borderColor: "rgba(247, 152, 44, 0.4)",
                                    }}
                                >
                                    {group.foto_grupo ? (
                                        <Image
                                            source={{ uri: group.foto_grupo }}
                                            className="w-full h-full rounded-2xl"
                                        />
                                    ) : (
                                        <Text className="text-white text-2xl font-bold">
                                            {initials}
                                        </Text>
                                    )}
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
                                    <Text className="text-xs text-emerald-400 font-medium">
                                        {group.publico ? "Public Group" : "Private Group"}
                                    </Text>
                                </View>
                                <Text className="text-sm text-slate-300 leading-5">
                                    {group.descricao || "Sem decrição."}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Stats Grid */}
                <View className="px-4 mb-4">
                    <View className="flex-row gap-3">
                        <StatCard value={group.members} label="Members" valueColor={COLORS.violetLight} />
                        <StatCard value={onlineOthers.length} label="Active Now" valueColor={COLORS.emeraldLight} />
                        <StatCard value={`${group.meta_horas || 0}h`} label="Weekly Goal" valueColor={COLORS.amber} />
                    </View>
                </View>

                {/* Active Members */}
                <View className="px-4 mb-4">
                    <View className="bg-navy-900 border border-navy-800 rounded-3xl p-4">
                        <View className="flex-row items-center justify-between mb-3">
                            <Text className="text-sm font-medium text-slate-200">Active Members</Text>
                            <View
                                className="flex-row items-center gap-1 px-2 py-1 rounded-full"
                                style={onlineOthers.length > 0 ? { backgroundColor: "rgba(16, 185, 129, 0.2)" } : { backgroundColor: "rgba(255, 0, 0, 0.2)" }}
                            >
                                <View className={`w-1.5 h-1.5 ${onlineOthers.length > 0 ? "bg-emerald-400" : "bg-rose-400"} rounded-full`} />
                                <Text className={`text-xs ${onlineOthers.length > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                    {onlineOthers.length > 0 ? onlineOthers.length + " estudando" : "Ninguém estudando"}
                                </Text>
                            </View>
                        </View>
                        <View className="flex-row flex-wrap gap-2">
                            {members.map((member) => (
                                <View
                                    key={member.id}
                                    className="flex-row items-center gap-2 px-3 py-2 rounded-xl bg-slate-800"
                                >
                                    <Avatar
                                        foto={member.userData?.foto_usuario}
                                        size={32}
                                        showOnlineDot={onlineOthers.includes(member.user_id || member.userData?.id)}
                                    />
                                    <Text className="text-sm text-slate-200">{member.userData?.nome_usuario || "Membro"}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                </View>

                {/* Weekly Progress */}
                <View className="px-4 mb-4">
                    <View className="bg-navy-900 border border-navy-800 rounded-3xl p-4">
                        <View className="flex-row items-center justify-between mb-3">
                            <Text className="text-sm font-medium text-slate-200">Weekly Progress</Text>
                            <Text className="text-xs text-emerald-400">
                                {Math.round(weeklyProgress * 100)}% achieved
                            </Text>
                        </View>
                        <ProgressBar progress={weeklyProgress} color={COLORS.emerald} height={12} />
                        <Text className="text-xs text-slate-500 mt-2">
                            {Math.round((group.meta_horas || 0) * weeklyProgress)}h / {group.meta_horas || 0}h this week
                        </Text>
                    </View>
                </View>

                <View className="h-20" />
            </ScrollView>

            {/* Join Button */}
            <View
                className="absolute bottom-0 left-0 right-0 px-4 pb-6 pt-2"
                style={{ backgroundColor: COLORS.bgPrimary }}
            >
                <TouchableOpacity
                    onPress={async () => {
                        await joinPublicGroup(group.id);
                        await saveLastGroupLocally(group.id);
                        router.push({
                            pathname: "/(tabs)",
                            params: {
                                groupId: group.id,
                                groupName: group.nome_grupo,
                                groupPhoto: group.foto_grupo
                            }
                        })
                    }}
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
