import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ChevronLeft, HandMetal, MessageCircle } from "lucide-react-native";
import { HADES } from "@/constants/hades";

type ColegaMock = {
    nome: string;
    inicial: string;
    cor: string;
    topico: string;
    tempo: string;
    emFoco: boolean;
};

// Mock: ainda não existe sessão pública em tempo real no backend (ver docs/project-context.md).
const COLEGAS_MOCK: ColegaMock[] = [
    { nome: "Nina", inicial: "N", cor: "#1f9d63", topico: "Modelagem entidade-relacionamento", tempo: "1:08:22", emFoco: true },
    { nome: "Théo", inicial: "T", cor: "#7c5cfc", topico: "Consultas SQL · JOINs", tempo: "55:40", emFoco: true },
    { nome: "Helena", inicial: "H", cor: "#c9482f", topico: "Normalização e formas normais", tempo: "33:15", emFoco: true },
    { nome: "Rafa", inicial: "R", cor: "#2f7dc9", topico: "Índices e otimização", tempo: "27:53", emFoco: true },
    { nome: "Duda", inicial: "D", cor: "#5a5d66", topico: "Transações e concorrência", tempo: "19:04", emFoco: false },
];

export default function ColegasFocandoScreen() {
    const router = useRouter();
    const { materia, conteudo } = useLocalSearchParams<{ materia?: string; conteudo?: string }>();

    const focando = COLEGAS_MOCK.filter((c) => c.emFoco).length + 1; // +1 = você
    const emPausa = COLEGAS_MOCK.filter((c) => !c.emFoco).length;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top"]}>
            <View style={{ paddingHorizontal: 18, paddingTop: 6, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{
                        width: 38,
                        height: 38,
                        borderRadius: 11,
                        backgroundColor: HADES.surfaceRaised,
                        borderWidth: 1,
                        borderColor: HADES.border,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <ChevronLeft size={20} color={HADES.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 18, fontWeight: "700", color: HADES.text, letterSpacing: -0.3 }}>
                        Focando juntos
                    </Text>
                </View>
            </View>

            <View
                style={{
                    marginHorizontal: 16,
                    marginBottom: 4,
                    backgroundColor: "rgba(255,154,0,0.09)",
                    borderWidth: 1,
                    borderColor: "rgba(255,154,0,0.22)",
                    borderRadius: 16,
                    paddingVertical: 16,
                    paddingHorizontal: 18,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 16,
                }}
            >
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: HADES.accentSolid, fontWeight: "700", letterSpacing: 0.6 }}>
                        TEMPO COMBINADO
                    </Text>
                    <Text style={{ fontSize: 30, fontWeight: "600", color: HADES.text, marginTop: 3 }}>3h 47m</Text>
                </View>
                <View style={{ width: 1, alignSelf: "stretch", backgroundColor: "rgba(255,255,255,0.1)" }} />
                <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: 24, fontWeight: "700", color: HADES.green }}>{focando}</Text>
                    <Text style={{ fontSize: 11, color: HADES.textMuted, marginTop: 1 }}>focando</Text>
                </View>
                <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: 24, fontWeight: "700", color: HADES.textFaint }}>{emPausa}</Text>
                    <Text style={{ fontSize: 11, color: HADES.textMuted, marginTop: 1 }}>em pausa</Text>
                </View>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 8 }}>
                <Text style={{ fontSize: 11, color: HADES.textFaint, fontWeight: "700", letterSpacing: 0.6, marginHorizontal: 4, marginBottom: 10 }}>
                    POR TEMPO DE HOJE
                </Text>

                <View style={{ gap: 9 }}>
                    <LinhaColega
                        inicial="H"
                        cor="#e08a1e"
                        nome="Você"
                        voce
                        topico={conteudo || "Normalização e formas normais"}
                        tempo="42:09"
                        emFoco
                    />
                    {COLEGAS_MOCK.map((c) => (
                        <LinhaColega
                            key={c.nome}
                            inicial={c.inicial}
                            cor={c.cor}
                            nome={c.nome}
                            topico={c.topico}
                            tempo={c.tempo}
                            emFoco={c.emFoco}
                        />
                    ))}
                </View>
            </ScrollView>

            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingHorizontal: 16,
                    paddingTop: 10,
                    paddingBottom: 26,
                    borderTopWidth: 1,
                    borderTopColor: HADES.border,
                }}
            >
                <TouchableOpacity
                    activeOpacity={0.85}
                    style={{
                        flex: 1,
                        height: 52,
                        borderRadius: 14,
                        backgroundColor: HADES.surfaceRaised,
                        borderWidth: 1,
                        borderColor: HADES.borderStrong,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                    }}
                >
                    <HandMetal size={18} color={HADES.accentSolid} />
                    <Text style={{ fontSize: 14, fontWeight: "600", color: HADES.text }}>Mandar força</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    activeOpacity={0.85}
                    style={{
                        width: 52,
                        height: 52,
                        borderRadius: 14,
                        backgroundColor: HADES.surfaceRaised,
                        borderWidth: 1,
                        borderColor: HADES.borderStrong,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <MessageCircle size={19} color={HADES.textMuted} />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

function LinhaColega({
    inicial,
    cor,
    nome,
    topico,
    tempo,
    emFoco,
    voce = false,
}: {
    inicial: string;
    cor: string;
    nome: string;
    topico: string;
    tempo: string;
    emFoco: boolean;
    voce?: boolean;
}) {
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 13,
                backgroundColor: voce ? "rgba(255,154,0,0.08)" : HADES.surface,
                borderWidth: 1,
                borderColor: voce ? "rgba(255,154,0,0.3)" : HADES.border,
                borderRadius: 14,
                paddingVertical: 13,
                paddingHorizontal: 14,
                opacity: emFoco ? 1 : 0.7,
            }}
        >
            <View style={{ position: "relative" }}>
                <View
                    style={{
                        width: 42,
                        height: 42,
                        borderRadius: 21,
                        backgroundColor: cor,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Text style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}>{inicial}</Text>
                </View>
                <View
                    style={{
                        position: "absolute",
                        right: -1,
                        bottom: -1,
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: emFoco ? HADES.green : HADES.textMuted,
                        borderWidth: 2.5,
                        borderColor: voce ? "#1c1608" : HADES.surface,
                    }}
                />
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: voce ? HADES.text : emFoco ? HADES.text : HADES.textSecondary }}>
                        {nome}
                    </Text>
                    {voce && (
                        <Text
                            style={{
                                fontSize: 10,
                                fontWeight: "700",
                                color: HADES.accentSolid,
                                backgroundColor: "rgba(255,154,0,0.15)",
                                borderRadius: 5,
                                paddingVertical: 2,
                                paddingHorizontal: 6,
                            }}
                        >
                            VOCÊ
                        </Text>
                    )}
                </View>
                <Text
                    style={{ fontSize: 12, color: emFoco ? HADES.textMuted : HADES.textFaint, marginTop: 2 }}
                    numberOfLines={1}
                >
                    {topico}
                </Text>
            </View>

            <View style={{ alignItems: "flex-end" }}>
                <Text
                    style={{
                        fontSize: 16,
                        fontWeight: "600",
                        color: emFoco ? HADES.text : HADES.textMuted,
                        fontVariant: ["tabular-nums"],
                    }}
                >
                    {tempo}
                </Text>
                <Text style={{ fontSize: 11, color: emFoco ? HADES.accentSolid : HADES.textFaint, marginTop: 1 }}>
                    {emFoco ? "em foco" : "em pausa"}
                </Text>
            </View>
        </View>
    );
}
