import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { Vibration, View, Text, TouchableOpacity, AppState } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Play } from "lucide-react-native";
import * as Notifications from "expo-notifications";
import * as Crypto from "expo-crypto";

import { HADES } from "@/constants/hades";
import { Skeleton } from "@/components/ui/Skeleton";
import { CONFIG_POMODORO_PADRAO } from "@/constants/foco";
import { usePreferencias } from "@/hooks/usePreferencias";
import { useAuth } from "@/hooks/useAuth";
import { useSessoesUsuario } from "@/hooks/useSessoesFoco";
import { useMaterias } from "@/hooks/useMaterias";
import { useArchives } from "@/hooks/useArchives";
import { useSessionMembers } from "@/hooks/useSessionMembers";
import {
    carregarUltimoGrupoLocalmente,
    carregarSnapshotSessao,
    limparSnapshotSessao,
    salvarSnapshotSessao,
} from "@/services/armazenamentoOffline";
import { resolverAgendaDoDia } from "@/services/agenda";
import { gerarSequenciaPomodoro, posicaoNaFila, inicioDoItemMs } from "@/utils/pomodoroSequence";
import { useCronogramaSessao, cronogramaDaLinha } from "@/hooks/useCronogramaSessao";
import { paraDataISO } from "@/utils/tempo";
import ConfigSessao, { SeletorModo } from "@/components/focus/ConfigSessao";
import BloqueioFeedback from "@/components/focus/BloqueioFeedback";
import SheetVault from "@/components/focus/SheetVault";
import SessaoAtiva from "@/components/focus/SessaoAtiva";
import type { ArquivoDetalhe } from "@/types/archives";
import type { SessaoFocoRow, SessionCardItem } from "@/types/sessions";
import { salvarSessaoFoco, atualizarSessaoFoco, fetchFocusSession, fetchSessionById, calculateFocusSessionMinutes, insertTabSessaoMembros, updateTabSessaoMembros, transferirAnfitriaoDaSessao, registrarProgressoSessao, republicarFilaDaSessao } from "@/services/sessions";
import { observarIncentivosDaSessao, buscarIncentivosDaSessao } from "@/services/incentivos";
import { FaixaBlocoCronograma, FaixaSessaoRestaurada } from "@/components/focus/PecasFoco";
import { toast } from "@/services/toast";
import type { ConfigPomodoro, ContextoBloco, FocusState, FaseFoco, ModoFoco, ItemFila, SnapshotSessaoFoco } from "@/types/foco";

// O handler global de notificações (mostrar com o app aberto) agora vive em
// services/notificacoesForca.ts, carregado no _layout — vale pra esta tela também.

// As chaves do AsyncStorage e o formato do que é gravado ficam em
// services/armazenamentoOffline.ts (ver `salvarSnapshotSessao`).

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
    const [configTocada, setConfigTocada] = useState(false);
    const [fase, setFase] = useState<FaseFoco>("foco");
    const [restanteFase, setRestanteFase] = useState(0);
    const [contexto, setContexto] = useState<ContextoBloco | null>(null);
    const [restaurada, setRestaurada] = useState(false);
    const [arquivosVault, setArquivosVault] = useState<ArquivoDetalhe[] | null>(null);
    // Fila de itens (pomodoros solo, ou blocos de um plano) que a sessão percorre sozinha.
    const [fila, setFila] = useState<ItemFila[]>([]);
    const [indiceFila, setIndiceFila] = useState(0);
    /*
      Empurrãozinho para regravar o snapshot da sessão quando o que mudou vive num ref
      (esticar o foco muda `faseDuracaoRef`, que nenhum estado observa).
    */
    const [snapshotTick, setSnapshotTick] = useState(0);

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef<number | null>(null);
    const pausedSecondsRef = useRef<number>(0);
    // Pomodoro: início da fase atual e foco já acumulado no item atual.
    const faseInicioRef = useRef<number | null>(null);
    const focoAcumuladoRef = useRef<number>(0);
    const faseDuracaoRef = useRef<number>(0);
    // Instante da pausa, usado para descontar o tempo parado numa sessão em grupo.
    const pausaIniciadaEmRef = useRef<number | null>(null);
    // Presente só quando a fila tem mais de uma matéria (encadeamento de plano) — cada
    // matéria vira sua própria linha em sessoes_foco, todas com este mesmo valor.
    const execucaoIdRef = useRef<string | null>(null);

    const { userId, user } = useAuth();
    const { prefs, carregando: carregandoPrefs } = usePreferencias(userId);
    const { pendingSessions, loading: carregandoSessoesPendentes } = useSessoesUsuario(userId);
    const { archives } = useArchives(userId || undefined);
    const { materias, recarregarMaterias, carregando: carregandoMaterias } = useMaterias(userId);
    const params = useLocalSearchParams();
    const router = useRouter();
    const navigation = useNavigation();

    /*
      A aba de foco é uma tab: ela não é desmontada quando um modal (feedback, criar
      matéria...) é empilhado por cima. Por isso todo parâmetro de rota que representa uma
      INTENÇÃO ("entre nesta sessão pública", "comece este bloco") é consumido uma única
      vez para dentro do estado e logo apagado da rota com `limparParamsDaRota`. Sem isso o
      parâmetro fica grudado na rota para sempre e, ao voltar do modal de feedback, a tela
      renderiza de novo a entrada na sessão em grupo que o usuário acabou de encerrar.
    */
    const limparParamsDaRota = useCallback(
        (chaves: string[]) => {
            router.setParams(Object.fromEntries(chaves.map((chave) => [chave, ""])));
        },
        [router]
    );

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
    // Sessão pública alheia em que o usuário está entrando, já consumida da rota.
    const [sessaoParaEntrar, setSessaoParaEntrar] = useState<SessionCardItem | null>(null);
    /*
      Sessão de revisão/refação aberta pelo Brain Hub, também consumida da rota: a linha em
      `sessoes_foco` já existe e o tempo anterior (`oldDuration`, em minutos) precisa ser
      somado ao novo no formulário de feedback.
    */
    const [revisao, setRevisao] = useState<{ sessionId: string; oldDuration: string | null } | null>(null);
    const [ignoreJoinSession, setIgnoreJoinSession] = useState(false);
    const session = createdSession || sessaoParaEntrar;
    const isJoiningExistingPublicSession = !!sessaoParaEntrar && !ignoreJoinSession;
    const hostName = session?.profiles?.nome_usuario || session?.profiles?.nome_real || "anfitrião";
    const hostInitial = hostName.trim().charAt(0).toUpperCase() || "A";

    useEffect(() => {
        if (joinPublicSession !== "true" || !parsedSession) return;

        setSessaoParaEntrar(parsedSession);
        setIgnoreJoinSession(false);
        setSelectedSubject(parsedSession.disciplina || "");
        setSpecificContent(parsedSession.conteudo_especifico || "");
        setIsPublicSession(true);
        /*
          O modo vem da sessão em que se está entrando, não é mais fixo em "cronometro".

          Era exatamente aqui que o "pomodoro em grupo" morria: o anfitrião rodava ciclos de
          foco e descanso, e todo mundo que entrava caía num cronômetro corrido — quando ele
          entrava em descanso, nada acontecia no aparelho dos outros.
        */
        setModo(parsedSession.modo === "pomodoro" ? "pomodoro" : "cronometro");
        limparParamsDaRota(["session", "joinPublicSession"]);
    }, [joinPublicSession, parsedSession, limparParamsDaRota]);

    /*
      Sessão de grupo à qual a participação em `tab_sessao_membros` pertence.

      Quem entra numa sessão pública alheia continua criando a própria linha em
      `sessoes_foco` (é o registro de estudo dele), mas o cronômetro compartilhado é o da
      sessão do anfitrião. Antes tudo usava `session.id` — que para o convidado é a linha
      dele mesmo —, então o insert/update de membro caía numa sessão sem participantes e o
      tempo dele nunca aparecia na tela "Focando juntos".
    */
    /*
      Fixado quando a sessão começa e mantido até ela acabar.

      Antes era derivado da sessão corrente, e num plano com várias matérias a sessão
      corrente troca a cada matéria — então o ponto de encontro do grupo mudava junto: quem
      tinha entrado continuava na sessão da primeira matéria enquanto o anfitrião passava a
      contar numa nova, e a tela "Focando juntos" se partia no meio do estudo.
    */
    const [sessaoGrupoFixa, setSessaoGrupoFixa] = useState<string | undefined>(undefined);
    const sessaoGrupoId = sessaoGrupoFixa ?? (sessaoParaEntrar ? sessaoParaEntrar.id : session?.id);

    // Membros da sessão em grupo, sincronizados em tempo real (ver hooks/useSessionMembers).
    const { members, recarregar: recarregarMembros } = useSessionMembers(sessaoGrupoId);

    /*
      Cronograma que a sessão em grupo segue: a fila de focos e descansos publicada na linha
      da sessão, mais o instante em que ela começou (ver hooks/useCronogramaSessao).

      Vale para o anfitrião e para quem entrou: os dois leem a MESMA linha e calculam a
      posição pela mesma conta, então não existe "quem manda a troca de fase" — e a sincronia
      sobrevive ao anfitrião fechar o app, sair da sessão ou perder a internet.

      Sessão privada não tem cronograma compartilhado: ali o pomodoro continua sendo local, e
      pausar continua empurrando a fase (não há mais ninguém para atrasar).
    */
    const cronogramaCompartilhado = useCronogramaSessao(isPublicSession ? sessaoGrupoId : null);
    const seguindoCronograma =
        focusState === "active" && modo === "pomodoro" && !!cronogramaCompartilhado;
    /** Só quem criou a sessão mexe no combinado; os outros seguem. */
    const souDonoDoCronograma = !sessaoParaEntrar;

    const memberNames = useMemo(() => {
        return members.map((member) => {
            const profileName = member.profiles?.nome_usuario || member.profiles?.nome_real;
            return profileName || "Participante";
        });
    }, [members]);

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
        const sessaoAtiva = sessaoGrupoId;
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

        // O aviso de "você recebeu força" agora é a notificação push de verdade, disparada
        // pela Edge Function mandar-forca — aqui só ressincroniza o contador exibido na tela.
        const cancelarInscricao = observarIncentivosDaSessao(sessaoAtiva, () => {
            sincronizarContador();
        });

        return () => {
            cancelado = true;
            cancelarInscricao();
        };
    }, [sessaoGrupoId, focusState, userId, isPublicSession]);

    const cancelarEntradaSessao = () => {
        setIgnoreJoinSession(true);
        setCreatedSession(null);
        setSessaoParaEntrar(null);
        setSessaoGrupoFixa(undefined);
        setSelectedSubject("");
        setSpecificContent("");
        setIsPublicSession(true);
        setModo("cronometro");
        setFocusState("config");
        setContexto(null);
        setRestaurada(false);
        setArquivosVault(null);
        // Os params da rota já foram limpos ao entrar na sessão, então basta zerar o estado
        // — não é preciso um `router.replace` só para descartar a query.
    };

    /*
      O tempo do cronômetro vem de `timerSeconds` (derivado de `startTimeRef`, que já é
      ajustado ao pausar/retomar e persistido no AsyncStorage para sobreviver ao app
      fechar). Antes existia um segundo cálculo em paralelo, a partir de
      `session.ultimo_inicio` + `session.tempo_minutos`, que somava MINUTOS como se fossem
      SEGUNDOS e usava um parsing de fuso diferente do da tela — era ele que gravava no
      banco um tempo diferente do que o relógio mostrava.
    */

    // Recarrega matérias sempre que a tela ganha foco (ex: ao voltar do modal de criar matéria)
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            recarregarMaterias();
        });
        return unsubscribe;
    }, [navigation, recarregarMaterias]);

    const bloqueadoPorFeedback = pendingSessions.length > 0 && !revisao;
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

    /*
      Recupera a sessão que estava rodando quando o app foi fechado.

      Reconstrói a sessão INTEIRA, não só o cronômetro: a fila do pomodoro, o item em que
      ela parou, a fase e seu início, o foco já acumulado, a execução do plano e as linhas
      do banco (a própria e, se a pessoa era convidada, a do anfitrião). Sem isso o app
      voltava "em pomodoro" com fila vazia — as fases nunca mais trocavam, as matérias
      seguintes do plano sumiam e o tempo virava relógio de parede, com descanso e app
      fechado contando como estudo.
    */
    useEffect(() => {
        const restoreSession = async () => {
            const snapshot = await carregarSnapshotSessao();
            if (!snapshot) return;

            /*
              A linha do banco é a última palavra sobre a sessão ainda estar aberta: ela
              pode ter sido encerrada em outro aparelho, ou fechada pela recuperação de
              sessões abandonadas. Nesse caso o snapshot é lixo — restaurá-lo faria a
              pessoa continuar contando tempo numa sessão que já foi salva.
            */
            let sessaoPropria: SessionCardItem | null = null;
            if (snapshot.sessaoId) {
                const { data } = await fetchFocusSession(snapshot.sessaoId);
                sessaoPropria = (data?.[0] as SessionCardItem) ?? null;

                if (!sessaoPropria || sessaoPropria.concluido_em) {
                    await limparSnapshotSessao();
                    return;
                }
            }

            startTimeRef.current = snapshot.inicioMs;
            pausedSecondsRef.current = snapshot.pausadoSeg;
            pausaIniciadaEmRef.current = snapshot.pausadaEmMs;
            faseInicioRef.current = snapshot.faseInicioMs;
            faseDuracaoRef.current = snapshot.faseDuracaoSeg;
            focoAcumuladoRef.current = snapshot.focoAcumuladoSeg;
            execucaoIdRef.current = snapshot.execucaoId;

            setSelectedSubject(snapshot.subject);
            setSpecificContent(snapshot.content);
            setIsPublicSession(snapshot.isPublic);
            setCurrentGroupId(snapshot.groupId);
            setModo(snapshot.modo);
            setContexto(snapshot.contexto);
            setFila(snapshot.fila);
            setIndiceFila(snapshot.indiceFila);
            setFase(snapshot.fase);
            setIsPaused(snapshot.pausado);

            if (sessaoPropria) setCreatedSession(sessaoPropria);

            /*
              Convidado: a participação em `tab_sessao_membros` é na sessão do anfitrião, e
              é dela que sai `sessaoGrupoId`. Sem reencontrá-la, o tempo de quem reabriu o
              app parava de aparecer para os colegas em "Focando juntos".
            */
            setSessaoGrupoFixa(snapshot.sessaoGrupoId ?? undefined);

            if (snapshot.ehConvidado && snapshot.sessaoGrupoId) {
                const { data } = await fetchSessionById(snapshot.sessaoGrupoId);
                if (data) setSessaoParaEntrar(data as SessionCardItem);
            }

            if (snapshot.modo === "cronometro") {
                setTimerSeconds(
                    snapshot.pausado
                        ? snapshot.pausadoSeg
                        : Math.floor((Date.now() - snapshot.inicioMs) / 1000)
                );
            } else if (snapshot.pausado) {
                setRestanteFase(snapshot.pausadoSeg);
            } else if (snapshot.faseInicioMs) {
                /*
                  Pode voltar negativo: a fase terminou com o app fechado. É o certo — o
                  efeito de avanço automático vê `restanteFase <= 0` e faz a passagem que
                  teria sido feita na hora (creditando a fase de foco por inteiro, nunca
                  mais do que ela durava).
                */
                setRestanteFase(
                    snapshot.faseDuracaoSeg - Math.floor((Date.now() - snapshot.faseInicioMs) / 1000)
                );
            }

            setFocusState("active");
            setRestaurada(true);
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

    /*
      A config do pomodoro nasce das preferências do cronograma. Só vale enquanto
      o usuário não mexeu nos controles da própria tela (`configTocada`) e a
      sessão ainda não começou — depois disso quem manda é o que está na tela.
    */
    useEffect(() => {
        if (carregandoPrefs || configTocada || focusState !== "config" || contexto) return;
        setConfigPomodoro((atual) => ({
            ...atual,
            focoMin: prefs.focoMin,
            descansoCurtoMin: prefs.descansoCurtoMin,
            descansoLongoMin: prefs.descansoLongoMin,
            ciclosAteLongo: prefs.ciclosAteLongo,
        }));
    }, [
        carregandoPrefs,
        configTocada,
        focusState,
        contexto,
        prefs.focoMin,
        prefs.descansoCurtoMin,
        prefs.descansoLongoMin,
        prefs.ciclosAteLongo,
    ]);

    // POMODORO Sessão   a partir de um bloco do cronograma.
    useEffect(() => {
        if (!params.blocoId || !params.subject) return;

        setContexto({
            blocoId: params.blocoId as string,
            origem: params.origemBloco === "plano" ? "plano" : "rotina",
            materia: params.subject as string,
            topico: (params.content as string) || "",
            fimEm: (params.fimEm as string) || "",
            planoId: (params.planoId as string) || undefined,
        });
        setSelectedSubject(params.subject as string);
        setSpecificContent((params.content as string) || "");
        setModo("pomodoro");
        const duracao = params.duracaoMin ? parseInt(params.duracaoMin as string, 10) : null;
        if (duracao) {
            setConfigPomodoro((c) => ({ ...c, focoMin: duracao }));
        }
        limparParamsDaRota([
            "blocoId",
            "origemBloco",
            "subject",
            "content",
            "fimEm",
            "duracaoMin",
            "planoId",
        ]);
    }, [
        params.blocoId,
        params.origemBloco,
        params.subject,
        params.content,
        params.fimEm,
        params.duracaoMin,
        params.planoId,
        limparParamsDaRota,
    ]);

    // Auto-start for review sessions
    useEffect(() => {
        if (params.autoStart !== "true" || !params.reviewSessionId) return;

        setRevisao({
            sessionId: params.reviewSessionId as string,
            oldDuration: (params.oldDuration as string) || null,
        });
        setSelectedSubject(params.subject as string);
        setSpecificContent(params.content as string);
        setFocusState("active");
        setTimerSeconds(0);
        limparParamsDaRota(["autoStart", "reviewSessionId", "oldDuration", "subject", "content"]);
    }, [
        params.autoStart,
        params.reviewSessionId,
        params.oldDuration,
        params.subject,
        params.content,
        limparParamsDaRota,
    ]);

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

                /*
                  Sessão em grupo: o tempo restante vem do cronograma publicado, não de um
                  contador local. Cada aparelho refaz a mesma conta a partir da mesma fila e
                  do mesmo instante inicial, então todos mostram o mesmo número — inclusive
                  quem entrou no meio ou acabou de reabrir o app.
                */
                if (cronogramaCompartilhado) {
                    const { restanteSeg } = posicaoNaFila(
                        cronogramaCompartilhado.fila,
                        cronogramaCompartilhado.inicioMs
                    );
                    setRestanteFase(restanteSeg);
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
    }, [focusState, isPaused, modo, cronogramaCompartilhado]);

    /*
      Batimento cardíaco da sessão: de tempo em tempo grava no banco o tempo de foco já
      acumulado (ver services/sessions.ts -> registrarProgressoSessao).

      Sem ele, `tempo_minutos` só era escrito ao pausar, trocar de fase ou encerrar — uma
      sessão de uma hora morta antes do primeiro descanso ficava registrada como zero, e a
      hora estudada sumia. É também o batimento que permite distinguir, depois, uma sessão
      viva de uma abandonada.

      Só bate durante o FOCO: no descanso não há tempo novo pra gravar.
    */
    useEffect(() => {
        const emFoco = modo === "cronometro" || fase === "foco";
        if (focusState !== "active" || isPaused || !emFoco || !session?.id) return;

        const bater = () =>
            registrarProgressoSessao({
                sessaoId: session.id,
                sessaoGrupoId,
                userId,
                segundosDeFoco: segundosDeFoco(),
                ehPublica: isPublicSession,
            });

        const id = setInterval(bater, 60 * 1000);

        // Sair do app é justamente quando o sistema pode matá-lo: registra antes de ir.
        const inscricao = AppState.addEventListener("change", (estado) => {
            if (estado !== "active") bater();
        });

        return () => {
            clearInterval(id);
            inscricao.remove();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [focusState, isPaused, modo, fase, session?.id, sessaoGrupoId, userId, isPublicSession]);

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

    /**
     * Fila de um pomodoro solo: sequência sintética gerada a partir da config (quantidade
     * de pomodoros, duração, descansos) — mesmo algoritmo usado por "sessão de pomodoros"
     * no plano (ver utils/pomodoroSequence.ts).
     */
    const construirFilaSolo = useCallback((): ItemFila[] => {
        return gerarSequenciaPomodoro({
            qtdPomodoros: configPomodoro.qtdPomodoros,
            duracaoPomodoroMin: configPomodoro.focoMin,
            inserirDescansos: true,
            descansoCurtoMin: configPomodoro.descansoCurtoMin,
            descansoLongoMin: configPomodoro.descansoLongoMin,
            ciclosAteLongo: configPomodoro.ciclosAteLongo,
        }).map((item) => ({
            tipo: item.tipo,
            duracaoMin: item.duracaoMin,
            ehLongo: item.ehLongo,
            materiaNome: item.tipo === "estudo" ? selectedSubject : undefined,
            topico: item.tipo === "estudo" ? specificContent : undefined,
        }));
    }, [configPomodoro, selectedSubject, specificContent]);

    /**
     * Adapta o cronograma do anfitrião para quem está entrando na sessão dele.
     *
     * A regra de matéria muda conforme a origem da sessão:
     *
     * - Sessão que veio do CRONOGRAMA do anfitrião (um bloco de rotina ou um plano): as
     *   matérias já estão definidas, e quem entra estuda as mesmas, na mesma ordem. É o
     *   sentido de estudar junto — o grupo passa por Matemática e depois por Física juntos.
     *
     * - Pomodoro solto, começado na tela de foco: o que se compartilha são só os TEMPOS.
     *   Cada um estuda a própria matéria no mesmo ritmo de foco e descanso, então os nomes
     *   de matéria do anfitrião são trocados pelos de quem entrou.
     *
     * Em qualquer caso o vínculo com os blocos do cronograma do anfitrião é removido: são
     * os blocos do plano DELE, e marcá-los como cumpridos pelo estudo de outra pessoa
     * bagunçaria a agenda de quem criou a sessão.
     */
    const adaptarFilaDoAnfitriao = useCallback(
        (filaDoAnfitriao: ItemFila[], sessaoAnfitria: SessionCardItem | null): ItemFila[] => {
            const veioDoCronograma = !!(
                sessaoAnfitria?.plano_id ||
                sessaoAnfitria?.bloco_plano_id ||
                sessaoAnfitria?.bloco_rotina_id
            );

            return filaDoAnfitriao.map((item) => ({
                ...item,
                blocoPlanoId: undefined,
                materiaId: veioDoCronograma ? item.materiaId : undefined,
                materiaNome:
                    item.tipo !== "estudo"
                        ? undefined
                        : veioDoCronograma
                            ? item.materiaNome
                            : selectedSubject,
                topico:
                    item.tipo !== "estudo"
                        ? undefined
                        : veioDoCronograma
                            ? item.topico
                            : specificContent,
            }));
        },
        [selectedSubject, specificContent]
    );

    /**
     * Fila de uma execução de plano: todos os blocos de hoje daquele plano a partir do
     * horário do bloco que o usuário tocou em diante (não volta pros que já passaram).
     * Cada bloco de matéria vira um item "estudo" com sua própria matéria/tópico.
     */
    const construirFilaDoPlano = useCallback(
        async (planoId: string, horaInicioBloco: string): Promise<ItemFila[]> => {
            if (!userId) return [];

            const hojeISO = paraDataISO(new Date());
            const agenda = await resolverAgendaDoDia(userId, hojeISO);
            const materiaPorId = new Map(materias.map((m) => [m.id, m]));

            return agenda
                .filter((bloco) => bloco.planoId === planoId && bloco.horaInicio >= horaInicioBloco)
                .map((bloco) => ({
                    tipo: bloco.tipo === "estudo" ? "estudo" : "descanso",
                    duracaoMin: bloco.duracaoMin,
                    materiaId: bloco.materiaId ?? undefined,
                    materiaNome: bloco.materiaId ? materiaPorId.get(bloco.materiaId)?.nomeExibicao : undefined,
                    topico: bloco.topico ?? undefined,
                    blocoPlanoId: bloco.id,
                }));
        },
        [userId, materias]
    );

    /** Marca a linha de sessoes_foco/tab_sessao_membros atual (a `session` corrente) como concluída. */
    const finalizarLinhaAtual = useCallback(
        async (duracaoSegundos: number) => {
            if (!session?.id) return;

            if (isPublicSession && userId && sessaoGrupoId) {
                await updateTabSessaoMembros(userId, sessaoGrupoId, {
                    status: "concluido",
                    tempo_segundos: duracaoSegundos,
                });
            }

            const { error } = await atualizarSessaoFoco(session.id, {
                tempo_minutos: await calculateFocusSessionMinutes(duracaoSegundos),
                concluido_em: new Date().toISOString(),
                status: "salvo",
            });
            if (error) {
                console.error("Erro ao finalizar sessão de foco:", error);
            }
        },
        [session?.id, sessaoGrupoId, isPublicSession, userId]
    );

    /**
     * Avança a sessão pro item `novoIndice` da fila: ajusta fase/duração/relógio e, se o
     * item for de estudo, troca a matéria exibida. Numa execução de plano (execucaoIdRef
     * setado), cada matéria de estudo também vira sua própria linha nova em sessoes_foco —
     * fora disso (solo ou bloco único), a mesma linha do início da sessão continua valendo.
     */
    /*
      Avisos de troca de fase, conforme as preferências. `Vibration` vem do próprio
      React Native, então não custa dependência nova; o aviso sonoro dedicado
      ainda não existe (ver "somFimFoco" nas preferências).
    */
    const avisarTrocaDeFase = useCallback(
        (entrandoEmEstudo: boolean) => {
            if (prefs.vibrar) {
                Vibration.vibrate(entrandoEmEstudo ? 400 : [0, 200, 120, 200]);
            }
            if (prefs.avisarFimDeFase) {
                Notifications.scheduleNotificationAsync({
                    content: entrandoEmEstudo
                        ? { title: "⏱ De volta ao foco", body: "O descanso acabou." }
                        : { title: "☕ Hora do descanso", body: "Pomodoro concluído." },
                    trigger: null,
                }).catch((erro) => console.error("Erro ao avisar fim de fase:", erro));
            }
        },
        [prefs.vibrar, prefs.avisarFimDeFase]
    );

    const avancarParaItem = useCallback(
        async (novoIndice: number, item: ItemFila, opcoes?: { inicioDaFaseMs?: number }) => {
            avisarTrocaDeFase(item.tipo === "estudo");
            faseDuracaoRef.current = item.duracaoMin * 60;
            /*
              No cronograma compartilhado a fase não começa "agora": ela começou na hora que
              o combinado diz. Usar `Date.now()` aqui daria a cada participante um início
              ligeiramente diferente (o do momento em que o app dele percebeu a troca) e o
              tempo creditado sairia diferente para cada um.
            */
            faseInicioRef.current = opcoes?.inicioDaFaseMs ?? Date.now();
            setFase(item.tipo === "estudo" ? "foco" : item.ehLongo ? "descansoLongo" : "descansoCurto");
            setRestanteFase(faseDuracaoRef.current);
            setIndiceFila(novoIndice);

            /*
              Espelha a fase na participação do grupo para o cronômetro que os colegas veem
              não contar descanso como estudo: entrando em foco, congela o acumulado e
              reabre a contagem a partir de agora; entrando em descanso, só congela.
              Em encadeamento de plano cada matéria abre a própria sessão (e a própria
              participação) logo abaixo, então lá esse ajuste não se aplica.
            */
            if (!execucaoIdRef.current) {
                const agoraIso = new Date().toISOString();
                const entrandoEmEstudo = item.tipo === "estudo";

                /*
                  A mesma fase precisa ser espelhada na linha de `sessoes_foco`, não só na
                  participação: é dela que o feed ao vivo do grupo lê tempo e status (ver
                  utils/tempo.ts -> tempoAoVivoDaSessao). Sem isso, o descanso do pomodoro
                  continuava contando como estudo para quem olhava o feed — a sessão
                  aparecia "focando agora" com o cronômetro correndo durante a pausa.
                */
                if (session?.id) {
                    const { error: erroFase } = await atualizarSessaoFoco(session.id, {
                        status: entrandoEmEstudo ? "ativo" : "pausado",
                        tempo_minutos: await calculateFocusSessionMinutes(focoAcumuladoRef.current),
                        ...(entrandoEmEstudo ? { ultimo_inicio: agoraIso } : {}),
                    });
                    if (erroFase) {
                        console.error("Erro ao espelhar a fase do pomodoro na sessão:", erroFase);
                    }
                }

                if (isPublicSession && userId && sessaoGrupoId) {
                    await updateTabSessaoMembros(
                        userId,
                        sessaoGrupoId,
                        entrandoEmEstudo
                            ? {
                                status: "ativo",
                                ultimo_inicio: agoraIso,
                                tempo_segundos: focoAcumuladoRef.current,
                            }
                            : { status: "pausado", tempo_segundos: focoAcumuladoRef.current }
                    );
                }
            }

            if (item.tipo !== "estudo") return;

            setSelectedSubject(item.materiaNome || "");
            setSpecificContent(item.topico || "");

            if (!execucaoIdRef.current || !userId) return;

            const activeGroupId = currentGroupId || (await carregarUltimoGrupoLocalmente());
            const { data, error } = await salvarSessaoFoco({
                user_id: userId,
                grupo_id: activeGroupId as string,
                disciplina: item.materiaNome || "Estudo Geral",
                conteudo_especifico: item.topico || "Sessão livre",
                tempo_minutos: 0,
                questoes_respondidas: 0,
                questoes_acertadas: 0,
                is_public: isPublicSession,
                status: "ativo",
                bloco_plano_id: item.blocoPlanoId ?? null,
                plano_id: contexto?.planoId ?? null,
                execucao_id: execucaoIdRef.current,
                ultimo_inicio: new Date().toISOString(),
                concluido_em: null,
                /*
                  A matéria nova carrega o mesmo cronograma da sessão. Sem isso, quem
                  abrisse esta sessão no feed a partir da segunda matéria (é ela que passa a
                  representar a execução) entraria numa sessão sem combinado nenhum e
                  montaria um pomodoro próprio — fora do ritmo do grupo.
                */
                modo,
                fila: cronogramaCompartilhado?.fila ?? null,
                fila_inicio_em: cronogramaCompartilhado
                    ? new Date(cronogramaCompartilhado.inicioMs).toISOString()
                    : null,
            });

            if (error || !data || data.length === 0) {
                console.error("Erro ao criar sessão da próxima matéria:", error);
                return;
            }

            /*
              A linha nova é o registro de estudo desta matéria, e só. A PARTICIPAÇÃO no
              grupo continua onde estava (`sessaoGrupoId`, fixado no início da sessão):
              trocar de matéria não é trocar de sala.

              Era aqui que o grupo se desfazia no meio de um plano — cada matéria abria uma
              sessão de grupo nova, com o anfitrião sozinho nela, enquanto quem tinha
              entrado ficava para trás na anterior.
            */
            setCreatedSession(data[0] as SessionCardItem);
        },
        [userId, currentGroupId, isPublicSession, sessaoGrupoId, contexto?.planoId, session?.id, avisarTrocaDeFase, modo, cronogramaCompartilhado]
    );

    // Avanço automático pela fila quando o tempo do item atual acaba.
    useEffect(() => {
        if (focusState !== "active" || modo !== "pomodoro" || isPaused) return;
        // Sessão em grupo tem motor próprio (logo abaixo): quem manda ali é o cronograma
        // publicado, e deixar os dois avançando faria a fila pular de dois em dois.
        if (seguindoCronograma) return;
        /*
          `faseInicioRef` só existe depois que a primeira fase foi de fato armada. Sem esta
          guarda, o efeito rodava no instante em que a sessão virava "active" — momento em
          que `restanteFase` ainda era o 0 inicial — e "concluía" o item 0 na hora: o
          primeiro pomodoro era pulado e a sessão começava direto no descanso.
        */
        if (!faseInicioRef.current) return;
        if (restanteFase > 0) return;
        if (fila.length === 0) return;

        const itemAtual = fila[indiceFila];
        if (!itemAtual) return;

        const processarFimDeItem = async () => {
            if (itemAtual.tipo === "estudo") {
                focoAcumuladoRef.current += faseDuracaoRef.current;

                if (execucaoIdRef.current) {
                    // Encadeamento de plano: essa matéria fecha aqui, com o tempo dela só.
                    await finalizarLinhaAtual(focoAcumuladoRef.current);
                    focoAcumuladoRef.current = 0;
                }
            }

            const proximoIndice = indiceFila + 1;
            const proximoItem = fila[proximoIndice];

            if (!proximoItem) {
                /*
                  A fila acabou. Encerrar a fase aqui é o que impede o último pomodoro de ser
                  contado duas vezes: o tempo dele acabou de entrar em `focoAcumuladoRef`, e
                  `segundosDeFoco()` somaria de novo o tempo decorrido na fase se ela ainda
                  parecesse em andamento.
                */
                faseInicioRef.current = null;
                await stopSession({ jaFinalizado: !!execucaoIdRef.current });
                return;
            }

            await avancarParaItem(proximoIndice, proximoItem);
        };

        processarFimDeItem();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [restanteFase, fila, indiceFila, focusState, modo, isPaused, seguindoCronograma, avancarParaItem, finalizarLinhaAtual]);

    /*
      Motor da sessão em grupo: em vez de contar o próprio tempo, olha onde o CRONOGRAMA
      publicado diz que a sessão está agora e vai para lá.

      Isso é o que sincroniza o pomodoro do grupo de verdade. Como a posição é derivada
      (fila + instante inicial), todos chegam ao mesmo item ao mesmo tempo sem ninguém
      avisar ninguém — e quem estava com o app fechado, sem internet ou entrou atrasado cai
      no ponto certo assim que volta.

      Uma pausa não move este relógio: quem pausou para de contar o próprio tempo, mas o
      combinado do grupo segue. Por isso o efeito só age enquanto a pessoa não está pausada.
    */
    const avancandoRef = useRef(false);
    useEffect(() => {
        if (!seguindoCronograma || isPaused || !cronogramaCompartilhado) return;
        // Uma passagem por vez: o efeito roda a cada segundo, e a troca de item é `async`.
        if (avancandoRef.current) return;

        const { indice, terminou } = posicaoNaFila(
            cronogramaCompartilhado.fila,
            cronogramaCompartilhado.inicioMs
        );

        if (!terminou && indice === indiceFila) return;

        avancandoRef.current = true;

        const acompanhar = async () => {
            try {
                /*
                  Credita o item que está sendo deixado. `segundosDeFoco()` já soma o
                  acumulado com o tempo cumprido da fase atual, limitado à duração dela —
                  então um item que ficou para trás porque o app passou horas fechado rende
                  no máximo o que ele durava, e um descanso não rende nada.
                */
                const totalAteAqui = segundosDeFoco();
                focoAcumuladoRef.current = totalAteAqui;

                if (execucaoIdRef.current && fila[indiceFila]?.tipo === "estudo") {
                    // Encadeamento de matérias: a que sai fecha aqui, com o tempo dela só.
                    await finalizarLinhaAtual(totalAteAqui);
                    focoAcumuladoRef.current = 0;
                }

                if (terminou) {
                    faseInicioRef.current = null;
                    await stopSession({ jaFinalizado: !!execucaoIdRef.current });
                    return;
                }

                const inicioDaFaseMs = inicioDoItemMs(
                    cronogramaCompartilhado.fila,
                    cronogramaCompartilhado.inicioMs,
                    indice
                );
                await avancarParaItem(indice, cronogramaCompartilhado.fila[indice], { inicioDaFaseMs });
            } finally {
                avancandoRef.current = false;
            }
        };

        acompanhar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [restanteFase, seguindoCronograma, isPaused, cronogramaCompartilhado, indiceFila]);

    /*
      Mantém a duração da fase atual igual à do cronograma. Importa quando o combinado é
      reescrito no meio (alguém esticou o foco, pulou o descanso): sem isto, o teto que
      `segundosDeFoco()` usa para creditar o tempo continuaria sendo o da duração antiga.
    */
    useEffect(() => {
        if (!seguindoCronograma || !cronogramaCompartilhado) return;

        const item = cronogramaCompartilhado.fila[indiceFila];
        if (item) faseDuracaoRef.current = item.duracaoMin * 60;
    }, [seguindoCronograma, cronogramaCompartilhado, indiceFila]);

    /**
     * Monta o retrato atual da sessão para gravar no aparelho. Os refs entram aqui porque
     * é neles que vivem os valores que mudam sem re-render (início e duração da fase, foco
     * acumulado, id da execução) — e é justamente esse conjunto que faltava ser salvo.
     */
    const montarSnapshot = useCallback(
        (inicio: number, grupoId: string | null): SnapshotSessaoFoco => ({
            subject: selectedSubject,
            content: specificContent,
            isPublic: isPublicSession,
            groupId: grupoId,
            modo,
            inicioMs: inicio,
            sessaoId: session?.id ?? null,
            sessaoGrupoId: sessaoGrupoId ?? null,
            ehConvidado: !!sessaoParaEntrar,
            fila,
            indiceFila,
            fase,
            faseInicioMs: faseInicioRef.current,
            faseDuracaoSeg: faseDuracaoRef.current,
            focoAcumuladoSeg: focoAcumuladoRef.current,
            execucaoId: execucaoIdRef.current,
            contexto,
            pausado: isPaused,
            pausadoSeg: pausedSecondsRef.current,
            pausadaEmMs: pausaIniciadaEmRef.current,
        }),
        [
            selectedSubject,
            specificContent,
            isPublicSession,
            modo,
            session?.id,
            sessaoGrupoId,
            sessaoParaEntrar,
            fila,
            indiceFila,
            fase,
            contexto,
            isPaused,
        ]
    );

    const persistirSessao = async (inicio: number, grupoId: string | null) => {
        await salvarSnapshotSessao(montarSnapshot(inicio, grupoId));
    };

    /*
      Regrava o snapshot a cada mudança que o torna obsoleto: trocar de item da fila, de
      fase, pausar, retomar, esticar o foco. Gravar por evento (em cada função que muda algo)
      era o desenho anterior, e foi assim que a fila acabou ficando de fora — um efeito que
      observa o estado não tem como esquecer um caminho novo.

      `restanteFase` de propósito NÃO entra nas dependências: ele muda a cada segundo, e o
      que importa (o início da fase) não muda junto.
    */
    useEffect(() => {
        if (focusState !== "active" || !startTimeRef.current) return;
        salvarSnapshotSessao(montarSnapshot(startTimeRef.current, currentGroupId));
    }, [focusState, montarSnapshot, currentGroupId, snapshotTick]);

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

        // Atualiza o carrossel de membros imediatamente, sem esperar o eco do realtime.
        await recarregarMembros();

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

    // Auto-inicia quando a sessão vem de um bloco do cronograma (rotina ou plano): a matéria e o
    // conteúdo já foram escolhidos ao montar o bloco, então pular a tela manual de configuração.
    const autoIniciadoRef = useRef(false);
    useEffect(() => {
        if (!contexto || autoIniciadoRef.current || focusState !== "config" || restaurada) return;
        autoIniciadoRef.current = true;
        startSession();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contexto, focusState, restaurada]);

    const realmenteIniciar = async (grupoId: string | null) => {
        const activeGroupId = currentGroupId || (await carregarUltimoGrupoLocalmente());
        setCurrentGroupId(activeGroupId);

        /*
          Entrando na sessão de outra pessoa: a fila NÃO é montada aqui, é adotada da
          sessão do anfitrião — é o que põe todo mundo no mesmo ciclo de foco e descanso.
          `inicioDaFila` também vem de lá, e não de agora: quem entra no meio do terceiro
          pomodoro precisa cair no terceiro pomodoro, no minuto em que ele está.
        */
        const cronogramaDoAnfitriao = sessaoParaEntrar
            ? cronogramaCompartilhado ?? cronogramaDaLinha(sessaoParaEntrar)
            : null;

        // Monta a fila de execução — só existe no modo pomodoro.
        let filaAtual: ItemFila[] = [];
        if (modo === "pomodoro") {
            if (cronogramaDoAnfitriao) {
                filaAtual = adaptarFilaDoAnfitriao(cronogramaDoAnfitriao.fila, sessaoParaEntrar);
            } else if (contexto?.origem === "plano" && contexto.planoId) {
                filaAtual = await construirFilaDoPlano(contexto.planoId, contexto.blocoId);
            } else if (contexto) {
                // Bloco único (rotina, ou plano sem mais blocos depois do tocado): 1 item só.
                filaAtual = [{
                    tipo: "estudo",
                    duracaoMin: configPomodoro.focoMin,
                    materiaNome: selectedSubject,
                    topico: specificContent,
                    blocoPlanoId: contexto.origem === "plano" ? contexto.blocoId : undefined,
                }];
            } else {
                filaAtual = construirFilaSolo();
            }
        }
        /*
          Encadeamento de PLANO (mais de uma matéria seguida) vira uma execução com id
          próprio, pra o feed compilar as matérias depois (ver services/sessions.ts) — cada
          matéria ganha sua própria linha em `sessoes_foco`.

          Um pomodoro solo com vários ciclos NÃO é isso: é uma matéria só, uma sessão só.
          A condição antiga ("mais de um item de estudo na fila") pegava o solo junto, e aí
          cada ciclo abria uma linha nova, cada uma arredondada pra cima em minutos — daí o
          total do dia acabar maior que o tempo realmente estudado.
        */
        const ehEncadeamentoDePlano =
            contexto?.origem === "plano" && filaAtual.filter((item) => item.tipo === "estudo").length > 1;
        /*
          Quem entra numa sessão de plano do anfitrião percorre as mesmas matérias que ele —
          e, como cada matéria vira uma linha própria em `sessoes_foco`, precisa da própria
          execução para o feed juntar tudo num card só depois. O id é dele, não do
          anfitrião: são registros de estudo diferentes, de pessoas diferentes.
        */
        const ehEncadeamentoDoAnfitriao =
            !!cronogramaDoAnfitriao &&
            new Set(
                filaAtual.filter((item) => item.tipo === "estudo").map((item) => item.materiaNome)
            ).size > 1;

        execucaoIdRef.current =
            ehEncadeamentoDePlano || ehEncadeamentoDoAnfitriao ? Crypto.randomUUID() : null;

        /*
          Onde a sessão está agora. Para quem começa, é o item 0 no instante presente; para
          quem entra no meio, é o ponto em que o cronograma do anfitrião já chegou.
        */
        const inicioDaFilaMs = cronogramaDoAnfitriao?.inicioMs ?? Date.now();
        const posicaoInicial =
            modo === "pomodoro" && filaAtual.length > 0
                ? posicaoNaFila(filaAtual, inicioDaFilaMs)
                : { indice: 0, restanteSeg: 0, terminou: false };

        const primeiroItem = filaAtual[posicaoInicial.indice];

        // O cronograma do anfitrião já se esgotou enquanto a pessoa decidia entrar.
        if (cronogramaDoAnfitriao && (posicaoInicial.terminou || cronogramaDoAnfitriao.encerrada)) {
            toast.info("Essa sessão já terminou. Comece a sua para o pessoal entrar.", "Sessão encerrada");
            cancelarEntradaSessao();
            return;
        }

        // Primeira vez salvando essa sessão — insere e guarda o ID
        const { data, error } = await salvarSessaoFoco({
            user_id: userId as string,
            grupo_id: activeGroupId as string,
            disciplina: (primeiroItem?.materiaNome ?? selectedSubject) || "Estudo Geral",
            conteudo_especifico: (primeiroItem?.topico ?? specificContent) || "Sessão livre",
            tempo_minutos: 0,
            questoes_respondidas: 0,
            questoes_acertadas: 0,
            is_public: isPublicSession,
            status: "ativo",
            bloco_rotina_id: contexto?.origem === "rotina" ? contexto.blocoId : null,
            bloco_plano_id: primeiroItem?.blocoPlanoId ?? (contexto?.origem === "plano" ? contexto.blocoId : null),
            plano_id: contexto?.origem === "plano" ? contexto.planoId ?? null : null,
            execucao_id: execucaoIdRef.current,
            ultimo_inicio: new Date().toISOString(),
            concluido_em: null,
            /*
              Cronograma publicado junto com a sessão. É o que permite a outra pessoa entrar
              depois e cair na mesma fase que todo mundo, sem precisar de ninguém avisando
              (ver a migration `20260805220000_cronograma_compartilhado_sessao.sql`).

              Quem entrou republica o mesmo cronograma na própria linha, com a MESMA origem:
              assim a sessão dele também é entrável, e continua contando a mesma história.
            */
            modo,
            fila: modo === "pomodoro" && filaAtual.length > 0 ? filaAtual : null,
            fila_inicio_em:
                modo === "pomodoro" && filaAtual.length > 0
                    ? new Date(inicioDaFilaMs).toISOString()
                    : null,
        });

        if (error || !data || data.length === 0) {
            console.error("Erro ao criar sessão de foco:", error);
            toast.error("Não foi possível iniciar a sessão. Tente novamente.");
            setFocusState("config");
            return;
        }

        const insertedSession = data[0];
        // Define a sessão no estado para ativar a visualização de grupo
        setCreatedSession(insertedSession);
        // Ponto de encontro do grupo por toda a sessão, mesmo que a matéria mude depois.
        setSessaoGrupoFixa(sessaoParaEntrar ? sessaoParaEntrar.id : insertedSession.id);

        // verifica se a sessão foi criada localmente e se ela é pública
        if (isPublicSession && !sessaoParaEntrar) {
            await handleJoinGroupSession(insertedSession, { funcao: "anfitriao" });
        }
        //se veio uma sessão já existente via parâmetro da rota, também entra nela
        if (sessaoParaEntrar) {
            await handleJoinGroupSession(sessaoParaEntrar, { funcao: "membro" });
        }

        focoAcumuladoRef.current = 0;

        // O relógio só começa depois que a sessão existe no banco: contar desde antes do
        // insert somava a latência da rede ao tempo de estudo.
        const inicioReal = Date.now();
        await persistirSessao(inicioReal, grupoId);

        /*
          A fila só é publicada aqui, junto com a primeira fase e no mesmo lote de
          atualização — nunca antes dos `await` acima. O efeito de avanço automático dispara
          assim que existe fila com a sessão ativa, então uma fila publicada cedo (enquanto
          `restanteFase` ainda valia 0) fazia o primeiro item ser descartado na largada.
        */
        if (modo === "pomodoro" && primeiroItem) {
            faseDuracaoRef.current = primeiroItem.duracaoMin * 60;
            /*
              A fase começa onde o cronograma diz que ela começou — que é `inicioReal` para
              quem está criando a sessão, mas um instante no passado para quem entrou no meio
              do terceiro pomodoro. Sem isso, quem chega depois ganharia um ciclo inteiro do
              zero e ficaria defasado do grupo pelo resto da sessão.
            */
            faseInicioRef.current = inicioDoItemMs(filaAtual, inicioDaFilaMs, posicaoInicial.indice);
            setFase(primeiroItem.tipo === "estudo" ? "foco" : primeiroItem.ehLongo ? "descansoLongo" : "descansoCurto");
            setRestanteFase(posicaoInicial.restanteSeg || faseDuracaoRef.current);
        } else {
            faseInicioRef.current = null;
        }

        startTimeRef.current = inicioReal;
        setTimerSeconds(0);
        setFila(filaAtual);
        setIndiceFila(posicaoInicial.indice);
        setRestaurada(false);
        setFocusState("active");
    };

    /**
     * Pausa ou retoma a sessão.
     *
     * O tempo gravado no banco (na linha da sessão e na participação do grupo) é sempre o
     * mesmo `segundosDeFoco()` que a tela usa — antes a pausa gravava um contador paralelo,
     * derivado do relógio de parede da sessão, que no pomodoro incluía até o descanso.
     */
    const togglePause = async () => {
        if (!session?.id) {
            console.error("Nenhuma sessão foi encontrada:", session);
            if (isPaused) toast.error("Não foi possível retomar a sessão.");
            return;
        }

        const nowIso = new Date().toISOString();

        if (isPaused) {
            if (modo === "cronometro") {
                // Retomar: cria um novo startTime baseado nos segundos já acumulados.
                // O snapshot inteiro (com este novo início) é regravado pelo efeito que
                // observa `isPaused`, logo depois deste `setIsPaused(false)`.
                startTimeRef.current = Date.now() - pausedSecondsRef.current * 1000;
            } else if (seguindoCronograma) {
                /*
                  Sessão em grupo: a pausa é sua, o cronograma é do grupo. O relógio
                  combinado não anda para trás porque uma pessoa parou — o que a pausa faz é
                  não contar o tempo parado como estudo, e isso se consegue empurrando o
                  início da fase para frente pelo tanto que a pausa durou.
                */
                if (faseInicioRef.current && pausaIniciadaEmRef.current) {
                    faseInicioRef.current += Date.now() - pausaIniciadaEmRef.current;
                }
            } else {
                // Retoma a fase de onde parou (pausedSecondsRef guarda o restante da fase).
                faseInicioRef.current = Date.now() - (faseDuracaoRef.current - pausedSecondsRef.current) * 1000;
            }
            pausaIniciadaEmRef.current = null;

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

            if (isPublicSession && sessaoGrupoId) {
                /*
                  `tempo_segundos` fica de fora: ele já foi congelado na pausa e, a partir
                  deste `ultimo_inicio`, a tela "Focando juntos" volta a somar o tempo ao
                  vivo por cima dele. Regravá-lo aqui contaria o mesmo trecho duas vezes.
                */
                const { error: updateMemberError } = await updateTabSessaoMembros(userId || "", sessaoGrupoId, {
                    ultimo_inicio: nowIso,
                    status: "ativo",
                });
                if (updateMemberError) {
                    console.error("Erro ao atualizar membro ao retomar:", updateMemberError);
                    toast.error("Não foi possível sincronizar sua sessão com o grupo.");
                    return;
                }

                await recarregarMembros();
            }

            setIsPaused(false);
            return;
        }

        // Pausar: congela o tempo de foco acumulado até aqui e para o interval.
        const focoAtual = segundosDeFoco();

        const { error: pauseError } = await atualizarSessaoFoco(session.id, {
            status: "pausado",
            tempo_minutos: await calculateFocusSessionMinutes(focoAtual),
        });
        if (pauseError) {
            console.error("Erro ao pausar sessão:", pauseError);
            toast.error("Não foi possível pausar a sessão.");
        }

        if (isPublicSession && sessaoGrupoId) {
            const { error: updateMemberError } = await updateTabSessaoMembros(userId || "", sessaoGrupoId, {
                status: "pausado",
                tempo_segundos: focoAtual,
            });
            if (updateMemberError) {
                console.error("Erro ao pausar membro:", updateMemberError);
                toast.error("Não foi possível sincronizar sua sessão com o grupo.");
                return;
            }

            await recarregarMembros();
        }

        // Mesmo valor que acabou de ser gravado no banco, para pausa e registro não
        // divergirem por um segundo.
        pausedSecondsRef.current = modo === "cronometro" ? focoAtual : restanteFase;
        // Quanto a pausa durou é o que será descontado do tempo de foco ao retomar numa
        // sessão em grupo, onde a fase não pode ser adiada.
        pausaIniciadaEmRef.current = Date.now();
        if (intervalRef.current) clearInterval(intervalRef.current);
        setIsPaused(true);
    };

    /**
     * Tempo de foco que vira sessão. Descanso nunca entra na conta.
     *
     * No cronômetro o tempo sai de `startTimeRef`, e não do estado `timerSeconds`: o
     * batimento cardíaco chama isto de dentro de um `setInterval`, cuja closure congela o
     * estado do render em que foi criada — gravaria sempre o mesmo valor antigo. O ref é
     * lido na hora, e `timerSeconds` é derivado dele de qualquer forma.
     */
    const segundosDeFoco = () => {
        if (modo === "cronometro") {
            if (isPaused) return pausedSecondsRef.current;
            return startTimeRef.current
                ? Math.floor((Date.now() - startTimeRef.current) / 1000)
                : timerSeconds;
        }
        const naFase =
            fase === "foco" && faseInicioRef.current
                ? Math.min(faseDuracaoRef.current, Math.floor((Date.now() - faseInicioRef.current) / 1000))
                : 0;
        return focoAcumuladoRef.current + naFase;
    };

    /**
     * Encerra a sessão. Para de contar o tempo, reseta os estados relacionados e navega
     * para o modal de feedback. `jaFinalizado` é passado só quando a fila de um
     * encadeamento de plano se esgota naturalmente — nesse caso a última matéria já foi
     * marcada como concluída pelo efeito de avanço automático, e aqui só falta limpar o
     * estado local e navegar (evita finalizar a mesma linha duas vezes, com tempo errado).
     */
    const stopSession = async (opcoes?: { jaFinalizado?: boolean }) => {
        setFocusState("config");

        // Salva uma cópia dos valores antes de resetar
        const finalSubject = selectedSubject;
        const finalContent = specificContent;
        const finalDuration = segundosDeFoco();
        const finalIsPublic = isPublicSession;
        const finalGroupId = currentGroupId || (await carregarUltimoGrupoLocalmente());
        const execucaoId = execucaoIdRef.current;
        const currentSessionId = session?.id;
        const currentGrupoSessaoId = sessaoGrupoId;
        // Numa execução de plano, parar durante um descanso não deve reabrir a linha da
        // última matéria (já finalizada quando o estudo dela terminou) — só finaliza aqui
        // quando o item atual é mesmo de estudo (sessão solo/bloco único sempre finaliza).
        const itemAtualEhEstudo = !execucaoId || fila[indiceFila]?.tipo === "estudo";

        setTimerSeconds(0);
        setSelectedSubject("");
        setSpecificContent("");
        startTimeRef.current = null;
        pausedSecondsRef.current = 0;
        faseInicioRef.current = null;
        focoAcumuladoRef.current = 0;
        setIsPaused(false);
        setFase("foco");
        setFila([]);
        setIndiceFila(0);
        execucaoIdRef.current = null;
        setContexto(null);
        setRestaurada(false);
        /*
          Encerrou: a tela volta a ser um "config" limpo. Sem zerar estes dois, ao voltar do
          modal de feedback a aba (que nunca foi desmontada) renderizaria de novo a entrada
          na sessão em grupo — ou trataria a próxima sessão como revisão da anterior.
        */
        setSessaoParaEntrar(null);
        setSessaoGrupoFixa(undefined);
        setCreatedSession(null);
        setRevisao(null);

        if (!opcoes?.jaFinalizado && itemAtualEhEstudo) {
            if (isPublicSession && currentGrupoSessaoId && userId) {
                await updateTabSessaoMembros(userId, currentGrupoSessaoId, {
                    status: "concluido",
                    tempo_segundos: finalDuration,
                });

                /*
                  Se quem está saindo é o anfitrião, a sessão não pode ficar órfã enquanto
                  os colegas ainda focam: o bastão passa para quem está lá há mais tempo (a
                  escolha e a permissão ficam no RPC, ver services/sessions.ts). Quando não
                  sobra ninguém, o RPC devolve null e a sessão acaba junto — nada a fazer.
                */
                const souAnfitriao = members.some(
                    (membro) => membro.membro_id === userId && membro.funcao === "anfitriao"
                );
                if (souAnfitriao) {
                    const { novoAnfitriaoId } = await transferirAnfitriaoDaSessao(currentGrupoSessaoId);
                    if (novoAnfitriaoId) {
                        toast.info("Você saiu da sessão. O grupo continua com um novo anfitrião.");
                    }
                }
            }

            if (currentSessionId) {
                const { error: updateSessionError } = await atualizarSessaoFoco(currentSessionId, {
                    tempo_minutos: await calculateFocusSessionMinutes(finalDuration),
                    concluido_em: new Date().toISOString(),
                    status: "salvo",
                });
                if (updateSessionError) {
                    console.error("Erro ao finalizar sessão de foco:", updateSessionError);
                }
            }
        }

        if (intervalRef.current) clearInterval(intervalRef.current);

        // A sessão acabou: o retrato salvo no aparelho não vale mais nada.
        await limparSnapshotSessao();

        if (execucaoId) {
            // Encadeamento de plano: um quiz só, combinando as matérias estudadas.
            router.push({
                pathname: "/(modals)/focus-feedback",
                params: { execucaoId, groupId: finalGroupId || undefined },
            });
            return;
        }

        const sessionIdParaFeedback = revisao?.sessionId || currentSessionId || undefined;

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
                oldDuration: revisao?.oldDuration || undefined,
                // O quiz gerado por IA por enquanto só entra no modo cronômetro (ver
                // focus-feedback.tsx); pomodoro mantém o quiz fixo até isso ser revisitado.
                modo,
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

    /**
     * Muda a duração do item atual e republica o cronograma para todo mundo.
     *
     * É assim que "esticar o foco" e "pular o descanso" funcionam numa sessão em grupo: em
     * vez de mandar um comando "avance agora" — que quem estivesse offline naquele segundo
     * perderia —, o combinado em si é reescrito. Quem recebe agora e quem só voltar depois
     * chegam à mesma conclusão, porque os dois recalculam a partir da mesma fila.
     */
    const reescreverItemAtual = async (novaDuracaoMin: number) => {
        // Só o dono muda o combinado — e a política de UPDATE do banco também não deixaria
        // outra pessoa escrever nessa linha.
        if (!cronogramaCompartilhado || !sessaoGrupoId || !souDonoDoCronograma) return;

        const novaFila = cronogramaCompartilhado.fila.map((item, i) =>
            i === indiceFila ? { ...item, duracaoMin: novaDuracaoMin } : item
        );

        setFila(novaFila);
        /*
          Escreve na sessão que o grupo segue, não na linha da matéria atual: num plano
          encadeado a matéria corrente é uma linha nova a cada troca, e republicar nela não
          chegaria a ninguém — todos leem o cronograma da sessão em que entraram.
        */
        await republicarFilaDaSessao(sessaoGrupoId, novaFila);
    };

    const pularDescanso = () => {
        if (seguindoCronograma) {
            /*
              Encurta o descanso até o ponto em que ele já está: o item acaba agora para
              todos ao mesmo tempo, e o efeito que segue o cronograma leva cada aparelho
              para o próximo item sozinho.
            */
            const cumpridoMin = Math.max(0, faseDuracaoRef.current - restanteFase) / 60;
            reescreverItemAtual(cumpridoMin);
            return;
        }

        const proximoIndice = indiceFila + 1;
        const proximoItem = fila[proximoIndice];
        if (!proximoItem) {
            stopSession();
            return;
        }
        avancarParaItem(proximoIndice, proximoItem);
    };

    const estenderFoco = () => {
        if (seguindoCronograma) {
            // O grupo inteiro ganha os 5 minutos — o combinado é um só.
            reescreverItemAtual(faseDuracaoRef.current / 60 + 5);
            return;
        }

        faseDuracaoRef.current += 5 * 60;
        setRestanteFase((r) => r + 5 * 60);
        // A fase ficou mais longa só no ref: sem isto, reabrir o app desfazia a extensão.
        setSnapshotTick((t) => t + 1);
    };

    /**
     * Formata o tempo restante ou decorrido para exibição no relógio da sessão. No modo cronômetro, mostra horas, minutos e segundos; no modo pomodoro, mostra minutos e segundos restantes na fase atual.
     */
    const textoRelogio =
        modo === "cronometro" ? formatarHMS(timerSeconds) : formatarMS(restanteFase);

    const progressoFase =
        faseDuracaoRef.current > 0 ? 1 - restanteFase / faseDuracaoRef.current : 0;

    /** Progresso "Ciclo X de Y" mostrado durante um pomodoro solo (oculto quando há contexto). */
    const totalCiclos = fila.filter((item) => item.tipo === "estudo").length || configPomodoro.qtdPomodoros;
    const cicloAtual = fila.slice(0, indiceFila + 1).filter((item) => item.tipo === "estudo").length || 1;

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
                                onChangeConfig={(novaConfig) => {
                                    setConfigTocada(true);
                                    setConfigPomodoro(novaConfig);
                                }}
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
                        ciclo={cicloAtual}
                        totalCiclos={totalCiclos}
                        contexto={contexto}
                        autoFoco
                        /*
                          Numa sessão em grupo, esticar o foco e pular o descanso mudam o
                          combinado de todo mundo — então só quem criou a sessão vê esses
                          botões. Quem entrou segue o ritmo (e pode sair quando quiser).
                        */
                        podeControlarCronograma={!seguindoCronograma || souDonoDoCronograma}
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
                                    sessionId: sessaoGrupoId || undefined,
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
