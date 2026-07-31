import { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from "react-native";
import { toast } from "@/services/toast";
import { confirm } from "@/services/confirm";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, Save, Trash2 } from "lucide-react-native";
import { HADES } from "@/constants/hades";
import { buscarPerfil, buscarUsuarioLogado, salvarDadosPerfil, verificarNomeUsuario } from "@/services/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ImagePickerAvatar } from "@/components/ui";
import { SecaoConfig, LinhaSwitch, LinhaPerigo } from "@/components/cronograma/LinhasConfig";
import { Skeleton, SkeletonCircle } from "@/components/ui/Skeleton";
import { Profile } from "@/types/profile";

export default function SettingsScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [userId, setUserId] = useState<string>("");
    const [username, setUsername] = useState("");
    const [vibrationEnabled, setVibrationEnabled] = useState(true);
    const [testModeEnabled, setTestModeEnabled] = useState(false);
    const [realName, setRealName] = useState("");
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [profileData, setProfileData] = useState<Profile | null>(null);

    useEffect(() => {
        const fetchUser = async () => {
            const { data } = await buscarUsuarioLogado();
            if (data?.user) {
                setUserId(data.user.id);
                const { data: prof } = await buscarPerfil(data.user.id);
                if (prof) {
                    setProfileData(prof);
                    setUsername(prof.nome_usuario || "");
                    setRealName(prof.nome_real || "");
                    if (prof.foto_usuario) setImageUrl(prof.foto_usuario);
                }
            }
            setLoading(false);
        };
        const fetchPreferences = async () => {
            const pref = await AsyncStorage.getItem("@app_preferences_vibration");
            if (pref !== null) {
                setVibrationEnabled(pref === "true");
            }
            const testPref = await AsyncStorage.getItem("@app_test_mode");
            if (testPref !== null) {
                setTestModeEnabled(testPref === "true");
            }
        };
        fetchUser();
        fetchPreferences();
    }, []);

    const handleSave = async () => {
        if (!username.trim() || !realName.trim()) {
            toast.error("Nome e nome de usuário são obrigatórios.");
            return;
        }

        setSaving(true);
        try {
            // Verifica se o username mudou e se já não é de outra pessoa
            if (username !== profileData?.nome_usuario) {
                const { data, error: selectError } = await verificarNomeUsuario(username);
                if (selectError) {
                    toast.error("Não foi possível verificar seu nome de usuário.");
                    setSaving(false);
                    return;
                }
                if (data && data.length > 0) {
                    toast.warning("Este nome de usuário já está sendo usado por outra pessoa. Escolha outro!", "Aviso");
                    setSaving(false);
                    return;
                }
            }

            const result = await salvarDadosPerfil(
                userId,
                realName,
                username,
                profileData?.data_nascimento || new Date().toISOString(),
                imageUrl
            );

            if (result.error) {
                toast.error("Não foi possível salvar os dados. " + result.error.message);
            } else {
                toast.success("Perfil atualizado com sucesso!");
                router.back();
            }
        } catch (error) {
            console.error("Erro ao salvar:", error);
            toast.error("Não foi possível salvar os dados.");
        } finally {
            setSaving(false);
        }
    };

    const toggleVibration = async (val: boolean) => {
        setVibrationEnabled(val);
        await AsyncStorage.setItem("@app_preferences_vibration", String(val));
    };

    const toggleTestMode = async (val: boolean) => {
        setTestModeEnabled(val);
        await AsyncStorage.setItem("@app_test_mode", String(val));
    };

    const handleClearCache = () => {
        confirm({
            title: "Limpar Dados Locais",
            message: "Isso apagará suas estatísticas simuladas (heatmap, horas falsas) e o histórico local. Deseja continuar?",
            confirmText: "Limpar",
            destructive: true,
            onConfirm: async () => {
                await AsyncStorage.multiRemove(["@app_preferences_vibration", "@app_test_mode"]);
                setVibrationEnabled(true);
                setTestModeEnabled(false);
                toast.success("Cache limpo. Reinicie o aplicativo para ver o efeito completamente.");
            },
        });
    };

    if (loading) {
        return <SettingsSkeleton />;
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.settingsBg }} edges={["top"]}>
            {/* Header */}
            <View
                style={{
                    paddingTop: 6,
                    paddingHorizontal: 20,
                    paddingBottom: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <ChevronLeft size={22} color={HADES.textSecondary} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 20, fontWeight: "700", color: HADES.text }}>Configurações</Text>
                </View>
                <TouchableOpacity onPress={handleSave} disabled={saving} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    {saving ? (
                        <ActivityIndicator size="small" color={HADES.accentSolid} />
                    ) : (
                        <Save size={20} color={HADES.accentSolid} />
                    )}
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Avatar */}
                    <ImagePickerAvatar
                        bucket="images"
                        onImageUploaded={(url) => setImageUrl(url)}
                        circle
                        defaultImage={imageUrl || undefined}
                        hades
                    />

                    {/* Perfil Público */}
                    <Text
                        style={{
                            fontSize: 12,
                            color: HADES.settingsTextMuted,
                            fontWeight: "700",
                            letterSpacing: 0.8,
                            marginBottom: 10,
                            marginLeft: 4,
                        }}
                    >
                        PERFIL PÚBLICO
                    </Text>

                    <View style={{ gap: 16, marginBottom: 4 }}>
                        <View>
                            <Text style={{ fontSize: 12, color: HADES.settingsTextMuted, marginBottom: 8, marginLeft: 4 }}>
                                Nome completo / Apelido
                            </Text>
                            <TextInput
                                value={realName}
                                onChangeText={setRealName}
                                placeholder="Seu nome"
                                placeholderTextColor={HADES.textFaint}
                                style={{
                                    backgroundColor: HADES.settingsInset,
                                    borderWidth: 1,
                                    borderColor: HADES.borderSettings,
                                    borderRadius: 12,
                                    paddingHorizontal: 16,
                                    paddingVertical: 14,
                                    color: HADES.text,
                                    fontSize: 15,
                                }}
                            />
                        </View>

                        <View>
                            <Text style={{ fontSize: 12, color: HADES.settingsTextMuted, marginBottom: 8, marginLeft: 4 }}>
                                Nome de usuário
                            </Text>
                            <View
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    backgroundColor: HADES.settingsInset,
                                    borderWidth: 1,
                                    borderColor: HADES.borderSettings,
                                    borderRadius: 12,
                                    paddingHorizontal: 16,
                                }}
                            >
                                <Text style={{ color: HADES.settingsTextMuted, fontSize: 15, marginRight: 2 }}>@</Text>
                                <TextInput
                                    value={username}
                                    onChangeText={setUsername}
                                    placeholder="nome_de_usuario"
                                    placeholderTextColor={HADES.textFaint}
                                    autoCapitalize="none"
                                    style={{ flex: 1, paddingVertical: 14, color: HADES.text, fontSize: 15 }}
                                />
                            </View>
                            <Text style={{ fontSize: 12, color: HADES.settingsTextMuted, marginTop: 8, marginLeft: 4 }}>
                                Este nome será único para convidar pessoas para grupos.
                            </Text>
                        </View>
                    </View>

                    {/* Preferências */}
                    <SecaoConfig titulo="PREFERÊNCIAS">
                        <LinhaSwitch
                            rotulo="Vibração em alertas"
                            descricao="Vibrar ao desbloquear medalhas"
                            ligado={vibrationEnabled}
                            onToggle={() => toggleVibration(!vibrationEnabled)}
                            ultima
                        />
                    </SecaoConfig>

                    {/* Sistema e Testes */}
                    <SecaoConfig titulo="SISTEMA E TESTES">
                        <LinhaSwitch
                            rotulo="Modo de testes rápido"
                            descricao="Transformar 10s reais em 1h no banco de dados"
                            ligado={testModeEnabled}
                            onToggle={() => toggleTestMode(!testModeEnabled)}
                        />
                        <LinhaPerigo
                            rotulo="Limpar cache local"
                            descricao="Restaurar matéria favorita e estatísticas"
                            icone={<Trash2 size={16} color={HADES.red} />}
                            onPress={handleClearCache}
                        />
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: 14,
                            }}
                        >
                            <Text style={{ fontSize: 14, color: HADES.text }}>Versão do aplicativo</Text>
                            <Text style={{ fontSize: 14, color: HADES.settingsTextSecondary }}>1.0.0 (Beta)</Text>
                        </View>
                    </SecaoConfig>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

function SettingsSkeleton() {
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.settingsBg }} edges={["top"]}>
            <View
                style={{
                    paddingTop: 6,
                    paddingHorizontal: 20,
                    paddingBottom: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Skeleton width={22} height={22} borderRadius={6} hades />
                    <Skeleton width={140} height={20} hades />
                </View>
                <Skeleton width={20} height={20} borderRadius={4} hades />
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
                showsVerticalScrollIndicator={false}
            >
                <View style={{ alignItems: "center", marginBottom: 20 }}>
                    <SkeletonCircle size={88} hades />
                </View>

                <Skeleton width={120} height={12} hades style={{ marginBottom: 10, marginLeft: 4 }} />

                <View style={{ gap: 16, marginBottom: 20 }}>
                    <Skeleton width="100%" height={49} borderRadius={12} hades />
                    <Skeleton width="100%" height={49} borderRadius={12} hades />
                </View>

                <Skeleton width="100%" height={64} borderRadius={14} hades style={{ marginBottom: 20 }} />
                <Skeleton width="100%" height={170} borderRadius={14} hades />
            </ScrollView>
        </SafeAreaView>
    );
}
