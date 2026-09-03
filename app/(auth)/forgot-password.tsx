import { useState } from "react";

//Componentes do React Native
import { View, Text, TextInput, KeyboardAvoidingView, Platform, StatusBar, Dimensions } from "react-native";

//Componentes do Expo
import { router, useLocalSearchParams } from "expo-router";

import { Mail, CheckCircle, LockKeyhole } from "@/components/ui/icons";
import { HADES } from "@/constants/hades";

//Componentes da Aplicação
import { DotPattern, LogoMark, BackButton, DragHandle } from "@/components/auth";
import { PasswordStrength, PrimaryButton } from "@/components/form";

//Serviços da Aplicação
import {
    deslogarUsuario,
    recuperarSenha,
    redefinirSenha,
} from "@/services/auth";
import { toast } from "@/services/toast";

//Utilitários
import { traduzirErroAuth } from "@/utils/errosAuth";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function ForgotPasswordScreen() {
    const params = useLocalSearchParams<{ recoveryReady?: string }>();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const canResetPassword = params.recoveryReady === "true";

    const voltarAoLogin = async () => {
        // O link de recuperação cria uma sessão temporária. Se a pessoa abandonar a
        // troca de senha, encerramos essa sessão antes de mostrar o login novamente.
        if (canResetPassword) {
            const { error } = await deslogarUsuario();
            if (error) {
                toast.error("Não foi possível encerrar a recuperação. Tente novamente.");
                return;
            }
        }

        router.replace("/(auth)/login");
    };

    const handleSendReset = async () => {
        if (!email.trim()) {
            toast.warning("Por favor, informe seu e-mail.", "Campo obrigatório");
            return;
        }

        setIsLoading(true);
        const { error } = await recuperarSenha(email.trim().toLowerCase());
        setIsLoading(false);

        if (error) {
            toast.error(traduzirErroAuth(error.message));
        } else {
            setSent(true);
        }
    };

    const handleUpdatePassword = async () => {
        // Mesmo mínimo do cadastro: com 6 aqui, o reset virava uma porta para enfraquecer
        // uma senha que o signup exigiu com 8.
        if (password.length < 8) {
            toast.warning("Informe uma senha com pelo menos 8 caracteres.", "Senha muito curta");
            return;
        }

        if (password !== confirmPassword) {
            toast.warning("A confirmação precisa ser igual à nova senha.", "Senhas diferentes");
            return;
        }

        setIsLoading(true);
        const { error } = await redefinirSenha(password);

        if (error) {
            setIsLoading(false);
            toast.error(traduzirErroAuth(error.message));
            return;
        }

        const { error: erroAoSair } = await deslogarUsuario();
        setIsLoading(false);
        if (erroAoSair) {
            toast.error(
                "A senha foi alterada, mas não foi possível encerrar a sessão. Tente novamente.",
                "Senha alterada",
            );
            return;
        }

        toast.success("Agora você já pode entrar com a nova senha.", "Senha alterada");
        router.replace("/(auth)/login");
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1, backgroundColor: HADES.bg }}
        >
            <StatusBar barStyle="light-content" backgroundColor="#000000" />

            {/* ── TOP: preto + dot pattern + logo ── */}
            <View
                style={{
                    height: SCREEN_HEIGHT * 0.36,
                    backgroundColor: HADES.bg,
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                }}
            >
                <DotPattern />
                <BackButton top={52} onPress={voltarAoLogin} />
                <LogoMark size={88} borderRadius={24} />

                <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={{ fontSize: 30, fontWeight: "800", color: HADES.text, letterSpacing: -0.5 }}>Studo</Text>
                    <Text style={{ fontSize: 30, fontWeight: "800", color: HADES.accentSolid, letterSpacing: -0.5 }}>
                        Core
                    </Text>
                </View>
            </View>

            {/* ── BOTTOM SHEET ── */}
            <View
                style={{
                    flex: 1,
                    backgroundColor: HADES.surface,
                    borderTopWidth: 1,
                    borderColor: HADES.border,
                    borderTopLeftRadius: 36,
                    borderTopRightRadius: 36,
                    paddingHorizontal: 26,
                    paddingTop: 20,
                    paddingBottom: 28,
                    justifyContent: "flex-start",
                }}
            >
                <DragHandle marginBottom={26} />

                {canResetPassword ? (
                    <>
                        <Text style={{ fontSize: 22, fontWeight: "800", color: HADES.text, marginBottom: 8, letterSpacing: -0.3 }}>
                            Nova senha
                        </Text>
                        <Text style={{ fontSize: 14, color: HADES.textMuted, marginBottom: 28, lineHeight: 22 }}>
                            Digite e confirme sua nova senha para voltar a acessar sua conta.
                        </Text>

                        <View style={{ marginBottom: 12, position: "relative" }}>
                            <TextInput
                                value={password}
                                onChangeText={setPassword}
                                placeholder="Nova senha"
                                placeholderTextColor={HADES.textFaint}
                                secureTextEntry
                                style={estilos.campo}
                            />
                            <View style={estilos.iconeDireita} pointerEvents="none">
                                <LockKeyhole size={20} color={HADES.textFaint} />
                            </View>
                            <PasswordStrength password={password} />
                        </View>

                        <View style={{ marginBottom: 20, position: "relative" }}>
                            <TextInput
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                placeholder="Confirmar senha"
                                placeholderTextColor={HADES.textFaint}
                                secureTextEntry
                                style={estilos.campo}
                            />
                            <View style={estilos.iconeDireita} pointerEvents="none">
                                <LockKeyhole size={20} color={HADES.textFaint} />
                            </View>
                        </View>

                        <PrimaryButton
                            label="SALVAR SENHA"
                            onPress={handleUpdatePassword}
                            isLoading={isLoading}
                            hades
                            style={{ marginBottom: 22 }}
                        />
                    </>
                ) : sent ? (
                    /* ── Success state ── */
                    <View style={{ alignItems: "center", paddingTop: 24 }}>
                        <View
                            style={{
                                width: 72,
                                height: 72,
                                borderRadius: 36,
                                backgroundColor: HADES.greenTint,
                                alignItems: "center",
                                justifyContent: "center",
                                marginBottom: 20,
                            }}
                        >
                            <CheckCircle size={36} color={HADES.green} />
                        </View>

                        <Text
                            style={{
                                fontSize: 22,
                                fontWeight: "800",
                                color: HADES.text,
                                textAlign: "center",
                                marginBottom: 10,
                                letterSpacing: -0.3,
                            }}
                        >
                            E-mail enviado!
                        </Text>
                        <Text
                            style={{
                                fontSize: 14,
                                color: HADES.textMuted,
                                textAlign: "center",
                                lineHeight: 22,
                                marginBottom: 36,
                            }}
                        >
                            Verifique sua caixa de entrada em{"\n"}
                            <Text style={{ color: HADES.accentSolid, fontWeight: "700" }}>{email}</Text>
                            {"\n"}e siga as instruções para redefinir sua senha.
                        </Text>

                        <PrimaryButton label="VOLTAR AO LOGIN" onPress={voltarAoLogin} hades style={{ width: "100%" }} />
                    </View>
                ) : (
                    /* ── Form state ── */
                    <>
                        <Text style={{ fontSize: 22, fontWeight: "800", color: HADES.text, marginBottom: 8, letterSpacing: -0.3 }}>
                            Esqueceu a senha?
                        </Text>
                        <Text style={{ fontSize: 14, color: HADES.textMuted, marginBottom: 28, lineHeight: 22 }}>
                            Informe seu e-mail e enviaremos um link para redefinir sua senha.
                        </Text>

                        {/* Email input */}
                        <View style={{ marginBottom: 20, position: "relative" }}>
                            <TextInput
                                value={email}
                                onChangeText={setEmail}
                                placeholder="E-mail"
                                placeholderTextColor={HADES.textFaint}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoComplete="email"
                                style={estilos.campo}
                            />
                            <View style={estilos.iconeDireita} pointerEvents="none">
                                <Mail size={20} color={HADES.textFaint} />
                            </View>
                        </View>

                        <PrimaryButton
                            label="ENVIAR LINK"
                            onPress={handleSendReset}
                            isLoading={isLoading}
                            hades
                            style={{ marginBottom: 22 }}
                        />

                        {/* Back to login */}
                        <View style={{ flexDirection: "row", justifyContent: "center", gap: 4 }}>
                            <Text style={{ fontSize: 14, color: HADES.textFaint }}>Lembrou a senha?</Text>
                            <Text
                                onPress={voltarAoLogin}
                                style={{ fontSize: 14, color: HADES.accentSolid, fontWeight: "700" }}
                            >
                                Voltar ao login
                            </Text>
                        </View>
                    </>
                )}
            </View>
        </KeyboardAvoidingView>
    );
}

const estilos = {
    campo: {
        backgroundColor: HADES.surfaceRaised,
        borderWidth: 1,
        borderColor: HADES.border,
        borderRadius: 14,
        paddingHorizontal: 18,
        paddingRight: 52,
        paddingVertical: 15,
        fontSize: 15,
        color: HADES.text,
        fontWeight: "500" as const,
    },
    iconeDireita: {
        position: "absolute" as const,
        right: 16,
        top: 0,
        bottom: 0,
        justifyContent: "center" as const,
    },
};
