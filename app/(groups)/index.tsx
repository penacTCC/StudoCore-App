import { View, Text, FlatList, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useCallback } from "react";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "../supabase";
import GroupCard from "@/components/GroupCard";
import { COLORS } from "@/constants/colors";
import { Users } from "lucide-react-native";

export default function MyGroupsScreen() {
    const [groups, setGroups] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchMyGroups = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch groups where the user is a member
            const { data: memberData, error } = await supabase
                .from("membros")
                .select(`
                    grupo_id,
                    grupos (
                        id,
                        nome_grupo,
                        descricao,
                        foto_grupo,
                        meta_horas,
                        publico
                    )
                `)
                .eq("user_id", user.id);

            if (error) {
                console.error("Erro ao buscar grupos:", error);
                return;
            }

            // Exclui membros que não tem um grupo correspondente, se houver, e mapeia para a array de grupos
            const myGroups = memberData
                ?.filter(m => m.grupos)
                .map(m => m.grupos);

            setGroups(myGroups || []);
        } catch (error) {
            console.error("Error fetching groups:", error);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchMyGroups();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchMyGroups();
    };

    return (
        <SafeAreaView className="flex-1 bg-slate-950 edges={['top']}">
            {/* Header */}
            <View className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: COLORS.primaryFaint }}>
                    <Users size={20} color={COLORS.primary} />
                </View>
                <View>
                    <Text className="text-2xl font-bold text-slate-200">Meus Grupos</Text>
                    <Text className="text-sm text-slate-400">Escolha um grupo para começar</Text>
                </View>
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
                            onPress={() => {
                                // Idealmente a gente salvaria esse grupo no context ou Async Storage aqui 
                                // antes de navegar. Por enquanto só navegamos para as tabs
                                router.push("/(tabs)");
                            }}
                        />
                    )}
                />
            )}
        </SafeAreaView>
    );
}
