import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    AppState,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

//Componentes do Lucide Native
import {
    Play,
    Pause,
    Square,
    ToggleLeft,
    ToggleRight,
    Plus,
} from "lucide-react-native";

//Constantes
import { COLORS } from "@/constants/colors";
import { useAuth } from "@/hooks/useAuth";
import { useSessoesUsuario } from "@/hooks/useSessoesFoco";
import { useMaterias } from "@/hooks/useMaterias";
import { useArchives } from "@/hooks/useArchives";
import { carregarUltimoGrupoLocalmente } from "@/services/armazenamentoOffline";


import * as Notifications from 'expo-notifications';
// Configurar o comportamento das notificações (necessário para mostrar enquanto o app está aberto)
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});


const STORAGE_KEY_START_TIME = "@focus_session_start_time";
const STORAGE_KEY_SESSION_DATA = "@focus_session_data";

type FocusState = "config" | "active";

export default function FocusScreen() {
    const [focusState, setFocusState] = useState<FocusState>("config");
    const [isPublicSession, setIsPublicSession] = useState(true);
    const [selectedSubject, setSelectedSubject] = useState("");
    const [specificContent, setSpecificContent] = useState("");
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef<number | null>(null);
    const pausedSecondsRef = useRef<number>(0);

    const { userId, user } = useAuth();
    const { pendingSessions } = useSessoesUsuario(userId);
    const { archives } = useArchives(userId || undefined);
    const { materias, recarregarMaterias } = useMaterias(userId);
    const params = useLocalSearchParams();
    const router = useRouter();
    const navigation = useNavigation();

    // Recarrega matérias sempre que a tela ganha foco (ex: ao voltar do modal de criar matéria)
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            recarregarMaterias();
        });
        return unsubscribe;
    }, [navigation, recarregarMaterias]);

    // Carrega o grupo atual a partir dos parâmetros da rota ou do último grupo salvo localmente.
    useEffect(() => {
        const loadCurrentGroup = async () => {
            const routeGroupId = Array.isArray(params.groupId) ? params.groupId[0] : params.groupId;
            if (routeGroupId) {
                setCurrentGroupId(routeGroupId);
                return;
            }

            const storedGroupId = await carregarUltimoGrupoLocalmente();
            setCurrentGroupId(storedGroupId);
        };

        loadCurrentGroup();
    }, [params.groupId]);

    // Recupera sessão ativa ao abrir o app (caso tenha saído com timer rodando)
    useEffect(() => {
        const restoreSession = async () => {
            try {
                const savedStartTime = await AsyncStorage.getItem(STORAGE_KEY_START_TIME);
                const savedSessionData = await AsyncStorage.getItem(STORAGE_KEY_SESSION_DATA);
                if (savedStartTime && savedSessionData) {
                    const startTime = parseInt(savedStartTime, 10);
                    const sessionData = JSON.parse(savedSessionData);
                    const elapsed = Math.floor((Date.now() - startTime) / 1000);
                    startTimeRef.current = startTime;
                    setSelectedSubject(sessionData.subject || "");
                    setSpecificContent(sessionData.content || "");
                    setIsPublicSession(sessionData.isPublic ?? true);
                    setCurrentGroupId(sessionData.groupId || null);
                    setTimerSeconds(elapsed);
                    setFocusState("active");
                }
            } catch (e) {
                console.warn("Erro ao restaurar sessão:", e);
            }
        };
        restoreSession();
    }, []);

    // Solicitar permissão para notificações ao montar o componente
    useEffect(() => {
        const requestPermissions = async () => {
            const { status } = await Notifications.getPermissionsAsync() as any;
            if (status !== 'granted') {
                await Notifications.requestPermissionsAsync();
            }
        };
        requestPermissions();
    }, []);

    // Auto-start for review sessions
    useEffect(() => {
        if (params.autoStart === 'true' && params.reviewSessionId) {
            setSelectedSubject(params.subject as string);
            setSpecificContent(params.content as string);
            setFocusState("active");
            setTimerSeconds(0);
        }
    }, [params.autoStart, params.reviewSessionId, params.subject, params.content]);

    // Recalcula o tempo quando o app volta do background
    useEffect(() => {
        const subscription = AppState.addEventListener("change", (nextAppState) => {
            if (nextAppState === "active" && startTimeRef.current && !isPaused) {
                const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
                setTimerSeconds(elapsed);
            }
        });
        return () => subscription.remove();
    }, [isPaused]);

    // Timer com setInterval (atualiza a cada segundo enquanto em foreground)
    useEffect(() => {
        if (focusState === "active" && !isPaused) {
            intervalRef.current = setInterval(() => {
                if (startTimeRef.current) {
                    const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
                    setTimerSeconds(elapsed);
                }
            }, 1000);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [focusState, isPaused]);

    const formatTime = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    const startSession = async () => {
        if (!selectedSubject || !specificContent.trim()) {
            Alert.alert("Incompleto", "Por favor, selecione uma matéria e informe o conteúdo específico antes de iniciar.");
            return;
        }

        if (pendingSessions.length > 0 && !params.reviewSessionId) {
            Alert.alert("Aviso", "Responda os formulários pendentes!");
            return;
        }

        try {
            // Já temos o usuário carregado no corpo do componente
            if (!user) return;

            // Garante o grupo ativo mesmo se o estado ainda não tiver terminado de carregar do AsyncStorage.
            const activeGroupId = currentGroupId || await carregarUltimoGrupoLocalmente();
            setCurrentGroupId(activeGroupId);

            // Mapeia o nome da matéria para o formato usado no banco (minúsculo e sem acento, se necessário)
            const disciplinaBusca = selectedSubject
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, ""); // Remove acentos
            console.log("Disciplina: ", disciplinaBusca);

            // Conta quantos arquivos existem para essa matéria no Vault do usuário e nos grupos
            const count = archives.filter(f => {
                if (!f.disciplina) return false;
                const fileSubject = f.disciplina.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                return fileSubject === disciplinaBusca;
            }).length;
            console.log("Count: ", count);

            if (count && count > 0) {
                /*
                
                a biblioteca Expo Go removeu o suporte a notificações push remotas a partir do SDK 53
                A biblioteca expo-notifications continua funcionando, porém não dentro do Expo Go.
                */


                // Dispara a notificação de sistema imediatamente
                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: "📚 Materiais Disponíveis",
                        body: `Você tem ${count} ${count === 1 ? "arquivo" : "arquivos"} de ${selectedSubject} no seu Vault!`,
                    },
                    trigger: null, // null envia imediatamente
                });

                Alert.alert(
                    "Materiais Disponíveis",
                    `Você tem ${count} ${count === 1 ? "arquivo" : "arquivos"} de ${selectedSubject} no seu Vault. Deseja revisar antes de focar?`,
                    [
                        {
                            text: "Agora não", onPress: async () => {
                                // Salva o timestamp de início e dados da sessão no AsyncStorage
                                const now = Date.now();
                                startTimeRef.current = now;
                                try {
                                    await AsyncStorage.setItem(STORAGE_KEY_START_TIME, now.toString());
                                    await AsyncStorage.setItem(STORAGE_KEY_SESSION_DATA, JSON.stringify({
                                        subject: selectedSubject,
                                        content: specificContent,
                                        isPublic: isPublicSession,
                                        groupId: activeGroupId,
                                    }));
                                } catch (e) {
                                    console.warn("Erro ao salvar sessão:", e);
                                }
                                setFocusState("active");
                                setTimerSeconds(0);
                            }
                        },
                        {
                            text: "Ver Materiais", onPress: () => {
                                //Navegar para o Vault filtrado, 
                                router.push("/(tabs)/vault");
                            }
                        }
                    ]
                );
            } else {
                // Salva o timestamp de início e dados da sessão no AsyncStorage
                const now = Date.now();
                startTimeRef.current = now;
                try {
                    await AsyncStorage.setItem(STORAGE_KEY_START_TIME, now.toString());
                    await AsyncStorage.setItem(STORAGE_KEY_SESSION_DATA, JSON.stringify({
                        subject: selectedSubject,
                        content: specificContent,
                        isPublic: isPublicSession,
                        groupId: activeGroupId,
                    }));
                } catch (e) {
                    console.warn("Erro ao salvar sessão:", e);
                }
                setFocusState("active");
                setTimerSeconds(0);
            }
        } catch (error) {
            console.error("Erro ao verificar vault:", error);
            // Inicia mesmo se houver erro na busca
            const now = Date.now();
            startTimeRef.current = now;
            const fallbackGroupId = currentGroupId || await carregarUltimoGrupoLocalmente();
            setCurrentGroupId(fallbackGroupId);
            try {
                await AsyncStorage.setItem(STORAGE_KEY_START_TIME, now.toString());
                await AsyncStorage.setItem(STORAGE_KEY_SESSION_DATA, JSON.stringify({
                    subject: selectedSubject,
                    content: specificContent,
                    isPublic: isPublicSession,
                    groupId: fallbackGroupId,
                }));
            } catch (e) {
                console.warn("Erro ao salvar sessão:", e);
            }
            setFocusState("active");
            setTimerSeconds(0);
        }
    };

    const togglePause = async () => {
        if (isPaused) {
            // Retomar: cria um novo startTime baseado nos segundos acumulados
            const now = Date.now();
            const newStartTime = now - (pausedSecondsRef.current * 1000);
            startTimeRef.current = newStartTime;
            try {
                await AsyncStorage.setItem(STORAGE_KEY_START_TIME, newStartTime.toString());
            } catch (e) {
                console.warn("Erro ao salvar sessão:", e);
            }
            setIsPaused(false);
        } else {
            // Pausar: salva os segundos acumulados e para o interval
            pausedSecondsRef.current = timerSeconds;
            if (intervalRef.current) clearInterval(intervalRef.current);
            setIsPaused(true);
        }
    };

    const stopSession = async () => {
        setFocusState("config");

        // Salva uma cópia dos valores antes de resetar
        const finalSubject = selectedSubject;
        const finalContent = specificContent;
        const finalDuration = timerSeconds;
        const finalIsPublic = isPublicSession;
        const finalGroupId = currentGroupId || await carregarUltimoGrupoLocalmente();

        setTimerSeconds(0);
        setSelectedSubject("");
        setSpecificContent("");
        startTimeRef.current = null;
        pausedSecondsRef.current = 0;
        setIsPaused(false);

        if (intervalRef.current) clearInterval(intervalRef.current);

        // Limpa os dados salvos no AsyncStorage
        try {
            await AsyncStorage.multiRemove([STORAGE_KEY_START_TIME, STORAGE_KEY_SESSION_DATA]);
        } catch (e) {
            console.warn("Erro ao limpar sessão:", e);
        }

        // Abre o modal de feedback após a sessão passando os parâmetros
        router.push({
            pathname: "/(modals)/focus-feedback",
            params: {
                subject: finalSubject,
                content: finalContent,
                duration: finalDuration.toString(),
                isPublic: finalIsPublic.toString(),
                groupId: finalGroupId || undefined,
                sessionId: params.reviewSessionId || undefined,
                oldDuration: params.oldDuration || undefined,
            }
        });
    };


    return (
        <SafeAreaView className="flex-1 bg-slate-950" edges={["top"]}>
            {/* Header */}
            <View className="bg-slate-950 border-b border-slate-800 px-4 py-3">
                <Text className="text-xl font-bold text-slate-200">Modo de Foco</Text>
                <Text className="text-xs text-slate-500">{specificContent || "Sessão Livre"}</Text>
            </View>

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 32 }}
            >
                {focusState === "config" && (
                    <View className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                        <Text className="text-lg font-semibold text-slate-200 mb-6 text-center">
                            Configurar Sessão de Estudos
                        </Text>

                        {/* Subject Picker */}
                        <View className="mb-4">
                            <Text className="text-sm text-slate-400 mb-2">Matérias</Text>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ gap: 8 }}
                            >
                                {materias.map((materia) => (
                                    <TouchableOpacity
                                        key={materia.nomeNormalizado}
                                        onPress={() => setSelectedSubject(materia.nomeExibicao === selectedSubject ? "" : materia.nomeExibicao)}
                                        className={`px-4 py-2.5 rounded-xl border ${selectedSubject === materia.nomeExibicao
                                            ? "bg-violet-600 border-violet-500"
                                            : "bg-slate-800 border-slate-700"
                                            }`}
                                    >
                                        <Text
                                            className={`text-sm font-medium ${selectedSubject === materia.nomeExibicao ? "text-white" : "text-slate-300"
                                                }`}
                                        >
                                            {materia.nomeExibicao}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                            {/* Botão para criar nova matéria (abaixo do carrossel) */}
                            <TouchableOpacity
                                onPress={() => router.push("/(modals)/criar-materia")}
                                className="mt-2 px-4 py-2 rounded-xl border border-dashed border-violet-500/50 flex-row items-center justify-center gap-1.5 self-start"
                            >
                                <Plus size={14} color={COLORS.violetLight} />
                                <Text className="text-sm font-medium text-violet-400">Nova matéria</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Specific Content */}
                        <View className="mb-4">
                            <Text className="text-sm text-slate-400 mb-2">Conteúdo Específico</Text>
                            <TextInput
                                value={specificContent}
                                onChangeText={setSpecificContent}
                                placeholder="ex.: Capítulo 5: Derivadas"
                                placeholderTextColor={COLORS.textMuted}
                                className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 text-base"
                            />
                        </View>

                        {/* Session Visibility Toggle */}
                        <View className="flex-row items-center justify-between bg-slate-800/50 p-4 rounded-xl mb-6">
                            <View>
                                <Text className="text-sm font-medium text-slate-200">Visibilidade da Sessão</Text>
                                <Text className="text-xs text-slate-400">
                                    {isPublicSession ? "Outros podem entrar" : "Sessão privada"}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setIsPublicSession(!isPublicSession)}>
                                {isPublicSession ? (
                                    <ToggleRight size={32} color={COLORS.violetLight} />
                                ) : (
                                    <ToggleLeft size={32} color={COLORS.textMuted} />
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Start Button */}
                        <TouchableOpacity
                            onPress={startSession}
                            className="bg-violet-600 py-4 rounded-2xl flex-row items-center justify-center gap-2"
                            style={{
                                shadowColor: COLORS.violet,
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.3,
                                shadowRadius: 12,
                                elevation: 8,
                            }}
                        >
                            <Play size={20} color={COLORS.white} />
                            <Text className="text-white font-semibold text-lg">Iniciar Sessão</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {focusState === "active" && (
                    <View className="items-center justify-center">
                        {/* Subject info */}
                        <View className="mb-8 items-center">
                            <Text className="text-sm text-violet-400 font-medium mb-1">
                                {selectedSubject || "Estudo Geral"}
                            </Text>
                            <Text className="text-xs text-slate-500">
                                {specificContent || "Sessão Livre"}
                            </Text>
                        </View>

                        {/* Big Neon Clock */}
                        <View className="items-center justify-center mb-10">
                            <View
                                className="w-64 h-64 rounded-full items-center justify-center"
                                style={{
                                    backgroundColor: "rgba(15, 23, 42, 0.8)",
                                    borderWidth: 4,
                                    borderColor: "rgba(139, 92, 246, 0.5)",
                                    shadowColor: COLORS.violet,
                                    shadowOffset: { width: 0, height: 0 },
                                    shadowOpacity: 0.6,
                                    shadowRadius: 30,
                                    elevation: 15,
                                }}
                            >
                                <Text
                                    className="font-bold text-violet-400"
                                    style={{ fontSize: 42, letterSpacing: 2 }}
                                >
                                    {formatTime(timerSeconds)}
                                </Text>
                                <Text className="text-xs text-slate-500 mt-2 uppercase tracking-widest">
                                    {isPaused ? "Pausado" : "Elapsed"}
                                </Text>
                            </View>
                        </View>

                        {/* Visibility Badge */}
                        <View className="flex-row items-center gap-2 mb-8">
                            <View
                                className={`w-2 h-2 rounded-full ${isPublicSession ? "bg-emerald-400" : "bg-slate-500"
                                    }`}
                            />
                            <Text className="text-sm text-slate-400">
                                {isPublicSession ? "Sessão Pública" : "Sessão Privada"}
                            </Text>
                        </View>

                        {/* Pause & Stop Buttons */}
                        <View className="flex-row items-center gap-4">
                            <TouchableOpacity
                                onPress={togglePause}
                                className={`py-4 px-8 rounded-2xl flex-row items-center justify-center gap-2 ${isPaused ? "bg-violet-600" : "bg-amber-500/20 border border-amber-500"}`}
                            >
                                {isPaused ? (
                                    <>
                                        <Play size={20} color={COLORS.white} />
                                        <Text className="text-white font-semibold text-lg">Retomar</Text>
                                    </>
                                ) : (
                                    <>
                                        <Pause size={20} color="#f59e0b" />
                                        <Text className="text-amber-500 font-semibold text-lg">Pausar</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={stopSession}
                                className="bg-rose-500/20 border border-rose-500 py-4 px-8 rounded-2xl flex-row items-center justify-center gap-2"
                            >
                                <Square size={20} color={COLORS.rose} />
                                <Text className="text-rose-500 font-semibold text-lg">Parar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
