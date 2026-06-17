import { useState, useEffect, useRef } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    AppState,
    Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    BookOpen,
    ChevronDown,
    Globe,
    Lock,
    Pause,
    Play,
    Plus,
    Square,
    ToggleLeft,
    ToggleRight,
    X,
} from "lucide-react-native";

import { COLORS } from "@/constants/colors";
import { useAuth } from "@/hooks/useAuth";
import { useSessoesUsuario } from "@/hooks/useSessoesFoco";
import { useMaterias } from "@/hooks/useMaterias";
import { useArchives } from "@/hooks/useArchives";
import { carregarUltimoGrupoLocalmente } from "@/services/armazenamentoOffline";

import * as Notifications from "expo-notifications";

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

const FlipDigit = ({ value, label }: { value: string; label: string }) => (
    <View className="flex-1">
        <View
            className="h-32 rounded-[28px] items-center justify-center overflow-hidden border"
            style={{
                backgroundColor: "#1f1f1f",
                borderColor: "rgba(255,255,255,0.06)",
            }}
        >
            <View className="absolute left-0 right-0 top-1/2 h-px bg-black" />
            <View className="absolute left-0 right-0 top-0 h-1/2 bg-white/5" />
            <Text
                className="font-black text-slate-200"
                style={{ fontSize: 58, lineHeight: 68 }}
            >
                {value}
            </Text>
        </View>
        <Text className="mt-2 text-center text-[10px] font-bold uppercase text-slate-600">
            {label}
        </Text>
    </View>
);

export default function FocusScreen() {
    const [focusState, setFocusState] = useState<FocusState>("config");
    const [isPublicSession, setIsPublicSession] = useState(true);
    const [selectedSubject, setSelectedSubject] = useState("");
    const [specificContent, setSpecificContent] = useState("");
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
    const [showSubjectSheet, setShowSubjectSheet] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef<number | null>(null);
    const pausedSecondsRef = useRef<number>(0);

    const { userId, user } = useAuth();
    const { pendingSessions } = useSessoesUsuario(userId);
    const { archives } = useArchives(userId || undefined);
    const { materias } = useMaterias(userId);
    const params = useLocalSearchParams();
    const router = useRouter();

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

    useEffect(() => {
        const requestPermissions = async () => {
            const { status } = await Notifications.getPermissionsAsync() as any;
            if (status !== "granted") {
                await Notifications.requestPermissionsAsync();
            }
        };
        requestPermissions();
    }, []);

    useEffect(() => {
        if (params.autoStart === "true" && params.reviewSessionId) {
            setSelectedSubject(params.subject as string);
            setSpecificContent(params.content as string);
            setFocusState("active");
            setTimerSeconds(0);
        }
    }, [params.autoStart, params.reviewSessionId, params.subject, params.content]);

    useEffect(() => {
        const subscription = AppState.addEventListener("change", (nextAppState) => {
            if (nextAppState === "active" && startTimeRef.current && !isPaused) {
                const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
                setTimerSeconds(elapsed);
            }
        });
        return () => subscription.remove();
    }, [isPaused]);

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

    const formatTimeParts = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return {
            hrs: hrs.toString().padStart(2, "0"),
            mins: mins.toString().padStart(2, "0"),
            secs: secs.toString().padStart(2, "0"),
        };
    };

    const addOneMinute = async () => {
        const nextSeconds = timerSeconds + 60;
        setTimerSeconds(nextSeconds);
        pausedSecondsRef.current = nextSeconds;

        if (startTimeRef.current && !isPaused) {
            const nextStartTime = startTimeRef.current - 60000;
            startTimeRef.current = nextStartTime;
            await AsyncStorage.setItem(STORAGE_KEY_START_TIME, nextStartTime.toString());
        }
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
            if (!user) return;

            const activeGroupId = currentGroupId || await carregarUltimoGrupoLocalmente();
            setCurrentGroupId(activeGroupId);

            const disciplinaBusca = selectedSubject
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "");

            const count = archives.filter(f => {
                if (!f.disciplina) return false;
                const fileSubject = f.disciplina.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                return fileSubject === disciplinaBusca;
            }).length;

            if (count && count > 0) {
                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: "Materiais Disponíveis",
                        body: `Você tem ${count} ${count === 1 ? "arquivo" : "arquivos"} de ${selectedSubject} no seu Vault!`,
                    },
                    trigger: null,
                });

                Alert.alert(
                    "Materiais Disponíveis",
                    `Você tem ${count} ${count === 1 ? "arquivo" : "arquivos"} de ${selectedSubject} no seu Vault. Deseja revisar antes de focar?`,
                    [
                        {
                            text: "Agora não", onPress: async () => {
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
                                router.push("/(tabs)/vault");
                            }
                        }
                    ]
                );
            } else {
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
            pausedSecondsRef.current = timerSeconds;
            if (intervalRef.current) clearInterval(intervalRef.current);
            setIsPaused(true);
        }
    };

    const stopSession = async () => {
        setFocusState("config");

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

        try {
            await AsyncStorage.multiRemove([STORAGE_KEY_START_TIME, STORAGE_KEY_SESSION_DATA]);
        } catch (e) {
            console.warn("Erro ao limpar sessão:", e);
        }

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

    const timeParts = formatTimeParts(timerSeconds);

    return (
        <SafeAreaView className="flex-1 bg-black" edges={["top"]}>
            {focusState === "config" ? (
                <>
                    <ScrollView
                        className="flex-1"
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
                    >
                        <View className="pt-6 pb-8">
                            <Text className="text-4xl font-black text-slate-100">Foco</Text>
                            <Text className="mt-2 text-base text-slate-500">
                                Monte uma sessão limpa antes de começar.
                            </Text>
                        </View>

                        <View className="rounded-[28px] border border-white/10 bg-[#151515] p-5">
                            <View className="mb-6 flex-row items-center justify-between">
                                <View>
                                    <Text className="text-sm font-semibold uppercase text-slate-500">
                                        Sessão de estudo
                                    </Text>
                                    <Text className="mt-1 text-2xl font-bold text-slate-100">
                                        Preparar foco
                                    </Text>
                                </View>
                                <View className="h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/15">
                                    <BookOpen size={23} color={COLORS.primary} />
                                </View>
                            </View>

                            <TouchableOpacity
                                onPress={() => setShowSubjectSheet(true)}
                                activeOpacity={0.8}
                                className="mb-4 rounded-2xl border border-white/10 bg-[#202020] px-4 py-4"
                            >
                                <Text className="mb-2 text-xs font-bold uppercase text-slate-500">Matéria</Text>
                                <View className="flex-row items-center justify-between gap-3">
                                    <Text
                                        className={`flex-1 text-lg font-semibold ${selectedSubject ? "text-slate-100" : "text-slate-500"}`}
                                        numberOfLines={1}
                                    >
                                        {selectedSubject || "Selecionar matéria"}
                                    </Text>
                                    <ChevronDown size={22} color={COLORS.primary} />
                                </View>
                            </TouchableOpacity>

                            <View className="mb-4">
                                <Text className="mb-2 text-xs font-bold uppercase text-slate-500">
                                    Conteúdo específico
                                </Text>
                                <TextInput
                                    value={specificContent}
                                    onChangeText={setSpecificContent}
                                    placeholder="ex.: Capítulo 5: Derivadas"
                                    placeholderTextColor={COLORS.textMuted}
                                    className="rounded-2xl border border-white/10 bg-[#202020] px-4 py-4 text-base text-slate-100"
                                />
                            </View>

                            <View className="mb-6 flex-row items-center justify-between rounded-2xl border border-white/10 bg-[#202020] p-4">
                                <View className="flex-1 pr-3">
                                    <View className="flex-row items-center gap-2">
                                        {isPublicSession ? (
                                            <Globe size={16} color={COLORS.primary} />
                                        ) : (
                                            <Lock size={16} color={COLORS.textMuted} />
                                        )}
                                        <Text className="text-sm font-semibold text-slate-100">
                                            {isPublicSession ? "Sessão pública" : "Sessão privada"}
                                        </Text>
                                    </View>
                                    <Text className="mt-1 text-xs text-slate-500">
                                        {isPublicSession ? "Outros podem entrar e ver a atividade." : "Apenas você verá essa sessão."}
                                    </Text>
                                </View>
                                <TouchableOpacity onPress={() => setIsPublicSession(!isPublicSession)}>
                                    {isPublicSession ? (
                                        <ToggleRight size={34} color={COLORS.primary} />
                                    ) : (
                                        <ToggleLeft size={34} color={COLORS.textMuted} />
                                    )}
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                onPress={startSession}
                                activeOpacity={0.85}
                                className="flex-row items-center justify-center gap-2 rounded-2xl bg-brand-500 py-4"
                                style={{
                                    shadowColor: COLORS.primary,
                                    shadowOffset: { width: 0, height: 8 },
                                    shadowOpacity: 0.28,
                                    shadowRadius: 16,
                                    elevation: 8,
                                }}
                            >
                                <Play size={20} color={COLORS.black} />
                                <Text className="text-lg font-black text-black">Iniciar sessão</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>

                    <Modal
                        visible={showSubjectSheet}
                        transparent
                        animationType="slide"
                        onRequestClose={() => setShowSubjectSheet(false)}
                    >
                        <View className="flex-1 justify-end bg-black/70">
                            <View className="rounded-t-[32px] border-t border-white/10 bg-[#151515] px-5 pb-8 pt-4">
                                <View className="mb-5 flex-row items-center justify-between">
                                    <View>
                                        <Text className="text-xs font-bold uppercase text-slate-500">Matérias</Text>
                                        <Text className="text-xl font-bold text-slate-100">Escolha a sessão</Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => setShowSubjectSheet(false)}
                                        className="h-10 w-10 items-center justify-center rounded-full bg-white"
                                    >
                                        <X size={20} color={COLORS.black} />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
                                    {materias.map((materia) => {
                                        const isSelected = selectedSubject === materia.nomeExibicao;
                                        return (
                                            <TouchableOpacity
                                                key={materia.nomeNormalizado}
                                                onPress={() => {
                                                    setSelectedSubject(isSelected ? "" : materia.nomeExibicao);
                                                    setShowSubjectSheet(false);
                                                }}
                                                activeOpacity={0.75}
                                                className={`mb-3 flex-row items-center justify-between rounded-2xl border px-4 py-4 ${
                                                    isSelected ? "border-brand-500 bg-brand-500/15" : "border-white/10 bg-[#202020]"
                                                }`}
                                            >
                                                <Text className="text-base font-semibold text-slate-100">
                                                    {materia.nomeExibicao}
                                                </Text>
                                                <View
                                                    className={`h-4 w-4 rounded-full border ${
                                                        isSelected ? "border-brand-500 bg-brand-500" : "border-slate-600"
                                                    }`}
                                                />
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>

                                <TouchableOpacity
                                    onPress={() => {
                                        setShowSubjectSheet(false);
                                        router.push("/(modals)/criar-materia");
                                    }}
                                    className="mt-2 flex-row items-center justify-center gap-2 rounded-2xl border border-dashed border-brand-500/60 py-4"
                                >
                                    <Plus size={18} color={COLORS.primary} />
                                    <Text className="font-bold text-brand-400">Nova matéria</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Modal>
                </>
            ) : (
                <View className="flex-1 px-5 pb-8 pt-5">
                    <View className="flex-row items-center justify-between">
                        <TouchableOpacity
                            onPress={stopSession}
                            className="h-11 w-11 items-center justify-center rounded-full bg-white"
                        >
                            <X size={23} color={COLORS.black} />
                        </TouchableOpacity>
                        <View className="items-end">
                            <Text className="text-xs font-bold uppercase text-slate-600">
                                {isPaused ? "Pausado" : "Em andamento"}
                            </Text>
                            <Text className="text-sm font-semibold text-brand-400">
                                {selectedSubject || "Estudo geral"}
                            </Text>
                        </View>
                    </View>

                    <View className="flex-1 justify-center">
                        <View className="mb-8 rounded-full border border-white/10 bg-white/5 px-5 py-3 self-center">
                            <Text className="text-center text-sm font-semibold text-slate-400" numberOfLines={1}>
                                {specificContent || "Sessão livre"}
                            </Text>
                        </View>

                        <View className="gap-4">
                            <View className="flex-row gap-4">
                                <FlipDigit value={timeParts.hrs} label="horas" />
                                <FlipDigit value={timeParts.mins} label="min" />
                            </View>
                            <View className="flex-row gap-4">
                                <FlipDigit value={timeParts.secs} label="seg" />
                                <View className="flex-1 justify-center rounded-[28px] border border-white/10 bg-[#151515] p-5">
                                    <Text className="text-xs font-bold uppercase text-slate-600">
                                        Visibilidade
                                    </Text>
                                    <Text className="mt-2 text-lg font-bold text-slate-100">
                                        {isPublicSession ? "Pública" : "Privada"}
                                    </Text>
                                    <View className="mt-4 flex-row items-center gap-2">
                                        <View
                                            className={`h-2 w-2 rounded-full ${isPublicSession ? "bg-brand-500" : "bg-slate-500"}`}
                                        />
                                        <Text className="text-xs text-slate-500">
                                            {isPublicSession ? "feed ativo" : "somente você"}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>

                    <View className="self-center rounded-full border border-white/10 bg-[#211f29] p-2">
                        <View className="flex-row items-center gap-2">
                            <TouchableOpacity
                                onPress={addOneMinute}
                                className="h-14 w-14 items-center justify-center rounded-full bg-white"
                            >
                                <Text className="text-base font-black text-slate-900">+1</Text>
                            </TouchableOpacity>
                            <View className="h-9 w-px bg-white/10" />
                            <TouchableOpacity
                                onPress={togglePause}
                                className="h-14 w-14 items-center justify-center rounded-full bg-brand-500"
                            >
                                {isPaused ? (
                                    <Play size={22} color={COLORS.black} />
                                ) : (
                                    <Pause size={22} color={COLORS.black} />
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={stopSession}
                                className="h-14 w-14 items-center justify-center rounded-full bg-white"
                            >
                                <Square size={20} color={COLORS.black} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}
        </SafeAreaView>
    );
}
