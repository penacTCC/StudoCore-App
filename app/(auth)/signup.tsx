import { useEffect, useRef, useState } from "react";

//Componentes do React Native
import {
    View,
    Text,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
} from "react-native";

//Componentes do Expo Router
import { router } from "expo-router";

//Componentes do Lucide React Native
import { Eye, EyeOff, Mail, Lock, User, AtSign } from "@/components/ui/icons";

//Constantes
import { HADES } from "@/constants/hades";

//Componentes do Projeto
import { BackButton, DragHandle, LogoMark } from "@/components/auth";
import { InputField, PasswordStrength, PrimaryButton } from "@/components/form";

//Serviços
import { cadastrarUsuario, nomeUsuarioDisponivel } from "@/services/auth";
import { toast } from "@/services/toast";
import { confirm } from "@/services/confirm";

//Utilitários
import { traduzirErroAuth } from "@/utils/errosAuth";

export default function SignUpScreen() {
    const [realName, setRealName] = useState("");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
    const usernameCheckId = useRef(0);

    useEffect(() => {
        const trimmed = username.trim();
        if (trimmed.length < 3) {
            setUsernameStatus("idle");
            return;
        }
        const currentCheck = ++usernameCheckId.current;
        setUsernameStatus("checking");
        const timeout = setTimeout(async () => {
            const { disponivel, error } = await nomeUsuarioDisponivel(trimmed);
            if (currentCheck !== usernameCheckId.current) return; // resposta desatualizada
            if (error) {
                // Sem resposta do servidor não dá para afirmar nada: volta ao estado neutro
                // em vez de mostrar um "disponível" que pode estar errado.
                setUsernameStatus("idle");
                return;
            }
            setUsernameStatus(disponivel ? "available" : "taken");
        }, 500);
        return () => clearTimeout(timeout);
    }, [username]);

    const handleSignUp = async () => {
        if (!realName.trim() || !username.trim() || !email || !password || !confirmPassword) {
            toast.warning("Preencha todos os campos.", "Campos obrigatórios");
            return;
        }
        if (username.trim().length < 3) {
            toast.warning("O nome de usuário deve ter pelo menos 3 caracteres.", "Nome de usuário curto");
            return;
        }
        if (usernameStatus === "checking") {
            toast.info("Ainda estamos verificando a disponibilidade do nome de usuário.", "Aguarde");
            return;
        }
        if (usernameStatus === "taken") {
            toast.warning("Escolha outro nome de usuário.", "Nome de usuário indisponível");
            return;
        }
        const emailLimpo = email.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailLimpo)) {
            toast.warning("Por favor, insira um e-mail válido.", "E-mail inválido");
            return;
        }
        if (password.length < 8) {
            toast.warning("A senha deve ter pelo menos 8 caracteres.", "Senha muito curta");
            return;
        }
        if (password !== confirmPassword) {
            toast.warning("As senhas não coincidem.", "Senhas diferentes");
            return;
        }

        setIsLoading(true);

        //Cadastra o usuário (nome e @usuário viajam em user_metadata até a verificação)
        const { error, emailJaCadastrado } = await cadastrarUsuario(emailLimpo, password, realName, username);
        setIsLoading(false);

        if (error) {
            toast.error(traduzirErroAuth(error.message), "Erro no cadastro");
            return;
        }

        if (emailJaCadastrado) {
            confirm({
                title: "E-mail já cadastrado",
                message: `Já existe uma conta usando ${emailLimpo}. Entre com ela ou cadastre-se com outro e-mail.`,
                confirmText: "Ir para o login",
                cancelText: "Usar outro e-mail",
                onConfirm: () => router.replace("/(auth)/login"),
            });
            return;
        }

        // Vai direto para a confirmação: o perfil só pode ser gravado depois que existe
        // sessão, e sessão só existe depois do código de 6 dígitos.
        router.replace("/(auth)/verify-email");
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
                <LogoMark size={72} borderRadius={20} marginBottom={14} />

                <Text style={{ fontSize: 22, fontWeight: "800", color: HADES.text, letterSpacing: -0.5 }}>
                    Criar conta
                </Text>
                <Text style={{ fontSize: 14, color: HADES.textMuted, marginTop: 4 }}>Etapa 1 de 2 — Seus dados</Text>
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

                    {/* Nome completo */}
                    <InputField
                        icon={<User size={18} color={HADES.accentSolid} />}
                        value={realName}
                        onChangeText={setRealName}
                        placeholder="Nome completo"
                        autoCapitalize="words"
                        hades
                    />

                    {/* Nome de usuário */}
                    <InputField
                        icon={<AtSign size={18} color={HADES.violet} />}
                        value={username}
                        onChangeText={(v) => setUsername(v.replace(/[^a-zA-Z0-9_.]/g, ""))}
                        placeholder="Nome de usuário"
                        maxLength={30}
                        hades
                    />
                    {usernameStatus === "checking" && (
                        <Text style={{ fontSize: 11.5, color: HADES.textMuted, marginTop: -6, paddingHorizontal: 2 }}>
                            Verificando disponibilidade...
                        </Text>
                    )}
                    {usernameStatus === "taken" && (
                        <Text style={{ fontSize: 11.5, color: HADES.red, marginTop: -6, paddingHorizontal: 2 }}>
                            Esse nome de usuário já está em uso.
                        </Text>
                    )}
                    {usernameStatus === "available" && (
                        <Text style={{ fontSize: 11.5, color: HADES.green, marginTop: -6, paddingHorizontal: 2 }}>
                            ✓ Nome de usuário disponível
                        </Text>
                    )}

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
