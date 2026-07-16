import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { ArrowRightCircle, Plus, LayoutList } from "lucide-react-native";
import Svg, { Rect, Line, Circle } from "react-native-svg";
import { HADES } from "@/constants/hades";
import BlocoHoje from "@/components/cronograma/BlocoHoje";
import type { BlocoDoDia } from "@/types/cronograma";

type Props = {
    blocos: BlocoDoDia[];
    resumo: { planejado: string; concluido: string; proximo: { materia: string; hora: string } | null };
    onIniciarFoco: (bloco: BlocoDoDia) => void;
    onMontarDia: () => void;
    onAplicarPlano: () => void;
};

export default function AbaHoje({ blocos, resumo, onIniciarFoco, onMontarDia, onAplicarPlano }: Props) {
    if (blocos.length === 0) {
        return <DiaVazio onMontarDia={onMontarDia} onAplicarPlano={onAplicarPlano} />;
    }

    return (
        <View style={{ flex: 1 }}>
            {/* Próximo bloco */}
            {resumo.proximo && (
                <View
                    style={{
                        marginHorizontal: 20,
                        marginBottom: 4,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        backgroundColor: HADES.accentTint,
                        borderWidth: 1,
                        borderColor: HADES.accentTintBorder,
                        borderRadius: 12,
                        paddingVertical: 11,
                        paddingHorizontal: 14,
                    }}
                >
                    <ArrowRightCircle size={17} color={HADES.accent} />
                    <Text style={{ fontSize: 13, color: HADES.accentText, fontWeight: "500" }}>
                        Próximo:{" "}
                        <Text style={{ color: HADES.text, fontWeight: "600" }}>{resumo.proximo.materia}</Text>
                        {" "}às {resumo.proximo.hora}
                    </Text>
                </View>
            )}

            {/* Resumo do dia */}
            <View
                style={{
                    paddingTop: 12,
                    paddingBottom: 6,
                    paddingHorizontal: 20,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                }}
            >
                <Text style={{ fontSize: 13, color: HADES.textMuted }}>
                    <Text style={{ color: HADES.text, fontWeight: "600" }}>{resumo.planejado}</Text> planejadas
                </Text>
                <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: HADES.dot }} />
                <Text style={{ fontSize: 13, color: HADES.textMuted }}>
                    <Text style={{ color: HADES.green, fontWeight: "600" }}>{resumo.concluido}</Text> concluídas
                </Text>
            </View>

            {/* Linha do tempo */}
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingTop: 12, paddingBottom: 24, paddingHorizontal: 20 }}
                showsVerticalScrollIndicator={false}
            >
                <View style={{ position: "relative", paddingLeft: 56 }}>
                    <View
                        style={{
                            position: "absolute",
                            left: 47,
                            top: 6,
                            bottom: 6,
                            width: 2,
                            backgroundColor: "rgba(255,255,255,0.07)",
                        }}
                    />
                    {blocos.map((bloco, i) => (
                        <BlocoHoje
                            key={bloco.id}
                            bloco={bloco}
                            ultimo={i === blocos.length - 1}
                            onIniciarFoco={onIniciarFoco}
                        />
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}

function DiaVazio({ onMontarDia, onAplicarPlano }: { onMontarDia: () => void; onAplicarPlano: () => void }) {
    return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 }}>
            <Svg width={120} height={120} viewBox="0 0 120 120" fill="none">
                <Rect x={22} y={30} width={76} height={66} rx={10} stroke="#2a2c33" strokeWidth={3} />
                <Line x1={22} y1={48} x2={98} y2={48} stroke="#2a2c33" strokeWidth={3} />
                <Line x1={40} y1={24} x2={40} y2={36} stroke="#3a3d45" strokeWidth={3} strokeLinecap="round" />
                <Line x1={80} y1={24} x2={80} y2={36} stroke="#3a3d45" strokeWidth={3} strokeLinecap="round" />
                <Line x1={34} y1={62} x2={66} y2={62} stroke="#2a2c33" strokeWidth={3} strokeLinecap="round" />
                <Line x1={34} y1={76} x2={54} y2={76} stroke="#2a2c33" strokeWidth={3} strokeLinecap="round" />
                <Circle cx={86} cy={82} r={17} fill="#000" stroke={HADES.accentSolid} strokeWidth={3} />
                <Line x1={86} y1={75} x2={86} y2={89} stroke={HADES.accent} strokeWidth={3} strokeLinecap="round" />
                <Line x1={79} y1={82} x2={93} y2={82} stroke={HADES.accentSolid} strokeWidth={3} strokeLinecap="round" />
            </Svg>

            <Text style={{ fontSize: 19, fontWeight: "700", color: HADES.text, marginTop: 26 }}>
                Seu dia está livre
            </Text>
            <Text
                style={{
                    fontSize: 14,
                    color: HADES.textMuted,
                    marginTop: 8,
                    lineHeight: 21,
                    textAlign: "center",
                }}
            >
                Nenhum plano por aqui ainda. Aplique um plano salvo ou monte o dia do zero.
            </Text>

            <View style={{ width: "100%", marginTop: 30, gap: 11 }}>
                <TouchableOpacity
                    onPress={onMontarDia}
                    activeOpacity={0.85}
                    style={{
                        height: 52,
                        borderRadius: 14,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        backgroundColor: HADES.accentSolid,
                    }}
                >
                    <Plus size={18} color="#000" />
                    <Text style={{ fontSize: 15, fontWeight: "700", color: "#000" }}>Montar meu dia</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={onAplicarPlano}
                    activeOpacity={0.85}
                    style={{
                        height: 52,
                        borderRadius: 14,
                        backgroundColor: HADES.surfaceRaised,
                        borderWidth: 1,
                        borderColor: HADES.borderStrong,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                    }}
                >
                    <LayoutList size={17} color={HADES.textSecondary} />
                    <Text style={{ fontSize: 15, fontWeight: "600", color: HADES.textSecondary }}>
                        Aplicar um plano
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
