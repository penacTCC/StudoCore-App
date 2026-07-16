import { View, Text, TouchableOpacity } from "react-native";
import { Clock, Flame, ChevronRight } from "lucide-react-native";
import { HADES } from "@/constants/hades";

type Props = {
    totalHoras: number;
    totalQuestoes: number;
    melhorOfensiva: number;
    materiaFavorita: string;
    corMateria: string;
    onEditarMateria: () => void;
};

export default function CardEstatisticas({
    totalHoras,
    totalQuestoes,
    melhorOfensiva,
    materiaFavorita,
    corMateria,
    onEditarMateria,
}: Props) {
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
            {/* Destaque: total de horas */}
            <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
                <View>
                    <Text
                        style={{
                            fontSize: 12,
                            color: HADES.textMuted,
                            fontWeight: "600",
                            letterSpacing: 0.3,
                        }}
                    >
                        Total de horas estudadas
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 6 }}>
                        <Text
                            style={{
                                fontSize: 38,
                                fontWeight: "700",
                                color: HADES.text,
                                letterSpacing: -1.2,
                                lineHeight: 40,
                            }}
                        >
                            {totalHoras}
                        </Text>
                        <Text style={{ fontSize: 17, fontWeight: "600", color: HADES.textMuted }}>h</Text>
                    </View>
                </View>
                <Clock size={22} color={HADES.dot} />
            </View>

            {/* Secundários */}
            <View
                style={{
                    flexDirection: "row",
                    marginTop: 18,
                    paddingTop: 16,
                    borderTopWidth: 1,
                    borderTopColor: HADES.border,
                }}
            >
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: HADES.textFaint }}>Questões</Text>
                    <Text style={{ fontSize: 19, fontWeight: "700", color: HADES.text, marginTop: 3 }}>
                        {totalQuestoes.toLocaleString("pt-BR")}
                    </Text>
                </View>
                <View style={{ width: 1, backgroundColor: HADES.border }} />
                <View style={{ flex: 1, paddingLeft: 16 }}>
                    <Text style={{ fontSize: 12, color: HADES.textFaint }}>Melhor ofensiva</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 }}>
                        <Flame size={16} color={HADES.accentSolid} />
                        <Text style={{ fontSize: 19, fontWeight: "700", color: HADES.text }}>
                            {melhorOfensiva}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Matéria favorita */}
            <TouchableOpacity
                onPress={onEditarMateria}
                activeOpacity={0.8}
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 11,
                    marginTop: 16,
                    paddingTop: 16,
                    borderTopWidth: 1,
                    borderTopColor: HADES.border,
                }}
            >
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: corMateria }} />
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: corMateria }} numberOfLines={1}>
                        {materiaFavorita}
                    </Text>
                    <Text style={{ fontSize: 11.5, color: HADES.textFaint, marginTop: 1 }}>
                        Matéria favorita · toque para editar
                    </Text>
                </View>
                <ChevronRight size={17} color={HADES.textDim} />
            </TouchableOpacity>
        </View>
    );
}
