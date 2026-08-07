import { useEffect, useRef } from "react";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withSpring,
    withTiming,
} from "react-native-reanimated";

/**
 * Cada aba tem um par de ícones: contorno quando está apagada e preenchido
 * quando está ativa — o mesmo truque que o Spotify usa pra marcar a aba atual
 * sem depender só da cor.
 */
const ICONES = {
    grupos: { ativo: "people", inativo: "people-outline" },
    cronograma: { ativo: "calendar", inativo: "calendar-outline" },
    foco: { ativo: "timer", inativo: "timer-outline" },
    analise: { ativo: "stats-chart", inativo: "stats-chart-outline" },
    perfil: { ativo: "person", inativo: "person-outline" },
} as const;

export type NomeIconeAba = keyof typeof ICONES;

type Props = {
    nome: NomeIconeAba;
    focused: boolean;
    color: string;
    size?: number;
};

export default function IconeAba({ nome, focused, color, size = 23 }: Props) {
    const escala = useSharedValue(1);
    // Sem isto o ícone daria o pulo na primeira montagem, em toda troca de tela.
    const jaMontou = useRef(false);

    useEffect(() => {
        if (!jaMontou.current) {
            jaMontou.current = true;
            return;
        }
        if (!focused) return;
        // Estica e volta: é o feedback de "acertei a aba" que o usuário procura.
        escala.value = withSequence(
            withTiming(1.16, { duration: 110 }),
            withSpring(1, { damping: 11, stiffness: 320 })
        );
    }, [escala, focused]);

    const estilo = useAnimatedStyle(() => ({
        transform: [{ scale: escala.value }],
    }));

    return (
        <Animated.View style={estilo}>
            <Ionicons
                name={focused ? ICONES[nome].ativo : ICONES[nome].inativo}
                size={size}
                color={color}
            />
        </Animated.View>
    );
}
