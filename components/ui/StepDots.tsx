import { View } from "react-native";
import { COLORS } from "@/constants/colors";

interface StepDotsProps {
    /** Índice do passo ativo (0-indexed) */
    active: number;
    /** Número total de passos. Padrão: 2 */
    total?: number;
}

/**
 * Indicador de progresso em bolinhas/pílula animado.
 * O passo ativo exibe uma pílula larga; os inativos exibem um círculo menor.
 */
export default function StepDots({ active, total = 2 }: StepDotsProps) {
    return (
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            {Array.from({ length: total }).map((_, i) => (
                <View
                    key={i}
                    style={{
                        width: i === active ? 24 : 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor:
                            i === active ? COLORS.primary : "rgba(255,255,255,0.2)",
                    }}
                />
            ))}
        </View>
    );
}
