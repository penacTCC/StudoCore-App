import { useEffect, useRef } from "react";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import { BarChart3, CalendarDays, Home, Timer, User } from "@/components/ui/icons";

/**
 * Cada aba tem um par de ícones: contorno quando está apagada e preenchido
 * quando está ativa — o mesmo truque que o Spotify usa pra marcar a aba atual
 * sem depender só da cor. As duas variantes vêm do mesmo desenho Solar que o
 * resto do app usa (components/ui/icons).
 */
const ICONES = {
    grupos: Home,
    cronograma: CalendarDays,
    foco: Timer,
    analise: BarChart3,
    perfil: User,
} as const;

export type NomeIconeAba = keyof typeof ICONES;

/** Lado da caixa do ícone. A tab bar precisa dele pra distribuir as abas. */
export const TAMANHO_ICONE_ABA = 27;

type Props = {
    nome: NomeIconeAba;
    focused: boolean;
    color: string;
    size?: number;
};

export default function IconeAba({
    nome,
    focused,
    color,
    size = TAMANHO_ICONE_ABA,
}: Props) {
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

    const Icone = ICONES[nome];

    return (
        <Animated.View style={estilo}>
            <Icone variante={focused ? "bold" : "outline"} size={size} color={color} />
        </Animated.View>
    );
}
