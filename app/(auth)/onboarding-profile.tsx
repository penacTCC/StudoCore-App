import { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    Alert,
    DeviceEventEmitter,
} from "react-native";
import { User, AtSign, Calendar, ChevronDown, Brain } from "lucide-react-native";
import { COLORS } from "@/constants/colors";
import { supabase } from "../supabase";
import InputField from "@/components/form/InputField";
import PrimaryButton from "@/components/form/PrimaryButton";
import ImagePickerAvatar from "@/components/ui/ImagePickerAvatar";
import MonthPicker from "@/components/ui/MonthPicker";
import StepDots from "@/components/ui/StepDots";

export default function OnboardingProfile() {
    const [realName, setRealName] = useState("");
    const [username, setUsername] = useState("");
    const [loading, setLoading] = useState(false);
    const [userId, setUserId] = useState("");
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    // Aniversário
    const [birthDay, setBirthDay] = useState("");
    const [birthMonth, setBirthMonth] = useState(0);
    const [birthYear, setBirthYear] = useState("");
    const [showMonthPicker, setShowMonthPicker] = useState(false);

    const MONTHS = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
    ];

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) setUserId(session.user.id);
        });
    }, []);

    const handleFinish = async () => {
        const day = parseInt(birthDay, 10);
        const year = parseInt(birthYear, 10);

        if (!realName.trim()) {
            Alert.alert("Nome obrigatório", "Por favor, insira o seu nome completo.");
            return;
        }
        if (!username.trim()) {
            Alert.alert("Username obrigatório", "Escolha um nome de usuário.");
            return;
        }
        if (!birthDay || !birthMonth || !birthYear || isNaN(day) || isNaN(year)) {
            Alert.alert("Data inválida", "Por favor, preencha uma data de nascimento válida.");
            return;
        }
        if (day < 1 || day > 31) {
            Alert.alert("Dia inválido", "Insira um número entre 1 e 31.");
            return;
        }
        if (year < 1946 || year > new Date().getFullYear()) {
            Alert.alert("Ano inválido", "Insira um ano válido.");
            return;
        }
        if (!userId) {
            Alert.alert("Erro", "Usuário não encontrado. Tente logar novamente.");
            return;
        }

        setLoading(true);

        const dataFormatada = `${year}-${String(birthMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

        const { data, error: selectError } = await supabase
            .from("profiles")
            .select("nome_usuario")
            .eq("nome_usuario", username.trim());

        if (selectError) {
            Alert.alert("Erro ao buscar", selectError.message);
            setLoading(false);
            return;
        }

        if (data && data.length > 0) {
            Alert.alert("Erro", "Nome de usuário já existe.");
            setLoading(false);
            return;
        }

        const { error: insertError } = await supabase.from("profiles").upsert({
            id: userId,
            nome_usuario: username.trim(),
            nome_real: realName.trim(),
            data_nascimento: dataFormatada,
            questoes_feitas: 0,
        });

        if (insertError) {
            Alert.alert("Erro ao salvar", insertError.message);
            setLoading(false);
        } else {
            await supabase.auth.refreshSession();
            DeviceEventEmitter.emit("profileUpdated");
        }
    };

    const selectedMonthLabel = birthMonth ? MONTHS[birthMonth - 1] : "Mês";

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1, backgroundColor: COLORS.bgPrimary }}
        >
            <StatusBar barStyle="light-content" backgroundColor={COLORS.bgPrimary} />

            <ScrollView
                contentContainerStyle={{ flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* ── Header ── */}
                <View style={{ paddingTop: 60, paddingHorizontal: 28, marginBottom: 32 }}>
                    {/* Step badge */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 24 }}>
                        <View
                            style={{
                                paddingHorizontal: 10,
                                paddingVertical: 4,
                                backgroundColor: COLORS.primary + "20",
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: COLORS.primary + "40",
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 11,
                                    fontWeight: "700",
                                    color: COLORS.primary,
                                    letterSpacing: 0.5,
                                }}
                            >
                                ETAPA 2 DE 2
                            </Text>
                        </View>
                    </View>

                    <Text
                        style={{
                            fontSize: 28,
                            fontWeight: "800",
                            color: "#ffffff",
                            letterSpacing: -0.5,
                            lineHeight: 34,
                        }}
                    >
                        Configure o seu
                    </Text>
                    <Text
                        style={{
                            fontSize: 28,
                            fontWeight: "800",
                            color: COLORS.primary,
                            letterSpacing: -0.5,
                            lineHeight: 34,
                            marginBottom: 10,
                        }}
                    >
                        perfil
                    </Text>
                    <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 20 }}>
                        Essas informações personalizam sua experiência e as questões geradas pela IA.
                    </Text>
                </View>

                {/* ── Avatar ── */}
                <ImagePickerAvatar
                    bucket="images"
                    onImageUploaded={(url) => setImageUrl(url)}
                    circle={true}
                />

                {/* ── Form ── */}
                <View style={{ paddingHorizontal: 28, flex: 1 }}>
                    <InputField
                        label="Nome Completo"
                        icon={<User size={18} color={COLORS.primary} />}
                        value={realName}
                        onChangeText={setRealName}
                        placeholder="Ex: Lucas Ferreira"
                        autoCapitalize="words"
                    />

                    <InputField
                        label="Nome de Usuário"
                        icon={<AtSign size={18} color={COLORS.violet} />}
                        value={username}
                        onChangeText={(v) => setUsername(v.replace(/[^a-zA-Z0-9_.]/g, ""))}
                        placeholder="ex: lucas.ferreira"
                        prefix="@"
                        maxLength={30}
                        helperText="Visível para outros usuários. Letras, números, pontos e underscores."
                    />

                    {/* Birthday section */}
                    <Text
                        style={{
                            fontSize: 12,
                            fontWeight: "700",
                            color: "rgba(255,255,255,0.45)",
                            letterSpacing: 0.8,
                            marginBottom: 8,
                            textTransform: "uppercase",
                        }}
                    >
                        Data de Nascimento
                    </Text>

                    <View style={{ flexDirection: "row", gap: 10, marginBottom: 8 }}>
                        {/* Day */}
                        <View
                            style={{
                                flex: 1,
                                flexDirection: "row",
                                alignItems: "center",
                                backgroundColor: COLORS.bgSecondary,
                                borderRadius: 14,
                                borderWidth: 1.5,
                                borderColor: "rgba(255,255,255,0.07)",
                                paddingHorizontal: 14,
                                paddingVertical: 14,
                                gap: 8,
                            }}
                        >
                            <Calendar size={16} color={COLORS.primary} style={{ opacity: 0.8 }} />
                            <TextInput
                                value={birthDay}
                                onChangeText={(v) => setBirthDay(v.replace(/\D/g, "").slice(0, 2))}
                                placeholder="Dia"
                                placeholderTextColor={COLORS.textFaint}
                                keyboardType="number-pad"
                                maxLength={2}
                                style={{ flex: 1, fontSize: 15, color: COLORS.textPrimary, fontWeight: "500" }}
                            />
                        </View>

                        {/* Month picker button */}
                        <TouchableOpacity
                            onPress={() => setShowMonthPicker(true)}
                            style={{
                                flex: 1.6,
                                flexDirection: "row",
                                alignItems: "center",
                                backgroundColor: COLORS.bgSecondary,
                                borderRadius: 14,
                                borderWidth: 1.5,
                                borderColor: "rgba(255,255,255,0.07)",
                                paddingHorizontal: 14,
                                paddingVertical: 14,
                                justifyContent: "space-between",
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 15,
                                    color: birthMonth ? COLORS.textPrimary : COLORS.textFaint,
                                    fontWeight: birthMonth ? "500" : "400",
                                }}
                            >
                                {selectedMonthLabel}
                            </Text>
                            <ChevronDown size={16} color={COLORS.textMuted} />
                        </TouchableOpacity>

                        {/* Year */}
                        <View
                            style={{
                                flex: 1.1,
                                flexDirection: "row",
                                alignItems: "center",
                                backgroundColor: COLORS.bgSecondary,
                                borderRadius: 14,
                                borderWidth: 1.5,
                                borderColor: "rgba(255,255,255,0.07)",
                                paddingHorizontal: 14,
                                paddingVertical: 14,
                            }}
                        >
                            <TextInput
                                value={birthYear}
                                onChangeText={(v) => setBirthYear(v.replace(/\D/g, "").slice(0, 4))}
                                placeholder="Ano"
                                placeholderTextColor={COLORS.textFaint}
                                keyboardType="number-pad"
                                maxLength={4}
                                style={{ flex: 1, fontSize: 15, color: COLORS.textPrimary, fontWeight: "500" }}
                            />
                        </View>
                    </View>

                    {/* AI Age info banner */}
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "flex-start",
                            gap: 10,
                            backgroundColor: COLORS.violet + "18",
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: COLORS.violet + "35",
                            paddingHorizontal: 14,
                            paddingVertical: 12,
                            marginBottom: 36,
                            marginTop: 4,
                        }}
                    >
                        <Brain size={16} color={COLORS.violet} style={{ marginTop: 1 }} />
                        <Text
                            style={{
                                flex: 1,
                                fontSize: 12.5,
                                color: "rgba(167, 139, 250, 0.85)",
                                lineHeight: 18,
                            }}
                        >
                            <Text style={{ fontWeight: "700", color: COLORS.violetLight }}>
                                Por que pedimos a sua idade?{"\n"}
                            </Text>
                            A IA usa a sua faixa etária para calibrar o nível de complexidade,
                            vocabulário e profundidade das questões geradas. Nenhum dado pessoal é
                            compartilhado.
                        </Text>
                    </View>

                    {/* Bottom nav */}
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            paddingBottom: 48,
                        }}
                    >
                        <StepDots active={1} total={2} />

                        <PrimaryButton
                            label="Começar ✓"
                            onPress={handleFinish}
                            isLoading={loading}
                            style={{ borderRadius: 16, paddingHorizontal: 32, letterSpacing: 1 } as any}
                        />
                    </View>
                </View>
            </ScrollView>

            <MonthPicker
                visible={showMonthPicker}
                selected={birthMonth}
                onSelect={setBirthMonth}
                onClose={() => setShowMonthPicker(false)}
            />
        </KeyboardAvoidingView>
    );
}
