import { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Alert,
    StatusBar,
    Image,
} from "react-native";
import { router } from "expo-router";
import { Eye, EyeOff, ArrowLeft, BookOpen, Mail, Lock } from "lucide-react-native";
import { COLORS } from "@/constants/colors";
import { supabase } from "../supabase";

// ── Styled input ──────────────────────────────────────────────────────────────
function InputField({
    icon,
    value,
    onChangeText,
    placeholder,
    secureTextEntry,
    keyboardType = "default",
    autoCapitalize = "none",
    rightElement,
}: {
    icon: React.ReactNode;
    value: string;
    onChangeText: (v: string) => void;
    placeholder: string;
    secureTextEntry?: boolean;
    keyboardType?: any;
    autoCapitalize?: any;
    rightElement?: React.ReactNode;
}) {
    const [focused, setFocused] = useState(false);
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: focused ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)",
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: focused ? COLORS.primary + "80" : "rgba(255,255,255,0.07)",
                paddingHorizontal: 16,
                paddingVertical: 14,
                gap: 12,
            }}
        >
            <View style={{ opacity: focused ? 1 : 0.45 }}>{icon}</View>
            <TextInput
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={COLORS.textFaint}
                secureTextEntry={secureTextEntry}
                keyboardType={keyboardType}
                autoCapitalize={autoCapitalize}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                style={{
                    flex: 1,
                    fontSize: 15,
                    color: COLORS.textPrimary,
                    fontWeight: "500",
                }}
            />
            {rightElement}
        </View>
    );
}

// ── Password strength indicator ───────────────────────────────────────────────
function PasswordStrength({ password }: { password: string }) {
    const len = password.length;
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    const score = (len >= 8 ? 1 : 0) + (hasUpper ? 1 : 0) + (hasNumber ? 1 : 0) + (hasSpecial ? 1 : 0);

    if (!password) return null;

    const labels = ["Fraca", "Razoável", "Boa", "Forte"];
    const barColors = [COLORS.rose, COLORS.amber, COLORS.primary, COLORS.emerald];
    const label = labels[score - 1] ?? "Fraca";
    const color = barColors[score - 1] ?? COLORS.rose;

    return (
        <View style={{ marginTop: 8, gap: 6 }}>
            <View style={{ flexDirection: "row", gap: 4 }}>
                {[0, 1, 2, 3].map((i) => (
                    <View
                        key={i}
                        style={{
                            flex: 1,
                            height: 3,
                            borderRadius: 2,
                            backgroundColor: i < score ? color : "rgba(255,255,255,0.1)",
                        }}
                    />
                ))}
            </View>
            <Text style={{ fontSize: 11.5, color, fontWeight: "600" }}>Senha {label}</Text>
        </View>
    );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function SignUpScreen() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSignUp = async () => {
        if (!email || !password || !confirmPassword) {
            Alert.alert("Campos obrigatórios", "Preencha todos os campos.");
            return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            Alert.alert("Email inválido", "Por favor insira um email válido.");
            return;
        }
        if (password.length < 8) {
            Alert.alert("Senha muito curta", "A senha deve ter pelo menos 8 caracteres.");
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert("Senhas diferentes", "As senhas não coincidem.");
            return;
        }

        setIsLoading(true);

        // A função de criação de conta
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
        });

        if (error) {
            Alert.alert('Erro no Cadastro', error.message);
        } else {
            console.log("DADOS DO CADASTRO:", data);
            //Manda para a tela de verificação de email
            router.replace('/(auth)/verify-email');
        }

        setIsLoading(false);
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1, backgroundColor: "#ffffff" }}
        >
            <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

            {/* ── TOP white header (matches login screen style) ── */}
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
                    Criar conta
                </Text>
                <Text style={{ fontSize: 14, color: COLORS.textMuted, marginTop: 4 }}>
                    Etapa 1 de 2 — Credenciais
                </Text>
            </View>

            {/* ── BOTTOM dark sheet ── */}
            <ScrollView
                contentContainerStyle={{ flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <View
                    style={{
                        flex: 1,
                        backgroundColor: COLORS.bgPrimary,
                        borderTopLeftRadius: 36,
                        borderTopRightRadius: 36,
                        paddingHorizontal: 26,
                        paddingTop: 32,
                        paddingBottom: 40,
                        gap: 12,
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
                            marginBottom: 8,
                        }}
                    />

                    {/* Email */}
                    <InputField
                        icon={<Mail size={18} color={COLORS.primary} />}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="Email"
                        keyboardType="email-address"
                    />

                    {/* Password */}
                    <View>
                        <InputField
                            icon={<Lock size={18} color={COLORS.primary} />}
                            value={password}
                            onChangeText={setPassword}
                            placeholder="Senha"
                            secureTextEntry={!showPassword}
                            rightElement={
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                    {showPassword
                                        ? <EyeOff size={20} color={COLORS.textMuted} />
                                        : <Eye size={20} color={COLORS.textMuted} />
                                    }
                                </TouchableOpacity>
                            }
                        />
                        <PasswordStrength password={password} />
                    </View>

                    {/* Confirm Password */}
                    <InputField
                        icon={<Lock size={18} color={COLORS.violet} />}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="Confirmar senha"
                        secureTextEntry={!showConfirm}
                        rightElement={
                            <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                                {showConfirm
                                    ? <EyeOff size={20} color={COLORS.textMuted} />
                                    : <Eye size={20} color={COLORS.textMuted} />
                                }
                            </TouchableOpacity>
                        }
                    />

                    {/* Confirm match hint */}
                    {confirmPassword.length > 0 && (
                        <Text
                            style={{
                                fontSize: 11.5,
                                fontWeight: "600",
                                color: password === confirmPassword ? COLORS.emerald : COLORS.rose,
                                marginTop: -4,
                                paddingHorizontal: 2,
                            }}
                        >
                            {password === confirmPassword ? "✓ Senhas coincidem" : "✗ Senhas não coincidem"}
                        </Text>
                    )}

                    {/* CTA */}
                    <TouchableOpacity
                        onPress={handleSignUp}
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
                            marginTop: 8,
                        }}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                            <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 15, letterSpacing: 2 }}>
                                CONTINUAR
                            </Text>
                        )}
                    </TouchableOpacity>

                    {/* Back to login */}
                    <View style={{ flexDirection: "row", justifyContent: "center", gap: 4, marginTop: 8 }}>
                        <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.38)" }}>
                            Já tem uma conta?
                        </Text>
                        <TouchableOpacity onPress={() => router.back()}>
                            <Text style={{ fontSize: 14, color: COLORS.primary, fontWeight: "700" }}>
                                Entrar
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
