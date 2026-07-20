import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, TrendingUp } from "lucide-react-native";
import { HADES } from "@/constants/hades";
import CardSessaoGrupo, { FeedVazio } from "@/components/grupo/CardSessaoGrupo";
import { useSessoesFoco } from "@/hooks/useSessoesFoco";
import { router, useLocalSearchParams } from "expo-router";
import { tempoTotalSessoesFocoOntem, tempoTotalSessoesFoco } from "@/services/sessions";
import { useMembrosOnline } from "@/hooks/useMembrosOnline";

export default function DetailingScreen() {
    const { groupId } = useLocalSearchParams<{ groupId?: string }>();
    const [total, setTotal] = useState("0h0");
    const [totalMinutos, setTotalMinutos] = useState(0);
    const [totalSessoesAnteriores, setTotalsessoesAnteriores] = useState(0);

    // Busca o histórico público do grupo atual para não misturar sessões de outros grupos.
    const { sessions, loading } = useSessoesFoco(50, groupId);

    //Busca de membros online agora
    const { totalOnline } = useMembrosOnline(groupId);

    //Busca o tempo total das sessões de foco
    useEffect(() => {
        const buscarTotal = async () => {
            //Busca resultados de tempo
            const resultado = await tempoTotalSessoesFoco(groupId);
            const totalMinutosAnteriores = await tempoTotalSessoesFocoOntem(groupId);

            setTotal(resultado.horasFormatadas);
            setTotalMinutos(resultado.totalMinutos);
            setTotalsessoesAnteriores(totalMinutosAnteriores);
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
                    gap: 12,
                }}
            >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <ArrowLeft size={22} color={HADES.textSecondary} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 20, fontWeight: "700", color: HADES.text, letterSpacing: -0.3 }}>
                            Detalhes
                        </Text>
                        <Text style={{ fontSize: 13, color: HADES.textMuted, marginTop: 2 }}>
                            Sessões recentes de estudo
                        </Text>
                    </View>
                </View>
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: HADES.greenTint,
                    }}
                >
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: HADES.green }} />
                    <Text style={{ fontSize: 11.5, fontWeight: "600", color: HADES.green }}>
                        {totalOnline} estudando agora
                    </Text>
                </View>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Resumo de hoje */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 14,
                        backgroundColor: HADES.groupVioletTint,
                        borderWidth: 1,
                        borderColor: "rgba(124,92,252,0.22)",
                        borderRadius: 16,
                        padding: 14,
                        marginBottom: 16,
                    }}
                >
                    <View
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 13,
                            backgroundColor: "rgba(124,92,252,0.22)",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <TrendingUp size={22} color={HADES.groupViolet} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, color: HADES.textMuted }}>Total de hoje</Text>
                        <Text style={{ fontSize: 22, fontWeight: "700", color: HADES.text, letterSpacing: -0.3 }}>
                            {total}
                        </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ fontSize: 13, color: HADES.green, fontWeight: "600" }}>
                            {percentual >= 0 ? "+" : ""}
                            {percentual.toFixed(0)}%
                        </Text>
                        <Text style={{ fontSize: 12, color: HADES.textDim }}>vs. ontem</Text>
                    </View>
                </View>

                {/* Feed de sessões */}
                <View style={{ gap: 12 }}>
                    {loading ? (
                        <FeedVazio carregando />
                    ) : sessions.length === 0 ? (
                        <FeedVazio />
                    ) : (
                        sessions.map((session) => <CardSessaoGrupo key={session.id} sessao={session} />)
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
