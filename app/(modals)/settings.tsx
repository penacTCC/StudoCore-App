import { useState, useEffect } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
} from "react-native";
import { toast } from "@/services/toast";
import { carregarModoTeste, definirModoTeste } from "@/services/modoTeste";
import { confirm } from "@/services/confirm";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, Trash2 } from "lucide-react-native";
import { HADES } from "@/constants/hades";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SecaoConfig, LinhaSwitch, LinhaPerigo } from "@/components/cronograma/LinhasConfig";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/hooks/useAuth";
import { usePreferencias } from "@/hooks/usePreferencias";

export default function SettingsScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);

    const { userId } = useAuth();
    // Preferências que moram no banco (o hook já faz o autosave debounced).
    const { prefs, alternar } = usePreferencias(userId);

    const [vibrationEnabled, setVibrationEnabled] = useState(true);
    const [testModeEnabled, setTestModeEnabled] = useState(false);

    useEffect(() => {
        const fetchPreferences = async () => {
            const pref = await AsyncStorage.getItem("@app_preferences_vibration");
            if (pref !== null) {
                setVibrationEnabled(pref === "true");
            }
            setTestModeEnabled(await carregarModoTeste());
            setLoading(false);
        };
        fetchPreferences();
    }, []);

    const toggleVibration = async (val: boolean) => {
        setVibrationEnabled(val);
        await AsyncStorage.setItem("@app_preferences_vibration", String(val));
    };

    const toggleTestMode = async (val: boolean) => {
        setTestModeEnabled(val);
        // Passa pelo serviço para a escala em memória mudar junto com a preferência salva:
        // as telas que calculam tempo ao vivo leem essa escala de forma síncrona.
        await definirModoTeste(val);
    };

    const handleClearCache = () => {
        confirm({
            title: "Limpar Dados Locais",
            message: "Isso apagará suas estatísticas simuladas (heatmap, horas falsas) e o histórico local. Deseja continuar?",
            confirmText: "Limpar",
            destructive: true,
            onConfirm: async () => {
                await AsyncStorage.removeItem("@app_preferences_vibration");
                await definirModoTeste(false);
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
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top"]}>
            {/* Header */}
            <View
                style={{
                    paddingTop: 6,
                    paddingHorizontal: 20,
                    paddingBottom: 14,
                    flexDirection: "row",
                    alignItems: "center",
                }}
            >
                <TouchableOpacity
                    onPress={() => router.back()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ marginRight: 12 }}
                >
                    <ChevronLeft size={22} color={HADES.textSecondary} />
                </TouchableOpacity>
                <Text style={{ fontSize: 20, fontWeight: "700", color: HADES.text }}>Configurações</Text>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
                showsVerticalScrollIndicator={false}
            >

                {/* Preferências */}
                <SecaoConfig titulo="PREFERÊNCIAS">
                    <LinhaSwitch
                        rotulo="Vibração em alertas"
                        descricao="Vibrar ao desbloquear medalhas"
                        ligado={vibrationEnabled}
                        onToggle={() => toggleVibration(!vibrationEnabled)}
                    />
                    <LinhaSwitch
                        rotulo="Anotar ao fim da sessão"
                        descricao="Abrir os campos de anotação assim que o quiz terminar. Desligado, dá pra anotar depois pela sessão salva."
                        ligado={prefs.anotarAposQuiz}
                        onToggle={() => alternar("anotarAposQuiz")}
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
                        <Text style={{ fontSize: 14, color: HADES.textMuted }}>1.0.0 (Beta)</Text>
                    </View>
                </SecaoConfig>
            </ScrollView>
        </SafeAreaView>
    );
}

function SettingsSkeleton() {
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top"]}>
            <View
                style={{
                    paddingTop: 6,
                    paddingHorizontal: 20,
                    paddingBottom: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                }}
            >
                <Skeleton width={22} height={22} borderRadius={6} />
                <Skeleton width={140} height={20} />
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
                showsVerticalScrollIndicator={false}
            >
                <Skeleton width="100%" height={64} borderRadius={14} style={{ marginBottom: 20 }} />
                <Skeleton width="100%" height={170} borderRadius={14} />
            </ScrollView>
        </SafeAreaView>
    );
}
