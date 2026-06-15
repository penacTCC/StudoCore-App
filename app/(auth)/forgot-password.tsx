import { useEffect, useRef, useState } from "react";

//Componentes do React Native
import {
    View,
    Text,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Alert,
    StatusBar,
    Dimensions,
} from "react-native";

//Componentes do Expo
import { router, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import * as QueryParams from "expo-auth-session/build/QueryParams";

import { Mail, CheckCircle, LockKeyhole } from "lucide-react-native";
import { COLORS } from "@/constants/colors";

//Componentes da Aplicação
import { DotPattern, LogoMark, BackButton, DragHandle } from "@/components/auth";
import { PrimaryButton } from "@/components/form";

//Serviços da Aplicação
import {
    deslogarUsuario,
    recuperarSenha,
    redefinirSenha,
    validarSessaoPorCodigo,
    validarSessaoPorTokens,
} from "@/services/auth";


const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function ForgotPasswordScreen() {
    const params = useLocalSearchParams<{ code?: string; access_token?: string; refresh_token?: string }>();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isValidatingLink, setIsValidatingLink] = useState(false);
    const [sent, setSent] = useState(false);
    const [canResetPassword, setCanResetPassword] = useState(false);
    const linkHandled = useRef(false);

    useEffect(() => {
        const handleRecoveryUrl = async (url?: string | null) => {
            if (linkHandled.current) return;

            const queryParams = url ? QueryParams.getQueryParams(url).params : params;
            const code = typeof queryParams.code === "string" ? queryParams.code : undefined;
            const accessToken = typeof queryParams.access_token === "string" ? queryParams.access_token : undefined;
            const refreshToken = typeof queryParams.refresh_token === "string" ? queryParams.refresh_token : undefined;

            if (!code && (!accessToken || !refreshToken)) return;

            linkHandled.current = true;
            setIsValidatingLink(true);

            const { error } = code
                ? await validarSessaoPorCodigo(code)
                : await validarSessaoPorTokens(accessToken!, refreshToken!);

            setIsValidatingLink(false);

            if (error) {
                Alert.alert("Link invalido", error.message);
                router.replace("/(auth)/login");
                return;
            }

            setCanResetPassword(true);
            setSent(false);
        };

        Linking.getInitialURL().then(handleRecoveryUrl);

        if (params.code || (params.access_token && params.refresh_token)) {
            handleRecoveryUrl();
        }
    }, [params]);

    const handleSendReset = async () => {
        if (!email.trim()) {
            Alert.alert("Campo obrigatório", "Por favor, informe seu e-mail.");
            return;
        }

        setIsLoading(true);
        const { error } = await recuperarSenha(email.trim());
        setIsLoading(false);

        if (error) {
            Alert.alert("Erro", error.message);
        } else {
            setSent(true);
        }
    };

    const handleUpdatePassword = async () => {
        if (password.length < 6) {
            Alert.alert("Senha muito curta", "Informe uma senha com pelo menos 6 caracteres.");
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert("Senhas diferentes", "A confirmacao precisa ser igual a nova senha.");
            return;
        }

        setIsLoading(true);
        const { error } = await redefinirSenha(password);
        setIsLoading(false);

        if (error) {
            Alert.alert("Erro", error.message);
            return;
        }

        Alert.alert("Senha alterada", "Agora voce ja pode entrar com a nova senha.");
        await deslogarUsuario();
        router.replace("/(auth)/login");
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1, backgroundColor: "#ffffff" }}
        >
            <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

            {/* ── TOP: white + dot pattern + logo ── */}
            <View
                style={{
                    height: SCREEN_HEIGHT * 0.36,
                    backgroundColor: "#ffffff",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                }}
            >
                <DotPattern />
                <BackButton top={52} />
                <LogoMark size={88} borderRadius={24} />

                <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text
                        style={{
                            fontSize: 30,
                            fontWeight: "800",
                            color: COLORS.bgPrimary,
                            letterSpacing: -0.5,
                        }}
                    >
                        Studo
                    </Text>
                    <Text
                        style={{
                            fontSize: 30,
                            fontWeight: "800",
                            color: COLORS.primary,
                            letterSpacing: -0.5,
                        }}
                    >
                        Core
                    </Text>
                </View>
            </View>

            {/* ── BOTTOM SHEET ── */}
            <View
                style={{
                    flex: 1,
                    backgroundColor: COLORS.bgPrimary,
                    borderTopLeftRadius: 36,
                    borderTopRightRadius: 36,
                    paddingHorizontal: 26,
                    paddingTop: 20,
                    paddingBottom: 28,
                    justifyContent: "flex-start",
                }}
            >
                <DragHandle marginBottom={26} />

                {isValidatingLink ? (
                    <View style={{ alignItems: "center", paddingTop: 24 }}>
                        <Text
                            style={{
                                fontSize: 22,
                                fontWeight: "800",
                                color: "#ffffff",
                                textAlign: "center",
                                marginBottom: 10,
                                letterSpacing: -0.3,
                            }}
                        >
                            Validando link...
                        </Text>
                        <Text
                            style={{
                                fontSize: 14,
                                color: "rgba(255,255,255,0.55)",
                                textAlign: "center",
                                lineHeight: 22,
                                marginBottom: 28,
                            }}
                        >
                            Aguarde enquanto preparamos a redefinicao da sua senha.
                        </Text>
                    </View>
                ) : canResetPassword ? (
                    <>
                        <Text
                            style={{
                                fontSize: 22,
                                fontWeight: "800",
                                color: "#ffffff",
                                marginBottom: 8,
                                letterSpacing: -0.3,
                            }}
                        >
                            Nova senha
                        </Text>
                        <Text
                            style={{
                                fontSize: 14,
                                color: "rgba(255,255,255,0.50)",
                                marginBottom: 28,
                                lineHeight: 22,
                            }}
                        >
                            Digite e confirme sua nova senha para voltar a acessar sua conta.
                        </Text>

                        <View style={{ marginBottom: 12, position: "relative" }}>
                            <TextInput
                                value={password}
                                onChangeText={setPassword}
                                placeholder="Nova senha"
                                placeholderTextColor="#94a3b8"
                                secureTextEntry
                                style={{
                                    backgroundColor: "#ffffff",
                                    borderRadius: 14,
                                    paddingHorizontal: 18,
                                    paddingRight: 52,
                                    paddingVertical: 15,
                                    fontSize: 15,
                                    color: "#0f172a",
                                    fontWeight: "500",
                                }}
                            />
                            <View
                                style={{
                                    position: "absolute",
                                    right: 16,
                                    top: 0,
                                    bottom: 0,
                                    justifyContent: "center",
                                }}
                                pointerEvents="none"
                            >
                                <LockKeyhole size={20} color="#94a3b8" />
                            </View>
                        </View>

                        <View style={{ marginBottom: 20, position: "relative" }}>
                            <TextInput
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                placeholder="Confirmar senha"
                                placeholderTextColor="#94a3b8"
                                secureTextEntry
                                style={{
                                    backgroundColor: "#ffffff",
                                    borderRadius: 14,
                                    paddingHorizontal: 18,
                                    paddingRight: 52,
                                    paddingVertical: 15,
                                    fontSize: 15,
                                    color: "#0f172a",
                                    fontWeight: "500",
                                }}
                            />
                            <View
                                style={{
                                    position: "absolute",
                                    right: 16,
                                    top: 0,
                                    bottom: 0,
                                    justifyContent: "center",
                                }}
                                pointerEvents="none"
                            >
                                <LockKeyhole size={20} color="#94a3b8" />
                            </View>
                        </View>

                        <PrimaryButton
                            label="SALVAR SENHA"
                            onPress={handleUpdatePassword}
                            isLoading={isLoading}
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
                                backgroundColor: "rgba(16,185,129,0.15)",
                                alignItems: "center",
                                justifyContent: "center",
                                marginBottom: 20,
                            }}
                        >
                            <CheckCircle size={36} color={COLORS.emeraldLight} />
                        </View>

                        <Text
                            style={{
                                fontSize: 22,
                                fontWeight: "800",
                                color: "#ffffff",
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
                                color: "rgba(255,255,255,0.55)",
                                textAlign: "center",
                                lineHeight: 22,
                                marginBottom: 36,
                            }}
                        >
                            Verifique sua caixa de entrada em{"\n"}
                            <Text style={{ color: COLORS.primaryLight, fontWeight: "700" }}>
                                {email}
                            </Text>
                            {"\n"}e siga as instruções para redefinir sua senha.
                        </Text>

                        <PrimaryButton
                            label="VOLTAR AO LOGIN"
                            onPress={() => router.back()}
                            style={{ width: "100%" }}
                        />
                    </View>
                ) : (
                    /* ── Form state ── */
                    <>
                        <Text
                            style={{
                                fontSize: 22,
                                fontWeight: "800",
                                color: "#ffffff",
                                marginBottom: 8,
                                letterSpacing: -0.3,
                            }}
                        >
                            Esqueceu a senha?
                        </Text>
                        <Text
                            style={{
                                fontSize: 14,
                                color: "rgba(255,255,255,0.50)",
                                marginBottom: 28,
                                lineHeight: 22,
                            }}
                        >
                            Informe seu e-mail e enviaremos um link para redefinir sua senha.
                        </Text>

                        {/* Email input */}
                        <View style={{ marginBottom: 20, position: "relative" }}>
                            <TextInput
                                value={email}
                                onChangeText={setEmail}
                                placeholder="E-mail"
                                placeholderTextColor="#94a3b8"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoComplete="email"
                                style={{
                                    backgroundColor: "#ffffff",
                                    borderRadius: 14,
                                    paddingHorizontal: 18,
                                    paddingRight: 52,
                                    paddingVertical: 15,
                                    fontSize: 15,
                                    color: "#0f172a",
                                    fontWeight: "500",
                                }}
                            />
                            <View
                                style={{
                                    position: "absolute",
                                    right: 16,
                                    top: 0,
                                    bottom: 0,
                                    justifyContent: "center",
                                }}
                                pointerEvents="none"
                            >
                                <Mail size={20} color="#94a3b8" />
                            </View>
                        </View>

                        <PrimaryButton
                            label="ENVIAR LINK"
                            onPress={handleSendReset}
                            isLoading={isLoading}
                            style={{ marginBottom: 22 }}
                        />

                        {/* Back to login */}
                        <View style={{ flexDirection: "row", justifyContent: "center", gap: 4 }}>
                            <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.38)" }}>
                                Lembrou a senha?
                            </Text>
                            <Text
                                onPress={() => router.back()}
                                style={{ fontSize: 14, color: COLORS.primary, fontWeight: "700" }}
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
