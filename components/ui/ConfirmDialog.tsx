import { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { AlertTriangle } from "lucide-react-native";
import { HADES } from "@/constants/hades";
import { subscribeConfirm, type ConfirmInternal } from "@/services/confirm";

function ConfirmCard({ dialog, onClose }: { dialog: ConfirmInternal; onClose: () => void }) {
    const scale = useSharedValue(0.92);
    const opacity = useSharedValue(0);

    useEffect(() => {
        scale.value = withSpring(1, { damping: 16, stiffness: 220 });
        opacity.value = withTiming(1, { duration: 160 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const cardStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }],
    }));

    const handleCancel = () => {
        onClose();
        dialog.onCancel?.();
    };

    const handleConfirm = () => {
        onClose();
        dialog.onConfirm();
    };

    return (
        <View style={styles.backdropWrap}>
            <Pressable style={StyleSheet.absoluteFill} onPress={handleCancel} />
            <Animated.View style={[styles.card, cardStyle]}>
                {dialog.destructive ? (
                    <View style={styles.iconWrap}>
                        <AlertTriangle size={20} color={HADES.red} />
                    </View>
                ) : null}
                <Text style={styles.title}>{dialog.title}</Text>
                {dialog.message ? <Text style={styles.message}>{dialog.message}</Text> : null}
                <View style={styles.buttonsRow}>
                    <Pressable onPress={handleCancel} style={[styles.button, styles.cancelButton]}>
                        <Text style={styles.cancelText}>{dialog.cancelText}</Text>
                    </Pressable>
                    <Pressable
                        onPress={handleConfirm}
                        style={[styles.button, dialog.destructive ? styles.destructiveButton : styles.confirmButton]}
                    >
                        <Text style={dialog.destructive ? styles.destructiveText : styles.confirmText}>
                            {dialog.confirmText}
                        </Text>
                    </Pressable>
                </View>
            </Animated.View>
        </View>
    );
}

/** Monta uma vez na raiz (app/_layout.tsx); escuta `confirm(...)` de qualquer lugar do app. */
export function ConfirmDialogHost() {
    const [dialog, setDialog] = useState<ConfirmInternal | null>(null);

    useEffect(() => subscribeConfirm(setDialog), []);

    const close = useCallback(() => setDialog(null), []);

    return (
        <Modal visible={!!dialog} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
            {dialog ? <ConfirmCard dialog={dialog} onClose={close} /> : null}
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdropWrap: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
    },
    card: {
        width: "100%",
        maxWidth: 340,
        backgroundColor: HADES.surfaceRaised,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: HADES.borderStrong,
        padding: 20,
        alignItems: "center",
        gap: 14,
    },
    iconWrap: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: "rgba(240,85,107,0.14)",
        alignItems: "center",
        justifyContent: "center",
    },
    title: {
        fontSize: 16,
        fontWeight: "700",
        color: HADES.text,
        textAlign: "center",
    },
    message: {
        fontSize: 13.5,
        color: HADES.textSecondary,
        textAlign: "center",
        lineHeight: 19,
    },
    buttonsRow: {
        flexDirection: "row",
        gap: 10,
        width: "100%",
    },
    button: {
        flex: 1,
        height: 46,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    cancelButton: {
        backgroundColor: HADES.surfaceOverlay,
        borderWidth: 1,
        borderColor: HADES.border,
    },
    cancelText: {
        fontSize: 14,
        fontWeight: "600",
        color: HADES.textSecondary,
    },
    confirmButton: {
        backgroundColor: HADES.accentSolid,
    },
    confirmText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#000",
    },
    destructiveButton: {
        backgroundColor: HADES.red,
    },
    destructiveText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#fff",
    },
});
