import React, { ReactNode, useEffect, useRef, useState } from "react";
import {
    Animated,
    Dimensions,
    Modal,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
    BarChart3,
    ListChecks,
    LockKeyhole,
    Sparkles,
} from "@/components/ui/icons";
import { subscribePaywallPro, type PaywallProOptions } from "@/services/paywall";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_MIN_HEIGHT = Math.min(680, Math.round(SCREEN_HEIGHT * 0.74));

type ProBottomSheetProps = {
    visible: boolean;
    onClose: () => void;
    onPressPro: () => void;
};

export function ProBottomSheet({ visible, onClose, onPressPro }: ProBottomSheetProps) {
    const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const backdropOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(translateY, {
                    toValue: 0,
                    useNativeDriver: true,
                    damping: 22,
                    stiffness: 180,
                    mass: 0.9,
                }),
                Animated.timing(backdropOpacity, {
                    toValue: 1,
                    duration: 220,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [backdropOpacity, translateY, visible]);

    const closeSheet = () => {
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: SCREEN_HEIGHT,
                duration: 260,
                useNativeDriver: true,
            }),
            Animated.timing(backdropOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onClose();
        });
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={closeSheet}
        >
            <StatusBar barStyle="light-content" />

            <View style={styles.container}>
                <Animated.View
                    style={[
                        StyleSheet.absoluteFillObject,
                        styles.backdrop,
                        { opacity: backdropOpacity },
                    ]}
                >
                    <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
                </Animated.View>

                <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
                    <LinearGradient
                        colors={["#122039", "#0B1729", "#07111F"]}
                        locations={[0, 0.46, 1]}
                        style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.blueGlow} />
                    <View style={styles.orangeGlow} />
                    <View style={styles.handle} />

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        bounces={false}
                        contentContainerStyle={styles.content}
                    >
                        <View style={styles.lockGlow}>
                            <LinearGradient
                                colors={["rgba(255,153,23,0.18)", "rgba(255,153,23,0.03)"]}
                                style={styles.lockContainer}
                            >
                                <LockKeyhole size={30} color="#FF9819" strokeWidth={2.2} />
                            </LinearGradient>
                        </View>

                        <LinearGradient
                            colors={["#FFAA27", "#FF8B0A"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.proBadge}
                        >
                            <Text style={styles.proBadgeText}>PRO</Text>
                        </LinearGradient>

                        <Text style={styles.title}>
                            Este recurso é{"\n"}
                            exclusivo do <Text style={styles.orangeText}>Pro</Text>
                        </Text>

                        <Text style={styles.description}>
                            Desbloqueie ferramentas avançadas para estudar com mais estratégia e ir além.
                        </Text>

                        <View style={styles.benefits}>
                            <Benefit
                                icon={<Sparkles size={25} color="#FF9A18" />}
                                title="Roadmap de estudos por IA"
                                description="Plano personalizado com base nos seus objetivos."
                            />
                            <Benefit
                                icon={<ListChecks size={25} color="#FF9A18" />}
                                title="Quiz e validação ilimitados"
                                description="Pratique à vontade e consolide o que aprendeu."
                            />
                            <Benefit
                                icon={<BarChart3 size={26} color="#FF9A18" />}
                                title="Wrapped mensal completo"
                                description="Acompanhe seu progresso de forma completa."
                            />
                        </View>

                        <Pressable
                            onPress={onPressPro}
                            style={({ pressed }) => [
                                styles.buttonWrapper,
                                pressed && styles.buttonPressed,
                            ]}
                        >
                            <LinearGradient
                                colors={["#FFA51E", "#FF9216", "#FFA328"]}
                                start={{ x: 0, y: 0.5 }}
                                end={{ x: 1, y: 0.5 }}
                                style={styles.button}
                            >
                                <Text style={styles.buttonText}>Conhecer o Pro</Text>
                            </LinearGradient>
                        </Pressable>

                        <Pressable onPress={closeSheet} hitSlop={10}>
                            <Text style={styles.cancelText}>Agora não</Text>
                        </Pressable>
                    </ScrollView>
                </Animated.View>
            </View>
        </Modal>
    );
}

function Benefit({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
    return (
        <View style={styles.benefitCard}>
            <View style={styles.benefitIcon}>{icon}</View>
            <View style={styles.benefitTextContainer}>
                <Text style={styles.benefitTitle}>{title}</Text>
                <Text style={styles.benefitDescription}>{description}</Text>
            </View>
        </View>
    );
}

export function ProBottomSheetHost() {
    const [paywall, setPaywall] = useState<PaywallProOptions | null>(null);

    useEffect(() => subscribePaywallPro((options) => setPaywall(options)), []);

    if (!paywall) return null;

    const fechar = () => setPaywall(null);

    return (
        <ProBottomSheet
            visible
            onClose={fechar}
            onPressPro={() => {
                fechar();
                router.push("/(modals)/plano");
            }}
        />
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "flex-end",
    },
    backdrop: {
        backgroundColor: "rgba(0, 4, 12, 0.73)",
    },
    sheet: {
        width: "100%",
        minHeight: SHEET_MIN_HEIGHT,
        maxHeight: "78%",
        backgroundColor: "#0B1729",
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: "rgba(88, 111, 151, 0.52)",
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.4,
        shadowRadius: 25,
        elevation: 30,
    },
    blueGlow: {
        position: "absolute",
        width: 260,
        height: 260,
        borderRadius: 130,
        left: -92,
        top: 22,
        backgroundColor: "rgba(34, 102, 255, 0.16)",
    },
    orangeGlow: {
        position: "absolute",
        width: 220,
        height: 220,
        borderRadius: 110,
        right: -96,
        bottom: 120,
        backgroundColor: "rgba(255, 152, 24, 0.12)",
    },
    handle: {
        width: 44,
        height: 5,
        backgroundColor: "#43516A",
        borderRadius: 10,
        alignSelf: "center",
        marginTop: 15,
        marginBottom: 30,
    },
    content: {
        paddingHorizontal: 26,
        paddingBottom: 34,
        alignItems: "center",
    },
    lockGlow: {
        shadowColor: "#FF9818",
        shadowOpacity: 0.42,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 0 },
    },
    lockContainer: {
        width: 68,
        height: 68,
        borderRadius: 34,
        borderWidth: 1,
        borderColor: "rgba(255, 153, 23, 0.52)",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(8, 18, 33, 0.88)",
    },
    proBadge: {
        marginTop: 13,
        paddingHorizontal: 18,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
    },
    proBadgeText: {
        color: "#FFFFFF",
        fontSize: 13,
        fontWeight: "800",
        letterSpacing: 0.3,
    },
    title: {
        color: "#FFFFFF",
        marginTop: 15,
        fontSize: 31,
        lineHeight: 40,
        fontWeight: "800",
        textAlign: "center",
    },
    orangeText: {
        color: "#FF9818",
    },
    description: {
        marginTop: 16,
        color: "#C4CAD6",
        fontSize: 14.5,
        lineHeight: 23,
        fontWeight: "500",
        textAlign: "center",
        maxWidth: 330,
    },
    benefits: {
        width: "100%",
        gap: 8,
        marginTop: 25,
    },
    benefitCard: {
        width: "100%",
        minHeight: 72,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "rgba(110, 132, 170, 0.22)",
        backgroundColor: "rgba(255, 255, 255, 0.055)",
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    benefitIcon: {
        width: 47,
        height: 47,
        borderRadius: 12,
        backgroundColor: "rgba(255, 255, 255, 0.055)",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 14,
    },
    benefitTextContainer: {
        flex: 1,
    },
    benefitTitle: {
        color: "#FFFFFF",
        fontSize: 15.5,
        lineHeight: 20,
        fontWeight: "700",
    },
    benefitDescription: {
        color: "#BAC2D0",
        fontSize: 12.7,
        lineHeight: 18,
        marginTop: 1,
    },
    buttonWrapper: {
        width: "100%",
        marginTop: 26,
        borderRadius: 16,
        shadowColor: "#FF9418",
        shadowOpacity: 0.22,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
    },
    buttonPressed: {
        opacity: 0.85,
        transform: [{ scale: 0.99 }],
    },
    button: {
        width: "100%",
        height: 58,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
    },
    buttonText: {
        color: "#FFFFFF",
        fontSize: 17.5,
        fontWeight: "800",
    },
    cancelText: {
        marginTop: 25,
        color: "#9BA5B6",
        fontSize: 16,
        fontWeight: "700",
    },
});
