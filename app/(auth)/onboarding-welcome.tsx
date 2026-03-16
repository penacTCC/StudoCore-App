import { useRef, useEffect } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    Dimensions,
    Animated,
    StatusBar,
    Image
} from "react-native";
import { router } from "expo-router";
import { BookOpen, Sparkles, Brain, Users } from "lucide-react-native";
import { COLORS } from "@/constants/colors";

const { width: W, height: H } = Dimensions.get("window");

// ── Animated floating card ────────────────────────────────────────────────────
function FloatingCard({
    icon,
    label,
    color,
    delay,
    top,
    left,
}: {
    icon: React.ReactNode;
    label: string;
    color: string;
    delay: number;
    top: number;
    left: number;
}) {
    const anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.delay(delay),
                Animated.timing(anim, {
                    toValue: -10,
                    duration: 1800,
                    useNativeDriver: true,
                }),
                Animated.timing(anim, {
                    toValue: 0,
                    duration: 1800,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    return (
        <Animated.View
            style={{
                position: "absolute",
                top,
                left,
                transform: [{ translateY: anim }],
                backgroundColor: "rgba(255,255,255,0.06)",
                borderRadius: 16,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.1)",
                padding: 12,
                alignItems: "center",
                gap: 6,
                width: 90,
            }}
        >
            <View
                style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: color + "22",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                {icon}
            </View>
            <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", fontWeight: "600", textAlign: "center" }}>
                {label}
            </Text>
        </Animated.View>
    );
}

// ── Main dots progress indicator ──────────────────────────────────────────────
function Dots({ active }: { active: number }) {
    return (
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            {[0, 1].map((i) => (
                <View
                    key={i}
                    style={{
                        width: i === active ? 24 : 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: i === active ? COLORS.primary : "rgba(255,255,255,0.2)",
                    }}
                />
            ))}
        </View>
    );
}

export default function OnboardingWelcome() {
    const fadeIn = useRef(new Animated.Value(0)).current;
    const slideUp = useRef(new Animated.Value(40)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeIn, {
                toValue: 1,
                duration: 700,
                useNativeDriver: true,
            }),
            Animated.timing(slideUp, {
                toValue: 0,
                duration: 700,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    return (
        <View style={{ flex: 1, backgroundColor: COLORS.bgPrimary }}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.bgPrimary} />

            {/* ── Hero illustration area ── */}
            <View
                style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                }}
            >
                {/* Glow circle */}
                <View
                    style={{
                        width: 240,
                        height: 240,
                        borderRadius: 120,
                        backgroundColor: COLORS.primary + "18",
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1.5,
                        borderColor: COLORS.primary + "30",
                    }}
                >
                    <View
                        style={{
                            width: 160,
                            height: 160,
                            borderRadius: 80,
                            backgroundColor: COLORS.primary + "25",
                            alignItems: "center",
                            justifyContent: "center",
                            borderWidth: 1.5,
                            borderColor: COLORS.primary + "40",
                        }}
                    >
                        {/* Center logo */}
                        <View
                            style={{
                                width: 88,
                                height: 88,
                                borderRadius: 24,
                                backgroundColor: "#ffffff",
                                alignItems: "center",
                                justifyContent: "center",
                                shadowColor: COLORS.primary,
                                shadowOffset: { width: 0, height: 8 },
                                shadowOpacity: 0.38,
                                shadowRadius: 20,
                                elevation: 16,
                            }}
                        >
                            <Image source={require("../../assets/LogoStudoCore.png")} style={{ width: 62, height: 62 }} />
                        </View>
                    </View>
                </View>

                {/* Floating feature cards */}
                <FloatingCard
                    icon={<Brain size={18} color={COLORS.violet} />}
                    label="IA Adaptativa"
                    color={COLORS.violet}
                    delay={0}
                    top={H * 0.07}
                    left={W * 0.04}
                />
                <FloatingCard
                    icon={<Sparkles size={18} color={COLORS.primary} />}
                    label="Quiz Inteligente"
                    color={COLORS.primary}
                    delay={400}
                    top={H * 0.06}
                    left={W * 0.66}
                />
                <FloatingCard
                    icon={<Users size={18} color={COLORS.emerald} />}
                    label="Grupos de Estudo"
                    color={COLORS.emerald}
                    delay={800}
                    top={H * 0.3}
                    left={W * 0.72}
                />
            </View>

            {/* ── Bottom content panel ── */}
            <Animated.View
                style={{
                    paddingHorizontal: 28,
                    paddingTop: 8,
                    paddingBottom: 52,
                    opacity: fadeIn,
                    transform: [{ translateY: slideUp }],
                }}
            >
                {/* Brand name */}
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 0, }}>
                    <Text style={{ fontSize: 36, fontWeight: "800", color: "#ffffff", letterSpacing: -1 }}>
                        Bem-vindo ao{" "}
                    </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
                    <Text style={{ fontSize: 36, fontWeight: "800", color: "#ffffff", letterSpacing: -1 }}>
                        Studo
                    </Text>
                    <Text style={{ fontSize: 36, fontWeight: "800", color: COLORS.primary, letterSpacing: -1 }}>
                        Core
                    </Text>
                    <Text style={{ fontSize: 30 }}> 🎉</Text>
                </View>

                <Text
                    style={{
                        fontSize: 16,
                        color: "rgba(255,255,255,0.55)",
                        lineHeight: 24,
                        marginBottom: 30,
                        fontWeight: "400",
                    }}
                >
                    Sua plataforma de estudos com IA que se adapta ao{" "}
                    <Text style={{ color: COLORS.primaryLight, fontWeight: "600" }}>seu ritmo</Text>.
                    {"\n"}Crie sua conta grátis e comece agora.
                </Text>

                {/* Dots + CTA */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Dots active={0} />

                    <TouchableOpacity
                        onPress={() => router.push("/signup")}
                        style={{
                            backgroundColor: COLORS.primary,
                            borderRadius: 16,
                            paddingVertical: 16,
                            paddingHorizontal: 32,
                            shadowColor: COLORS.primary,
                            shadowOffset: { width: 0, height: 6 },
                            shadowOpacity: 0.45,
                            shadowRadius: 14,
                            elevation: 10,
                        }}
                    >
                        <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 15, letterSpacing: 1 }}>
                            Vamos lá →
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Already have an account */}
                <View style={{ flexDirection: "row", justifyContent: "center", gap: 4, marginTop: 48, marginBottom: 0 }}>
                    <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.38)" }}>
                        Já tem uma conta?
                    </Text>
                    <TouchableOpacity onPress={() => router.push("/login")}>
                        <Text style={{ fontSize: 14, color: COLORS.primary, fontWeight: "700" }}>
                            Entrar
                        </Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </View>
    );
}
