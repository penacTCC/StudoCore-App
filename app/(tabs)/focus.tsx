import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { View, Text, TouchableOpacity, Alert, AppState } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Play } from "lucide-react-native";
import * as Notifications from "expo-notifications";

import { HADES } from "@/constants/hades";
import { CONFIG_POMODORO_PADRAO } from "@/constants/foco";
import { useAuth } from "@/hooks/useAuth";
import { useSessoesUsuario } from "@/hooks/useSessoesFoco";
import { useMaterias } from "@/hooks/useMaterias";
import { useArchives } from "@/hooks/useArchives";
import { carregarUltimoGrupoLocalmente } from "@/services/armazenamentoOffline";
import ConfigSessao, { SeletorModo } from "@/components/focus/ConfigSessao";
import BloqueioFeedback from "@/components/focus/BloqueioFeedback";
import SheetVault from "@/components/focus/SheetVault";
import SessaoAtiva from "@/components/focus/SessaoAtiva";
import { FaixaBlocoCronograma, FaixaSessaoRestaurada } from "@/components/focus/PecasFoco";
import type { ArquivoDetalhe } from "@/types/archives";
import type { SessaoFocoRow } from "@/types/sessions";
import type { ConfigPomodoro, ContextoBloco, EstadoFoco, FaseFoco, ModoFoco } from "@/types/foco";

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

/** Remove acentos e caixa para comparar nomes de matéria com o Vault. */
function normalizar(texto: string) {
    return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
}

function formatarHMS(segundos: number) {
    const h = Math.floor(segundos / 3600);
    const m = Math.floor((segundos % 3600) / 60);
    const s = segundos % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s
        .toString()
        .padStart(2, "0")}`;
}

function formatarMS(segundos: number) {
    const m = Math.floor(Math.max(0, segundos) / 60);
    const s = Math.max(0, segundos) % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatarHora(timestamp: number) {
    const d = new Date(timestamp);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export default function FocusScreen() {
    const [focusState, setFocusState] = useState<EstadoFoco>("config");
    const [modo, setModo] = useState<ModoFoco>("cronometro");
    const [isPublicSession, setIsPublicSession] = useState(true);
    const [selectedSubject, setSelectedSubject] = useState("");
    const [specificContent, setSpecificContent] = useState("");
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
    const [configPomodoro, setConfigPomodoro] = useState<ConfigPomodoro>(CONFIG_POMODORO_PADRAO);
    const [fase, setFase] = useState<FaseFoco>("foco");
    const [ciclo, setCiclo] = useState(1);
    const [restanteFase, setRestanteFase] = useState(0);
    const [contexto, setContexto] = useState<ContextoBloco | null>(null);
    const [restaurada, setRestaurada] = useState(false);
    const [arquivosVault, setArquivosVault] = useState<ArquivoDetalhe[] | null>(null);

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef<number | null>(null);
    const pausedSecondsRef = useRef<number>(0);
    // Pomodoro: início da fase atual e foco já acumulado nos ciclos anteriores.
    const faseInicioRef = useRef<number | null>(null);
    const focoAcumuladoRef = useRef<number>(0);
    const faseDuracaoRef = useRef<number>(0);

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

    const bloqueadoPorFeedback = pendingSessions.length > 0 && !params.reviewSessionId;

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
                    // Sessões salvas antes do pomodoro não têm modo: caem no cronômetro.
                    setModo(sessionData.modo === "pomodoro" ? "pomodoro" : "cronometro");
                    setTimerSeconds(elapsed);
                    setFocusState("ativo");
                    setRestaurada(true);
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
            const { status } = (await Notifications.getPermissionsAsync()) as any;
            if (status !== "granted") {
                await Notifications.requestPermissionsAsync();
            }
        };
        requestPermissions();
    }, []);

    // Sessão iniciada a partir de um bloco do cronograma.
    useEffect(() => {
        if (params.blocoId && params.subject) {
            setContexto({
                blocoId: params.blocoId as string,
                materia: params.subject as string,
                topico: (params.content as string) || "",
                fimEm: (params.fimEm as string) || "",
            });
            setSelectedSubject(params.subject as string);
            setSpecificContent((params.content as string) || "");
            setModo("pomodoro");
            const duracao = params.duracaoMin ? parseInt(params.duracaoMin as string, 10) : null;
            if (duracao) {
                setConfigPomodoro((c) => ({ ...c, focoMin: duracao }));
            }
        }
    }, [params.blocoId, params.subject, params.content, params.fimEm, params.duracaoMin]);

    // Auto-start for review sessions
    useEffect(() => {
        if (params.autoStart === "true" && params.reviewSessionId) {
            setSelectedSubject(params.subject as string);
            setSpecificContent(params.content as string);
            setFocusState("ativo");
            setTimerSeconds(0);
        }
    }, [params.autoStart, params.reviewSessionId, params.subject, params.content]);

    // Timer com setInterval (atualiza a cada segundo enquanto em foreground)
    useEffect(() => {
        if (focusState === "ativo" && !isPaused) {
            intervalRef.current = setInterval(() => {
                if (modo === "cronometro") {
                    if (startTimeRef.current) {
                        setTimerSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
                    }
                    return;
                }

                if (faseInicioRef.current) {
                    const decorrido = Math.floor((Date.now() - faseInicioRef.current) / 1000);
                    setRestanteFase(faseDuracaoRef.current - decorrido);
                }
            }, 1000);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [focusState, isPaused, modo]);

    // Recalcula o tempo quando o app volta do background
    useEffect(() => {
        const subscription = AppState.addEventListener("change", (nextAppState) => {
            if (nextAppState !== "active" || isPaused) return;

            if (modo === "cronometro" && startTimeRef.current) {
                setTimerSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
                return;
            }

            if (modo === "pomodoro" && faseInicioRef.current) {
                const decorrido = Math.floor((Date.now() - faseInicioRef.current) / 1000);
                setRestanteFase(faseDuracaoRef.current - decorrido);
            }
        });
        return () => subscription.remove();
    }, [isPaused, modo]);

    const duracaoDaFase = useCallback(
        (f: FaseFoco) => {
            if (f === "foco") return configPomodoro.focoMin * 60;
            if (f === "descansoCurto") return configPomodoro.descansoCurtoMin * 60;
            return configPomodoro.descansoLongoMin * 60;
        },
        [configPomodoro]
    );

    const iniciarFase = useCallback(
        (novaFase: FaseFoco) => {
            const duracao = duracaoDaFase(novaFase);
            faseDuracaoRef.current = duracao;
            faseInicioRef.current = Date.now();
            setFase(novaFase);
            setRestanteFase(duracao);
        },
        [duracaoDaFase]
    );

    // Avanço automático de fase quando o tempo acaba.
    useEffect(() => {
        if (focusState !== "ativo" || modo !== "pomodoro" || isPaused) return;
        if (restanteFase > 0) return;

        if (fase === "foco") {
            focoAcumuladoRef.current += faseDuracaoRef.current;
            const fechaCiclo = ciclo % configPomodoro.ciclosAteLongo === 0;
            iniciarFase(fechaCiclo ? "descansoLongo" : "descansoCurto");
        } else {
            setCiclo((c) => c + 1);
            iniciarFase("foco");
        }
    }, [restanteFase, fase, focusState, modo, isPaused, ciclo, configPomodoro.ciclosAteLongo, iniciarFase]);

    const persistirSessao = async (inicio: number, grupoId: string | null) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEY_START_TIME, inicio.toString());
            await AsyncStorage.setItem(
                STORAGE_KEY_SESSION_DATA,
                JSON.stringify({
                    subject: selectedSubject,
                    content: specificContent,
                    isPublic: isPublicSession,
                    groupId: grupoId,
                    modo,
                })
            );
        } catch (e) {
            console.warn("Erro ao salvar sessão:", e);
        }
    };

    const realmenteIniciar = async (grupoId: string | null) => {
        const now = Date.now();
        startTimeRef.current = now;
        focoAcumuladoRef.current = 0;
        setCiclo(1);
        await persistirSessao(now, grupoId);
        setFocusState("ativo");
        setTimerSeconds(0);
        setRestaurada(false);
        if (modo === "pomodoro") iniciarFase("foco");
    };

    const startSession = async () => {
        if (!selectedSubject || !specificContent.trim()) {
            Alert.alert(
                "Incompleto",
                "Por favor, selecione uma matéria e informe o conteúdo específico antes de iniciar."
            );
            return;
        }

        if (bloqueadoPorFeedback) return;

        try {
            if (!user) return;

            // Garante o grupo ativo mesmo se o estado ainda não tiver terminado de carregar do AsyncStorage.
            const activeGroupId = currentGroupId || (await carregarUltimoGrupoLocalmente());
            setCurrentGroupId(activeGroupId);

            const disciplinaBusca = normalizar(selectedSubject);
            const doVault = archives.filter(
                (f) => f.disciplina && normalizar(f.disciplina) === disciplinaBusca
            );

            if (doVault.length > 0) {
                /*
                a biblioteca Expo Go removeu o suporte a notificações push remotas a partir do SDK 53
                A biblioteca expo-notifications continua funcionando, porém não dentro do Expo Go.
                */
                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: "📚 Materiais Disponíveis",
                        body: `Você tem ${doVault.length} ${doVault.length === 1 ? "arquivo" : "arquivos"} de ${selectedSubject} no seu Vault!`,
                    },
                    trigger: null,
                });

                setArquivosVault(doVault);
                return;
            }

            await realmenteIniciar(activeGroupId);
        } catch (error) {
            console.error("Erro ao verificar vault:", error);
            // Inicia mesmo se houver erro na busca
            const fallbackGroupId = currentGroupId || (await carregarUltimoGrupoLocalmente());
            setCurrentGroupId(fallbackGroupId);
            await realmenteIniciar(fallbackGroupId);
        }
    };

    const togglePause = async () => {
        if (isPaused) {
            const now = Date.now();

            if (modo === "cronometro") {
                const newStartTime = now - pausedSecondsRef.current * 1000;
                startTimeRef.current = newStartTime;
                try {
                    await AsyncStorage.setItem(STORAGE_KEY_START_TIME, newStartTime.toString());
                } catch (e) {
                    console.warn("Erro ao salvar sessão:", e);
                }
            } else {
                // Retoma a fase de onde parou.
                faseInicioRef.current = now - (faseDuracaoRef.current - pausedSecondsRef.current) * 1000;
            }

            setIsPaused(false);
            return;
        }

        pausedSecondsRef.current = modo === "cronometro" ? timerSeconds : restanteFase;
        if (intervalRef.current) clearInterval(intervalRef.current);
        setIsPaused(true);
    };

    /** Tempo de foco que vira sessão. Descanso nunca entra na conta. */
    const segundosDeFoco = () => {
        if (modo === "cronometro") return timerSeconds;
        const naFase =
            fase === "foco" && faseInicioRef.current
                ? Math.min(faseDuracaoRef.current, Math.floor((Date.now() - faseInicioRef.current) / 1000))
                : 0;
        return focoAcumuladoRef.current + naFase;
    };

    const stopSession = async () => {
        setFocusState("config");

        // Salva uma cópia dos valores antes de resetar
        const finalSubject = selectedSubject;
        const finalContent = specificContent;
        const finalDuration = segundosDeFoco();
        const finalIsPublic = isPublicSession;
        const finalGroupId = currentGroupId || (await carregarUltimoGrupoLocalmente());

        setTimerSeconds(0);
        setSelectedSubject("");
        setSpecificContent("");
        startTimeRef.current = null;
        pausedSecondsRef.current = 0;
        faseInicioRef.current = null;
        focoAcumuladoRef.current = 0;
        setIsPaused(false);
        setFase("foco");
        setCiclo(1);
        setContexto(null);
        setRestaurada(false);

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
            },
        });
    };

    /**
     * Abre o formulário de uma sessão pendente.
     * Usa o mesmo contrato de params do brain.tsx: `oldDuration` em minutos e
     * `duration` zerado, já que o tempo da sessão já foi contabilizado.
     */
    const abrirFormulario = (sessao: SessaoFocoRow) =>
        router.push({
            pathname: "/(modals)/focus-feedback",
            params: {
                sessionId: sessao.id,
                subject: sessao.disciplina,
                content: sessao.conteudo_especifico || "",
                oldDuration: sessao.tempo_minutos.toString(),
                duration: "0",
                isPublic: sessao.is_public.toString(),
                groupId: sessao.grupo_id ?? undefined,
            },
        });

    const pularDescanso = () => {
        setCiclo((c) => c + 1);
        iniciarFase("foco");
    };

    const estenderFoco = () => {
        faseDuracaoRef.current += 5 * 60;
        setRestanteFase((r) => r + 5 * 60);
    };

    const textoRelogio =
        modo === "cronometro" ? formatarHMS(timerSeconds) : formatarMS(restanteFase);

    const progressoFase =
        faseDuracaoRef.current > 0 ? 1 - restanteFase / faseDuracaoRef.current : 0;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top"]}>
            {focusState === "config" ? (
                <>
                    <View style={{ paddingTop: 6, paddingHorizontal: 20, paddingBottom: 14 }}>
                        <Text
                            style={{ fontSize: 23, fontWeight: "700", color: HADES.text, letterSpacing: -0.3 }}
                        >
                            Foco
                        </Text>
                    </View>

                    {bloqueadoPorFeedback ? (
                        <BloqueioFeedback
                            sessoes={pendingSessions}
                            onResponder={abrirFormulario}
                            onResponderTodos={() => {
                                const primeira = pendingSessions[0];
                                if (primeira) abrirFormulario(primeira);
                            }}
                        />
                    ) : (
                        <>
                            <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
                                <SeletorModo modo={modo} onChange={setModo} />
                            </View>

                            <ConfigSessao
                                modo={modo}
                                materias={materias}
                                materiaSelecionada={selectedSubject}
                                onSelecionarMateria={setSelectedSubject}
                                onNovaMateria={() => router.push("/(modals)/criar-materia")}
                                conteudo={specificContent}
                                onChangeConteudo={setSpecificContent}
                                publica={isPublicSession}
                                onChangeVisibilidade={setIsPublicSession}
                                config={configPomodoro}
                                onChangeConfig={setConfigPomodoro}
                            />

                            <View style={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: 12 }}>
                                <TouchableOpacity
                                    onPress={startSession}
                                    activeOpacity={0.85}
                                    style={{
                                        height: 54,
                                        borderRadius: 15,
                                        backgroundColor: HADES.accentSolid,
                                        flexDirection: "row",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 9,
                                    }}
                                >
                                    <Play size={19} color="#000" fill="#000" />
                                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#000" }}>
                                        Iniciar foco
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </>
            ) : (
                <>
                    {contexto && (
                        <FaixaBlocoCronograma contexto={contexto} onTrocar={() => setContexto(null)} />
                    )}
                    {restaurada && !contexto && <FaixaSessaoRestaurada />}

                    <SessaoAtiva
                        modo={modo}
                        fase={fase}
                        pausado={isPaused}
                        materia={selectedSubject}
                        conteudo={specificContent}
                        publica={isPublicSession}
                        textoRelogio={textoRelogio}
                        progressoFase={progressoFase}
                        ciclo={ciclo}
                        totalCiclos={configPomodoro.ciclosAteLongo}
                        contexto={contexto}
                        autoFoco
                        colegas={null}
                        iniciadaEm={
                            restaurada && startTimeRef.current ? formatarHora(startTimeRef.current) : null
                        }
                        onPausar={togglePause}
                        onEncerrar={stopSession}
                        onEstender={estenderFoco}
                        onPularDescanso={pularDescanso}
                        onConcluirBloco={stopSession}
                    />
                </>
            )}

            <SheetVault
                visivel={arquivosVault !== null}
                materia={selectedSubject}
                arquivos={arquivosVault ?? []}
                onVerMateriais={() => {
                    setArquivosVault(null);
                    router.push("/(tabs)/vault");
                }}
                onAgoraNao={async () => {
                    setArquivosVault(null);
                    await realmenteIniciar(currentGroupId);
                }}
            />
        </SafeAreaView>
    );
}
