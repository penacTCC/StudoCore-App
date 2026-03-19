import { useState } from "react";

//Componentes do Native
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Globe, Compass, Link as LinkIcon } from "lucide-react-native";

//Componentes do Projeto
import { router } from "expo-router";
import { COLORS } from "@/constants/colors";
import { usePublicGroups } from "@/hooks/usePublicGroups";

//Componentes gráficos
import SearchBar from "@/components/ui/SearchBar";
import PublicGroupCard from "@/components/groups/PublicGroupCard";

export default function BrowseGroupsScreen() {
    const [searchQuery, setSearchQuery] = useState("");

    const { publicGroups, isLoading, refetchGroups } = usePublicGroups();

    const filteredGroups = publicGroups.filter(
        (g) =>
            g.nome_grupo.toLowerCase().includes(searchQuery.toLowerCase()) ||
            g.descricao.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totalActive = publicGroups.reduce((acc, g) => acc + g.activeNow, 0);

    if (isLoading) {
        return <Text>Carregando os melhores grupos para você...</Text>;
    }

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
                            <Text className="text-xl font-bold text-slate-200">Grupos Públicos</Text>
                            <Text className="text-sm text-slate-400">Junte-se a grupos de estudo</Text>
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
                <SearchBar
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Pesquisar grupos..."
                    variant="dark"
                />
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
                            {totalActive} estudando agora
                        </Text>
                        <Text className="text-sm text-slate-400">
                            {publicGroups.length} grupos públicos disponíveis
                        </Text>
                    </View>
                </View>
            </View>

            <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
                <View className="gap-3 pb-6">
                    {filteredGroups.map((group, index) => (
                        <PublicGroupCard
                            key={group.id}
                            group={group}
                            colorIndex={index}
                        />
                    ))}

                    {filteredGroups.length === 0 && (
                        <View className="items-center py-8">
                            <Compass size={48} color={COLORS.textFaint} />
                            <Text className="text-slate-400 font-medium mt-3">Nenhum grupo encontrado</Text>
                            <Text className="text-sm text-slate-500">Tente um termo de busca diferente</Text>
                        </View>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
