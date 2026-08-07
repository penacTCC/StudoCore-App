import { Pressable } from "react-native";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from "react-native-reanimated";

/**
 * Botão de aba com o afundamento de toque do Spotify: encolhe enquanto o dedo
 * está em cima e volta com mola ao soltar, mesmo que a aba já fosse a atual.
 * Substitui o ripple/opacidade padrão do react-navigation.
 */
export default function BotaoAba({
    children,
    onPress,
    onLongPress,
    style,
    testID,
    accessibilityLabel,
    accessibilityState,
}: BottomTabBarButtonProps) {
    const escala = useSharedValue(1);

    const estilo = useAnimatedStyle(() => ({
        transform: [{ scale: escala.value }],
    }));

    return (
        <Pressable
            onPress={onPress}
            onLongPress={onLongPress}
            onPressIn={() => {
                escala.value = withTiming(0.84, { duration: 90 });
            }}
            onPressOut={() => {
                escala.value = withSpring(1, { damping: 13, stiffness: 400 });
            }}
            android_ripple={null}
            testID={testID}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={accessibilityState}
            style={[{ flex: 1, alignItems: "center", justifyContent: "center" }, style]}
        >
            <Animated.View style={[{ alignItems: "center", justifyContent: "center" }, estilo]}>
                {children}
            </Animated.View>
        </Pressable>
    );
}
