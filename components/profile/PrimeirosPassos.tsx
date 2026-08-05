import { View, Text, TouchableOpacity } from "react-native";
import { Target, ChevronRight, Sparkles } from "lucide-react-native";
import { HADES } from "@/constants/hades";

/** Nudge de "meta semanal ainda não definida", mostrado no dia 1 no lugar da barra de progresso. */
export default function MetaSemanalVazia({ onDefinirMeta }: { onDefinirMeta: () => void }) {
    return (
        <TouchableOpacity
            onPress={onDefinirMeta}
            activeOpacity={0.8}
            style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                borderWidth: 1,
                borderStyle: "dashed",
                borderColor: HADES.borderDashed,
                borderRadius: 13,
                padding: 14,
            }}
        >
            <View
                style={{
                    width: 36,
                    height: 36,
                    borderRadius: 11,
                    backgroundColor: HADES.tintAccent,
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <Target size={18} color={HADES.accentSolid} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13.5, fontWeight: "600", color: HADES.text }}>
                    Defina sua meta semanal
                </Text>
                <Text style={{ fontSize: 11.5, color: HADES.textFaint, marginTop: 2 }}>
                    Quantas horas quer estudar por semana?
                </Text>
            </View>
            <ChevronRight size={16} color={HADES.textFaint} />
        </TouchableOpacity>
    );
}

/** Heatmap ainda sem dados: mostra a grade apagada e explica o que vai acontecer. */
export function HeatmapVazio({ children }: { children: React.ReactNode }) {
    return (
        <View>
            <View style={{ opacity: 0.55 }}>{children}</View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 }}>
                <Sparkles size={13} color={HADES.textDim} />
                <Text style={{ fontSize: 12, color: HADES.textFaint, lineHeight: 17, flex: 1 }}>
                    Seu histórico aparece aqui conforme você estuda.
                </Text>
            </View>
        </View>
    );
}
