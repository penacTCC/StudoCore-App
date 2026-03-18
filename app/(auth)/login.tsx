import { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Alert,
    StatusBar,
    Dimensions,
    Image,
} from "react-native";
import { router } from "expo-router";
import { Eye, EyeOff, Github, ArrowLeft } from "lucide-react-native";
import { COLORS } from "@/constants/colors";
import { supabase } from "../supabase";
import * as WebBrowser from 'expo-web-browser';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as Linking from 'expo-linking';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const DOT_GAP = 26;
const DOT_R = 2.2;
const COLS = Math.ceil(SCREEN_WIDTH / DOT_GAP) + 1;
const ROWS = 10;

function DotPattern() {
    const dots: { key: string; x: number; y: number }[] = [];
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            dots.push({ key: `${r}-${c}`, x: c * DOT_GAP, y: r * DOT_GAP });
        }
    }
    return (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
            {dots.map((d) => (
                <View
                    key={d.key}
                    style={{
                        position: "absolute",
                        left: d.x,
                        top: d.y,
                        width: DOT_R * 2,
                        height: DOT_R * 2,
                        borderRadius: DOT_R,
                        backgroundColor: "rgba(16,24,43,0.10)",
                    }}
                />
            ))}
        </View>
    );
}

function StudoCoreLogoMark() {
    return (
        <View style={{ alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <View
                style={{
                    width: 88,
                    height: 88,
                    borderRadius: 24,
                    backgroundColor: "#fff",
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: COLORS.bgPrimary,
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.18,
                    shadowRadius: 20,
                    elevation: 12,
                    borderWidth: 1.5,
                    borderColor: "rgba(16,24,43,0.07)",
                }}
            >
                <Image source={require("../../assets/LogoStudoCore.png")} style={{ width: 62, height: 62 }} />
            </View>
        </View>
    );
}

// 1. Isso avisa ao sistema para fechar o navegador automaticamente quando terminar
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleGoogleSignIn = async () => {
        try {
            // Usa o scheme do app.json ("studocore") para criar a URL de retorno
            // Ex: studocore:// — é isso que o Supabase vai usar pra devolver pro app
            const redirectUrl = Linking.createURL('/(auth)/onboarding-profile');

            // Pede pro Supabase a URL oficial de login do Google, com as chaves de config
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                    skipBrowserRedirect: true, // Essencial para retornar ao app
                },
            });
            if (error) throw error;

            // Abre a janelinha do navegador dentro do app
            const res = await WebBrowser.openAuthSessionAsync(data?.url ?? '', redirectUrl);

            if (res.type === 'success') {
                // Supabase usa PKCE por padrão: a URL de retorno tem um "code" no query string,
                // não tokens diretos. exchangeCodeForSession troca o code pela sessão do usuário.
                const { params } = QueryParams.getQueryParams(res.url);
                if (params.code) {
                    const { error: sessionError } = await supabase.auth.exchangeCodeForSession(params.code);
                    if (sessionError) throw sessionError;
                    // O _layout.tsx vai detectar a nova sessão e redirecionar automaticamente
                } else if (params.error) {
                    Alert.alert("Erro no Google", params.error_description ?? params.error);
                }
            }
        } catch (error) {
            console.error("Erro no fluxo do Google:", error);
            Alert.alert("Erro", "Não foi possível concluir o login com o Google.");
        }
    }

    const handleLogin = async () => {
        setIsLoading(true);
        if (!email || !password) {
            Alert.alert("Campos obrigatórios", "Por favor, preencha o email e a senha.");
            return;
        }
        const { error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            Alert.alert('Erro no Login', error.message);
        } else {
            console.log('SUCESSO! O banco respondeu:');
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

                {/* Back button */}
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={{
                        position: "absolute",
                        left: 20,
                        top: 52,
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

                <StudoCoreLogoMark />

                <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={{ fontSize: 30, fontWeight: "800", color: COLORS.bgPrimary, letterSpacing: -0.5 }}>
                        Studo
                    </Text>
                    <Text style={{ fontSize: 30, fontWeight: "800", color: COLORS.primary, letterSpacing: -0.5 }}>
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
                {/* Drag handle */}
                <View
                    style={{
                        width: 44,
                        height: 4,
                        backgroundColor: "rgba(255,255,255,0.15)",
                        borderRadius: 2,
                        alignSelf: "center",
                        marginBottom: 26,
                    }}
                />

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
                        {showPassword
                            ? <EyeOff size={20} color="#64748b" />
                            : <Eye size={20} color="#64748b" />
                        }
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
                <TouchableOpacity
                    onPress={handleLogin}
                    disabled={isLoading}
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
                        opacity: isLoading ? 0.8 : 1,
                        marginBottom: 22,
                    }}
                >
                    {isLoading ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                        <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 15, letterSpacing: 2.5 }}>
                            ENTRAR
                        </Text>
                    )}
                </TouchableOpacity>

                {/* Divider */}
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 18, gap: 10 }}>
                    <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.1)" }} />
                    <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontWeight: "600", letterSpacing: 0.5 }}>
                        OU <Text style={{ color: COLORS.violetLight }}>CONTINUAR COM</Text>
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
