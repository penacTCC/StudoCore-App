//Componentes do Native
import { View, Text, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

//Serviços do Projeto
import GroupCard from "@/components/GroupCard";
import { HADES } from "@/constants/hades";
import { useMeusGrupos } from "@/hooks/useMeusGrupos";
import { salvarUltimoGrupoLocalmente } from "@/services/armazenamentoOffline";

//Componentes Lucide Native
import { Plus, Users } from "lucide-react-native";

export default function MyGroupsScreen() {
    const { grupos, carregando, atualizando, atualizar } = useMeusGrupos();

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top"]}>
            {/* Header */}
            <View
                style={{
                    paddingTop: 6,
                    paddingHorizontal: 20,
                    paddingBottom: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <View>
                    <Text style={{ fontSize: 23, fontWeight: "700", color: HADES.text, letterSpacing: -0.3 }}>
                        Meus Grupos
                    </Text>
                    <Text style={{ fontSize: 13, color: HADES.textMuted, marginTop: 2 }}>Escolha um grupo</Text>
                </View>
                <TouchableOpacity
                    onPress={() => router.push("/(modals)/create-group")}
                    style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: HADES.surfaceRaised,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Plus size={18} color={HADES.textSecondary} />
                </TouchableOpacity>
            </View>

            {carregando ? (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <ActivityIndicator size="large" color={HADES.accentSolid} />
                </View>
            ) : (
                <FlatList
                    style={{ flex: 1 }}
                    data={grupos}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={atualizando} onRefresh={atualizar} tintColor={HADES.accentSolid} />
                    }
                    ListEmptyComponent={
                        <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 80 }}>
                            <Users size={30} color={HADES.dot} />
                            <Text style={{ color: HADES.textMuted, textAlign: "center", marginTop: 12 }}>
                                Você ainda não está em nenhum grupo.
                            </Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <GroupCard
                            group={item}
                            onPress={async () => {
                                // Salva esse grupo na memória antes de navegar
                                await salvarUltimoGrupoLocalmente(item.id);
                                router.push({
                                    pathname: "/(tabs)",
                                    params: {
                                        groupId: item.id,
                                        groupName: item.nome_grupo,
                                        groupPhoto: item.foto_grupo,
                                        groupCode: item.codigo_convite,
                                        groupGoal: item.meta_horas,
                                    },
                                });
                            }}
                        />
                    )}
                />
            )}

            {/* CTA fixo no rodapé */}
            <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 }}>
                <TouchableOpacity
                    onPress={() => router.push("/(modals)/create-group")}
                    activeOpacity={0.85}
                    style={{
                        height: 54,
                        borderRadius: 15,
                        backgroundColor: HADES.accentSolid,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 9,
                    }}
                >
                    <Plus size={20} color="#000" />
                    <Text style={{ color: "#000", fontWeight: "700", fontSize: 16 }}>Criar um grupo</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
