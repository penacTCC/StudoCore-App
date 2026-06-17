import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, TrendingUp } from "lucide-react-native";
import { COLORS } from "@/constants/colors";
import SessionCard from "@/components/groups/SessionCard";
import { useSessoesFoco } from "@/hooks/useSessoesFoco";
import { router, useLocalSearchParams } from "expo-router";
import { tempoTotalSessoesFocoOntem, tempoTotalSessoesFoco } from "@/services/sessions";
import { useMembrosOnline } from "@/hooks/useMembrosOnline";

export default function DetailingScreen() {
    const { groupId } = useLocalSearchParams<{ groupId?: string }>();
    const [total, setTotal] = useState("0h0");
    const [totalMinutos, setTotalMinutos] = useState(0)
    const [totalSessoesAnteriores, setTotalsessoesAnteriores] = useState(0)

    // Busca o histórico público do grupo atual para não misturar sessões de outros grupos.
    const { sessions, loading } = useSessoesFoco(50, groupId);

    //Busca de membros online agora
    const {totalOnline} = useMembrosOnline(groupId)
    

    //Busca o tempo total das sessões de foco
    useEffect(() => {
        const buscarTotal = async () => {
            //Busca resultados de tempo
            const resultado = await tempoTotalSessoesFoco(groupId);
            const totalMinutosAnteriores = await tempoTotalSessoesFocoOntem(groupId)

            setTotal(resultado.horasFormatadas);
            setTotalMinutos(resultado.totalMinutos)
            setTotalsessoesAnteriores(totalMinutosAnteriores)
        };

        buscarTotal();
    }, [groupId]);

    //Faz o cálculo percentual do aumento, em relação a ontem
    const percentual =
    totalSessoesAnteriores === 0
        ? totalMinutos > 0
            ? 100
            : 0
        : ((totalMinutos - totalSessoesAnteriores) / totalSessoesAnteriores) * 100;


    return (
        <SafeAreaView className="flex-1 bg-slate-950" edges={["top"]}>
            {/* Header */}
            <View className="bg-slate-950 border-b border-slate-800 px-4 py-3">
                <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-3 flex-1 pr-3">
                        <TouchableOpacity
                            onPress={() => router.back()}
                            className="w-9 h-9 rounded-full bg-slate-800 items-center justify-center"
                            activeOpacity={0.8}
                        >
                            <ArrowLeft size={18} color={COLORS.textSecondary} />
                        </TouchableOpacity>

                        <View className="flex-1">
                            <Text className="text-xl font-bold text-slate-200">Detalhes</Text>
                            <Text className="text-sm text-slate-400">Sessões recentes de estudo</Text>
                        </View>
                    </View>
                    <View
                        className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full"
                        style={{
                            backgroundColor: "rgba(16, 185, 129, 0.15)",
                            borderWidth: 1,
                            borderColor: "rgba(16, 185, 129, 0.3)",
                        }}
                    >
                        <View className="w-2 h-2 bg-emerald-400 rounded-full" />
                        <Text className="text-xs font-medium text-emerald-400">
                            {totalOnline} estudando agora
                        </Text>
                    </View>
                </View>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Total de estudo Hoje */}
                <View className="px-4 py-3">
                    <View
                        className="border rounded-2xl p-4"
                        style={{
                            backgroundColor: "rgba(124, 58, 237, 0.08)",
                            borderColor: "rgba(139, 92, 246, 0.2)",
                        }}
                    >
                        <View className="flex-row items-center gap-4">
                            <View
                                className="w-12 h-12 rounded-xl items-center justify-center"
                                style={{ backgroundColor: "rgba(139, 92, 246, 0.2)" }}
                            >
                                <TrendingUp size={24} color={COLORS.violetLight} />
                            </View>
                            <View className="flex-1">
                                <Text className="text-sm text-slate-400">Total de hoje</Text>
                                <Text className="text-2xl font-bold text-slate-200">{total}</Text>
                            </View>
                            <View className="items-end">
                                <Text className="text-sm text-emerald-400 font-medium">
                                    {percentual >= 0 ? "+" : ""}
                                    {percentual.toFixed(0)}%
                                </Text>
                                <Text className="text-xs text-slate-500">vs. ontem</Text>
                            </View>
                        </View>
                    </View>
                </View>
                
                {/* Sessões de estudo */}
                <View className="px-4 pb-6">
                    <View className="gap-3">
                        {loading ? (
                            <Text className="text-sm text-slate-500 text-center py-4">Carregando sessões...</Text>
                        ) : sessions.length === 0 ? (
                            <Text className="text-sm text-slate-500 text-center py-4">Nenhuma sessão registrada ainda.</Text>
                        ) : (
                            sessions.map((session, index) => (
                                <SessionCard
                                    key={session.id}
                                    session={session}
                                    colorIndex={index}
                                />
                            ))
                        )}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
