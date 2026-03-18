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
    Pressable,
    Modal,
    DeviceEventEmitter,
    Image,
} from "react-native";
import { User, AtSign, Calendar, ChevronDown, Brain, Plus, ImageIcon } from "lucide-react-native";
import { COLORS } from "@/constants/colors";
import { supabase } from "../supabase";
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

// ── Dots progress indicator ───────────────────────────────────────────────────
function Dots({ active }: { active: number }) {
    return (
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            {[0, 1].map((i) => (
                <View
                    key={i}
                    style={{
                        width: i === active ? 24 : 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: i === active ? COLORS.primary : "rgba(255,255,255,0.2)",
                    }}
                />
            ))}
        </View>
    );
}

// ── Styled input field ────────────────────────────────────────────────────────
function InputField({
    label,
    icon,
    value,
    onChangeText,
    placeholder,
    helperText,
    keyboardType = "default",
    autoCapitalize = "none",
    maxLength,
    prefix,
}: {
    label: string;
    icon: React.ReactNode;
    value: string;
    onChangeText: (v: string) => void;
    placeholder: string;
    helperText?: string;
    keyboardType?: any;
    autoCapitalize?: any;
    maxLength?: number;
    prefix?: string;
}) {
    const [focused, setFocused] = useState(false);
    return (
        <View style={{ marginBottom: 20 }}>
            <Text
                style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: focused ? COLORS.primary : "rgba(255,255,255,0.45)",
                    letterSpacing: 0.8,
                    marginBottom: 8,
                    textTransform: "uppercase",
                }}
            >
                {label}
            </Text>
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: focused ? COLORS.bgTertiary : COLORS.bgSecondary,
                    borderRadius: 14,
                    borderWidth: 1.5,
                    borderColor: focused ? COLORS.primary + "80" : "rgba(255,255,255,0.07)",
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    gap: 10,
                }}
            >
                <View style={{ opacity: focused ? 1 : 0.4 }}>{icon}</View>
                {prefix && (
                    <Text style={{ color: COLORS.textSecondary, fontSize: 15, fontWeight: "600" }}>{prefix}</Text>
                )}
                <TextInput
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={COLORS.textFaint}
                    keyboardType={keyboardType}
                    autoCapitalize={autoCapitalize}
                    maxLength={maxLength}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    style={{
                        flex: 1,
                        fontSize: 15,
                        color: COLORS.textPrimary,
                        fontWeight: "500",
                    }}
                />
            </View>
            {helperText && (
                <Text
                    style={{
                        fontSize: 11.5,
                        color: COLORS.textMuted,
                        marginTop: 6,
                        lineHeight: 16,
                        paddingHorizontal: 2,
                    }}
                >
                    {helperText}
                </Text>
            )}
        </View>
    );
}

// ── Month picker modal ────────────────────────────────────────────────────────
const MONTHS = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function MonthPicker({
    visible,
    selected,
    onSelect,
    onClose,
}: {
    visible: boolean;
    selected: number;
    onSelect: (i: number) => void;
    onClose: () => void;
}) {
    return (
        <Modal visible={visible} transparent animationType="fade">
            <Pressable
                onPress={onClose}
                style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "center", paddingHorizontal: 24 }}
            >
                <Pressable
                    onPress={() => { }}
                    style={{
                        backgroundColor: COLORS.bgSecondary,
                        borderRadius: 20,
                        overflow: "hidden",
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.1)",
                    }}
                >
                    <View
                        style={{
                            paddingHorizontal: 20,
                            paddingVertical: 16,
                            borderBottomWidth: 1,
                            borderColor: "rgba(255,255,255,0.07)",
                        }}
                    >
                        <Text style={{ fontSize: 15, fontWeight: "700", color: COLORS.textPrimary }}>Selecionar Mês</Text>
                    </View>
                    {MONTHS.map((m, i) => (
                        <TouchableOpacity
                            key={m}
                            onPress={() => { onSelect(i + 1); onClose(); }}
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                paddingHorizontal: 20,
                                paddingVertical: 13,
                                backgroundColor: selected === i + 1 ? COLORS.primary + "18" : "transparent",
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 14,
                                    color: selected === i + 1 ? COLORS.primary : COLORS.textSecondary,
                                    fontWeight: selected === i + 1 ? "700" : "400",
                                }}
                            >
                                {m}
                            </Text>
                            {selected === i + 1 && (
                                <View
                                    style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: 4,
                                        backgroundColor: COLORS.primary,
                                    }}
                                />
                            )}
                        </TouchableOpacity>
                    ))}
                </Pressable>
            </Pressable>
        </Modal>
    );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function OnboardingProfile() {
    const [realName, setRealName] = useState("");
    const [username, setUsername] = useState("");
    const [loading, setLoading] = useState(false);
    const [userId, setUserId] = useState("");
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    // Aniversário
    const [birthDay, setBirthDay] = useState("");
    const [birthMonth, setBirthMonth] = useState(0);
    const [birthYear, setBirthYear] = useState("");
    const [showMonthPicker, setShowMonthPicker] = useState(false);

    // Aqui estamos pegando o id do usuario logado, por meio da sua sessão
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                setUserId(session.user.id);
            }
        });
    }, []);

    const selectImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true, //permite editar a imagem
                aspect: [1, 1],
                quality: 0.5, //comprime para 50% do tamanho original, evitar tomar muito espaço no banco de dados
                base64: true, // obtém diretamente o base64
            });

            if (result.canceled) {
                console.log("Usuário cancelou a operação")
                return
            }

            const imageUri = result.assets[0].uri;
            setImagePreview(imageUri);

            const base64 = result.assets[0].base64;

            if (!base64) {
                console.log("Erro: base64 da imagem não foi gerado.");
                return;
            }

            const fileExt = imageUri.split('.').pop();
            const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`;

            const { data, error } = await supabase.storage
                .from('images')
                .upload(fileName, decode(base64), {
                    contentType: `image/${fileExt}`,
                });

            if (error) {
                Alert.alert("Erro no Supabase", JSON.stringify(error));
                console.log("Erro detalhado:", error);
                console.log("Erro ao enviar imagem:", error);
                return;
            }

            const { data: urlData } = supabase.storage
                .from('images')
                .getPublicUrl(fileName);

            const imagemUrlCompleta = urlData.publicUrl;
            setImageUrl(imagemUrlCompleta);
            console.log("Imagem enviada com sucesso:", imagemUrlCompleta);

        } catch (error) {
            Alert.alert("Erro Crítico no Catch", JSON.stringify(error));
            console.log(error);
        }
    }

    // 2. A função HandleFinish cuida de tudo, desde formatação da data, até salvar no banco de dados
    const handleFinish = async () => {
        const day = parseInt(birthDay, 10);
        const year = parseInt(birthYear, 10);

        // --- VALIDAÇÕES ---
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
            Alert.alert('Erro', 'Usuário não encontrado. Tente logar novamente.');
            return;
        }

        setLoading(true);

        // 3. Formatar a data para o padrão do Banco de Dados (YYYY-MM-DD)
        // O padStart garante que o mês 5 vire "05", por exemplo.
        const dataFormatada = `${year}-${String(birthMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        //Busca no supabase se o nome de usuario ja existe
        const { data, error: selectError } = await supabase
            .from('profiles')
            .select('nome_usuario')
            .eq('nome_usuario', username.trim());

        if (selectError) {
            Alert.alert('Erro ao buscar', selectError.message);
            setLoading(false);
            return;
        }

        if (data && data.length > 0) {
            Alert.alert('Erro', 'Nome de usuário já existe.');
            setLoading(false);
            return;
        }

        // 4. Salvar no Supabase
        const { error: insertError } = await supabase
            .from('profiles')
            .upsert({ //upsert é uma função que insere ou atualiza um registro
                id: userId,
                nome_usuario: username.trim(),
                nome_real: realName.trim(), //trim é usado para remover espaços em branco no início e no fim da string
                data_nascimento: dataFormatada,
                questoes_feitas: 0
            });

        if (insertError) {
            Alert.alert('Erro ao salvar', insertError.message);
            setLoading(false);
        } else {
            // Sucesso! Atualiza a sessão para que o app perceba que o perfil agora exista e libere a ida para as (tabs)
            await supabase.auth.refreshSession();
            //O DeviceEventEmitter é um objeto que permite que o app escute eventos em tempo real
            DeviceEventEmitter.emit('profileUpdated');
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
                <View
                    style={{
                        paddingTop: 60,
                        paddingHorizontal: 28,
                        marginBottom: 32,
                    }}
                >
                    {/* Step indicator */}
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 24,
                        }}
                    >
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
                            <Text style={{ fontSize: 11, fontWeight: "700", color: COLORS.primary, letterSpacing: 0.5 }}>
                                ETAPA 2 DE 2
                            </Text>
                        </View>
                    </View>

                    <Text style={{ fontSize: 28, fontWeight: "800", color: "#ffffff", letterSpacing: -0.5, lineHeight: 34 }}>
                        Configure o seu
                    </Text>
                    <Text style={{ fontSize: 28, fontWeight: "800", color: COLORS.primary, letterSpacing: -0.5, lineHeight: 34, marginBottom: 10 }}>
                        perfil
                    </Text>
                    <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 20 }}>
                        Essas informações personalizam sua experiência e as questões geradas pela IA.
                    </Text>
                </View>

                <View className="items-center mb-8 mt-2">
                    <View className="relative">
                        <TouchableOpacity
                            onPress={selectImage}
                            className="w-32 h-32 rounded-full bg-navy-800 border-[3px] border-navy-700 items-center justify-center overflow-hidden"
                            style={{ shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5 }}
                        >
                            {imagePreview ? (
                                <Image className="h-full w-full" source={{ uri: imagePreview || '' }} />
                            ) : (
                                <ImageIcon size={36} color={COLORS.textMuted} />
                            )}
                            <Text className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">Photo</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={selectImage}
                            className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-brand-500 items-center justify-center border-[3px] border-navy-950"
                        >
                            <Plus size={18} color="#ffffff" strokeWidth={3} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── Form ── */}
                <View style={{ paddingHorizontal: 28, flex: 1 }}>
                    {/* Real name */}
                    <InputField
                        label="Nome Completo"
                        icon={<User size={18} color={COLORS.primary} />}
                        value={realName}
                        onChangeText={setRealName}
                        placeholder="Ex: Lucas Ferreira"
                        autoCapitalize="words"
                    />

                    {/* Username */}
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

                    {/* Birthday row */}
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

                        {/* Month picker */}
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
                        <Text style={{ flex: 1, fontSize: 12.5, color: "rgba(167, 139, 250, 0.85)", lineHeight: 18 }}>
                            <Text style={{ fontWeight: "700", color: COLORS.violetLight }}>Por que pedimos a sua idade?{"\n"}</Text>
                            A IA usa a sua faixa etária para calibrar o nível de complexidade, vocabulário e profundidade das questões geradas. Nenhum dado pessoal é compartilhado.
                        </Text>
                    </View>

                    {/* Bottom nav */}
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 48 }}>
                        <Dots active={1} />

                        <TouchableOpacity
                            onPress={handleFinish}
                            style={{
                                backgroundColor: COLORS.primary,
                                borderRadius: 16,
                                paddingVertical: 16,
                                paddingHorizontal: 32,
                                shadowColor: COLORS.primary,
                                shadowOffset: { width: 0, height: 6 },
                                shadowOpacity: 0.45,
                                shadowRadius: 14,
                                elevation: 10,
                            }}
                        >
                            <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 15, letterSpacing: 1 }}>
                                Começar ✓
                            </Text>
                        </TouchableOpacity>
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
