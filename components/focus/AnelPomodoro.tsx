import { ReactNode } from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";

const TAMANHO = 264;
const RAIO = 120;
const PERIMETRO = 2 * Math.PI * RAIO; // ≈ 753.98

type Props = {
    /** 0–1. Fração já decorrida da fase. */
    progresso: number;
    cor: string;
    corTrilha?: string;
    children: ReactNode;
};

export default function AnelPomodoro({
    progresso,
    cor,
    corTrilha = "rgba(255,255,255,0.07)",
    children,
}: Props) {
    const limitado = Math.min(1, Math.max(0, progresso));

    return (
        <View style={{ width: TAMANHO, height: TAMANHO, alignItems: "center", justifyContent: "center" }}>
            <Svg width={TAMANHO} height={TAMANHO} viewBox={`0 0 ${TAMANHO} ${TAMANHO}`} style={{ position: "absolute" }}>
                <Circle cx={132} cy={132} r={RAIO} fill="none" stroke={corTrilha} strokeWidth={8} />
                <Circle
                    cx={132}
                    cy={132}
                    r={RAIO}
                    fill="none"
                    stroke={cor}
                    strokeWidth={8}
                    strokeLinecap="round"
                    strokeDasharray={PERIMETRO}
                    strokeDashoffset={PERIMETRO * (1 - limitado)}
                    transform={`rotate(-90 132 132)`}
                />
            </Svg>
            <View style={{ alignItems: "center" }}>{children}</View>
        </View>
    );
}
