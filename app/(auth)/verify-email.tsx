import {
    View,
    Text,
    TouchableOpacity,
    StatusBar,
    Image,
    ActivityIndicator,
    Alert,
} from "react-native";

//Componentes do Expo Router
import { router } from "expo-router";

//Componentes do Lucide React Native
import { ArrowLeft, Mail, RefreshCw, CheckCircle } from "lucide-react-native";

//Constantes
import { HADES } from "@/constants/hades";

//Componentes do Projeto
import { useState } from "react";

//Serviços
import { obtemEmailUsuario, reenviarEmailConfirmacao, verificaEmailConfirmado } from "@/services/auth";

export default function VerifyEmailScreen() {
    const [isChecking, setIsChecking] = useState(false);
    const [isResending, setIsResending] = useState(false);

    const handleConfirmed = async () => {
        setIsChecking(true);

        //Chama a função de email verificado
        const { data, error, emailVerificado } = await verificaEmailConfirmado();

        //Se der erro, dá um alerta
        if (error || !data.session || !emailVerificado) {
            Alert.alert(
                "E-mail não confirmado",
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

        //Obtém o email do usuário
        const { email } = await obtemEmailUsuario();

        if (!email) {
            Alert.alert("Erro", "Não foi possível obter o e-mail. Volte e tente novamente.");
            setIsResending(false);
            return;
        }

        //Reenvia o email de confirmação
        const { error } = await reenviarEmailConfirmacao(email);

        if (error) {
            Alert.alert("Erro ao reenviar", error.message);
        } else {
            Alert.alert("E-mail reenviado!", "Um novo link de confirmação foi enviado para " + email + ".");
        }
        setIsResending(false);
    };

    return (
        <View style={{ flex: 1, backgroundColor: HADES.bg }}>
            <StatusBar barStyle="light-content" backgroundColor="#000000" />

            {/* ── TOP header ── */}
            <View
                style={{
                    paddingTop: 56,
                    paddingHorizontal: 24,
                    paddingBottom: 28,
                    backgroundColor: HADES.bg,
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
                        backgroundColor: "rgba(255,255,255,0.06)",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <ArrowLeft size={20} color={HADES.textSecondary} />
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
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.3,
                        shadowRadius: 16,
                        elevation: 10,
                        marginBottom: 14,
                    }}
                >
                    <Image source={require("../../assets/LogoStudoCore.png")} style={{ width: 47, height: 47 }} />
                </View>

                <Text style={{ fontSize: 22, fontWeight: "800", color: HADES.text, letterSpacing: -0.5 }}>
                    Verifique seu e-mail
                </Text>
                <Text style={{ fontSize: 14, color: HADES.textMuted, marginTop: 4 }}>Etapa 2 de 2 — Confirmação</Text>
            </View>

            {/* ── BOTTOM sheet ── */}
            <View
                style={{
                    flex: 1,
                    backgroundColor: HADES.surface,
                    borderTopWidth: 1,
                    borderColor: HADES.border,
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
                            backgroundColor: HADES.accentTint,
                            alignItems: "center",
                            justifyContent: "center",
                            borderWidth: 1.5,
                            borderColor: HADES.accentTintBorder,
                        }}
                    >
                        <Mail size={40} color={HADES.accentSolid} />
                    </View>

                    {/* Main copy */}
                    <View style={{ alignItems: "center", gap: 10, paddingHorizontal: 8 }}>
                        <Text
                            style={{
                                fontSize: 20,
                                fontWeight: "800",
                                color: HADES.text,
                                letterSpacing: -0.3,
                                textAlign: "center",
                            }}
                        >
                            Enviamos um link de{"\n"}confirmação
                        </Text>
                        <Text style={{ fontSize: 14, color: HADES.textSecondary, textAlign: "center", lineHeight: 21 }}>
                            Acesse sua caixa de entrada e clique no link que enviamos para ativar sua conta.
                        </Text>
                    </View>

                    {/* Hint row */}
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            backgroundColor: HADES.surfaceOverlay,
                            borderRadius: 12,
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            borderWidth: 1,
                            borderColor: HADES.border,
                            alignSelf: "stretch",
                        }}
                    >
                        <CheckCircle size={16} color={HADES.green} />
                        <Text style={{ fontSize: 13, color: HADES.textSecondary, flex: 1 }}>
                            Verifique também sua pasta de spam caso não encontre o e-mail.
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
                            backgroundColor: HADES.accentSolid,
                            borderRadius: 14,
                            paddingVertical: 16,
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: isChecking ? 0.8 : 1,
                        }}
                    >
                        {isChecking ? (
                            <ActivityIndicator size="small" color="#000000" />
                        ) : (
                            <Text style={{ color: "#000000", fontWeight: "800", fontSize: 15, letterSpacing: 2 }}>
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
                            <ActivityIndicator size="small" color={HADES.textMuted} />
                        ) : (
                            <RefreshCw size={15} color={HADES.textMuted} />
                        )}
                        <Text style={{ fontSize: 14, color: HADES.textMuted, fontWeight: "600" }}>
                            {isResending ? "Reenviando..." : "Reenviar e-mail"}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}
