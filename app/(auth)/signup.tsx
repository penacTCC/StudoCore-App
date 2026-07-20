import { useState } from "react";

//Componentes do React Native
import {
    View,
    Text,
    TouchableOpacity,
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
import { HADES } from "@/constants/hades";

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
            Alert.alert("E-mail inválido", "Por favor, insira um e-mail válido.");
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
            Alert.alert("Erro no cadastro", error.message);
        } else {
            console.log("DADOS DO CADASTRO:", data);
            router.replace("/(auth)/onboarding-profile");
        }
        setIsLoading(false);
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1, backgroundColor: HADES.bg }}
        >
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
                    Criar conta
                </Text>
                <Text style={{ fontSize: 14, color: HADES.textMuted, marginTop: 4 }}>Etapa 1 de 2 — Credenciais</Text>
            </View>

            {/* ── BOTTOM sheet ── */}
            <ScrollView
                contentContainerStyle={{ flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
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
                        paddingBottom: 40,
                        gap: 12,
                    }}
                >
                    <DragHandle marginBottom={8} />

                    {/* Email */}
                    <InputField
                        icon={<Mail size={18} color={HADES.accentSolid} />}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="E-mail"
                        keyboardType="email-address"
                        hades
                    />

                    {/* Password */}
                    <View>
                        <InputField
                            icon={<Lock size={18} color={HADES.accentSolid} />}
                            value={password}
                            onChangeText={setPassword}
                            placeholder="Senha"
                            secureTextEntry={!showPassword}
                            hades
                            rightElement={
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                    {showPassword ? (
                                        <EyeOff size={20} color={HADES.textFaint} />
                                    ) : (
                                        <Eye size={20} color={HADES.textFaint} />
                                    )}
                                </TouchableOpacity>
                            }
                        />
                        <PasswordStrength password={password} />
                    </View>

                    {/* Confirm Password */}
                    <InputField
                        icon={<Lock size={18} color={HADES.violet} />}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="Confirmar senha"
                        secureTextEntry={!showConfirm}
                        hades
                        rightElement={
                            <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                                {showConfirm ? (
                                    <EyeOff size={20} color={HADES.textFaint} />
                                ) : (
                                    <Eye size={20} color={HADES.textFaint} />
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
                                color: password === confirmPassword ? HADES.green : HADES.red,
                                marginTop: -4,
                                paddingHorizontal: 2,
                            }}
                        >
                            {password === confirmPassword ? "✓ Senhas coincidem" : "✗ Senhas não coincidem"}
                        </Text>
                    )}

                    {/* CTA */}
                    <PrimaryButton
                        label="CONTINUAR"
                        onPress={handleSignUp}
                        isLoading={isLoading}
                        hades
                        style={{ marginTop: 8, letterSpacing: 2 } as any}
                    />

                    {/* Back to login */}
                    <View style={{ flexDirection: "row", justifyContent: "center", gap: 4, marginTop: 8 }}>
                        <Text style={{ fontSize: 14, color: HADES.textFaint }}>Já tem uma conta?</Text>
                        <TouchableOpacity onPress={() => router.back()}>
                            <Text style={{ fontSize: 14, color: HADES.accentSolid, fontWeight: "700" }}>Entrar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
