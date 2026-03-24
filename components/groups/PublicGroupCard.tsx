import { View, Text, TouchableOpacity, Image } from "react-native";
import { Users, Target } from "lucide-react-native";
import { router } from "expo-router";
import { COLORS } from "@/constants/colors";
import { joinPublicGroup } from "@/services/groups";
import { usePublicGroups } from "@/hooks/usePublicGroups";
import { saveLastGroupLocally } from "@/services/offlineStorage";

interface PublicGroup {
    id: string;
    nome_grupo: string;
    descricao: string;
    foto_grupo?: string | null;
    meta_horas: number;
    publico: boolean;
    members: number;
    activeNow: number;
    weeklyTarget: number;
    isOnline: boolean;
}

interface PublicGroupCardProps {
    group: PublicGroup;
    colorIndex: number;
    onJoin?: () => void;
}

/**
 * Card de grupo público com avatar, nome, descrição, membros, meta semanal
 * e botão Join. Extraído de browse-groups.tsx.
 */
export default function PublicGroupCard({
    group
}: PublicGroupCardProps) {

    const { refetchGroups } = usePublicGroups();


    const onJoin = async (groupId: string) => {
        await joinPublicGroup(groupId);
        await saveLastGroupLocally(groupId);
        refetchGroups();
        router.push({
            pathname: "/(tabs)",
            params: {
                groupId: groupId,
                groupName: group.nome_grupo,
                groupPhoto: group.foto_grupo,
            }
        })
    }

    return (
        <TouchableOpacity
            onPress={() =>
                router.push({
                    pathname: "/group-details",
                    params: { groupId: group.id.toString() },
                })
            }
            className="bg-navy-900 border border-navy-800 rounded-2xl p-4"
        >
            <View className="flex-row items-start gap-3">
                {/* Avatar */}
                <View className="w-16 h-16 rounded-xl bg-slate-800 overflow-hidden items-center justify-center border border-slate-700 mr-4">
                    {group.foto_grupo ? (
                        <Image source={{ uri: group.foto_grupo }} className="w-full h-full" resizeMode="cover" />
                    ) : (
                        <Users size={28} color={COLORS.textMuted} />
                    )}
                </View>
                <View className="relative">
                    {group.isOnline && (
                        <View className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-slate-900 rounded-full" />
                    )}
                </View>

                {/* Info */}
                <View className="flex-1">
                    <View className="flex-row items-center gap-2 mb-1">
                        <Text className="font-semibold text-slate-200" numberOfLines={1}>
                            {group.nome_grupo}
                        </Text>
                        {group.activeNow > 0 && (
                            <View
                                className="px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: "rgba(16, 185, 129, 0.2)" }}
                            >
                                <Text className="text-xs text-emerald-400">
                                    {group.activeNow} active
                                </Text>
                            </View>
                        )}
                    </View>
                    <Text className="text-sm text-slate-400 mb-2" numberOfLines={2}>
                        {group.descricao || "Sem descrição"}
                    </Text>
                    <View className="flex-row items-center gap-4">
                        <View className="flex-row items-center gap-1">
                            <Users size={12} color={COLORS.textMuted} />
                            <Text className="text-xs text-slate-500">
                                {group.members} members
                            </Text>
                        </View>
                        <View className="flex-row items-center gap-1">
                            <Target size={12} color={COLORS.textMuted} />
                            <Text className="text-xs text-slate-500">
                                {group.meta_horas}h/week
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Join Button */}
                <TouchableOpacity
                    onPress={() => onJoin(group.id)}
                    className="bg-brand-500 px-4 py-2 rounded-xl"
                >
                    <Text className="text-white text-sm font-medium">Join</Text>
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );
}
