import { View, Text, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Check, MinusCircle, Coffee, Play, XCircle } from "lucide-react-native";
import { HADES } from "@/constants/hades";
import type { BlocoDoDia } from "@/types/cronograma";

const SELO = {
    cumprido: { cor: HADES.green, fundo: "rgba(48,209,88,0.12)", rotulo: "Cumprido", Icone: Check },
    parcial: { cor: HADES.amber, fundo: "rgba(242,176,61,0.12)", rotulo: "Parcial", Icone: MinusCircle },
    furado: { cor: HADES.red, fundo: "rgba(240,85,107,0.12)", rotulo: "Furado", Icone: XCircle },
} as const;

function formatarDuracao(min: number) {
    if (min < 60) return `${min}m`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, "0")}`;
}

type Props = {
    bloco: BlocoDoDia;
    ultimo?: boolean;
    onIniciarFoco?: (bloco: BlocoDoDia) => void;
    onPress?: (bloco: BlocoDoDia) => void;
};

export default function BlocoHoje({ bloco, ultimo, onIniciarFoco, onPress }: Props) {
    const passado = bloco.status === "cumprido" || bloco.status === "parcial" || bloco.status === "furado";
    const agora = bloco.status === "agora";
    const descanso = bloco.tipo === "descanso";

    const corMarcador = agora
        ? HADES.accent
        : bloco.status === "cumprido"
            ? HADES.green
            : bloco.status === "parcial"
                ? HADES.amber
                : bloco.status === "furado"
                    ? HADES.red
                    : descanso
                        ? HADES.dot
                        : "#5f636c";

    return (
        <View
            style={{
                position: "relative",
                marginBottom: ultimo ? 0 : 16,
                opacity: passado ? 0.62 : 1,
            }}
        >
            {/* Horário */}
            <Text
                style={{
                    position: "absolute",
                    left: -56,
                    top: agora ? 2 : 0,
                    width: 40,
                    textAlign: "right",
                    fontSize: 12,
                    fontWeight: agora ? "700" : "600",
                    color: agora ? HADES.accent : HADES.textMuted,
                }}
            >
                {bloco.horaInicio}
            </Text>

            {/* Marcador na linha do tempo */}
            {agora ? (
                <View
                    style={{
                        position: "absolute",
                        left: -19,
                        top: 1,
                        width: 23,
                        height: 23,
                        borderRadius: 12,
                        backgroundColor: HADES.accentGlow,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <View
                        style={{
                            width: 15,
                            height: 15,
                            borderRadius: 8,
                            backgroundColor: HADES.accent,
                            borderWidth: 3,
                            borderColor: HADES.bg,
                        }}
                    />
                </View>
            ) : (
                <View
                    style={{
                        position: "absolute",
                        left: descanso || bloco.status === "futuro" ? -12 : -13,
                        top: 4,
                        width: descanso || bloco.status === "futuro" ? 9 : 11,
                        height: descanso || bloco.status === "futuro" ? 9 : 11,
                        borderRadius: 6,
                        backgroundColor: corMarcador,
                        borderWidth: 2.5,
                        borderColor: HADES.bg,
                    }}
                />
            )}

            {/* Card */}
            {descanso ? (
                <View
                    style={{
                        borderWidth: 1,
                        borderStyle: "dashed",
                        borderColor: "rgba(255,255,255,0.10)",
                        borderRadius: 14,
                        paddingVertical: 11,
                        paddingHorizontal: 15,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                    }}
                >
                    <Coffee size={16} color={HADES.textMuted} />
                    <Text style={{ fontSize: 14, color: HADES.textSecondary, fontWeight: "500" }}>
                        Descanso
                    </Text>
                    <Text style={{ fontSize: 12, color: HADES.textFaint, marginLeft: "auto" }}>
                        {formatarDuracao(bloco.duracaoMin)}
                    </Text>
                </View>
            ) : agora ? (
                <LinearGradient
                    colors={["rgba(255,122,47,0.10)", "rgba(255,122,47,0.03)"]}
                    style={{
                        borderWidth: 1.5,
                        borderColor: "rgba(255,122,47,0.55)",
                        borderRadius: 16,
                        padding: 16,
                    }}
                >
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <Text
                            style={{
                                fontSize: 11,
                                fontWeight: "700",
                                color: HADES.accentSolid,
                                letterSpacing: 0.6,
                                backgroundColor: "rgba(255,122,47,0.14)",
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                borderRadius: 6,
                                overflow: "hidden",
                            }}
                        >
                            AGORA
                        </Text>
                        {bloco.restanteMin !== undefined && (
                            <Text style={{ fontSize: 12, color: HADES.accentText, fontWeight: "600" }}>
                                faltam {bloco.restanteMin} min
                            </Text>
                        )}
                    </View>

                    <Text style={{ fontSize: 19, fontWeight: "700", color: HADES.text, marginTop: 12 }}>
                        {bloco.materia}
                    </Text>
                    <Text style={{ fontSize: 13, color: HADES.textSecondary, marginTop: 2 }}>
                        {bloco.topico} · {formatarDuracao(bloco.duracaoMin)}
                    </Text>

                    <View
                        style={{
                            height: 7,
                            borderRadius: 4,
                            backgroundColor: "rgba(255,255,255,0.10)",
                            marginTop: 14,
                            overflow: "hidden",
                        }}
                    >
                        <View
                            style={{
                                height: "100%",
                                width: `${bloco.progresso ?? 0}%`,
                                borderRadius: 4,
                                backgroundColor: HADES.accentSolid,
                            }}
                        />
                    </View>

                    <TouchableOpacity
                        onPress={() => onIniciarFoco?.(bloco)}
                        activeOpacity={0.85}
                        style={{
                            height: 50,
                            borderRadius: 13,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            marginTop: 14,
                            backgroundColor: HADES.accentSolid,
                        }}
                    >
                        <Play size={18} color="#000" fill="#000" />
                        <Text style={{ fontSize: 15, fontWeight: "700", color: "#000" }}>Iniciar foco</Text>
                    </TouchableOpacity>
                </LinearGradient>
            ) : (
                <TouchableOpacity
                    onPress={() => onPress?.(bloco)}
                    activeOpacity={0.8}
                    style={{
                        backgroundColor: HADES.surface,
                        borderWidth: 1,
                        borderColor: HADES.border,
                        borderRadius: 14,
                        paddingVertical: 13,
                        paddingHorizontal: 15,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}
                >
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: "600", color: HADES.text }}>
                            {bloco.materia}
                        </Text>
                        <Text style={{ fontSize: 12, color: HADES.textFaint, marginTop: 2 }}>
                            {bloco.topico} · {formatarDuracao(bloco.duracaoMin)}
                        </Text>
                    </View>

                    {passado && SELO[bloco.status as keyof typeof SELO] && (
                        <Selo status={bloco.status as keyof typeof SELO} />
                    )}
                </TouchableOpacity>
            )}
        </View>
    );
}

function Selo({ status }: { status: keyof typeof SELO }) {
    const { cor, fundo, rotulo, Icone } = SELO[status];
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                backgroundColor: fundo,
                borderRadius: 8,
                paddingVertical: 5,
                paddingHorizontal: 9,
            }}
        >
            <Icone size={13} color={cor} />
            <Text style={{ fontSize: 11, color: cor, fontWeight: "600" }}>{rotulo}</Text>
        </View>
    );
}
