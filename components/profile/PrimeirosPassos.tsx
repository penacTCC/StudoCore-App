import { View, Text, TouchableOpacity } from "react-native";
import { Target, Play, Users, ChevronRight, Sparkles } from "lucide-react-native";
import { HADES } from "@/constants/hades";

type Props = {
    onDefinirMeta: () => void;
    onPrimeiraSessao: () => void;
    onEntrarGrupo: () => void;
};

export default function PrimeirosPassos({ onDefinirMeta, onPrimeiraSessao, onEntrarGrupo }: Props) {
    return (
        <View
            style={{
                backgroundColor: HADES.surface,
                borderWidth: 1,
                borderColor: "rgba(255,154,0,0.30)",
                borderRadius: 16,
                padding: 18,
                marginBottom: 16,
            }}
        >
            <Text style={{ fontSize: 18, fontWeight: "700", color: HADES.text, letterSpacing: -0.2 }}>
                Comece por aqui
            </Text>
            <Text style={{ fontSize: 13, color: HADES.textMuted, marginTop: 5, lineHeight: 19 }}>
                Três passos para o app começar a trabalhar por você.
            </Text>

            <View style={{ gap: 10, marginTop: 16 }}>
                <Passo
                    Icone={Target}
                    cor={HADES.accentSolid}
                    fundo={HADES.tintAccent}
                    titulo="Defina sua meta semanal"
                    descricao="Quantas horas quer estudar por semana?"
                    onPress={onDefinirMeta}
                />
                <Passo
                    Icone={Play}
                    cor={HADES.accentSolid}
                    fundo={HADES.tintAccent}
                    titulo="Faça sua primeira sessão"
                    descricao="Ganha sua primeira medalha na hora"
                    onPress={onPrimeiraSessao}
                />
                <Passo
                    Icone={Users}
                    cor={HADES.groupViolet}
                    fundo={HADES.groupVioletTint}
                    titulo="Entre em um grupo"
                    descricao="Estude junto e dispute o ranking"
                    onPress={onEntrarGrupo}
                />
            </View>

            <TouchableOpacity
                onPress={onPrimeiraSessao}
                activeOpacity={0.85}
                style={{
                    height: 52,
                    borderRadius: 14,
                    backgroundColor: HADES.accentSolid,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    marginTop: 16,
                }}
            >
                <Play size={18} color="#000" fill="#000" />
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#000" }}>
                    Iniciar primeira sessão
                </Text>
            </TouchableOpacity>
        </View>
    );
}

function Passo({
    Icone,
    cor,
    fundo,
    titulo,
    descricao,
    onPress,
}: {
    Icone: typeof Target;
    cor: string;
    fundo: string;
    titulo: string;
    descricao: string;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.8}
            style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                backgroundColor: HADES.bg,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.07)",
                borderRadius: 13,
                paddingVertical: 13,
                paddingHorizontal: 14,
            }}
        >
            <View
                style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    backgroundColor: fundo,
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <Icone size={16} color={cor} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: HADES.text }}>{titulo}</Text>
                <Text style={{ fontSize: 12, color: HADES.textFaint, marginTop: 1 }}>{descricao}</Text>
            </View>
            <ChevronRight size={17} color={HADES.textFaint} />
        </TouchableOpacity>
    );
}

/** Heatmap ainda sem dados: mostra a grade apagada e explica o que vai acontecer. */
export function HeatmapVazio({ children }: { children: React.ReactNode }) {
    return (
        <View
            style={{
                backgroundColor: HADES.surface,
                borderWidth: 1,
                borderColor: HADES.border,
                borderRadius: 16,
                padding: 16,
                marginBottom: 16,
            }}
        >
            <Text style={{ fontSize: 16, fontWeight: "700", color: HADES.text, letterSpacing: -0.2 }}>
                Histórico
            </Text>
            <View style={{ marginTop: 16, opacity: 0.55 }}>{children}</View>
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 16,
                    paddingTop: 14,
                    borderTopWidth: 1,
                    borderTopColor: "rgba(255,255,255,0.05)",
                }}
            >
                <Sparkles size={14} color={HADES.textDim} />
                <Text style={{ fontSize: 12.5, color: HADES.textFaint, lineHeight: 18, flex: 1 }}>
                    Seu histórico aparece aqui conforme você estuda.
                </Text>
            </View>
        </View>
    );
}
