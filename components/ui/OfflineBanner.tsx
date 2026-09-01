import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { CloudOff } from "@/components/ui/icons";
import { HADES } from "@/constants/hades";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

/**
 * Aviso fixo no topo do app quando o aparelho está sem internet — o padrão que Instagram,
 * WhatsApp e Gmail usam: uma faixa que aparece sozinha ao cair a conexão e some sozinha ao
 * voltar, sem precisar que cada tela trate o caso.
 *
 * Fica montado uma vez no `app/_layout.tsx`, acima do `Stack`, então cobre qualquer tela
 * sem que cada uma precise saber que ele existe.
 */
export function OfflineBanner() {
    const { online } = useNetworkStatus();
    const insets = useSafeAreaInsets();

    // Começa "fora da tela" pra não piscar a faixa no instante do app abrindo, antes da
    // primeira checagem do NetInfo terminar (ver `lib/network.ts`).
    const progresso = useSharedValue(0);
    const montouAoMenosUmaVez = useRef(false);

    useEffect(() => {
        if (!online) montouAoMenosUmaVez.current = true;
        progresso.value = withTiming(online ? 0 : 1, { duration: 240 });
    }, [online, progresso]);

    const estilo = useAnimatedStyle(() => ({
        opacity: progresso.value,
        transform: [{ translateY: (1 - progresso.value) * -40 }],
    }));

    // Nunca ficou offline nesta sessão: não monta nada, nem escondido, pra não pagar o
    // custo do insets/layout à toa na tela mais comum (app com internet o tempo todo).
    if (online && !montouAoMenosUmaVez.current) return null;

    return (
        <Animated.View
            pointerEvents="none"
            style={[styles.container, { paddingTop: insets.top + 8 }, estilo]}
        >
            <View style={styles.pill}>
                <CloudOff size={14} color={HADES.red} />
                <Text style={styles.texto}>Sem conexão com a internet</Text>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        alignItems: "center",
        paddingBottom: 8,
    },
    pill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: HADES.surface,
        borderWidth: 1,
        borderColor: "rgba(240,85,107,0.35)",
        borderRadius: 999,
        paddingVertical: 6,
        paddingHorizontal: 14,
    },
    texto: {
        fontSize: 12.5,
        fontWeight: "600",
        color: HADES.red,
    },
});
