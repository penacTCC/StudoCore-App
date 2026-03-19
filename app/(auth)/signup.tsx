import { useState } from "react";

//Componentes do React Native
import {
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Alert,
    StatusBar,
    Image,
} from "react-native";

//Componentes do Expo Router
import { router } from "expo-router";

//Componentes do Lucide React Native
import { Eye, EyeOff, Mail, Lock } from "lucide-react-native";

//Constantes
import { COLORS } from "@/constants/colors";

//Componentes do Projeto
import { BackButton, DragHandle } from "@/components/auth";
import { InputField, PasswordStrength, PrimaryButton } from "@/components/form";

//Serviços
import { cadastrarUsuario } from "@/services/auth";

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

        //Cadastra o usuário
        const { data, error } = await cadastrarUsuario(email, password);
        if (error) {
            Alert.alert("Erro no Cadastro", error.message);
        } else {
            console.log("DADOS DO CADASTRO:", data);
            router.replace("/(auth)/verify-email");
        }
        setIsLoading(false);
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1, backgroundColor: "#ffffff" }}
        >
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
                <BackButton top={56} />

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
                    <Image
                        source={require("../../assets/LogoStudoCore.png")}
                        style={{ width: 47, height: 47 }}
                    />
                </View>
                <Text
                    style={{
                        fontSize: 22,
                        fontWeight: "800",
                        color: COLORS.bgPrimary,
                        letterSpacing: -0.5,
                    }}
                >
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
                    <DragHandle marginBottom={8} />

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
                                    {showPassword ? (
                                        <EyeOff size={20} color={COLORS.textMuted} />
                                    ) : (
                                        <Eye size={20} color={COLORS.textMuted} />
                                    )}
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
                                {showConfirm ? (
                                    <EyeOff size={20} color={COLORS.textMuted} />
                                ) : (
                                    <Eye size={20} color={COLORS.textMuted} />
                                )}
                            </TouchableOpacity>
                        }
                    />

                    {/* Confirm match hint */}
                    {confirmPassword.length > 0 && (
                        <Text
                            style={{
                                fontSize: 11.5,
                                fontWeight: "600",
                                color:
                                    password === confirmPassword ? COLORS.emerald : COLORS.rose,
                                marginTop: -4,
                                paddingHorizontal: 2,
                            }}
                        >
                            {password === confirmPassword
                                ? "✓ Senhas coincidem"
                                : "✗ Senhas não coincidem"}
                        </Text>
                    )}

                    {/* CTA */}
                    <PrimaryButton
                        label="CONTINUAR"
                        onPress={handleSignUp}
                        isLoading={isLoading}
                        style={{ marginTop: 8, letterSpacing: 2 } as any}
                    />

                    {/* Back to login */}
                    <View
                        style={{
                            flexDirection: "row",
                            justifyContent: "center",
                            gap: 4,
                            marginTop: 8,
                        }}
                    >
                        <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.38)" }}>
                            Já tem uma conta?
                        </Text>
                        <TouchableOpacity onPress={() => router.back()}>
                            <Text
                                style={{ fontSize: 14, color: COLORS.primary, fontWeight: "700" }}
                            >
                                Entrar
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
