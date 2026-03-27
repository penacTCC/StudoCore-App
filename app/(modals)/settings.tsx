import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, User, Save, Trash2, Smartphone, LogOut, Bell } from "lucide-react-native";
import { COLORS } from "@/constants/colors";
import { buscarPerfil, buscarUsuarioLogado, salvarDadosPerfil } from "@/services/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function SettingsScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    const [userId, setUserId] = useState<string>("");
    const [username, setUsername] = useState("");
    const [vibrationEnabled, setVibrationEnabled] = useState(true);
    const [realName, setRealName] = useState("");
    const [profileData, setProfileData] = useState<any>(null);

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
                }
            }
            setLoading(false);
        };
        const fetchPreferences = async () => {
            const pref = await AsyncStorage.getItem('@app_preferences_vibration');
            if (pref !== null) {
                setVibrationEnabled(pref === 'true');
            }
        };
        fetchUser();
        fetchPreferences();
    }, []);

    const handleSave = async () => {
        if (!username.trim() || !realName.trim()) {
            Alert.alert("Erro", "Nome e nome de usuário são obrigatórios.");
            return;
        }

        setSaving(true);
        try {
            const result = await salvarDadosPerfil(
                userId,
                realName,
                username,
                profileData?.data_nascimento || new Date().toISOString(), // Keep existing date if updating
                profileData?.foto_usuario || null
            );

            if (result.error) {
                Alert.alert("Erro", "Não foi possível salvar os dados. O nome de usuário pode já estar em uso.");
            } else {
                Alert.alert("Sucesso", "Perfil atualizado com sucesso!");
                router.back();
            }
        } catch (error) {
            console.error("Erro ao salvar:", error);
            Alert.alert("Erro", "Não foi possível salvar os dados.");
        } finally {
            setSaving(false);
        }
    };

    const toggleVibration = async (val: boolean) => {
        setVibrationEnabled(val);
        await AsyncStorage.setItem('@app_preferences_vibration', String(val));
    };

    const handleClearCache = () => {
        Alert.alert(
            "Limpar Dados Locais",
            "Isso apagará suas estatísticas simuladas (heatmap, horas falsas) e o histórico local. Deseja continuar?",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Limpar",
                    style: "destructive",
                    onPress: async () => {
                        await AsyncStorage.clear();
                        Alert.alert("Sucesso", "Cache limpo. Reinicie o aplicativo para ver o efeito completamento.");
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-slate-950 items-center justify-center">
                <ActivityIndicator size="large" color={COLORS.violetLight} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-slate-950">
            {/* Header */}
            <View className="bg-slate-950 border-b border-slate-800 px-4 py-3 flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                    <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
                        <ChevronLeft size={24} color="#cbd5e1" />
                    </TouchableOpacity>
                    <Text className="text-xl font-bold text-slate-200">Configurações</Text>
                </View>
                <TouchableOpacity onPress={handleSave} disabled={saving}>
                    {saving ? (
                        <ActivityIndicator size="small" color={COLORS.emerald} />
                    ) : (
                        <Save size={20} color={COLORS.emerald} />
                    )}
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView className="flex-1 px-4 py-6" showsVerticalScrollIndicator={false}>
                    
                    {/* Public Profile Form */}
                    <Text className="text-sm font-medium text-slate-400 mb-4 uppercase tracking-wider">
                        Perfil Público
                    </Text>
                    
                    <View className="bg-slate-900 border border-slate-800 rounded-3xl p-4 mb-6">
                        <View className="mb-4">
                            <Text className="text-xs text-slate-400 mb-2 ml-1">Nome Completo / Apelido</Text>
                            <View className="flex-row items-center bg-slate-950/50 border border-slate-800 rounded-2xl px-4 py-3">
                                <User size={20} color="#94a3b8" className="mr-3" />
                                <TextInput
                                    className="flex-1 text-slate-200"
                                    placeholder="Seu nome"
                                    placeholderTextColor="#64748b"
                                    value={realName}
                                    onChangeText={setRealName}
                                />
                            </View>
                        </View>

                        <View>
                            <Text className="text-xs text-slate-400 mb-2 ml-1">Username (Nome de Usuário)</Text>
                            <View className="flex-row items-center bg-slate-950/50 border border-slate-800 rounded-2xl px-4 py-3">
                                <Text className="text-slate-500 mr-1">@</Text>
                                <TextInput
                                    className="flex-1 text-slate-200"
                                    placeholder="username"
                                    placeholderTextColor="#64748b"
                                    value={username}
                                    onChangeText={setUsername}
                                    autoCapitalize="none"
                                />
                            </View>
                            <Text className="text-xs text-slate-500 mt-2 ml-1">Este nome será único para convidar pessoas para grupos.</Text>
                        </View>
                    </View>

                    {/* Preferences */}
                    <Text className="text-sm font-medium text-slate-400 mb-4 uppercase tracking-wider mt-4">
                        Preferências
                    </Text>

                    <View className="bg-slate-900 border border-slate-800 rounded-3xl p-4 mb-2">
                        <View className="flex-row items-center justify-between py-2">
                            <View className="flex-row items-center gap-3">
                                <View className="w-10 h-10 rounded-full bg-slate-800 items-center justify-center">
                                    <Bell size={20} color="#cbd5e1" />
                                </View>
                                <View>
                                    <Text className="text-sm font-medium text-slate-200">Vibração em Alertas</Text>
                                    <Text className="text-xs text-slate-400">Vibrar ao desbloquear medalhas</Text>
                                </View>
                            </View>
                            <Switch
                                value={vibrationEnabled}
                                onValueChange={toggleVibration}
                                trackColor={{ false: "#334155", true: COLORS.emerald }}
                                thumbColor="#ffffff"
                            />
                        </View>
                    </View>

                    {/* App Prefs */}
                    <Text className="text-sm font-medium text-slate-400 mb-4 uppercase tracking-wider mt-4">
                        Sistema e Testes
                    </Text>

                    <View className="bg-slate-900 border border-slate-800 rounded-3xl p-4">
                        <TouchableOpacity 
                            onPress={handleClearCache}
                            className="flex-row items-center justify-between py-2"
                        >
                            <View className="flex-row items-center gap-3">
                                <View className="w-10 h-10 rounded-full bg-rose-500/20 items-center justify-center">
                                    <Trash2 size={20} color={COLORS.rose} />
                                </View>
                                <View>
                                    <Text className="text-sm font-bold text-rose-500">Limpar Cache Local</Text>
                                    <Text className="text-xs text-slate-400">Restaurar fav. subject e estatísticas</Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                        
                        <View className="h-[1px] bg-slate-800 my-3" />

                        <View className="flex-row items-center justify-between py-2">
                            <View className="flex-row items-center gap-3">
                                <View className="w-10 h-10 rounded-full bg-slate-800 items-center justify-center">
                                    <Smartphone size={20} color="#cbd5e1" />
                                </View>
                                <View>
                                    <Text className="text-sm font-medium text-slate-200">Versão do App</Text>
                                    <Text className="text-xs text-slate-400">1.0.0 (Beta)</Text>
                                </View>
                            </View>
                        </View>
                    </View>

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
