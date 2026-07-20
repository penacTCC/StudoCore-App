import { useState } from "react";

//Componentes do Native
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Globe, Compass, Link as LinkIcon } from "lucide-react-native";

//Componentes do Projeto
import { router } from "expo-router";
import { HADES } from "@/constants/hades";
import { useGruposPublicos } from "@/hooks/useGruposPublicos";

//Componentes gráficos
import SearchBar from "@/components/ui/SearchBar";
import PublicGroupCard from "@/components/groups/PublicGroupCard";
import { useOnlineUsers } from "@/hooks/useOnlineUsers";

export default function BrowseGroupsScreen() {
    //Faz sistema de pesquisa
    const [searchQuery, setSearchQuery] = useState("");

    //Busca os grupos públicos
    const { gruposPublicos, carregando } = useGruposPublicos();

    //Filtra os grupos por pesquisa
    const gruposFiltrados = gruposPublicos.filter(
        (g) =>
            g.nome_grupo.toLowerCase().includes(searchQuery.toLowerCase()) ||
            g.descricao?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const { onlineUsers } = useOnlineUsers();

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
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <ArrowLeft size={22} color={HADES.textSecondary} />
                    </TouchableOpacity>
                    <View>
                        <Text style={{ fontSize: 20, fontWeight: "700", color: HADES.text, letterSpacing: -0.3 }}>
                            Grupos Públicos
                        </Text>
                        <Text style={{ fontSize: 13, color: HADES.textMuted, marginTop: 2 }}>
                            Junte-se a grupos de estudo
                        </Text>
                    </View>
                </View>
                <TouchableOpacity
                    onPress={() => router.push("/(modals)/join-by-code")}
                    style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: HADES.surfaceRaised,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <LinkIcon size={18} color={HADES.textSecondary} />
                </TouchableOpacity>
            </View>

            {carregando ? (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <ActivityIndicator size="large" color={HADES.accentSolid} />
                    <Text style={{ color: HADES.textMuted, marginTop: 14 }}>
                        Carregando os melhores grupos para você...
                    </Text>
                </View>
            ) : (
                <>
                    {/* Search */}
                    <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
                        <SearchBar
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Pesquisar grupos..."
                        />
                    </View>

                    {/* Banner de estatísticas */}
                    <View style={{ paddingHorizontal: 20, marginBottom: 4 }}>
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 14,
                                backgroundColor: HADES.accentTint,
                                borderWidth: 1,
                                borderColor: HADES.accentTintBorder,
                                borderRadius: 16,
                                padding: 14,
                            }}
                        >
                            <View
                                style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 13,
                                    backgroundColor: "rgba(255,154,0,0.14)",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <Globe size={22} color={HADES.accentSolid} />
                            </View>
                            <View>
                                <Text style={{ fontSize: 16, fontWeight: "700", color: HADES.text }}>
                                    {onlineUsers.length} estudando agora
                                </Text>
                                <Text style={{ fontSize: 13, color: HADES.textMuted, marginTop: 1 }}>
                                    {gruposPublicos.length} grupos públicos disponíveis
                                </Text>
                            </View>
                        </View>
                    </View>

                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 }}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={{ gap: 12 }}>
                            {gruposFiltrados.map((group, index) => (
                                <PublicGroupCard key={group.id} grupo={group} colorIndex={index} />
                            ))}

                            {gruposFiltrados.length === 0 && (
                                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                                    <Compass size={44} color={HADES.dot} />
                                    <Text style={{ color: HADES.textMuted, fontWeight: "600", marginTop: 14 }}>
                                        Nenhum grupo encontrado
                                    </Text>
                                    <Text style={{ fontSize: 13, color: HADES.textDim, marginTop: 4 }}>
                                        Tente um termo de busca diferente
                                    </Text>
                                </View>
                            )}
                        </View>
                    </ScrollView>
                </>
            )}
        </SafeAreaView>
    );
}
