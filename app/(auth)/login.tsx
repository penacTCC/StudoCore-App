import { useEffect, useRef, useState } from "react";
//Componentes do React Native
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    Alert,
    StatusBar,
    Dimensions,
} from "react-native";

//Componentes do Expo
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

import { Eye, EyeOff, Github } from "lucide-react-native";
import { HADES } from "@/constants/hades";

//Componentes da Aplicação
import { DotPattern, LogoMark, BackButton, DragHandle } from "@/components/auth";
import { PrimaryButton } from "@/components/form";

//Serviços da Aplicação
import { gerarUrlLoginGoogle, loginComSenha, obterSessaoAtual, validarSessaoGoogle, validarSessaoPorTokens } from "@/services/auth";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const GOOGLE_REDIRECT_URL = "studocore://login";

type GoogleCallbackParams = {
    code: string | null;
    accessToken: string | null;
    refreshToken: string | null;
    error: string | null;
    errorDescription: string | null;
};

// Avisa ao sistema para fechar o navegador automaticamente quando terminar
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
    const params = useLocalSearchParams<{ code?: string; error?: string; error_description?: string }>();
    const codigoGoogleProcessado = useRef<string | null>(null);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const extrairParametrosUrl = (url: string): GoogleCallbackParams => {
        const queryString = url.split("?")[1]?.split("#")[0] ?? "";
        const hashString = url.split("#")[1] ?? "";
        const searchParams = new URLSearchParams(queryString || hashString);

        return {
            code: searchParams.get("code"),
            accessToken: searchParams.get("access_token"),
            refreshToken: searchParams.get("refresh_token"),
            error: searchParams.get("error"),
            errorDescription: searchParams.get("error_description"),
        };
    };

    const finalizarLoginGoogle = async (code: string) => {
        if (codigoGoogleProcessado.current === code) return;
        codigoGoogleProcessado.current = code;

        const { error: sessionError } = await validarSessaoGoogle(code);
        if (sessionError) {
            const { data: { session } } = await obterSessaoAtual();
            if (!session) throw sessionError;
        }

        router.replace("/");
    };

    const finalizarCallbackGoogle = async (
        code?: string | null,
        accessToken?: string | null,
        refreshToken?: string | null,
        error?: string | null,
        errorDescription?: string | null
    ) => {
        if (error) {
            Alert.alert("Erro no Google", errorDescription ?? error);
            return;
        }

        if (!code && (!accessToken || !refreshToken)) return;

        try {
            setIsLoading(true);
            if (code) {
                await finalizarLoginGoogle(code);
            } else if (accessToken && refreshToken) {
                const { error: sessionError } = await validarSessaoPorTokens(accessToken, refreshToken);
                if (sessionError) throw sessionError;
                router.replace("/");
            }
        } catch (error) {
            console.error("Erro no callback do Google:", error);
            Alert.alert("Erro", "Não foi possível concluir o login com o Google.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        finalizarCallbackGoogle(params.code, null, null, params.error, params.error_description);
    }, [params.code, params.error, params.error_description]);

    useEffect(() => {
        const subscription = Linking.addEventListener("url", ({ url }) => {
            if (!url.startsWith(GOOGLE_REDIRECT_URL)) return;

            const { code, accessToken, refreshToken, error, errorDescription } = extrairParametrosUrl(url);
            finalizarCallbackGoogle(code, accessToken, refreshToken, error, errorDescription);
        });

        return () => subscription.remove();
    }, []);

    const handleGoogleSignIn = async () => {
        try {
            setIsLoading(true);
            const { data, error } = await gerarUrlLoginGoogle(GOOGLE_REDIRECT_URL);
            if (error) throw error;

            const res = await WebBrowser.openAuthSessionAsync(data?.url ?? "", GOOGLE_REDIRECT_URL);

            if (res.type === "success") {
                const { code, accessToken, refreshToken, error, errorDescription } = extrairParametrosUrl(res.url);

                await finalizarCallbackGoogle(code, accessToken, refreshToken, error, errorDescription);

                if (!code && !accessToken && !error) {
                    Alert.alert("Erro no Google", "O Google voltou sem código de autenticação.");
                }
            }
        } catch (error) {
            console.error("Erro no fluxo do Google:", error);
            Alert.alert("Erro", "Não foi possível concluir o login com o Google.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogin = async () => {
        setIsLoading(true);
        if (!email || !password) {
            Alert.alert("Campos obrigatórios", "Por favor, preencha o e-mail e a senha.");
            setIsLoading(false);
            return;
        }
        const { error } = await loginComSenha(email, password);
        if (error) {
            Alert.alert("Erro ao entrar", error.message);
        }
        setIsLoading(false);
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
                <BackButton top={52} />
                <LogoMark size={88} borderRadius={24} />

                <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text
                        style={{
                            fontSize: 30,
                            fontWeight: "800",
                            color: HADES.text,
                            letterSpacing: -0.5,
                        }}
                    >
                        Studo
                    </Text>
                    <Text
                        style={{
                            fontSize: 30,
                            fontWeight: "800",
                            color: HADES.accentSolid,
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
                    backgroundColor: HADES.surface,
                    borderTopWidth: 1,
                    borderColor: HADES.border,
                    borderTopLeftRadius: 36,
                    borderTopRightRadius: 36,
                    paddingHorizontal: 26,
                    paddingTop: 20,
                    paddingBottom: 28,
                    justifyContent: "space-between",
                }}
            >
                <DragHandle marginBottom={26} />

                {/* Email */}
                <View style={{ marginBottom: 12 }}>
                    <TextInput
                        value={email}
                        onChangeText={setEmail}
                        placeholder="E-mail"
                        placeholderTextColor={HADES.textFaint}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        style={estilos.campo}
                    />
                </View>

                {/* Password */}
                <View style={{ marginBottom: 8, position: "relative" }}>
                    <TextInput
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Senha"
                        placeholderTextColor={HADES.textFaint}
                        secureTextEntry={!showPassword}
                        style={[estilos.campo, { paddingRight: 52 }]}
                    />
                    <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        style={{ position: "absolute", right: 16, top: 0, bottom: 0, justifyContent: "center" }}
                    >
                        {showPassword ? (
                            <EyeOff size={20} color={HADES.textFaint} />
                        ) : (
                            <Eye size={20} color={HADES.textFaint} />
                        )}
                    </TouchableOpacity>
                </View>

                {/* Forgot password */}
                <TouchableOpacity
                    onPress={() => router.push("/(auth)/forgot-password")}
                    style={{ alignSelf: "flex-end", marginBottom: 22 }}
                >
                    <Text style={{ fontSize: 13, color: HADES.textMuted, fontWeight: "500" }}>
                        Esqueceu a senha?
                    </Text>
                </TouchableOpacity>

                {/* ENTRAR */}
                <PrimaryButton
                    label="ENTRAR"
                    onPress={handleLogin}
                    isLoading={isLoading}
                    hades
                    style={{ marginBottom: 22 }}
                />

                {/* Divider */}
                <View
                    style={{ flexDirection: "row", alignItems: "center", marginBottom: 18, gap: 10 }}
                >
                    <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.1)" }} />
                    <Text
                        style={{
                            fontSize: 12,
                            color: "rgba(255,255,255,0.35)",
                            fontWeight: "600",
                            letterSpacing: 0.5,
                        }}
                    >
                        OU{" "}
                        <Text style={{ color: HADES.accentText }}>CONTINUAR COM</Text>
                    </Text>
                    <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.1)" }} />
                </View>

                {/* Social Logins */}
                <View style={{ flexDirection: "row", gap: 12, marginBottom: 24 }}>
                    <TouchableOpacity
                        style={{
                            flex: 1,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            backgroundColor: "#24292e",
                            borderRadius: 14,
                            paddingVertical: 13,
                        }}
                        onPress={handleGoogleSignIn}
                    >
                        <View style={{ width: 20, height: 20, alignItems: "center", justifyContent: "center" }}>
                            <Text style={{ fontSize: 15, fontWeight: "800", color: "#ffffff" }}>G</Text>
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: "700", color: "#ffffff" }}>Google</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={{
                            flex: 1,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            backgroundColor: "#24292e",
                            borderRadius: 14,
                            paddingVertical: 13,
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.08)",
                        }}
                    >
                        <Github size={18} color="#ffffff" />
                        <Text style={{ fontSize: 14, fontWeight: "700", color: "#ffffff" }}>GitHub</Text>
                    </TouchableOpacity>
                </View>

                {/* Sign Up link */}
                <View style={{ flexDirection: "row", justifyContent: "center", gap: 4 }}>
                    <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.38)" }}>
                        Não tem uma conta?
                    </Text>
                    <TouchableOpacity onPress={() => router.push("/signup")}>
                        <Text style={{ fontSize: 14, color: HADES.accentSolid, fontWeight: "700" }}>
                            Cadastre-se
                        </Text>
                    </TouchableOpacity>
                </View>
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
        paddingVertical: 15,
        fontSize: 15,
        color: HADES.text,
        fontWeight: "500" as const,
    },
};
