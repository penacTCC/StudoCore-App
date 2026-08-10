import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "@/components/ui/icons";
import type { IconeComponente } from "@/components/ui/icons";
import { HADES } from "@/constants/hades";
import { subscribeToast, type ToastInternal, type ToastType } from "@/services/toast";

const VARIANTS: Record<ToastType, { icon: IconeComponente; color: string; tint: string }> = {
    success: { icon: CheckCircle2, color: HADES.green, tint: "rgba(48,209,88,0.14)" },
    error: { icon: XCircle, color: HADES.red, tint: "rgba(240,85,107,0.14)" },
    warning: { icon: AlertTriangle, color: HADES.amber, tint: HADES.amberTint },
    info: { icon: Info, color: HADES.blue, tint: "rgba(59,130,246,0.14)" },
};

const SWIPE_DISMISS_THRESHOLD = 80;

function ToastCard({ toastData, onDismiss }: { toastData: ToastInternal; onDismiss: (id: string) => void }) {
    const translateY = useSharedValue(-24);
    const translateX = useSharedValue(0);
    const opacity = useSharedValue(0);

    const dismiss = useCallback(() => {
        opacity.value = withTiming(0, { duration: 160 });
        translateY.value = withTiming(-16, { duration: 160 }, (finished) => {
            if (finished) runOnJS(onDismiss)(toastData.id);
        });
    }, [onDismiss, opacity, toastData.id, translateY]);

    useEffect(() => {
        translateY.value = withSpring(0, { damping: 16, stiffness: 190 });
        opacity.value = withTiming(1, { duration: 220 });
        const timer = setTimeout(dismiss, toastData.duration);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const pan = Gesture.Pan()
        .onChange((e) => {
            translateX.value = e.translationX;
        })
        .onEnd((e) => {
            if (Math.abs(e.translationX) > SWIPE_DISMISS_THRESHOLD) {
                translateX.value = withTiming(e.translationX > 0 ? 500 : -500, { duration: 180 }, (finished) => {
                    if (finished) runOnJS(onDismiss)(toastData.id);
                });
            } else {
                translateX.value = withSpring(0, { damping: 18 });
            }
        });

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: translateY.value }, { translateX: translateX.value }],
    }));

    const variant = VARIANTS[toastData.type];
    const Icon = variant.icon;

    return (
        <GestureDetector gesture={pan}>
            <Animated.View style={[styles.card, animatedStyle]}>
                <View style={[styles.accentBar, { backgroundColor: variant.color }]} />
                <View style={[styles.iconWrap, { backgroundColor: variant.tint }]}>
                    <Icon size={18} color={variant.color} />
                </View>
                <View style={{ flex: 1 }}>
                    {toastData.title ? <Text style={styles.title}>{toastData.title}</Text> : null}
                    <Text style={styles.message}>{toastData.message}</Text>
                </View>
                <Pressable onPress={dismiss} hitSlop={10} style={styles.closeBtn}>
                    <X size={15} color={HADES.textMuted} />
                </Pressable>
            </Animated.View>
        </GestureDetector>
    );
}

/** Monta uma vez na raiz (app/_layout.tsx); escuta `toast.*` de qualquer lugar do app. */
export function ToastHost() {
    const [toasts, setToasts] = useState<ToastInternal[]>([]);
    const insets = useSafeAreaInsets();

    useEffect(() => subscribeToast((t) => setToasts((prev) => [...prev, t])), []);

    const remove = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    if (toasts.length === 0) return null;

    return (
        <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 8 }]}>
            {toasts.map((t) => (
                <ToastCard key={t.id} toastData={t} onDismiss={remove} />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    host: {
        position: "absolute",
        left: 12,
        right: 12,
        zIndex: 9999,
        gap: 8,
    },
    card: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: HADES.surfaceRaised,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: HADES.borderStrong,
        paddingVertical: 12,
        paddingHorizontal: 14,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOpacity: 0.35,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 8,
    },
    accentBar: {
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
    },
    iconWrap: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    title: {
        fontSize: 13.5,
        fontWeight: "700",
        color: HADES.text,
        marginBottom: 2,
    },
    message: {
        fontSize: 12.5,
        color: HADES.textSecondary,
        lineHeight: 17,
    },
    closeBtn: {
        marginLeft: 10,
        padding: 4,
    },
});
