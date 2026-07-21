import { useRef, useEffect } from "react";

//Componentes do React Native
import {
    View,
    Text,
    TouchableOpacity,
    Animated,
    StatusBar,
    Image,
    ActivityIndicator,
} from "react-native";

//Safe area
import { useSafeAreaInsets } from "react-native-safe-area-context";

//SVG (glow radial)
import Svg, { Defs, RadialGradient, Stop, Circle } from "react-native-svg";

//Componentes do Expo Router
import { router } from "expo-router";

//Ícones
import { BrainCircuit, Sparkles, Users } from "lucide-react-native";

//Tokens do design system HADES
import { HADES } from "@/constants/hades";

//Hooks da Aplicação
import { useGoogleAuth } from "@/hooks/useGoogleAuth";

// ── Card de pilar flutuante ───────────────────────────────────────────────────
function FloatingPillar({
    icon,
    title,
    subtitle,
    tint,
    delay,
    duration,
    drift,
    top,
    left,
    right,
    width,
}: {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    tint: string;
    delay: number;
    duration: number;
    drift: number;
    top: number;
    left?: number | string;
    right?: number | string;
    width: string;
}) {
    const anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.delay(delay),
                Animated.timing(anim, {
                    toValue: 1,
                    duration,
                    useNativeDriver: true,
                }),
                Animated.timing(anim, {
                    toValue: 0,
                    duration,
                    useNativeDriver: true,
                }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, []);

    const translateY = anim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, drift],
    });

    return (
        <Animated.View
            style={{
                position: "absolute",
                top,
                left: left as any,
                right: right as any,
                width: width as any,
                transform: [{ translateY }],
                backgroundColor: HADES.surface,
                borderWidth: 1,
                borderColor: HADES.border,
                borderRadius: 16,
                paddingVertical: 13,
                paddingHorizontal: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 11,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 14 },
                shadowOpacity: 0.4,
                shadowRadius: 30,
                elevation: 12,
            }}
        >
            <View
                style={{
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    backgroundColor: tint,
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                {icon}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: HADES.text }}>{title}</Text>
                <Text style={{ fontSize: 11.5, color: HADES.textMuted, marginTop: 1 }}>{subtitle}</Text>
            </View>
        </Animated.View>
    );
}

// ── Logo do Google (mesma marca da tela de login) ──────────────────────────────
function GoogleMark() {
    return (
        <View style={{ width: 20, height: 20, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 15, fontWeight: "800", color: "#ffffff" }}>G</Text>
        </View>
    );
}

export default function OnboardingWelcome() {
    const insets = useSafeAreaInsets();
    const { isLoading: isGoogleLoading, handleGoogleSignIn } = useGoogleAuth();
    const fadeIn = useRef(new Animated.Value(0)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeIn, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
        }).start();

        Animated.loop(
            Animated.sequence([
                Animated.timing(glowAnim, { toValue: 1, duration: 2500, useNativeDriver: true }),
                Animated.timing(glowAnim, { toValue: 0, duration: 2500, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.9] });

    return (
        <View style={{ flex: 1, backgroundColor: HADES.bg }}>
            <StatusBar barStyle="light-content" backgroundColor={HADES.bg} />

            {/* ── Glow radial no topo ── */}
            <Animated.View
                pointerEvents="none"
                style={{
                    position: "absolute",
                    top: -90,
                    left: 0,
                    right: 0,
                    alignItems: "center",
                    opacity: glowOpacity,
                }}
            >
                <Svg width={340} height={340}>
                    <Defs>
                        <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
                            <Stop offset="0%" stopColor={HADES.accentSolid} stopOpacity={0.22} />
                            <Stop offset="70%" stopColor={HADES.accentSolid} stopOpacity={0} />
                        </RadialGradient>
                    </Defs>
                    <Circle cx={170} cy={170} r={170} fill="url(#glow)" />
                </Svg>
            </Animated.View>

            <Animated.View
                style={{
                    flex: 1,
                    paddingTop: insets.top + 16,
                    paddingHorizontal: 26,
                    paddingBottom: insets.bottom + 22,
                    opacity: fadeIn,
                }}
            >
                {/* ── Logo ── */}
                <View style={{ alignItems: "center", gap: 12, paddingTop: 22 }}>
                    <View
                        style={{
                            width: 64,
                            height: 64,
                            borderRadius: 18,
                            backgroundColor: "#ffffff",
                            alignItems: "center",
                            justifyContent: "center",
                            shadowColor: HADES.accentSolid,
                            shadowOffset: { width: 0, height: 10 },
                            shadowOpacity: 0.3,
                            shadowRadius: 26,
                            elevation: 12,
                        }}
                    >
                        <Image
                            source={require("../../assets/LogoStudoCore.png")}
                            style={{ width: 46, height: 46 }}
                        />
                    </View>
                    <Text style={{ fontSize: 22, fontWeight: "800", color: HADES.text, letterSpacing: -0.3 }}>
                        Studo<Text style={{ color: HADES.accentSolid }}>Core</Text>
                    </Text>
                </View>

                {/* ── Headline ── */}
                <View style={{ alignItems: "center", marginTop: 24 }}>
                    <Text
                        style={{
                            fontSize: 27,
                            fontWeight: "800",
                            color: HADES.text,
                            letterSpacing: -0.6,
                            lineHeight: 31,
                            textAlign: "center",
                        }}
                    >
                        Estude no seu ritmo
                    </Text>
                    <Text style={{ fontSize: 14, color: HADES.textMuted, marginTop: 8, textAlign: "center" }}>
                        IA, quiz e grupo de estudos em um só lugar
                    </Text>
                </View>

                {/* ── Pilares flutuantes ── */}
                <View style={{ flex: 1, marginTop: 8, minHeight: 180 }}>
                    <FloatingPillar
                        icon={<BrainCircuit size={19} color={HADES.accentSolid} />}
                        title="IA Adaptativa"
                        subtitle="Ajusta o plano a cada sessão"
                        tint="rgba(255,154,0,0.12)"
                        delay={0}
                        duration={2750}
                        drift={-10}
                        top={2}
                        left={0}
                        width="66%"
                    />
                    <FloatingPillar
                        icon={<Sparkles size={19} color={HADES.subjectBlue} />}
                        title="Quiz Inteligente"
                        subtitle="Revisão ativa dos seus erros"
                        tint="rgba(77,148,255,0.12)"
                        delay={400}
                        duration={3100}
                        drift={12}
                        top={64}
                        right={0}
                        width="70%"
                    />
                    <FloatingPillar
                        icon={<Users size={19} color={HADES.green} />}
                        title="Grupos de Estudo"
                        subtitle="Ranking e foco em equipe"
                        tint="rgba(48,209,88,0.12)"
                        delay={800}
                        duration={2900}
                        drift={12}
                        top={128}
                        left="6%"
                        width="68%"
                    />
                </View>

                {/* ── Ações ── */}
                <View style={{ gap: 12, paddingTop: 8 }}>
                    <TouchableOpacity
                        onPress={() => router.push("/signup")}
                        activeOpacity={0.9}
                        style={{
                            height: 54,
                            borderRadius: 15,
                            backgroundColor: HADES.accentSolid,
                            alignItems: "center",
                            justifyContent: "center",
                            shadowColor: HADES.accentSolid,
                            shadowOffset: { width: 0, height: 6 },
                            shadowOpacity: 0.35,
                            shadowRadius: 14,
                            elevation: 10,
                        }}
                    >
                        <Text style={{ fontSize: 16, fontWeight: "700", color: "#000000" }}>Criar conta</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleGoogleSignIn}
                        disabled={isGoogleLoading}
                        activeOpacity={0.85}
                        style={{
                            height: 52,
                            borderRadius: 15,
                            backgroundColor: HADES.surfaceRaised,
                            borderWidth: 1,
                            borderColor: HADES.borderStrong,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 10,
                            opacity: isGoogleLoading ? 0.6 : 1,
                        }}
                    >
                        {isGoogleLoading ? (
                            <ActivityIndicator size="small" color="#e8e9ec" />
                        ) : (
                            <>
                                <GoogleMark />
                                <Text style={{ fontSize: 14.5, fontWeight: "600", color: "#e8e9ec" }}>
                                    Continuar com Google
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 5, paddingTop: 2 }}>
                        <Text style={{ fontSize: 13, color: HADES.textMuted }}>Já tenho conta</Text>
                        <TouchableOpacity onPress={() => router.push("/login")}>
                            <Text style={{ fontSize: 13, color: HADES.accentSolid, fontWeight: "700" }}>Entrar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Animated.View>
        </View>
    );
}
