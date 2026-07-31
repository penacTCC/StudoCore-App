import { useState } from "react";

//Componentes do Native
import { View, Text, TouchableOpacity, ScrollView, RefreshControl } from "react-native";
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
import { Skeleton, SkeletonCircle } from "@/components/ui/Skeleton";

export default function BrowseGroupsScreen() {
    //Faz sistema de pesquisa
    const [searchQuery, setSearchQuery] = useState("");

    //Busca os grupos públicos
    const { gruposPublicos, carregando, recarregarGrupos } = useGruposPublicos();

    //Controla o estado do pull-to-refresh
    const [atualizando, setAtualizando] = useState(false);
    const handleRefresh = async () => {
        setAtualizando(true);
        try {
            await recarregarGrupos();
        } finally {
            setAtualizando(false);
        }
    };

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
                <BrowseGroupsSkeleton />
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
                        refreshControl={
                            <RefreshControl
                                refreshing={atualizando}
                                onRefresh={handleRefresh}
                                tintColor={HADES.accentSolid}
                            />
                        }
                    >
                        <View style={{ gap: 12 }}>
                            {gruposFiltrados.map((group, index) => (
                                <PublicGroupCard key={group.id} grupo={group} colorIndex={index} />
                            ))}

                            {gruposFiltrados.length === 0 && (
                                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                                    <Compass size={44} color={HADES.dot} />
                                    <Text style={{ color: HADES.textMuted, fontWeight: "600", marginTop: 14 }}>
                                        {searchQuery.trim().length > 0
                                            ? "Nenhum grupo encontrado"
                                            : "Nenhum grupo público ainda"}
                                    </Text>
                                    <Text style={{ fontSize: 13, color: HADES.textDim, marginTop: 4 }}>
                                        {searchQuery.trim().length > 0
                                            ? "Tente um termo de busca diferente"
                                            : "Seja o primeiro a criar um grupo público pra outras pessoas encontrarem"}
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

function PublicGroupCardSkeleton() {
    return (
        <View
            style={{
                backgroundColor: HADES.surface,
                borderWidth: 1,
                borderColor: HADES.border,
                borderRadius: 16,
                padding: 14,
            }}
        >
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                <Skeleton width={56} height={56} borderRadius={14} hades />
                <View style={{ flex: 1, gap: 8 }}>
                    <Skeleton width="55%" height={15} hades />
                    <Skeleton width="90%" height={13} hades />
                    <View style={{ flexDirection: "row", gap: 16 }}>
                        <Skeleton width={70} height={12} hades />
                        <Skeleton width={80} height={12} hades />
                    </View>
                </View>
                <Skeleton width={62} height={32} borderRadius={11} hades />
            </View>
        </View>
    );
}

function BrowseGroupsSkeleton() {
    return (
        <>
            <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
                <Skeleton width="100%" height={44} borderRadius={12} hades />
            </View>

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
                    <SkeletonCircle size={44} hades />
                    <View style={{ gap: 6 }}>
                        <Skeleton width={140} height={16} hades />
                        <Skeleton width={170} height={13} hades />
                    </View>
                </View>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 }}
                showsVerticalScrollIndicator={false}
            >
                <View style={{ gap: 12 }}>
                    {[0, 1, 2, 3].map((i) => (
                        <PublicGroupCardSkeleton key={i} />
                    ))}
                </View>
            </ScrollView>
        </>
    );
}
