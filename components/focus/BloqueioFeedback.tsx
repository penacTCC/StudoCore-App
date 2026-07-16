import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { ClipboardList, ChevronRight, Pencil } from "lucide-react-native";
import { HADES } from "@/constants/hades";
import type { SessaoFocoRow } from "@/types/sessions";

const CORES = ["#3b82f6", "#7c5cfc", "#30d158", "#f2b03d", "#f0556b"];

function formatarQuando(dataIso: string) {
    const data = new Date(dataIso);
    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(hoje.getDate() - 1);

    const mesmoDia = (a: Date, b: Date) =>
        a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

    if (mesmoDia(data, hoje)) return "Hoje";
    if (mesmoDia(data, ontem)) return "Ontem";
    return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function formatarDuracao(minutos: number) {
    if (minutos < 60) return `${minutos}m`;
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

type Props = {
    sessoes: SessaoFocoRow[];
    onResponder: (sessao: SessaoFocoRow) => void;
    onResponderTodos: () => void;
};

export default function BloqueioFeedback({ sessoes, onResponder, onResponderTodos }: Props) {
    const plural = sessoes.length === 1 ? "formulário" : "formulários";

    return (
        <View style={{ flex: 1 }}>
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingTop: 6, paddingHorizontal: 20, paddingBottom: 20 }}
                showsVerticalScrollIndicator={false}
            >
                <View
                    style={{
                        backgroundColor: HADES.surface,
                        borderWidth: 1,
                        borderColor: "rgba(242,176,61,0.35)",
                        borderRadius: 18,
                        padding: 20,
                    }}
                >
                    <View
                        style={{
                            width: 46,
                            height: 46,
                            borderRadius: 13,
                            backgroundColor: "rgba(242,176,61,0.12)",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <ClipboardList size={23} color={HADES.amber} />
                    </View>

                    <Text style={{ fontSize: 18, fontWeight: "700", color: HADES.text, marginTop: 16 }}>
                        Responda antes de continuar
                    </Text>
                    <Text style={{ fontSize: 14, color: HADES.textMuted, marginTop: 8, lineHeight: 21 }}>
                        Você tem{" "}
                        <Text style={{ color: HADES.text, fontWeight: "600" }}>
                            {sessoes.length} {plural}
                        </Text>{" "}
                        de sessões anteriores em aberto. Conclua-os para iniciar uma nova sessão.
                    </Text>

                    <View style={{ marginTop: 16, gap: 9 }}>
                        {sessoes.map((sessao, i) => (
                            <TouchableOpacity
                                key={sessao.id}
                                onPress={() => onResponder(sessao)}
                                activeOpacity={0.8}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 12,
                                    backgroundColor: HADES.bg,
                                    borderWidth: 1,
                                    borderColor: "rgba(255,255,255,0.07)",
                                    borderRadius: 12,
                                    paddingVertical: 13,
                                    paddingHorizontal: 14,
                                }}
                            >
                                <View
                                    style={{
                                        width: 9,
                                        height: 9,
                                        borderRadius: 5,
                                        backgroundColor: CORES[i % CORES.length],
                                    }}
                                />
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 14, fontWeight: "600", color: HADES.text }}>
                                        {sessao.disciplina}
                                    </Text>
                                    <Text style={{ fontSize: 12, color: HADES.textFaint, marginTop: 1 }}>
                                        {formatarQuando(sessao.created_at)} · {formatarDuracao(sessao.tempo_minutos)}
                                    </Text>
                                </View>
                                <ChevronRight size={17} color={HADES.textFaint} />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </ScrollView>

            <View style={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: 12 }}>
                <TouchableOpacity
                    onPress={onResponderTodos}
                    activeOpacity={0.85}
                    style={{
                        height: 54,
                        borderRadius: 15,
                        backgroundColor: HADES.amber,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 9,
                    }}
                >
                    <Pencil size={18} color="#000" />
                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#000" }}>
                        Responder formulários
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
