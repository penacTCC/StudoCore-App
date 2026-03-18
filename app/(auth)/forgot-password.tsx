import { useState } from "react";
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
import { router } from "expo-router";
import { Mail, CheckCircle } from "lucide-react-native";
import { COLORS } from "@/constants/colors";
import { supabase } from "../supabase";
import { makeRedirectUri } from "expo-auth-session";
import DotPattern from "@/components/auth/DotPattern";
import LogoMark from "@/components/auth/LogoMark";
import BackButton from "@/components/auth/BackButton";
import DragHandle from "@/components/auth/DragHandle";
import PrimaryButton from "@/components/form/PrimaryButton";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function ForgotPasswordScreen() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSendReset = async () => {
        if (!email.trim()) {
            Alert.alert("Campo obrigatório", "Por favor, informe seu email.");
            return;
        }

        setIsLoading(true);
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: makeRedirectUri({ path: "forgot-password" }),
        });
        setIsLoading(false);

        if (error) {
            Alert.alert("Erro", error.message);
        } else {
            setSent(true);
        }
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

                {sent ? (
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
                            Email enviado!
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
                            Informe seu email e enviaremos um link para redefinir sua senha.
                        </Text>

                        {/* Email input */}
                        <View style={{ marginBottom: 20, position: "relative" }}>
                            <TextInput
                                value={email}
                                onChangeText={setEmail}
                                placeholder="Email"
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
