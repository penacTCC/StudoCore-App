import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StatusBar,
    ActivityIndicator,
} from "react-native";

//Componentes do Expo Router
import { router } from "expo-router";

//Componentes do Lucide React Native
import { ArrowLeft, Mail, RefreshCw, CheckCircle } from "@/components/ui/icons";

//Constantes
import { HADES } from "@/constants/hades";

//Componentes do Projeto
import { LogoMark } from "@/components/auth";
import { useEffect, useState } from "react";

//Serviços
import { confirmarCodigoCadastro, obtemEmailUsuario, reenviarEmailConfirmacao } from "@/services/auth";
import { toast } from "@/services/toast";

//Utilitários
import { traduzirErroAuth } from "@/utils/errosAuth";

export default function VerifyEmailScreen() {
    const [code, setCode] = useState("");
    const [email, setEmail] = useState("");
    const [isChecking, setIsChecking] = useState(false);
    const [isResending, setIsResending] = useState(false);

    // O Supabase recusa reenvios seguidos com um 429. Sem este contador o botão aceitava
    // o toque, ia até o servidor e voltava com erro — o usuário só descobria depois.
    const [esperaReenvio, setEsperaReenvio] = useState(0);

    useEffect(() => {
        obtemEmailUsuario().then(({ email }) => setEmail(email));
    }, []);

    useEffect(() => {
        if (esperaReenvio <= 0) return;
        const relogio = setTimeout(() => setEsperaReenvio((s) => s - 1), 1000);
        return () => clearTimeout(relogio);
    }, [esperaReenvio]);

    const handleConfirmed = async () => {
        if (code.trim().length !== 6) {
            toast.warning("Digite o código de 6 dígitos enviado para seu e-mail.", "Código incompleto");
            return;
        }
        if (!email) {
            toast.error("Não foi possível obter o e-mail. Volte e tente novamente.");
            return;
        }

        setIsChecking(true);

        //Verifica o código de 6 dígitos enviado por email
        const { error } = await confirmarCodigoCadastro(email, code.trim());

        if (error) {
            toast.error("O código digitado está incorreto ou expirou. Tente reenviar.", "Código inválido");
            setIsChecking(false);
            return;
        }

        // Se o código está correto, o _layout.tsx routing guard vai
        // detectar a sessão e redirecionar para onboarding-profile automaticamente.
        setIsChecking(false);
    };

    const handleResend = async () => {
        if (esperaReenvio > 0) return;
        setIsResending(true);

        //Obtém o email do usuário
        const { email: currentEmail } = await obtemEmailUsuario();

        if (!currentEmail) {
            toast.error("Não foi possível obter o e-mail. Volte e tente novamente.");
            setIsResending(false);
            return;
        }

        //Reenvia o email com o código de confirmação
        const { error } = await reenviarEmailConfirmacao(currentEmail);

        if (error) {
            toast.error(traduzirErroAuth(error.message), "Erro ao reenviar");
        } else {
            setCode("");
            setEsperaReenvio(60);
            toast.success("Um novo código foi enviado para " + currentEmail + ".", "Código reenviado!");
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
                <LogoMark size={72} borderRadius={20} marginBottom={14} />

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
                            Enviamos um código{"\n"}de confirmação
                        </Text>
                        <Text style={{ fontSize: 14, color: HADES.textSecondary, textAlign: "center", lineHeight: 21 }}>
                            Digite abaixo o código de 6 dígitos que enviamos para {email || "seu e-mail"}.
                        </Text>
                    </View>

                    {/* Code input */}
                    <TextInput
                        value={code}
                        onChangeText={(v) => setCode(v.replace(/[^0-9]/g, "").slice(0, 6))}
                        keyboardType="number-pad"
                        maxLength={6}
                        placeholder="000000"
                        placeholderTextColor={HADES.textFaint}
                        style={{
                            alignSelf: "stretch",
                            backgroundColor: HADES.surfaceRaised,
                            borderWidth: 1.5,
                            borderColor: HADES.border,
                            borderRadius: 14,
                            paddingVertical: 16,
                            textAlign: "center",
                            fontSize: 26,
                            fontWeight: "800",
                            letterSpacing: 10,
                            color: HADES.text,
                        }}
                    />

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
                                CONFIRMAR CÓDIGO
                            </Text>
                        )}
                    </TouchableOpacity>

                    {/* Resend link */}
                    <TouchableOpacity
                        onPress={handleResend}
                        disabled={isResending || esperaReenvio > 0}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            paddingVertical: 12,
                            opacity: isResending || esperaReenvio > 0 ? 0.6 : 1,
                        }}
                    >
                        {isResending ? (
                            <ActivityIndicator size="small" color={HADES.textMuted} />
                        ) : (
                            <RefreshCw size={15} color={HADES.textMuted} />
                        )}
                        <Text style={{ fontSize: 14, color: HADES.textMuted, fontWeight: "600" }}>
                            {isResending
                                ? "Reenviando..."
                                : esperaReenvio > 0
                                    ? `Reenviar código em ${esperaReenvio}s`
                                    : "Reenviar código"}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}
