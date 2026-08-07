import { View, Text, TouchableOpacity } from "react-native";
import { HADES } from "@/constants/hades";

export type EscopoComunidade = "meu-grupo" | "explorar";

const OPCOES: { key: EscopoComunidade; label: string }[] = [
    { key: "meu-grupo", label: "Meu grupo" },
    { key: "explorar", label: "Explorar" },
];

/**
 * Alternador de escopo do topo da Comunidade.
 *
 * É o que faz a aba deixar de ser só "o meu grupo": o mesmo lugar passa a abrigar o
 * grupo do usuário e o conteúdo público de todo mundo, sem virar duas abas na barra
 * de baixo.
 */
export default function SegmentoComunidade({
    escopo,
    onSelecionar,
}: {
    escopo: EscopoComunidade;
    onSelecionar: (escopo: EscopoComunidade) => void;
}) {
    return (
        <View
            style={{
                marginHorizontal: 18,
                marginBottom: 12,
                padding: 4,
                backgroundColor: "#101116",
                borderWidth: 1,
                borderColor: HADES.border,
                borderRadius: 13,
                flexDirection: "row",
                gap: 3,
            }}
        >
            {OPCOES.map((opcao) => {
                const ativo = opcao.key === escopo;
                return (
                    <TouchableOpacity
                        key={opcao.key}
                        onPress={() => onSelecionar(opcao.key)}
                        activeOpacity={0.85}
                        style={{
                            flex: 1,
                            alignItems: "center",
                            paddingVertical: 9,
                            borderRadius: 10,
                            backgroundColor: ativo ? HADES.accentSolid : "transparent",
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 13,
                                fontWeight: ativo ? "700" : "600",
                                color: ativo ? "#000" : HADES.textMuted,
                            }}
                        >
                            {opcao.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}
