import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { HADES, HEATMAP_ESCALA } from "@/constants/hades";

/** Converte a intensidade calculada no profile.tsx (0 / .3 / .6 / .9) numa cor da escala. */
export function corDaIntensidade(intensidade: number) {
    if (intensidade > 0.8) return HEATMAP_ESCALA[3];
    if (intensidade > 0.4) return HEATMAP_ESCALA[2];
    if (intensidade > 0.2) return HEATMAP_ESCALA[1];
    return HEATMAP_ESCALA[0];
}

const DIAS_VISIVEIS = ["Dom", "", "Ter", "", "Qui", "", "Sáb"];

type Dia = { dateStr: string | null; intensity: number; date?: Date };

type Props = {
    colunas: Dia[][];
    monthPositions: { colIndex: number; name: string }[];
    /** 14 no card, 20 no modal expandido. */
    celula?: number;
    gap?: number;
    diaSelecionado?: Date | null;
    onSelecionarDia?: (dia: Dia) => void;
};

export function GradeHeatmap({
    colunas,
    monthPositions,
    celula = 14,
    gap = 4,
    diaSelecionado,
    onSelecionarDia,
}: Props) {
    const larguraEixo = celula >= 20 ? 30 : 24;

    return (
        <View>
            {/* Rótulos de mês */}
            <View
                style={{
                    flexDirection: "row",
                    height: celula >= 20 ? 14 : 12,
                    marginBottom: celula >= 20 ? 7 : 6,
                    paddingLeft: larguraEixo,
                }}
            >
                {monthPositions.map((m, i) => (
                    <Text
                        key={i}
                        style={{
                            position: "absolute",
                            left: larguraEixo + m.colIndex * (celula + gap),
                            fontSize: celula >= 20 ? 11 : 10,
                            color: HADES.textDim,
                        }}
                    >
                        {m.name}
                    </Text>
                ))}
            </View>

            <View style={{ flexDirection: "row" }}>
                {/* Eixo dos dias da semana */}
                <View style={{ width: larguraEixo, gap }}>
                    {DIAS_VISIVEIS.map((dia, i) => (
                        <Text
                            key={i}
                            style={{
                                height: celula,
                                lineHeight: celula,
                                fontSize: celula >= 20 ? 10 : 9,
                                color: HADES.textDim,
                            }}
                        >
                            {dia}
                        </Text>
                    ))}
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: "row", gap }}>
                        {colunas.map((semana, colIndex) => (
                            <View key={colIndex} style={{ gap }}>
                                {semana.map((dia, rowIndex) => {
                                    if (dia.intensity === -1) {
                                        return (
                                            <View
                                                key={rowIndex}
                                                style={{ width: celula, height: celula }}
                                            />
                                        );
                                    }

                                    const selecionado =
                                        diaSelecionado && dia.date
                                            ? diaSelecionado.getTime() === dia.date.getTime()
                                            : false;

                                    return (
                                        <TouchableOpacity
                                            key={rowIndex}
                                            activeOpacity={0.7}
                                            onPress={() => onSelecionarDia?.(dia)}
                                            style={{
                                                width: celula,
                                                height: celula,
                                                borderRadius: celula >= 20 ? 4 : 3,
                                                backgroundColor: corDaIntensidade(dia.intensity),
                                                borderWidth: selecionado ? 2 : 0,
                                                borderColor: "#ffffff",
                                            }}
                                        />
                                    );
                                })}
                            </View>
                        ))}
                    </View>
                </ScrollView>
            </View>
        </View>
    );
}

export function LegendaHeatmap({ celula = 11 }: { celula?: number }) {
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 5,
                marginTop: celula >= 12 ? 16 : 14,
            }}
        >
            <Text style={{ fontSize: celula >= 12 ? 11 : 10.5, color: HADES.textDim }}>Menos</Text>
            {HEATMAP_ESCALA.map((cor) => (
                <View
                    key={cor}
                    style={{ width: celula, height: celula, borderRadius: 3, backgroundColor: cor }}
                />
            ))}
            <Text style={{ fontSize: celula >= 12 ? 11 : 10.5, color: HADES.textDim }}>Mais</Text>
        </View>
    );
}
