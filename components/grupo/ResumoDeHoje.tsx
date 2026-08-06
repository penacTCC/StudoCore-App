import { View, Text } from "react-native";
import { TrendingUp, TrendingDown, Minus } from "lucide-react-native";
import { HADES } from "@/constants/hades";

function formatarHoras(minutos: number) {
    const total = Math.max(0, Math.round(minutos));
    const horas = Math.floor(total / 60);
    const resto = total % 60;
    if (horas === 0) return `${resto}m`;
    if (resto === 0) return `${horas}h`;
    return `${horas}h ${resto}m`;
}

/**
 * Cabeçalho do feed: quanto o grupo estudou hoje e como isso se compara a ontem.
 *
 * Substitui o card roxo com ícone que ocupava um terço da largura para dizer duas
 * informações. Aqui o número é o elemento — mesma lógica dos cards do feed, onde o
 * cronômetro e a duração carregam o peso e o resto fica em texto pequeno.
 *
 * Quando ontem foi zero não há porcentagem: dividir por zero e anunciar "+100%" seria
 * inventar uma comparação que não existe (o primeiro dia de um grupo cairia sempre nisso).
 */
export default function ResumoDeHoje({
    totalMinutos,
    minutosOntem,
}: {
    totalMinutos: number;
    minutosOntem: number;
}) {
    const temComparacao = minutosOntem > 0;
    const percentual = temComparacao
        ? Math.round(((totalMinutos - minutosOntem) / minutosOntem) * 100)
        : 0;

    const subiu = percentual > 0;
    const parado = percentual === 0;
    const cor = parado ? HADES.textMuted : subiu ? HADES.green : HADES.red;
    const Icone = parado ? Minus : subiu ? TrendingUp : TrendingDown;

    return (
        <View
            style={{
                backgroundColor: HADES.surface,
                borderRadius: 20,
                paddingVertical: 18,
                paddingHorizontal: 18,
            }}
        >
            <Text
                style={{
                    fontSize: 11,
                    fontWeight: "700",
                    letterSpacing: 0.9,
                    color: HADES.textDim,
                }}
            >
                HOJE NO GRUPO
            </Text>

            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: 8 }}>
                <Text
                    style={{
                        fontSize: 34,
                        fontWeight: "800",
                        color: HADES.text,
                        letterSpacing: -1.2,
                        lineHeight: 36,
                        fontVariant: ["tabular-nums"],
                    }}
                >
                    {formatarHoras(totalMinutos)}
                </Text>

                {temComparacao && (
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                            paddingBottom: 4,
                        }}
                    >
                        <Icone size={14} color={cor} />
                        <Text style={{ fontSize: 13, fontWeight: "700", color: cor }}>
                            {subiu ? "+" : ""}
                            {percentual}%
                        </Text>
                    </View>
                )}
            </View>

            <Text style={{ fontSize: 12, color: HADES.textDim, marginTop: 6 }}>
                {temComparacao
                    ? `vs. ${formatarHoras(minutosOntem)} ontem`
                    : "Sem registro de ontem para comparar"}
            </Text>
        </View>
    );
}
