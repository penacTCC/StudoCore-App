//Componentes do Native
import { View, Text, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

//Serviços do Projeto
import GroupCard from "@/components/GroupCard";
import { COLORS } from "@/constants/colors";
import { useMyGroups } from "@/hooks/useMyGroups";
import { saveLastGroupLocally } from "@/services/offlineStorage";

//Componentes Lucide Native
import { Plus, Users } from "lucide-react-native";

export default function MyGroupsScreen() {
    const { groups, isLoading, refreshing, onRefresh } = useMyGroups();

    return (
        <SafeAreaView className="flex-1 bg-slate-950 edges={['top']}">
            {/* Header */}
            <View className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex-row items-center gap-3 justify-between">
                <View className="flex-row gap-3">
                    <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: COLORS.primaryFaint }}>
                        <Users size={20} color={COLORS.primary} />
                    </View>
                    <View>
                        <Text className="text-2xl font-bold text-slate-200">Meus Grupos</Text>
                        <Text className="text-sm text-slate-400">Escolha um grupo</Text>
                    </View>
                </View>
                <TouchableOpacity
                    onPress={() => router.push("/(modals)/create-group")}
                    className="flex-row items-center gap-1 bg-brand-500 px-3 py-1.5 rounded-lg"
                >
                    <Plus size={16} color={COLORS.white} />
                </TouchableOpacity>
            </View>

            {isLoading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <FlatList
                    data={groups}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
                    }
                    ListEmptyComponent={
                        <View className="items-center justify-center py-20">
                            <Text className="text-slate-400 text-center">Você ainda não está em nenhum grupo.</Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <GroupCard
                            group={item}
                            onPress={async () => {
                                // Salva esse grupo na memória antes de navegar
                                await saveLastGroupLocally(item.id);
                                router.push({
                                    pathname: "/(tabs)",
                                    params: {
                                        groupId: item.id,
                                        groupName: item.nome_grupo,
                                        groupPhoto: item.foto_grupo,
                                        groupCode: item.codigo_grupo
                                    }
                                });
                            }}
                        />
                    )}
                />
            )}
            <TouchableOpacity
                onPress={() => router.push("/create-group")}
                className="w-full flex-row items-center justify-center gap-2 bg-brand-500 py-4 rounded-xl"
            >
                <Plus size={20} color={COLORS.white} />
                <Text className="text-white font-semibold text-lg">
                    Criar um grupo
                </Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
}
