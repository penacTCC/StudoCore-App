import { View, Text, ScrollView } from "react-native";
import { HADES } from "@/constants/hades";
import { GRADE_MIN_POR_PX, diasDaSemanaGrade } from "@/constants/cronograma-mock";
import type { BlocoSemana } from "@/types/cronograma";

const ALTURA_GRADE = 560;
const LARGURA_EIXO = 26;
const HORAS_EIXO = [
    { rotulo: "8h", topo: 0 },
    { rotulo: "11h", topo: 140 },
    { rotulo: "14h", topo: 280 },
    { rotulo: "17h", topo: 420 },
];

/** Converte um valor em minutos (a partir das 8h) para pixels da grade. */
function minParaPx(min: number) {
    return min / GRADE_MIN_POR_PX;
}

type Props = {
    blocos: BlocoSemana[];
    resumo: { planejado: string; realizado: string };
    diaAtual: number;
};

export default function AbaSemana({ blocos, resumo, diaAtual }: Props) {
    return (
        <View style={{ flex: 1 }}>
            {/* Resumo */}
            <View
                style={{
                    paddingTop: 2,
                    paddingBottom: 10,
                    paddingHorizontal: 20,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                }}
            >
                <Text style={{ fontSize: 13, color: HADES.textMuted }}>
                    Planejado <Text style={{ color: HADES.text, fontWeight: "600" }}>{resumo.planejado}</Text>
                </Text>
                <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: HADES.dot }} />
                <Text style={{ fontSize: 13, color: HADES.textMuted }}>
                    Realizado <Text style={{ color: HADES.green, fontWeight: "600" }}>{resumo.realizado}</Text>
                </Text>
            </View>

            {/* Cabeçalho dos dias */}
            <View style={{ paddingHorizontal: 12, flexDirection: "row" }}>
                <View style={{ width: LARGURA_EIXO }} />
                {diasDaSemanaGrade.map((dia, i) => {
                    const hoje = i === diaAtual;
                    return (
                        <View key={i} style={{ flex: 1, alignItems: "center" }}>
                            <Text
                                style={{
                                    fontSize: 11,
                                    fontWeight: hoje ? "700" : "600",
                                    color: hoje ? HADES.accentSolid : HADES.textFaint,
                                }}
                            >
                                {dia.letra}
                            </Text>
                            <Text
                                style={{
                                    fontSize: 12,
                                    marginTop: 2,
                                    color: hoje ? "#000" : HADES.textMuted,
                                    fontWeight: hoje ? "700" : "400",
                                    backgroundColor: hoje ? HADES.accentSolid : "transparent",
                                    borderRadius: 6,
                                    width: 22,
                                    textAlign: "center",
                                    overflow: "hidden",
                                }}
                            >
                                {dia.numero}
                            </Text>
                        </View>
                    );
                })}
            </View>

            {/* Grade de horários */}
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingTop: 10, paddingBottom: 20, paddingHorizontal: 12 }}
                showsVerticalScrollIndicator={false}
            >
                <View style={{ flexDirection: "row", height: ALTURA_GRADE, position: "relative" }}>
                    {/* Eixo de horas */}
                    <View style={{ width: LARGURA_EIXO }}>
                        {HORAS_EIXO.map((h) => (
                            <Text
                                key={h.rotulo}
                                style={{
                                    position: "absolute",
                                    top: h.topo,
                                    right: 4,
                                    fontSize: 10,
                                    color: HADES.textDim,
                                }}
                            >
                                {h.rotulo}
                            </Text>
                        ))}
                    </View>

                    {/* Linhas de hora */}
                    <View
                        style={{
                            position: "absolute",
                            left: LARGURA_EIXO,
                            right: 0,
                            top: 0,
                            height: "100%",
                        }}
                        pointerEvents="none"
                    >
                        {HORAS_EIXO.map((h) => (
                            <View
                                key={h.rotulo}
                                style={{
                                    position: "absolute",
                                    top: h.topo,
                                    left: 0,
                                    right: 0,
                                    height: 1,
                                    backgroundColor: "rgba(255,255,255,0.05)",
                                }}
                            />
                        ))}
                    </View>

                    {/* Colunas dos dias */}
                    {diasDaSemanaGrade.map((_, dia) => (
                        <View
                            key={dia}
                            style={{
                                flex: 1,
                                position: "relative",
                                paddingHorizontal: 2,
                                backgroundColor: dia === diaAtual ? "rgba(255,122,47,0.05)" : "transparent",
                            }}
                        >
                            {blocos
                                .filter((b) => b.dia === dia)
                                .map((bloco) => (
                                    <View
                                        key={bloco.id}
                                        style={{
                                            position: "absolute",
                                            top: minParaPx(bloco.inicioMin),
                                            left: 2,
                                            right: 2,
                                            height: minParaPx(bloco.duracaoMin),
                                            backgroundColor: `${bloco.cor}33`,
                                            borderLeftWidth: 2.5,
                                            borderLeftColor: bloco.cor,
                                            borderRadius: 6,
                                            paddingVertical: 5,
                                            paddingHorizontal: 4,
                                            overflow: "hidden",
                                        }}
                                    >
                                        <Text
                                            style={{
                                                fontSize: 9,
                                                color: HADES.text,
                                                fontWeight: "600",
                                                lineHeight: 11,
                                            }}
                                            numberOfLines={2}
                                        >
                                            {bloco.rotulo}
                                        </Text>
                                    </View>
                                ))}
                        </View>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}
