import { useState } from "react";
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
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import * as Linking from "expo-linking";

import { Eye, EyeOff, Github } from "lucide-react-native";
import { COLORS } from "@/constants/colors";

//Componentes da Aplicação
import { DotPattern, LogoMark, BackButton, DragHandle } from "@/components/auth";
import { PrimaryButton } from "@/components/form";

//Serviços da Aplicação
import { gerarUrlLoginGoogle, loginComSenha, validarSessaoGoogle } from "@/services/auth";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// Avisa ao sistema para fechar o navegador automaticamente quando terminar
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleGoogleSignIn = async () => {
        try {
            const redirectUrl = Linking.createURL("/(auth)/onboarding-profile");
            const { data, error } = await gerarUrlLoginGoogle(redirectUrl);
            if (error) throw error;

            const res = await WebBrowser.openAuthSessionAsync(data?.url ?? "", redirectUrl);

            if (res.type === "success") {
                const { params } = QueryParams.getQueryParams(res.url);
                if (params.code) {
                    const { error: sessionError } = await validarSessaoGoogle(params.code);
                    if (sessionError) throw sessionError;
                } else if (params.error) {
                    Alert.alert("Erro no Google", params.error_description ?? params.error);
                }
            }
        } catch (error) {
            console.error("Erro no fluxo do Google:", error);
            Alert.alert("Erro", "Não foi possível concluir o login com o Google.");
        }
    };

    const handleLogin = async () => {
        setIsLoading(true);
        if (!email || !password) {
            Alert.alert("Campos obrigatórios", "Por favor, preencha o email e a senha.");
            setIsLoading(false);
            return;
        }
        const { error } = await loginComSenha(email, password);
        if (error) {
            Alert.alert("Erro no Login", error.message);
        }
        setIsLoading(false);
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
                    justifyContent: "space-between",
                }}
            >
                <DragHandle marginBottom={26} />

                {/* Email */}
                <View style={{ marginBottom: 12 }}>
                    <TextInput
                        value={email}
                        onChangeText={setEmail}
                        placeholder="Email"
                        placeholderTextColor="#94a3b8"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        style={{
                            backgroundColor: "#ffffff",
                            borderRadius: 14,
                            paddingHorizontal: 18,
                            paddingVertical: 15,
                            fontSize: 15,
                            color: "#0f172a",
                            fontWeight: "500",
                        }}
                    />
                </View>

                {/* Password */}
                <View style={{ marginBottom: 8, position: "relative" }}>
                    <TextInput
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Senha"
                        placeholderTextColor="#94a3b8"
                        secureTextEntry={!showPassword}
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
                    <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        style={{ position: "absolute", right: 16, top: 0, bottom: 0, justifyContent: "center" }}
                    >
                        {showPassword ? (
                            <EyeOff size={20} color="#64748b" />
                        ) : (
                            <Eye size={20} color="#64748b" />
                        )}
                    </TouchableOpacity>
                </View>

                {/* Forgot password */}
                <TouchableOpacity
                    onPress={() => router.push("/(auth)/forgot-password")}
                    style={{ alignSelf: "flex-end", marginBottom: 22 }}
                >
                    <Text style={{ fontSize: 13, color: COLORS.violetLight, fontWeight: "500" }}>
                        Esqueceu a senha?
                    </Text>
                </TouchableOpacity>

                {/* ENTRAR */}
                <PrimaryButton
                    label="ENTRAR"
                    onPress={handleLogin}
                    isLoading={isLoading}
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
                        <Text style={{ color: COLORS.violetLight }}>CONTINUAR COM</Text>
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
                        <Text style={{ fontSize: 14, color: COLORS.primary, fontWeight: "700" }}>
                            Cadastre-se
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}
