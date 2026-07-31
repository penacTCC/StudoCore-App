import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { View, Text, TouchableOpacity, AppState } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Play } from "lucide-react-native";
import * as Notifications from "expo-notifications";

import { HADES } from "@/constants/hades";
import { Skeleton } from "@/components/ui/Skeleton";
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
import type { ArquivoDetalhe } from "@/types/archives";
import type { SessaoFocoRow, SessionCardItem, MemberSession } from "@/types/sessions";
import { salvarSessaoFoco, atualizarSessaoFoco, fetchFocusSession, calculateFocusSessionMinutes, insertTabSessaoMembros, fetchSessionMembers, updateTabSessaoMembros } from "@/services/sessions";
import { observarIncentivosDaSessao, buscarIncentivosDaSessao } from "@/services/incentivos";
import { FaixaBlocoCronograma, FaixaSessaoRestaurada } from "@/components/focus/PecasFoco";
import { toast } from "@/services/toast";
import type { ConfigPomodoro, ContextoBloco, FocusState, FaseFoco, ModoFoco } from "@/types/foco";

// Configurar o comportamento das notificações (necessário para mostrar enquanto o app está aberto)
Notifications.setNotificationHandler({
    handleNotification: async () => ({
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

/**
     * formata o tempo em segundos para o formato HH:MM:SS
     * @param seconds 
     * @returns horas minutos e segundos
     */
function formatarHMS(segundos: number) {
    const h = Math.floor(segundos / 3600);
    const m = Math.floor((segundos % 3600) / 60);
    const s = segundos % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s
        .toString()
        .padStart(2, "0")}`;
}

/**
     * formata o tempo em segundos para o formato HH:MM
     * @param seconds 
     * @returns horas minutos
     */
function formatarMS(segundos: number) {
    const m = Math.floor(Math.max(0, segundos) / 60);
    const s = Math.max(0, segundos) % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/**
     * formata o tempo em segundos para o formato HH
     * @param timestamp 
     * @returns horas 
     */
function formatarHora(timestamp: number) {
    const d = new Date(timestamp);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export default function FocusScreen() {
    const [focusState, setFocusState] = useState<FocusState>("config");
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
    const { pendingSessions, loading: carregandoSessoesPendentes } = useSessoesUsuario(userId);
    const { archives } = useArchives(userId || undefined);
    const { materias, recarregarMaterias, carregando: carregandoMaterias } = useMaterias(userId);
    const params = useLocalSearchParams();
    const router = useRouter();
    const navigation = useNavigation();

    /**
     * Sessão enviada pelo SessionCard (quando o usuário clica em "Continuar sessão" no card do cronograma). O parâmetro é enviado como JSON stringificado na query da rota.
     */
    const { session: sessionParam, joinPublicSession } = useLocalSearchParams<{
        session?: string;
        joinPublicSession?: string;
    }>(); // parametros de sessão em grupo

    // Parse session data enviada pelo SessionCard.
    const parsedSession = useMemo<SessionCardItem | null>(() => {
        if (!sessionParam) return null;

        try {
            return JSON.parse(sessionParam as string) as SessionCardItem;
        } catch (error) {
            console.warn("Erro ao parsear sessão:", error);
            return null;
        }
    }, [sessionParam]);

    const [createdSession, setCreatedSession] = useState<SessionCardItem | null>(null);
    const [ignoreJoinSession, setIgnoreJoinSession] = useState(false);
    const session = createdSession || parsedSession;
    const isJoiningExistingPublicSession = joinPublicSession === "true" && !!parsedSession && !ignoreJoinSession;
    const hostName = session?.profiles?.nome_usuario || session?.profiles?.nome_real || "anfitrião";
    const hostInitial = hostName.trim().charAt(0).toUpperCase() || "A";

    useEffect(() => {
        if (joinPublicSession === "true") {
            setIgnoreJoinSession(false);
            setIsPublicSession(true);
        }
    }, [joinPublicSession]);

    useEffect(() => {
        if (isJoiningExistingPublicSession && parsedSession) {
            setSelectedSubject(parsedSession.disciplina || "");
            setSpecificContent(parsedSession.conteudo_especifico || "");
            setIsPublicSession(true);
            setModo("cronometro");
        }
    }, [isJoiningExistingPublicSession, parsedSession]);

    useEffect(() => {
        const carregarMembros = async () => {
            if (!session?.id) {
                setMembers([]);
                return;
            }

            const { data, error } = await fetchSessionMembers(session.id);
            if (error) {
                console.error("Erro ao carregar membros da sessão:", error);
                return;
            }

            setMembers((data || []) as MemberSession[]);
        };

        carregarMembros();
    }, [session?.id]);

    //estado dos membros da sessão
    const [members, setMembers] = useState<Array<MemberSession>>([]);

    const memberNames = useMemo(() => {
        return members.map((member) => {
            const profileName = member.profiles?.nome_usuario || member.profiles?.nome_real;
            return profileName || "Participante";
        });
    }, [members]);

    const [newUserTimer, setNewUserTimer] = useState<number>(0)

    // Quantidade de incentivos já recebidos, para mostrar a torcida durante a sessão.
    const [incentivosRecebidos, setIncentivosRecebidos] = useState(0);

    /*
      Avisa quem está focando que alguém mandou força. Usa notificação LOCAL (o mesmo
      recurso do aviso de materiais do Vault) porque o projeto ainda não tem push real:
      não há Expo Push Token, tabela de tokens nem FCM configurado. A limitação é que só
      dispara com o app vivo — o que cobre bem o caso de uso, já que durante uma sessão de
      foco o app costuma estar aberto.
    */
    useEffect(() => {
        const sessaoAtiva = session?.id;
        // Só sessão pública tem torcida: na privada a pessoa está estudando sozinha.
        if (!sessaoAtiva || focusState !== "active" || !userId || !isPublicSession) return;

        let cancelado = false;

        const sincronizarContador = async () => {
            const { data } = await buscarIncentivosDaSessao(sessaoAtiva);
            if (cancelado) return data;
            setIncentivosRecebidos(data.filter((item) => item.destinatario_id === userId).length);
            return data;
        };

        sincronizarContador();

        const cancelarInscricao = observarIncentivosDaSessao(sessaoAtiva, async (novoIncentivo) => {
            // DELETE chega como null: apenas ressincroniza o contador, sem notificar.
            if (!novoIncentivo) {
                await sincronizarContador();
                return;
            }

            // Só interessa a força destinada a mim, e não o eco do meu próprio envio.
            if (novoIncentivo.destinatario_id !== userId || novoIncentivo.remetente_id === userId) return;

            // O payload do realtime não traz o JOIN com profiles, então recarrega para
            // descobrir o nome de quem torceu e deixar o aviso pessoal.
            const incentivosAtuais = await sincronizarContador();
            if (cancelado) return;

            const autor = incentivosAtuais.find((item) => item.id === novoIncentivo.id);
            const nomeAutor = autor?.profiles?.nome_usuario || autor?.profiles?.nome_real;

            await Notifications.scheduleNotificationAsync({
                content: {
                    title: "💪 Você recebeu força!",
                    body: nomeAutor
                        ? `${nomeAutor} está torcendo pelo seu foco agora.`
                        : "Alguém está torcendo pelo seu foco agora.",
                },
                trigger: null,
            });
        });

        return () => {
            cancelado = true;
            cancelarInscricao();
        };
    }, [session?.id, focusState, userId, isPublicSession]);

    const cancelarEntradaSessao = () => {
        setIgnoreJoinSession(true);
        setCreatedSession(null);
        setSelectedSubject("");
        setSpecificContent("");
        setIsPublicSession(true);
        setModo("cronometro");
        setFocusState("config");
        setContexto(null);
        setRestaurada(false);
        setArquivosVault(null);
        router.replace({ pathname: "/(tabs)/focus" });
    };

    /**
     * Calcula o tempo do cronometro do usuário
     * @param user 
     * @returns tempoTotal = tempoAcumulado + tempoDesdeUltimoInicio
     */
    const base = session?.tempo_minutos ?? 0;

    const inicio = session?.ultimo_inicio
        ? new Date(session?.ultimo_inicio + "Z").getTime()
        : null;

    const live =
        session?.status === "ativo" && inicio
            ? (Date.now() - inicio) / 1000
            : 0;

    const total = Math.floor(base + live);



    /**
     * Calcula o tempo do usuário atual em tempo real
     */
    useEffect(() => {
        console.log("session ultimo_inicio:", session?.ultimo_inicio);

        if (focusState !== "active" || isPaused) return;
        let lastStart: number | null = null;
        let storedTime: number = 0;

        // Usa último_inicio da sessão  
        if (session?.ultimo_inicio) {
            lastStart = new Date(session.ultimo_inicio).getTime();
        }


        //se tempo_minutos estiver definido, converte para segundos
        storedTime = (session?.tempo_minutos ?? 0);

        if (!lastStart) return;

        /**
         * tempo decorrido desde o último início da sessão (em segundos) + tempo armazenado
         */
        const updateTimer = () => {
            const elapsed = Math.floor(
                storedTime + ((Date.now() - lastStart) / 1000)
            );
            setNewUserTimer(elapsed);
        };
        updateTimer();

        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [session?.ultimo_inicio, isPaused, focusState]);


    // Recarrega matérias sempre que a tela ganha foco (ex: ao voltar do modal de criar matéria)
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            recarregarMaterias();
        });
        return unsubscribe;
    }, [navigation, recarregarMaterias]);

    const bloqueadoPorFeedback = pendingSessions.length > 0 && !params.reviewSessionId;
    const carregandoConfig = carregandoMaterias || carregandoSessoesPendentes;

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
                    setFocusState("active");
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

    // POMODORO Sessão   a partir de um bloco do cronograma.
    useEffect(() => {
        if (params.blocoId && params.subject) {
            setContexto({
                blocoId: params.blocoId as string,
                origem: params.origemBloco === "plano" ? "plano" : "rotina",
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
    }, [params.blocoId, params.origemBloco, params.subject, params.content, params.fimEm, params.duracaoMin]);

    // Auto-start for review sessions
    useEffect(() => {
        if (params.autoStart === "true" && params.reviewSessionId) {
            setSelectedSubject(params.subject as string);
            setSpecificContent(params.content as string);
            setFocusState("active");
            setTimerSeconds(0);
        }
    }, [params.autoStart, params.reviewSessionId, params.subject, params.content]);

    // Timer com setInterval (atualiza a cada segundo enquanto em foreground)
    useEffect(() => {
        if (focusState === "active" && !isPaused) {
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
        if (focusState !== "active" || modo !== "pomodoro" || isPaused) return;
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

    /**
     * função para entrar na sessão em grupo
     */
    const handleJoinGroupSession = async (sessionData: SessionCardItem, options?: { funcao?: "anfitriao" | "membro" }) => {
        if (!userId) return;

        // inserir o usuário na tabela de membros da sessão
        const { data: insertTabSM, error: insertError } = await insertTabSessaoMembros({
            sessao_id: sessionData.id,
            membro_id: userId,
            funcao: options?.funcao ?? 'membro',
            tempo_segundos: 0,
            status: 'ativo',
            ultimo_inicio: new Date().toISOString(),
        });

        console.log("Inserindo membro na sessão:", { sessionId: sessionData.id, userId });
        console.log("insertTabSM: ", insertTabSM)


        if (insertError) {
            /*
              23505 é a violação da constraint (sessao_id, membro_id): já existe linha para
              essa pessoa nessa sessão. Isso não é falha — acontece ao reentrar numa sessão
              que já foi aberta antes, ou ao entrar na sessão que a própria pessoa criou (o
              anfitrião já entra como membro ao criar). Antes o `return` abortava aqui e a
              pessoa ficava presa sem nunca virar `active`; agora só reativamos a presença.

              O `tempo_segundos` fica de fora de propósito, para não zerar o que já foi
              acumulado por quem está retomando.
            */
            if (insertError.code === "23505") {
                const { error: reativarError } = await updateTabSessaoMembros(userId, sessionData.id, {
                    status: "ativo",
                    ultimo_inicio: new Date().toISOString(),
                });

                if (reativarError) {
                    console.warn("Erro ao reativar membro na sessão:", reativarError);
                    return;
                }
            } else {
                console.warn("Erro ao adicionar membro na sessão:", insertError);
                return;
            }
        }

        // carregar dados dos membros da sessão para mostrar no carrossel
        const { data: sessionMembers, error } = await fetchSessionMembers(sessionData.id);
        if (error) {
            console.error("Erro ao buscar membros da sessão:", error);
            return;
        }
        console.log("sessionMembers: ", sessionMembers)

        if (sessionMembers) {
            setMembers(sessionMembers);
            console.log("1Membros da sessão:", sessionMembers);
        }


        // mudar para o modo de foco
        setFocusState('active');
    };

    /**
     * Inicia a sessão de foco. Verifica se os campos estão preenchidos, se há sessões pendentes e se existem arquivos relacionados à matéria no vault. Se houver arquivos, notifica o usuário e oferece a opção de revisar antes de iniciar. Salva os dados da sessão e o timestamp de início no AsyncStorage para persistência.
     * @returns void
     */
    const startSession = async () => {
        //Verifica preenchimento de dados obrigatorios
        if (!selectedSubject || !specificContent.trim()) {
            toast.warning(
                "Por favor, selecione uma matéria e informe o conteúdo específico antes de iniciar.",
                "Incompleto"
            );
            return;
        }
        if (bloqueadoPorFeedback) return;

        try {
            if (!user) return;

            // Garante o grupo ativo mesmo se o estado ainda não tiver terminado de carregar do AsyncStorage.
            const activeGroupId = currentGroupId || (await carregarUltimoGrupoLocalmente());
            setCurrentGroupId(activeGroupId);

            /**
             * Mapeia o nome da matéria para o formato usado no banco (minúsculo e sem acento, se necessário)
             */
            const disciplinaBusca = normalizar(selectedSubject);
            const doVault = archives.filter(
                (f) => f.disciplina && normalizar(f.disciplina) === disciplinaBusca
            );

            if (doVault.length > 0) {
                /*
                  Dispara a notificação de sistema se existem arquivos relacionados à matéria no vault. O usuário pode então decidir revisar os arquivos antes de iniciar a sessão.
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

    const realmenteIniciar = async (grupoId: string | null) => {
        const now = Date.now();
        startTimeRef.current = now;

        const activeGroupId = currentGroupId || (await carregarUltimoGrupoLocalmente());
        setCurrentGroupId(activeGroupId);

        // Primeira vez salvando essa sessão — insere e guarda o ID
        const { data, error } = await salvarSessaoFoco({
            user_id: userId as string,
            grupo_id: activeGroupId as string,
            disciplina: selectedSubject || "Estudo Geral",
            conteudo_especifico: specificContent || "Sessão livre",
            tempo_minutos: 0,
            questoes_respondidas: 0,
            questoes_acertadas: 0,
            is_public: isPublicSession,
            status: "ativo",
            bloco_rotina_id: contexto?.origem === "rotina" ? contexto.blocoId : null,
            bloco_plano_id: contexto?.origem === "plano" ? contexto.blocoId : null,
            ultimo_inicio: new Date().toISOString(),
            concluido_em: null,
        });
        const insertedSession = (data as any)[0];
        // Define a sessão no estado para ativar a visualização de grupo
        setCreatedSession(insertedSession);

        // verifica se a sessão foi criada localmente e se ela é pública
        if (!error && data && data.length > 0 && isPublicSession && !sessionParam) {
            await handleJoinGroupSession(insertedSession, { funcao: "anfitriao" });
        }
        //se veio uma sessão já existente via parâmetro da rota, também entra nela
        if (sessionParam && parsedSession) {
            await handleJoinGroupSession(parsedSession, { funcao: "membro" });
        }

        focoAcumuladoRef.current = 0;
        setCiclo(1);
        await persistirSessao(now, grupoId);
        setFocusState("active");
        setTimerSeconds(0);
        setRestaurada(false);
        if (modo === "pomodoro") iniciarFase("foco");
    };

    /**
     * Função para pausar ou retomar a sessão. Ao pausar, salva os segundos acumulados e para o timer. Ao retomar, calcula um novo startTime baseado nos segundos acumulados para continuar a contagem de onde parou.
     */
    const togglePause = async () => {
        if (isPaused) {
            const nowIso = new Date().toISOString();
            if (!session?.id) {
                console.error("Nemhuma sessão foi encontrada:", session);
                toast.error("Não foi possível retomar a sessão.");
                return;
            }
            if (modo === "cronometro") {
                //Retomar: cria um novo startTime baseado nos segundos acumulados
                const newStartTime = Date.now() - pausedSecondsRef.current * 1000;
                startTimeRef.current = newStartTime;

                const { error: updateError } = await atualizarSessaoFoco(session.id, {
                    ultimo_inicio: nowIso,
                    status: "ativo",
                });
                if (updateError) {
                    console.error("Erro ao atualizar sessão ao retomar:", updateError);
                    toast.error("Não foi possível retomar a sessão.");
                    return;
                }
                const { data: refreshedSession } = await fetchFocusSession(session.id);
                if (refreshedSession && refreshedSession.length > 0) {
                    setCreatedSession(refreshedSession[0]);
                }

                if (isPublicSession) {
                    const { error: updateMemberError } = await updateTabSessaoMembros(userId || "", session.id, {
                        ultimo_inicio: nowIso,
                        status: "ativo",
                    });
                    if (updateMemberError) {
                        console.error("Erro ao atualizar membro ao retomar:", updateMemberError);
                        toast.error("Não foi possível sincronizar sua sessão com o grupo.");
                        return;
                    }

                    const { data: updatedMembers } = await fetchSessionMembers(session.id)
                    if (updatedMembers) {
                        setMembers(updatedMembers)
                    }
                }


                try {
                    await AsyncStorage.setItem(STORAGE_KEY_START_TIME, newStartTime.toString());
                } catch (e) {
                    console.warn("Erro ao salvar sessão:", e);
                }
            } else {
                // Retoma a fase de onde parou.
                faseInicioRef.current = Date.now(); - (faseDuracaoRef.current - pausedSecondsRef.current) * 1000;
            }

            setIsPaused(false);
            return;
        } else {
            // Pausar: salva os segundos acumulados e para o interval
            if (!session?.id) return;

            const { error: pauseError } = await atualizarSessaoFoco(session.id, {
                status: "pausado",
                tempo_minutos: await calculateFocusSessionMinutes(newUserTimer),
            });
            if (pauseError) {
                console.error("Erro ao pausar sessão:", pauseError);
                toast.error("Não foi possível pausar a sessão.");
            }

            if (isPublicSession) {
                const { error: updateMemberError } = await updateTabSessaoMembros(userId || "", session.id, {
                    status: "pausado",
                    tempo_segundos: newUserTimer, // em segundos
                });
                if (updateMemberError) {
                    console.error("Erro ao pausar membro:", updateMemberError);
                    toast.error("Não foi possível sincronizar sua sessão com o grupo.");
                    return;
                }
            }

            pausedSecondsRef.current = modo === "cronometro" ? newUserTimer : restanteFase;
            if (intervalRef.current) clearInterval(intervalRef.current);
            setIsPaused(true);
        }
    };

    /** Tempo de foco que vira sessão. Descanso nunca entra na conta. */
    const segundosDeFoco = () => {
        if (modo === "cronometro") return newUserTimer;
        const naFase =
            fase === "foco" && faseInicioRef.current
                ? Math.min(faseDuracaoRef.current, Math.floor((Date.now() - faseInicioRef.current) / 1000))
                : 0;
        return focoAcumuladoRef.current + naFase;
    };

    /**
     * Encerra a sessão
     * Para de contar o tempo, reseta os estados relacionados e navega para o modal de feedback, passando os dados da sessão como parâmetros.
     */
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

        if (isPublicSession && session?.id && userId) {
            await updateTabSessaoMembros(userId, session?.id, {
                status: "concluido",
                tempo_segundos: finalDuration,
            });
        }

        const concluidoEm = new Date().toISOString();
        const { error: updateSessionError } = await atualizarSessaoFoco(session?.id || "", {
            tempo_minutos: await calculateFocusSessionMinutes(finalDuration),
            concluido_em: concluidoEm,
            status: "salvo",
        });
        if (updateSessionError) {
            console.error("Erro ao finalizar sessão de foco:", updateSessionError);
        }

        if (intervalRef.current) clearInterval(intervalRef.current);

        // Limpa os dados salvos no AsyncStorage
        try {
            await AsyncStorage.multiRemove([STORAGE_KEY_START_TIME, STORAGE_KEY_SESSION_DATA]);
        } catch (e) {
            console.warn("Erro ao limpar sessão:", e);
        }

        const sessionIdParaFeedback = params.reviewSessionId || session?.id || undefined;

        // Abre o modal de feedback após a sessão passando os parâmetros
        router.push({
            pathname: "/(modals)/focus-feedback",
            params: {
                subject: finalSubject,
                content: finalContent,
                duration: finalDuration.toString(),
                isPublic: finalIsPublic.toString(),
                groupId: finalGroupId || undefined,
                sessionId: sessionIdParaFeedback,
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

    /**
     * Formata o tempo restante ou decorrido para exibição no relógio da sessão. No modo cronômetro, mostra horas, minutos e segundos; no modo pomodoro, mostra minutos e segundos restantes na fase atual.
     */
    const textoRelogio =
        modo === "cronometro" ? formatarHMS(total) : formatarMS(restanteFase);

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

                    {carregandoConfig ? (
                        <FocusConfigSkeleton />
                    ) : bloqueadoPorFeedback ? (
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
                            {isJoiningExistingPublicSession && (
                                <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>
                                    <View
                                        style={{
                                            backgroundColor: HADES.surface,
                                            borderWidth: 1,
                                            borderColor: HADES.border,
                                            borderRadius: 16,
                                            padding: 14,
                                        }}
                                    >
                                        <Text style={{ fontSize: 11, color: HADES.accentSolid, fontWeight: "700", letterSpacing: 0.6, marginBottom: 10 }}>
                                            ENTRANDO EM SESSÃO PÚBLICA
                                        </Text>
                                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                                            <View
                                                style={{
                                                    width: 46,
                                                    height: 46,
                                                    borderRadius: 23,
                                                    backgroundColor: HADES.accentSolid,
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                }}
                                            >
                                                <Text style={{ color: "#000", fontSize: 18, fontWeight: "700" }}>
                                                    {hostInitial}
                                                </Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontSize: 16, fontWeight: "700", color: HADES.text, marginBottom: 4 }}>
                                                    Você está prestes a entrar na sessão de {hostName}
                                                </Text>
                                                <Text style={{ fontSize: 13, color: HADES.textSecondary, lineHeight: 18 }}>
                                                    {session?.disciplina || selectedSubject || "Sessão em andamento"}
                                                    {session?.conteudo_especifico ? ` · ${session.conteudo_especifico}` : ""}
                                                </Text>
                                            </View>
                                        </View>
                                        <TouchableOpacity
                                            onPress={cancelarEntradaSessao}
                                            activeOpacity={0.8}
                                            style={{
                                                marginTop: 12,
                                                alignSelf: "flex-start",
                                                paddingHorizontal: 12, 
                                                paddingVertical: 8,
                                                borderRadius: 999,
                                                backgroundColor: HADES.surfaceRaised,
                                                borderWidth: 1,
                                                borderColor: HADES.border,
                                            }}
                                        >
                                            <Text style={{ fontSize: 12.5, fontWeight: "700", color: HADES.textSecondary }}>
                                                Cancelar
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}

                            {!isJoiningExistingPublicSession && (
                                <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
                                    <SeletorModo modo={modo} onChange={setModo} />
                                </View>
                            )}

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
                                mostrarSeletorModo={!isJoiningExistingPublicSession}
                                mostrarVisibilidade={!isJoiningExistingPublicSession}
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
                        colegas={isPublicSession ? memberNames : null}
                        incentivosRecebidos={incentivosRecebidos}
                        iniciadaEm={
                            restaurada && startTimeRef.current ? formatarHora(startTimeRef.current) : null
                        }
                        onPausar={togglePause}
                        onEncerrar={stopSession}
                        onEstender={estenderFoco}
                        onPularDescanso={pularDescanso}
                        onConcluirBloco={stopSession}
                        onAbrirColegas={() =>
                            router.push({
                                pathname: "/(modals)/colegas-focando",
                                params: {
                                    materia: selectedSubject,
                                    conteudo: specificContent,
                                    sessionId: session?.id || parsedSession?.id || undefined,
                                },
                            })
                        }
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

/** Esqueleto da tela de configuração de sessão (matéria, conteúdo, visibilidade/preset), exibido enquanto matérias e sessões pendentes ainda carregam. */
function FocusConfigSkeleton() {
    return (
        <>
            <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
                <View
                    style={{
                        flexDirection: "row",
                        backgroundColor: HADES.surface,
                        borderWidth: 1,
                        borderColor: HADES.border,
                        borderRadius: 12,
                        padding: 4,
                        gap: 4,
                    }}
                >
                    <Skeleton height={38} borderRadius={9} hades style={{ flex: 1 }} />
                    <Skeleton height={38} borderRadius={9} hades style={{ flex: 1 }} />
                </View>
            </View>

            <View style={{ flex: 1, paddingHorizontal: 20 }}>
                <Skeleton width={70} height={11} hades style={{ marginBottom: 12 }} />
                <View style={{ flexDirection: "row", gap: 9, marginBottom: 24 }}>
                    <Skeleton width={90} height={38} borderRadius={12} hades />
                    <Skeleton width={110} height={38} borderRadius={12} hades />
                    <Skeleton width={80} height={38} borderRadius={12} hades />
                </View>

                <Skeleton width={150} height={11} hades style={{ marginBottom: 12 }} />
                <Skeleton height={49} borderRadius={13} hades />

                <Skeleton width={90} height={11} hades style={{ marginTop: 26, marginBottom: 12 }} />
                <View style={{ flexDirection: "row", gap: 10 }}>
                    <Skeleton height={90} borderRadius={14} hades style={{ flex: 1 }} />
                    <Skeleton height={90} borderRadius={14} hades style={{ flex: 1 }} />
                </View>
            </View>

            <View style={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: 12 }}>
                <Skeleton height={54} borderRadius={15} hades />
            </View>
        </>
    );
}
