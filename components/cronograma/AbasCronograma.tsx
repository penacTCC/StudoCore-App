import { View, Text, TouchableOpacity } from "react-native";
import { HADES } from "@/constants/hades";
import type { AbaCronograma } from "@/types/cronograma";

const ABAS: { chave: AbaCronograma; rotulo: string }[] = [
    { chave: "hoje", rotulo: "Hoje" },
    { chave: "semana", rotulo: "Semana" },
    { chave: "planos", rotulo: "Planos" },
];

type Props = {
    ativa: AbaCronograma;
    onChange: (aba: AbaCronograma) => void;
};

export default function AbasCronograma({ ativa, onChange }: Props) {
    return (
        <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>
            <View
                style={{
                    flexDirection: "row",
                    backgroundColor: HADES.surface,
                    borderWidth: 1,
                    borderColor: HADES.border,
                    borderRadius: 12,
                    padding: 4,
                }}
            >
                {ABAS.map(({ chave, rotulo }) => {
                    const selecionada = ativa === chave;
                    return (
                        <TouchableOpacity
                            key={chave}
                            onPress={() => onChange(chave)}
                            activeOpacity={0.7}
                            style={{
                                flex: 1,
                                paddingVertical: 9,
                                alignItems: "center",
                                borderRadius: 9,
                                backgroundColor: selecionada ? HADES.surfaceOverlay : "transparent",
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 13,
                                    fontWeight: "600",
                                    color: selecionada ? HADES.text : HADES.textFaint,
                                }}
                            >
                                {rotulo}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}
