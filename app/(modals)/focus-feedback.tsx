import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { X, Lightbulb, CheckCheck, Trophy, RotateCw, Lock, Send, Bookmark, Clock, Check } from "lucide-react-native";
import { HADES } from "@/constants/hades";
import { useAuth } from "@/hooks/useAuth";
import { salvarSessaoFoco, atualizarSessaoFoco, calculateFocusSessionMinutes, buscarSessoesPorExecucao } from "@/services/sessions";
import { syncProfileStatsAfterFocusSession } from "@/services/profileStats";
import { registrarSessaoConcluida } from "@/services/gamificacao";
import { registrarOfensivaGrupo } from "@/services/grupos";
import { buscarPerfil } from "@/services/auth";
import { gerarQuizIA } from "@/services/quizIA";
import { toast } from "@/services/toast";
import type { QuizPergunta } from "@/types/quiz";
import type { SessionCardItem } from "@/types/sessions";
import { usePreferencias } from "@/hooks/usePreferencias";
import { salvarAnotacoes } from "@/services/anotacoes";
import FormAnotacoes from "@/components/sessao/FormAnotacoes";
import EtapaFotoSessao from "@/components/sessao/EtapaFotoSessao";
import { ANOTACOES_VAZIAS, type AnotacoesSessao } from "@/types/anotacoes";

const MAX_QUESTOES_EXECUCAO = 15;

// Helper para misturar qualquer array (Fisher-Yates) sem mutar o original
const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

/** Idade em anos completos a partir da data de nascimento do perfil (null se ausente/inválida). */
const calcularIdade = (dataNascimento?: string | null): number | null => {
    if (!dataNascimento) return null;
    const nascimento = new Date(dataNascimento);
    if (Number.isNaN(nascimento.getTime())) return null;

    const hoje = new Date();
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const aindaNaoFezAniversario =
        hoje.getMonth() < nascimento.getMonth() ||
        (hoje.getMonth() === nascimento.getMonth() && hoje.getDate() < nascimento.getDate());
    if (aindaNaoFezAniversario) idade -= 1;

    return idade;
};

export default function FocusFeedbackModal() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const modo = (params.modo as string) || "cronometro";
    // Presente quando a sessão veio de um encadeamento de plano com mais de uma matéria
    // (ver app/(tabs)/focus.tsx) — o quiz combina todas elas em vez de uma matéria só.
    const execucaoId = (params.execucaoId as string) || null;

    // Pega o ID do usuário para salvar no Supabase
    const { userId } = useAuth();

    // Respostas dadas pelo usuário, por id de questão. Começa vazio porque a quantidade de
    // questões varia (10 numa sessão normal, até 15 numa execução de plano combinada).
    const [answers, setAnswers] = useState<Record<number, string | null>>({});

    // Mostra as respotas corretas e erradas após o "Enviar"
    const [showResults, setShowResults] = useState(false);

    // Linhas de sessoes_foco da execução (uma por matéria) — só populado quando execucaoId
    // existe, pra distribuir os acertos de volta pra cada matéria ao salvar o resultado.
    const [linhasExecucao, setLinhasExecucao] = useState<SessionCardItem[]>([]);

    // Quiz fixo de fallback: usado quando a IA falha, ou (por enquanto) em sessões pomodoro.
    const perguntasGenericas: QuizPergunta[] = [
        { id: 1, text: "Qual é o resultado da soma de 1/2 e 1/4?", options: ["3/4", "1/6", "2/6", "1/8"], correctAnswer: "3/4" },
        { id: 2, text: "Qual a forma irredutível da fração 8/12?", options: ["2/3", "4/6", "3/4", "1/2"], correctAnswer: "2/3" },
        { id: 3, text: "Qual destas frações é a maior?", options: ["2/5", "1/3", "3/4", "4/7"], correctAnswer: "3/4" },
        { id: 4, text: "Como se escreve a fração 3/5 em número decimal?", options: ["0,6", "0,3", "0,5", "3,5"], correctAnswer: "0,6" },
        { id: 5, text: "Quanto é 1/3 de 60?", options: ["20", "15", "30", "10"], correctAnswer: "20" },
        { id: 6, text: "Qual é o resultado da multiplicação de 2/3 por 3/4?", options: ["1/2", "5/12", "5/7", "8/9"], correctAnswer: "1/2" },
        { id: 7, text: "O que é uma fração imprópria?", options: ["O numerador é maior que o denominador", "O denominador é maior que o numerador", "Ambos são iguais", "Possui um número inteiro"], correctAnswer: "O numerador é maior que o denominador" },
        { id: 8, text: "Qual é o resultado de 3/4 menos 1/2?", options: ["1/4", "2/6", "1/8", "1/2"], correctAnswer: "1/4" },
        { id: 9, text: "Como se escreve o número misto 2 e 1/2 em fração imprópria?", options: ["5/2", "3/2", "2/2", "4/2"], correctAnswer: "5/2" },
        { id: 10, text: "Se eu comi 3/8 de uma pizza, que fração da pizza sobrou?", options: ["5/8", "3/8", "1/8", "8/8"], correctAnswer: "5/8" },
    ];

    // Aqui guardamos no STATE a versão final (e já embaralhada) das perguntas. Começa `null`
    // porque no modo cronômetro elas vêm da IA (assíncrono); só troca UMA VEZ, quando a
    // geração termina, para as opções não mudarem de lugar depois que o usuário já respondeu.
    const [shuffledQuestions, setShuffledQuestions] = useState<QuizPergunta[] | null>(null);
    const [carregandoQuiz, setCarregandoQuiz] = useState(true);
    const perguntasAtuais = shuffledQuestions ?? [];

    useEffect(() => {
        let cancelado = false;

        const aplicarPerguntas = (perguntas: QuizPergunta[]) => {
            if (cancelado) return;
            setShuffledQuestions(perguntas.map((pergunta) => ({ ...pergunta, options: shuffleArray(pergunta.options) })));
            setCarregandoQuiz(false);
        };

        const carregarQuiz = async () => {
            // Pomodoro mantém o quiz fixo por enquanto — a IA entra só no modo cronômetro.
            if ((modo === "pomodoro" && !execucaoId) || !userId) {
                aplicarPerguntas(perguntasGenericas);
                return;
            }

            const { data: perfil } = await buscarPerfil(userId);
            const perfilComum = {
                idade: calcularIdade(perfil?.data_nascimento),
                objetivo: perfil?.objetivo ?? null,
                nivelEnsino: perfil?.nivel_ensino ?? null,
                ritmoEstudo: perfil?.ritmo_estudo ?? null,
                dificuldade: perfil?.dificuldade ?? null,
            };

            if (execucaoId) {
                // Encadeamento de plano: busca cada matéria estudada e combina num quiz só.
                const { data: linhas, error } = await buscarSessoesPorExecucao(execucaoId);
                if (!cancelado) setLinhasExecucao(linhas);

                if (error || linhas.length === 0) {
                    aplicarPerguntas(perguntasGenericas);
                    return;
                }

                const { data: perguntasGeradas } = await gerarQuizIA({
                    ...perfilComum,
                    maxQuestoes: MAX_QUESTOES_EXECUCAO,
                    materias: linhas.map((linha) => ({
                        materia: linha.disciplina,
                        conteudo: linha.conteudo_especifico || "",
                        minutosEstudados: linha.tempo_minutos,
                    })),
                });

                aplicarPerguntas(perguntasGeradas ?? perguntasGenericas);
                return;
            }

            const { data: perguntasGeradas } = await gerarQuizIA({
                ...perfilComum,
                materias: [{
                    materia: (params.subject as string) || "Estudo Geral",
                    conteudo: (params.content as string) || "",
                }],
            });

            // Falha ou resposta vazia da IA nunca pode travar o encerramento da sessão.
            aplicarPerguntas(perguntasGeradas ?? perguntasGenericas);
        };

        carregarQuiz();
        return () => {
            cancelado = true;
        };
        // Roda uma única vez, ao abrir a tela: o quiz não pode trocar no meio da resposta.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const isComplete = !!shuffledQuestions && perguntasAtuais.every((q) => answers[q.id] != null);
    const answeredCount = perguntasAtuais.filter((q) => answers[q.id] != null).length;
    const totalQuestoes = perguntasAtuais.length || 10;

    const [saving, setSaving] = useState(false);
    // Guarda o ID da sessão assim que ela é inserida no banco (evita duplicatas ao refazer)
    const [savedSessionId, setSavedSessionId] = useState<string | null>(null);

    /*
      Etapas opcionais mostradas depois que a sessão já foi gravada, nesta ordem:
      foto do momento → anotações. Cada uma fica atrás da sua preferência em
      app/(modals)/settings.tsx ("Foto ao fim da sessão" e "Anotar ao fim da sessão"),
      e as duas são puláveis — quem desligar as duas volta direto pro app.

      A ordem é essa porque a foto é do ambiente daquele instante (a pessoa ainda está na
      mesa) e a anotação é reflexão, que sobrevive a alguns minutos. Anotar depois também
      é possível pela sessão salva, em app/(modals)/detalhes-sessao.tsx.
    */
    const { prefs } = usePreferencias(userId);
    const [etapaFoto, setEtapaFoto] = useState(false);
    const [etapaAnotacoes, setEtapaAnotacoes] = useState(false);
    const [anotacoes, setAnotacoes] = useState<AnotacoesSessao>(ANOTACOES_VAZIAS);
    const [salvandoAnotacoes, setSalvandoAnotacoes] = useState(false);
    // Numa execução de plano são várias linhas (uma por matéria); foto e anotação valem pra todas.
    const [idsDaSessao, setIdsDaSessao] = useState<string[]>([]);

    /** Fecha a sessão: abre a primeira etapa opcional ligada, ou volta direto. */
    const concluirFluxo = (ids: (string | null | undefined)[]) => {
        const validos = ids.filter((id): id is string => !!id);
        if (validos.length === 0) {
            router.back();
            return;
        }

        setIdsDaSessao(validos);

        if (prefs.fotoAposSessao) {
            setEtapaFoto(true);
            return;
        }
        if (prefs.anotarAposQuiz) {
            setEtapaAnotacoes(true);
            return;
        }
        router.back();
    };

    /** Saída da etapa de foto (salvou ou pulou): segue pras anotações ou encerra. */
    const concluirEtapaFoto = () => {
        setEtapaFoto(false);
        if (prefs.anotarAposQuiz) {
            setEtapaAnotacoes(true);
            return;
        }
        router.back();
    };

    const salvarEtapaAnotacoes = async () => {
        setSalvandoAnotacoes(true);
        const resultados = await Promise.all(idsDaSessao.map((id) => salvarAnotacoes(id, anotacoes)));
        setSalvandoAnotacoes(false);

        if (resultados.some((resultado) => !resultado.sucesso)) {
            toast.error("Não foi possível salvar suas anotações.");
            return;
        }
        router.back();
    };

    /**
     * Distribui o resultado do quiz combinado de volta pra cada matéria da execução: cada
     * linha de sessoes_foco (uma por matéria) recebe só as questões e acertos que são dela,
     * em vez de um único total genérico. O tempo de cada matéria já foi salvo durante a
     * execução (ver app/(tabs)/focus.tsx) — aqui só atualiza questões/status.
     */
    const salvarResultadoNaExecucao = async (status: string) => {
        const resultados = await Promise.all(
            linhasExecucao.map((linha) => {
                const questoesDaMateria = perguntasAtuais.filter((q) => q.materia === linha.disciplina);
                const acertosDaMateria = questoesDaMateria.filter((q) => answers[q.id] === q.correctAnswer).length;

                return atualizarSessaoFoco(linha.id, {
                    questoes_respondidas: questoesDaMateria.length,
                    questoes_acertadas: acertosDaMateria,
                    status,
                });
            })
        );

        return resultados.every((resultado) => !resultado.error);
    };

    const persistFocusSession = async (status: string) => {
        // Impede gravação sem usuário autenticado, porque a tabela exige `user_id`.
        if (!userId) {
            toast.error("Usuário não autenticado.");
            return false;
        }

        // Liga o estado de salvamento para bloquear múltiplos cliques durante a escrita no banco.
        setSaving(true);

        const groupId = (params.groupId as string) || null;

        if (execucaoId) {
            const sucesso = await salvarResultadoNaExecucao(status);
            setSaving(false);

            if (!sucesso) {
                toast.error("Não foi possível salvar a sessão. Tente novamente.");
                return false;
            }

            await syncProfileStatsAfterFocusSession(userId);
            await registrarSessaoConcluida(userId);
            if (groupId) await registrarOfensivaGrupo(groupId);
            return true;
        }

        // Converte os segundos reais do cronômetro para os minutos que serão gravados no banco.
        const durationSecs = Number(params.duration) || 0;
        const sessionMinutes = await calculateFocusSessionMinutes(durationSecs);

        // Usa o ID vindo do Brain ou o ID recém-criado nesta tela para atualizar em vez de duplicar.
        const existingId = (params.sessionId as string) || savedSessionId;

        // Guarda erro em variável única para tratar insert e update do mesmo jeito.
        let dbError = null;

        if (existingId) {
            // `oldDuration` vem em minutos quando a sessão é uma revisão/refação do Brain.
            const oldDuration = Number(params.oldDuration) || 0;

            // Se o registro foi criado nesta mesma tela, não soma de novo; se veio do Brain, acumula o novo tempo.
            const totalMinutes = savedSessionId ? sessionMinutes : (oldDuration + sessionMinutes);

            // Atualiza o registro existente com as respostas atuais e o status escolhido.
            const { error } = await atualizarSessaoFoco(existingId, {
                grupo_id: groupId,
                questoes_respondidas: perguntasAtuais.length,
                questoes_acertadas: score,
                status,
                tempo_minutos: totalMinutes,
            });
            dbError = error;
        } else {
            // Insere a sessão pela primeira vez assim que o usuário conclui as 10 questões.
            const { data, error } = await salvarSessaoFoco({
                user_id: userId,
                grupo_id: groupId,
                disciplina: params.subject as string || "Estudo Geral",
                conteudo_especifico: params.content as string || "Sessão livre",
                tempo_minutos: sessionMinutes,
                questoes_respondidas: perguntasAtuais.length,
                questoes_acertadas: score,
                is_public: params.isPublic === "true",
                status,
                ultimo_inicio: new Date().toISOString(),
                concluido_em: null,
            });
            dbError = error;

            // Guarda o ID retornado para que refazer ou salvar depois atualize a mesma sessão.
            if (!error && data) {
                const inserted = (data as any)[0];
                if (inserted?.id) setSavedSessionId(inserted.id);
            }
        }

        // Desliga o estado visual de salvamento antes de mostrar erro ou gabarito.
        setSaving(false);

        if (dbError) {
            console.error("Erro ao salvar sessão:", dbError);
            toast.error("Não foi possível salvar a sessão. Tente novamente.");
            return false;
        }

        // Recalcula perfil, estatísticas e medalhas depois que a sessão já existe no banco.
        await syncProfileStatsAfterFocusSession(userId);
        await registrarSessaoConcluida(userId);
        if (groupId) await registrarOfensivaGrupo(groupId);

        return true;
    };

    const handleSubmit = async (status: string = "salvo") => {
        if (!showResults) {
            // Passo 1: Avaliar/Validar
            if (!isComplete) {
                toast.warning("Por favor, responda todas as questões.", "Incompleto");
                return;
            }
            const initialStatus = isHighScore ? "salvo" : "pendente";
            const saved = await persistFocusSession(initialStatus);
            if (saved) setShowResults(true); // Muda pra tela de review do gabarito
        } else {
            // Passo 2: Salvar ou atualizar sessão no Supabase
            if (!userId) {
                toast.error("Usuário não autenticado.");
                return;
            }

            setSaving(true);

            const groupId = (params.groupId as string) || null;

            if (execucaoId) {
                const sucesso = await salvarResultadoNaExecucao(status);
                setSaving(false);

                if (!sucesso) {
                    toast.error("Não foi possível salvar a sessão. Tente novamente.");
                    return;
                }

                await syncProfileStatsAfterFocusSession(userId);
                await registrarSessaoConcluida(userId);
                if (groupId) await registrarOfensivaGrupo(groupId);

                concluirFluxo(linhasExecucao.map((linha) => linha.id));
                return;
            }

            // Converte os segundos reais do cronômetro para os minutos que serão gravados no banco.
            const durationSecs = Number(params.duration) || 0;
            const sessionMinutes = await calculateFocusSessionMinutes(durationSecs);

            let dbError = null;
            let idRecemInserido: string | null = null;

            // Usa o ID de um param (sessão de revisão/refazer vindo do Brain Hub)
            // OU o ID que foi guardado ao salvar pela primeira vez nesta sessão
            const existingId = (params.sessionId as string) || savedSessionId;

            if (existingId) {
                // Atualiza o registro existente (refazer, revisão ou segunda tentativa)
                // `oldDuration` vem em minutos quando a sessão é uma revisão/refação do Brain.
                const oldDuration = Number(params.oldDuration) || 0;

                // Se o registro foi criado nesta mesma tela, não soma de novo; se veio do Brain, acumula o novo tempo.
                const totalMinutes = savedSessionId ? sessionMinutes : (oldDuration + sessionMinutes);

                const { error } = await atualizarSessaoFoco(existingId, {
                    grupo_id: groupId,
                    questoes_respondidas: perguntasAtuais.length,
                    questoes_acertadas: score,
                    status: status,
                    tempo_minutos: totalMinutes,
                });
                dbError = error;
            } else {
                // Primeira vez salvando essa sessão — insere e guarda o ID
                const { data, error } = await salvarSessaoFoco({
                    user_id: userId,
                    grupo_id: groupId,
                    disciplina: params.subject as string || "Estudo Geral",
                    conteudo_especifico: params.content as string || "Sessão livre",
                    tempo_minutos: sessionMinutes,
                    questoes_respondidas: perguntasAtuais.length,
                    questoes_acertadas: score,
                    is_public: params.isPublic === "true",
                    status: status,
                    ultimo_inicio: new Date().toISOString(),
                    concluido_em: null,
                });
                dbError = error;
                if (!error && data) {
                    // Guarda o ID para que um eventual "refazer" não insira duplicata
                    const inserted = (data as any)[0];
                    if (inserted?.id) {
                        setSavedSessionId(inserted.id);
                        // Guardado também numa variável local: o setState só vale no próximo
                        // render, e a etapa de anotações precisa do ID agora.
                        idRecemInserido = inserted.id;
                    }
                }
            }

            setSaving(false);

            if (dbError) {
                console.error("Erro ao salvar sessão:", dbError);
                toast.error("Não foi possível salvar a sessão. Tente novamente.");
                return;
            }

            // Recalcula perfil, estatísticas e medalhas depois que a sessão já existe no banco.
            await syncProfileStatsAfterFocusSession(userId);
            await registrarSessaoConcluida(userId);
            if (groupId) await registrarOfensivaGrupo(groupId);

            concluirFluxo([existingId, idRecemInserido]);
        }
    };

    const handleAnswerChange = (questionNumber: number, val: string) => {
        if (showResults) return; // Se já avaliou, não pode trocar
        setAnswers(prev => ({ ...prev, [questionNumber]: val }));
    };

    // Conta quantos acertos teve no geral só para mostrar ao usuário um resumo (opcional)
    const score = perguntasAtuais.reduce((acc, curr) => {
        return answers[curr.id] === curr.correctAnswer ? acc + 1 : acc;
    }, 0);

    // "Bom desempenho" = mais de 70% de acerto (equivale ao corte antigo de >7 em 10).
    const isHighScore = totalQuestoes > 0 && score / totalQuestoes > 0.7;

    /*
      Etapas finais opcionais. A sessão JÁ está gravada quando estas telas aparecem — pular
      aqui não perde nada do estudo, só deixa a foto e as anotações pra depois.
    */
    if (etapaFoto && userId) {
        return (
            <EtapaFotoSessao
                userId={userId}
                sessaoIds={idsDaSessao}
                aoConcluir={concluirEtapaFoto}
            />
        );
    }

    if (etapaAnotacoes) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top", "bottom"]}>
                <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}>
                    <Text style={{ fontSize: 20, fontWeight: "700", color: HADES.text, letterSpacing: -0.3 }}>
                        Como foi essa sessão?
                    </Text>
                    <Text style={{ fontSize: 13, color: HADES.textMuted, marginTop: 4 }}>
                        Anote agora enquanto está fresco. Dá pra editar depois pelo Banco de dados.
                    </Text>
                </View>

                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <FormAnotacoes
                        anotacoes={anotacoes}
                        aoMudar={(campo, valor) => setAnotacoes((atual) => ({ ...atual, [campo]: valor }))}
                        bloqueado={salvandoAnotacoes}
                    />
                </ScrollView>

                <View style={{ paddingHorizontal: 20, paddingBottom: 12, paddingTop: 8, gap: 4 }}>
                    <TouchableOpacity
                        onPress={salvarEtapaAnotacoes}
                        disabled={salvandoAnotacoes}
                        activeOpacity={0.85}
                        style={{
                            height: 50,
                            borderRadius: 14,
                            backgroundColor: HADES.accentSolid,
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: salvandoAnotacoes ? 0.6 : 1,
                        }}
                    >
                        {salvandoAnotacoes ? (
                            <ActivityIndicator color="#000" />
                        ) : (
                            <Text style={{ fontSize: 15, fontWeight: "700", color: "#000" }}>Salvar anotações</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => router.back()}
                        disabled={salvandoAnotacoes}
                        activeOpacity={0.7}
                        style={{ paddingVertical: 14, alignItems: "center" }}
                    >
                        <Text style={{ fontSize: 14.5, fontWeight: "500", color: HADES.textMuted }}>
                            Anotar depois
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top", "bottom"]}>
            {/* Top bar */}
            <View style={{ paddingHorizontal: 14, paddingTop: 4, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: HADES.surfaceRaised, alignItems: "center", justifyContent: "center" }}
                >
                    <X size={17} color={HADES.textSecondary} />
                </TouchableOpacity>
                <Text style={{ flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: HADES.text, letterSpacing: -0.2 }}>
                    {showResults ? "Resultado" : "Quiz do Conteúdo"}
                </Text>
                <View style={{ width: 34 }} />
            </View>

            {/* Progresso (só durante as respostas) */}
            {!showResults && (
                <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <Text style={{ fontSize: 11.5, color: HADES.textFaint, fontWeight: "700", letterSpacing: 0.7 }}>PROGRESSO</Text>
                        <Text style={{ fontSize: 12.5, color: isComplete ? HADES.accentSolid : HADES.text, fontWeight: "700" }}>
                            {answeredCount} <Text style={{ color: HADES.textFaint, fontWeight: "600" }}>/ {totalQuestoes}</Text>
                        </Text>
                    </View>
                    <View style={{ height: 6, borderRadius: 3, backgroundColor: HADES.surfaceOverlay, overflow: "hidden" }}>
                        <View style={{ height: "100%", width: `${(answeredCount / totalQuestoes) * 100}%`, backgroundColor: HADES.accentSolid, borderRadius: 3 }} />
                    </View>
                </View>
            )}

            <ScrollView
                style={{ flex: 1, paddingHorizontal: 18 }}
                contentContainerStyle={{ paddingBottom: 24 }}
                showsVerticalScrollIndicator={false}
            >
                {!showResults ? (
                    carregandoQuiz ? (
                        <View style={{ alignItems: "center", paddingVertical: 6, paddingBottom: 22 }}>
                            <View style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: HADES.accentTint, alignItems: "center", justifyContent: "center" }}>
                                <ActivityIndicator color={HADES.accentSolid} />
                            </View>
                            <Text style={{ fontSize: 20, fontWeight: "700", color: HADES.text, marginTop: 15, letterSpacing: -0.2 }}>
                                Gerando seu quiz personalizado…
                            </Text>
                            <Text style={{ fontSize: 13.5, color: HADES.textMuted, marginTop: 7, textAlign: "center", lineHeight: 19, paddingHorizontal: 18 }}>
                                Estamos montando perguntas sobre o que você acabou de estudar.
                            </Text>
                        </View>
                    ) : isComplete ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: HADES.accentTint, borderWidth: 1, borderColor: HADES.accentTintBorder, borderRadius: 12, padding: 14, marginBottom: 16 }}>
                            <CheckCheck size={18} color={HADES.accentSolid} />
                            <Text style={{ flex: 1, fontSize: 13, color: HADES.textSecondary, lineHeight: 18 }}>
                                Tudo respondido! Revise se quiser e envie para ver o gabarito.
                            </Text>
                        </View>
                    ) : (
                        <View style={{ alignItems: "center", paddingVertical: 6, paddingBottom: 22 }}>
                            <View style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: HADES.accentTint, alignItems: "center", justifyContent: "center" }}>
                                <Lightbulb size={32} color={HADES.accentSolid} />
                            </View>
                            <Text style={{ fontSize: 20, fontWeight: "700", color: HADES.text, marginTop: 15, letterSpacing: -0.2 }}>
                                Teste seus Conhecimentos
                            </Text>
                            <Text style={{ fontSize: 13.5, color: HADES.textMuted, marginTop: 7, textAlign: "center", lineHeight: 19, paddingHorizontal: 18 }}>
                                Responda as questões baseadas no conteúdo que você acabou de estudar.
                            </Text>
                        </View>
                    )
                ) : (
                    <View style={{ alignItems: "center", paddingVertical: 10, paddingBottom: 24 }}>
                        <View style={{
                            width: 84, height: 84, borderRadius: 42,
                            backgroundColor: isHighScore ? HADES.greenTint : "rgba(240,85,107,0.12)",
                            alignItems: "center", justifyContent: "center",
                        }}>
                            {isHighScore ? <Trophy size={40} color={HADES.green} /> : <RotateCw size={38} color={HADES.red} />}
                        </View>
                        <Text style={{ fontSize: 23, fontWeight: "800", color: isHighScore ? HADES.green : HADES.red, marginTop: 16, letterSpacing: -0.4 }}>
                            {isHighScore ? `Você acertou ${score} de ${totalQuestoes}!` : `Você acertou ${score} de ${totalQuestoes}`}
                        </Text>
                        <Text style={{ fontSize: 14, color: isHighScore ? "#7fae91" : "#b98089", marginTop: 7, textAlign: "center", lineHeight: 20 }}>
                            {isHighScore ? "Conteúdo dominado. Mandou muito bem. 🔥" : "Faltou pouco. Uma revisada rápida agora e o conteúdo gruda de vez. 💪"}
                        </Text>
                    </View>
                )}

                {/* Questões */}
                <View style={{ gap: 14 }}>
                    {perguntasAtuais.map((question) => {
                        const selected = answers[question.id];
                        const isCorrectlyAnswered = selected === question.correctAnswer;

                        return (
                            <View
                                key={question.id}
                                style={{ backgroundColor: HADES.surface, borderWidth: 1, borderColor: HADES.border, borderRadius: 16, padding: 16 }}
                            >
                                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                    <Text style={{ fontSize: 11.5, fontWeight: "700", color: HADES.textFaint, letterSpacing: 0.7 }}>
                                        QUESTÃO {question.id}
                                    </Text>
                                    {showResults && (
                                        <View style={{
                                            flexDirection: "row", alignItems: "center", gap: 4,
                                            backgroundColor: isCorrectlyAnswered ? HADES.greenTint : "rgba(240,85,107,0.13)",
                                            borderRadius: 8, paddingVertical: 4, paddingHorizontal: 9,
                                        }}>
                                            <Text style={{ fontSize: 11, fontWeight: "700", color: isCorrectlyAnswered ? HADES.green : HADES.red }}>
                                                {isCorrectlyAnswered ? "Certa" : "Errada"}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={{ fontSize: 15, fontWeight: "600", color: HADES.text, lineHeight: 21, marginTop: 11 }}>
                                    {question.text}
                                </Text>
                                <View style={{ gap: 9, marginTop: 14 }}>
                                    {question.options.map((opt) => {
                                        const isSelected = selected === opt;
                                        const isCorrectOpt = opt === question.correctAnswer;

                                        let bg: string = HADES.bg;
                                        let border: string = HADES.borderStrong;
                                        let radBg: string = "transparent";
                                        let radBorder: string = HADES.dot;
                                        let textColor: string = HADES.textSecondary;
                                        let textWeight: "400" | "600" = "400";
                                        let strike = false;
                                        let opacity = 1;
                                        let icon = null;

                                        if (!showResults) {
                                            if (isSelected) {
                                                bg = HADES.accentTint;
                                                border = HADES.accentTintBorder;
                                                radBg = HADES.accentSolid;
                                                radBorder = HADES.accentSolid;
                                                textColor = HADES.text;
                                                textWeight = "600";
                                                icon = <Check size={13} color="#000" />;
                                            }
                                        } else if (isSelected && isCorrectOpt) {
                                            bg = HADES.greenTint;
                                            border = "rgba(48,209,88,0.55)";
                                            radBg = HADES.green;
                                            radBorder = HADES.green;
                                            textColor = "#eafff2";
                                            textWeight = "600";
                                            icon = <Check size={13} color="#04140a" />;
                                        } else if (isSelected && !isCorrectOpt) {
                                            bg = "rgba(240,85,107,0.10)";
                                            border = "rgba(240,85,107,0.5)";
                                            radBg = HADES.red;
                                            radBorder = HADES.red;
                                            textColor = HADES.red;
                                            textWeight = "600";
                                            strike = true;
                                        } else {
                                            opacity = 0.32;
                                        }

                                        return (
                                            <TouchableOpacity
                                                key={opt}
                                                onPress={() => handleAnswerChange(question.id, opt)}
                                                activeOpacity={0.7}
                                                disabled={showResults}
                                                style={{
                                                    flexDirection: "row", alignItems: "center", gap: 13,
                                                    paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12,
                                                    backgroundColor: bg, borderWidth: 1, borderColor: border, opacity,
                                                }}
                                            >
                                                <View style={{
                                                    width: 21, height: 21, borderRadius: 11, borderWidth: 2,
                                                    borderColor: radBorder, backgroundColor: radBg,
                                                    alignItems: "center", justifyContent: "center",
                                                }}>
                                                    {icon}
                                                </View>
                                                <Text style={{
                                                    flex: 1, fontSize: 14, lineHeight: 19, color: textColor,
                                                    fontWeight: textWeight,
                                                    textDecorationLine: strike ? "line-through" : "none",
                                                }}>
                                                    {opt}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        );
                    })}
                </View>
            </ScrollView>

            {/* Ações fixadas na parte inferior */}
            <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, borderTopWidth: 1, borderTopColor: HADES.border, backgroundColor: HADES.bg, gap: 10 }}>
                {!showResults ? (
                    <TouchableOpacity
                        onPress={() => handleSubmit('salvo')}
                        disabled={saving || !isComplete}
                        activeOpacity={0.8}
                        style={{
                            height: 54, borderRadius: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9,
                            backgroundColor: isComplete ? HADES.accentSolid : HADES.surfaceRaised,
                            borderWidth: isComplete ? 0 : 1, borderColor: HADES.border,
                        }}
                    >
                        {carregandoQuiz ? (
                            <ActivityIndicator size="small" color={HADES.textDim} />
                        ) : isComplete ? (
                            <Send size={18} color="#000" />
                        ) : (
                            <Lock size={16} color={HADES.textDim} />
                        )}
                        <Text style={{ fontSize: isComplete ? 16 : 15, fontWeight: "700", color: isComplete ? "#000" : HADES.textDim }}>
                            {carregandoQuiz ? "Gerando quiz…" : isComplete ? "Enviar Respostas" : `Responda as ${totalQuestoes} Questões`}
                        </Text>
                    </TouchableOpacity>
                ) : isHighScore ? (
                    <TouchableOpacity
                        onPress={() => handleSubmit('salvo')}
                        activeOpacity={0.8}
                        disabled={saving}
                        style={{ height: 54, borderRadius: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, backgroundColor: HADES.accentSolid }}
                    >
                        <Bookmark size={18} color="#000" />
                        <Text style={{ fontSize: 16, fontWeight: "700", color: "#000" }}>Guardar Questões</Text>
                    </TouchableOpacity>
                ) : (
                    <>
                        <TouchableOpacity
                            onPress={() => {
                                setAnswers({});
                                setShowResults(false);
                            }}
                            activeOpacity={0.8}
                            style={{ height: 54, borderRadius: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, backgroundColor: HADES.accentSolid }}
                        >
                            <RotateCw size={18} color="#000" />
                            <Text style={{ fontSize: 16, fontWeight: "700", color: "#000" }}>Revisar e refazer agora</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => handleSubmit('pendente')}
                            activeOpacity={0.8}
                            disabled={saving}
                            style={{ height: 50, borderRadius: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
                        >
                            <Clock size={16} color={HADES.textMuted} />
                            <Text style={{ fontSize: 15, fontWeight: "600", color: HADES.textMuted }}>Salvar e refazer mais tarde</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>
        </SafeAreaView>
    );
}
