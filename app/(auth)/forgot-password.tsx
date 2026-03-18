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
import { ArrowLeft, Mail, CheckCircle } from "lucide-react-native";
import { COLORS } from "@/constants/colors";
import { supabase } from "../supabase";
import * as Linking from 'expo-linking';
import { makeRedirectUri } from 'expo-auth-session';

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
   redirectTo: makeRedirectUri({ path: 'forgot-password' }),
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
     justifyContent: "flex-start",
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
       <Text style={{ color: COLORS.primaryLight, fontWeight: "700" }}>{email}</Text>
       {"\n"}e siga as instruções para redefinir sua senha.
      </Text>

      <TouchableOpacity
       onPress={() => router.back()}
       style={{
        backgroundColor: COLORS.primary,
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 14,
        elevation: 10,
       }}
      >
       <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 15, letterSpacing: 2.5 }}>
        VOLTAR AO LOGIN
       </Text>
      </TouchableOpacity>
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

      {/* Send button */}
      <TouchableOpacity
       onPress={handleSendReset}
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
         ENVIAR LINK
        </Text>
       )}
      </TouchableOpacity>

      {/* Back to login */}
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 4 }}>
       <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.38)" }}>
        Lembrou a senha?
       </Text>
       <TouchableOpacity onPress={() => router.back()}>
        <Text style={{ fontSize: 14, color: COLORS.primary, fontWeight: "700" }}>
         Voltar ao login
        </Text>
       </TouchableOpacity>
      </View>
     </>
    )}
   </View>
  </KeyboardAvoidingView>
 );
}
