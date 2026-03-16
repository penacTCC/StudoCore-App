import {
    View,
    Text,
    TouchableOpacity,
    StatusBar,
    Image,
    ActivityIndicator,
    Alert,
} from "react-native";
import { router } from "expo-router";
import { ArrowLeft, Mail, RefreshCw, CheckCircle } from "lucide-react-native";
import { COLORS } from "@/constants/colors";
import { supabase } from "../supabase";
import { useState } from "react";

export default function VerifyEmailScreen() {
    const [isChecking, setIsChecking] = useState(false);
    const [isResending, setIsResending] = useState(false);

    const handleConfirmed = async () => {
        setIsChecking(true);
        const { data, error } = await supabase.auth.getSession();

        const isEmailVerified = !!data.session?.user?.email_confirmed_at;

        if (error || !data.session || !isEmailVerified) {
            Alert.alert(
                "Email não confirmado",
                "Ainda não detectamos a confirmação. Verifique sua caixa de entrada e clique no link."
            );
            setIsChecking(false);
            return;
        }

        // Se o email está confirmado, o _layout.tsx routing guard vai
        // detectar a sessão e redirecionar para onboarding-profile automaticamente.
        setIsChecking(false);
    };

    const handleResend = async () => {
        setIsResending(true);
        const { data: { session } } = await supabase.auth.getSession();
        const email = session?.user?.email ?? "";

        if (!email) {
            Alert.alert("Erro", "Não foi possível obter o email. Volte e tente novamente.");
            setIsResending(false);
            return;
        }

        const { error } = await supabase.auth.resend({ type: "signup", email });

        if (error) {
            Alert.alert("Erro ao reenviar", error.message);
        } else {
            Alert.alert("Email reenviado!", "Um novo link de confirmação foi enviado para " + email + ".");
        }
        setIsResending(false);
    };

    return (
        <View style={{ flex: 1, backgroundColor: "#ffffff" }}>
            <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

            {/* ── TOP white header ── */}
            <View
                style={{
                    paddingTop: 56,
                    paddingHorizontal: 24,
                    paddingBottom: 28,
                    backgroundColor: "#ffffff",
                    alignItems: "center",
                }}
            >
                {/* Back button */}
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={{
                        position: "absolute",
                        left: 20,
                        top: 56,
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        backgroundColor: "rgba(16,24,43,0.06)",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <ArrowLeft size={20} color={COLORS.bgPrimary} />
                </TouchableOpacity>

                {/* Logo */}
                <View
                    style={{
                        width: 72,
                        height: 72,
                        borderRadius: 20,
                        backgroundColor: "#fff",
                        alignItems: "center",
                        justifyContent: "center",
                        shadowColor: COLORS.bgPrimary,
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.14,
                        shadowRadius: 16,
                        elevation: 10,
                        borderWidth: 1.5,
                        borderColor: "rgba(16,24,43,0.07)",
                        marginBottom: 14,
                    }}
                >
                    <Image source={require("../../assets/LogoStudoCore.png")} style={{ width: 47, height: 47 }} />
                </View>

                <Text style={{ fontSize: 22, fontWeight: "800", color: COLORS.bgPrimary, letterSpacing: -0.5 }}>
                    Verifique seu email
                </Text>
                <Text style={{ fontSize: 14, color: COLORS.textMuted, marginTop: 4 }}>
                    Etapa 2 de 2 — Confirmação
                </Text>
            </View>

            {/* ── BOTTOM dark sheet ── */}
            <View
                style={{
                    flex: 1,
                    backgroundColor: COLORS.bgPrimary,
                    borderTopLeftRadius: 36,
                    borderTopRightRadius: 36,
                    paddingHorizontal: 26,
                    paddingTop: 32,
                    paddingBottom: 48,
                    justifyContent: "space-between",
                }}
            >
                {/* Drag handle */}
                <View
                    style={{
                        width: 44,
                        height: 4,
                        backgroundColor: "rgba(255,255,255,0.15)",
                        borderRadius: 2,
                        alignSelf: "center",
                        marginBottom: 28,
                    }}
                />

                {/* Email icon card */}
                <View style={{ alignItems: "center", gap: 20 }}>
                    <View
                        style={{
                            width: 88,
                            height: 88,
                            borderRadius: 28,
                            backgroundColor: COLORS.primaryFaint,
                            alignItems: "center",
                            justifyContent: "center",
                            borderWidth: 1.5,
                            borderColor: COLORS.primary + "40",
                        }}
                    >
                        <Mail size={40} color={COLORS.primary} />
                    </View>

                    {/* Main copy */}
                    <View style={{ alignItems: "center", gap: 10, paddingHorizontal: 8 }}>
                        <Text
                            style={{
                                fontSize: 20,
                                fontWeight: "800",
                                color: COLORS.textPrimary,
                                letterSpacing: -0.3,
                                textAlign: "center",
                            }}
                        >
                            Enviamos um link de{"\n"}confirmação
                        </Text>
                        <Text
                            style={{
                                fontSize: 14,
                                color: COLORS.textSecondary,
                                textAlign: "center",
                                lineHeight: 21,
                            }}
                        >
                            Acesse sua caixa de entrada e clique no link que enviamos para ativar sua conta.
                        </Text>
                    </View>

                    {/* Hint row */}
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            backgroundColor: "rgba(255,255,255,0.05)",
                            borderRadius: 12,
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.07)",
                            alignSelf: "stretch",
                        }}
                    >
                        <CheckCircle size={16} color={COLORS.emerald} />
                        <Text style={{ fontSize: 13, color: COLORS.textSecondary, flex: 1 }}>
                            Verifique também sua pasta de spam caso não encontre o email.
                        </Text>
                    </View>
                </View>

                {/* Actions */}
                <View style={{ gap: 12, marginTop: 32 }}>
                    {/* Primary CTA */}
                    <TouchableOpacity
                        onPress={handleConfirmed}
                        disabled={isChecking}
                        style={{
                            backgroundColor: COLORS.primary,
                            borderRadius: 14,
                            paddingVertical: 16,
                            alignItems: "center",
                            justifyContent: "center",
                            shadowColor: COLORS.primary,
                            shadowOffset: { width: 0, height: 6 },
                            shadowOpacity: 0.4,
                            shadowRadius: 14,
                            elevation: 10,
                            opacity: isChecking ? 0.8 : 1,
                        }}
                    >
                        {isChecking ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                            <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 15, letterSpacing: 2 }}>
                                JÁ CONFIRMEI O EMAIL
                            </Text>
                        )}
                    </TouchableOpacity>

                    {/* Resend link */}
                    <TouchableOpacity
                        onPress={handleResend}
                        disabled={isResending}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            paddingVertical: 12,
                            opacity: isResending ? 0.6 : 1,
                        }}
                    >
                        {isResending ? (
                            <ActivityIndicator size="small" color={COLORS.textMuted} />
                        ) : (
                            <RefreshCw size={15} color={COLORS.textMuted} />
                        )}
                        <Text style={{ fontSize: 14, color: COLORS.textMuted, fontWeight: "600" }}>
                            {isResending ? "Reenviando..." : "Reenviar email"}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}
