import { useEffect, useState } from "react";

//Componentes do React Native
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Clock, Play, Flame } from "lucide-react-native";

//Componentes do expo router
import { router } from "expo-router";

//Constantes
import { HADES } from "@/constants/hades";
import { useLocalSearchParams } from "expo-router";

type CoresMateria = { bg: string; text: string; border: string };

const CORES_PADRAO: CoresMateria = {
    bg: HADES.surfaceOverlay,
    text: HADES.textSecondary,
    border: HADES.border,
};

export default function JoinSessionScreen() {
    const { subjectColors } = useLocalSearchParams();
    // Se abrir sem o parâmetro (ex.: deep link), cai numa cor neutra em vez de quebrar.
    const colors: CoresMateria = subjectColors ? JSON.parse(subjectColors as string) : CORES_PADRAO;

    const handleJoin = () => {
        // In a real app, this would register the user in the session
        // Direct them to the focus tab
        router.dismissAll();
        router.replace("/(tabs)/focus");
    };

    //lógica do timer
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setElapsed((e) => e + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const seconds = String(elapsed % 60).padStart(2, "0");

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
                <Text style={{ fontSize: 20, fontWeight: "700", color: HADES.text }}>Entrar na sessão</Text>
                <TouchableOpacity onPress={() => router.back()} style={estilos.botaoCircular}>
                    <X size={18} color={HADES.textSecondary} />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Session Info */}
                <View style={[estilos.card, { marginBottom: 16 }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
                        <View
                            style={{
                                width: 48,
                                height: 48,
                                borderRadius: 24,
                                backgroundColor: HADES.surfaceOverlay,
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>AC</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", width: "100%", justifyContent: "space-between" }}>
                                <Text style={{ fontWeight: "500", color: HADES.text }}>Alex Chen</Text>
                                <View
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 4,
                                        paddingHorizontal: 8,
                                        paddingVertical: 4,
                                        borderRadius: 8,
                                        backgroundColor: HADES.amberTint,
                                        borderWidth: 1,
                                        borderColor: "rgba(242,176,61,0.25)",
                                    }}
                                >
                                    <Flame size={14} color={HADES.amber} />
                                    <Text style={{ fontSize: 12, fontWeight: "700", color: HADES.amber }}>5</Text>
                                </View>
                            </View>
                            <Text style={{ fontSize: 14, color: HADES.green }}>Estudando Agora</Text>
                        </View>
                    </View>

                    <View style={{ flexDirection: "row", alignItems: "center", gap: 24 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Clock size={14} color={HADES.textFaint} />
                            <Text style={{ fontSize: 14, color: HADES.textMuted }}>
                                Começou há <Text style={{ color: HADES.accentSolid }}>2m</Text>
                            </Text>
                        </View>
                    </View>

                    <View
                        style={{
                            backgroundColor: colors.bg,
                            borderColor: colors.border,
                            borderWidth: 1,
                            padding: 14,
                            marginTop: 12,
                            borderRadius: 14,
                        }}
                    >
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <View style={{ flex: 1, marginRight: 16 }}>
                                <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700", letterSpacing: 1.5, marginBottom: 4 }}>
                                    MATEMÁTICA
                                </Text>
                                <Text style={{ color: HADES.text, fontSize: 14, fontWeight: "600" }} numberOfLines={2}>
                                    Cálculo diferencial e integral
                                </Text>
                            </View>

                            <View style={{ alignItems: "flex-end" }}>
                                <Text style={{ color: HADES.text, fontSize: 22, fontWeight: "700" }}>
                                    {minutes}:{seconds}
                                </Text>
                                <Text style={{ color: HADES.textFaint, fontSize: 12, fontWeight: "700", letterSpacing: 1.5 }}>
                                    AO VIVO
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Cards */}
                <View style={{ flexDirection: "row", gap: 12 }}>
                    {[
                        { valor: "3", rotulo: "participantes" },
                        { valor: "12", rotulo: "reações" },
                        { valor: "pública", rotulo: "visibilidade" },
                    ].map((item) => (
                        <View key={item.rotulo} style={[estilos.card, { flex: 1, alignItems: "center" }]}>
                            <Text style={{ color: HADES.text, fontSize: 17, fontWeight: "600" }}>{item.valor}</Text>
                            <Text numberOfLines={1} style={{ color: HADES.textFaint, fontSize: 12, fontWeight: "500", letterSpacing: 1 }}>
                                {item.rotulo}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* Container dos membros */}
                <View style={[estilos.card, { marginTop: 24 }]}>
                    <Text style={{ fontSize: 12, fontWeight: "700", letterSpacing: 1.5, color: HADES.textMuted }}>
                        PARTICIPANTES
                    </Text>

                    {[
                        { iniciais: "AC", cor: "#1e3a5f", nome: "Alex Chen", papel: "anfitrião" },
                        { iniciais: "MR", cor: "#2d1b4e", nome: "Maria Ribeiro", papel: "participante" },
                        { iniciais: "JS", cor: "#1a3320", nome: "João Silva", papel: "participante" },
                    ].map((membro) => (
                        <View key={membro.iniciais} style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16 }}>
                            <View
                                style={{
                                    backgroundColor: membro.cor,
                                    width: 48,
                                    height: 48,
                                    borderRadius: 24,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{membro.iniciais}</Text>
                            </View>
                            <View style={{ flex: 1, flexDirection: "row", justifyContent: "space-between" }}>
                                <View>
                                    <Text style={{ fontWeight: "500", fontSize: 14, color: HADES.text }}>{membro.nome}</Text>
                                    <Text style={{ fontSize: 12, color: HADES.textFaint, letterSpacing: 0.5 }}>{membro.papel}</Text>
                                </View>
                                <Text style={{ fontSize: 12, color: HADES.textFaint }}>2m</Text>
                            </View>
                        </View>
                    ))}
                </View>
            </ScrollView>

            {/* Bottom Button */}
            <View style={{ paddingHorizontal: 20, paddingBottom: 24, paddingTop: 8, borderTopWidth: 1, borderTopColor: HADES.border }}>
                <TouchableOpacity
                    onPress={handleJoin}
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
                    <Play size={20} color="#000" />
                    <Text style={{ fontWeight: "700", fontSize: 16, color: "#000" }}>Entrar na Sessão</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const estilos = {
    card: {
        backgroundColor: HADES.surface,
        borderWidth: 1,
        borderColor: HADES.border,
        padding: 14,
        borderRadius: 16,
    },
    botaoCircular: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: HADES.surfaceRaised,
        alignItems: "center" as const,
        justifyContent: "center" as const,
    },
};
