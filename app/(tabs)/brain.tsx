import { useState, useEffect, useMemo, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView, Modal, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronRight, X, AlertCircle, BookOpen, Clock, RefreshCw, ArrowLeft, Timer, Layers, Search, Play, Edit, Trash2, SlidersHorizontal, Check } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

import { HADES } from "@/constants/hades";
import { Skeleton, SkeletonCircle } from "@/components/ui/Skeleton";
import { useGraficosAnalytics } from "@/lib/graphics-analytics";
import { useAnalisePessoal } from "@/hooks/useAnalisePessoal";
import { useAuth } from "@/hooks/useAuth";
import { useMaterias } from "@/hooks/useMaterias";
import { formatarHoras } from "@/lib/analytics";
import { SessaoFocoRow } from "@/types/sessions";
import { EstadoPoucosDadosPessoal, EstadoVazioPessoal, EstadoSemGrupo, EstadoGrupoSemDadosPeriodo } from "@/components/analytics/EstadosAnalise";
import {
    SeletorEscopo,
    SeletorPeriodo,
    GraficoArea,
    CartaoMetrica,
    GraficoComparativoSemanal,
    GraficoDonutMaterias,
    BarraTaxaAcerto,
    GraficoDiaSemana,
    GraficoOfensiva,
    CabecalhoGrupo,
    MetaSemanalGrupo,
    RankingHorasGrupo,
    MateriaMaisEstudadaGrupo,
    MembrosAtivosGrupo,
    EvolucaoGrupo,
    QuestoesPorMembroGrupo,
    EscopoAnalise,
    PeriodoAnalise,
} from "@/components/analytics/GraficosAnalise";

type BrainTab = "database" | "analytics";
type SelectedForm = SessaoFocoRow | null | "pending-tab";

const BRAIN_TABS = [
    { key: "database", label: "Banco de dados" },
    { key: "analytics", label: "Análises" },
];

export default function BrainScreen() {
    const [brainTab, setBrainTab] = useState<BrainTab>("database");
    const [comecoSemana, setComecoSemana] = useState<'domingo' | 'segunda'>('domingo');
    const [escopoAnalise, setEscopoAnalise] = useState<EscopoAnalise>("pessoal");
    const [periodoAnalise, setPeriodoAnalise] = useState<PeriodoAnalise>("7d");
    // const [statsPessoais, setStatsPessoais] = useState<UserStats | null>()

    //Busca para ver a preferência do início da semana do usuário (ex: Domingo ou Segunda)
    useEffect(() => {
        const loadPref = async () => {
            const pref = await AsyncStorage.getItem('@app_week_starts_on');
            if (pref === 'segunda') {
                setComecoSemana('segunda');
            }
        };
        loadPref();
    }, []);

    const { userId } = useAuth();
    const [selectedForm, setSelectedForm] = useState<SelectedForm>(null);
    const router = useRouter();
    const { materiasComCores } = useMaterias(userId);

    // Uma única leitura alimenta as duas abas: `analise` (números da aba Análise,
    // escopo pessoal) e as sessões cruas (aba Banco de dados).
    const { analise, savedSessions, pendingSessions, loading: carregandoAnalise, refresh: refreshAnalisePessoal } = useAnalisePessoal(userId, comecoSemana);

    //------Cálculos e funções para os gráficos dessa tela------
    const {
        sessoesUsuario,
        horasFormatadasAtuais,
        variacaoPercentual,
        rotuloPeriodo,
        qtdSessoes,
        mediaDasHoras,
        pontosGraficoArea,
        tituloComparativo,
        paresGraficoComparativo,
        qtdMateriasEstudadas,
        materiasParaDonut,
        qtdQuestoesTotais,
        qtdQuestoesCorretas,
        qtdQuestoesErradas,
        pctAcerto,
        pontosDiaSemana,
        pontosOfensiva,
        grupos,
        membrosPorGrupo,
        grupoSelecionadoId,
        setGrupoSelecionadoId,
        horasSemanaGrupo,
        grupoSelecionado,
        qtdMembrosGrupoSelecionado,
        membrosRanking,
        sessoesGrupoNoPeriodo,
        materiasGrupo,
        qtdDisciplinasGrupo,
        membrosInativos,
        membrosTotais,
        questoesPorMembroGrupo,
        pontosEvolucaoGrupo,
        horasEvolucaoGrupo,
        percentualEvolucaoGrupo,
        ofensivaGrupo,
        refresh: refreshGraficos,
    } = useGraficosAnalytics(userId, comecoSemana, periodoAnalise);

    //Controla o estado do pull-to-refresh
    const [atualizando, setAtualizando] = useState(false);
    const handleRefresh = useCallback(async () => {
        setAtualizando(true);
        try {
            await Promise.all([refreshAnalisePessoal(), refreshGraficos()]);
        } finally {
            setAtualizando(false);
        }
    }, [refreshAnalisePessoal, refreshGraficos]);

    const formatarData = (dataSessao: string) => {
        try {
            const [ano, mes, dia] = dataSessao.split('-');
            const data = new Date(`${ano}-${mes}-${dia}`);
            const hoje = new Date();
            const amanhaString = new Date(hoje.getTime() + 86400000).toISOString().split('T')[0];
            const ontemString = new Date(hoje.getTime() - 86400000).toISOString().split('T')[0];
            const hojeString = hoje.toISOString().split('T')[0];

            if (dataSessao === hojeString) return "Hoje";
            if (dataSessao === ontemString) return "Ontem";
            if (dataSessao === amanhaString) return "Amanhã";

            return data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('de ', '').replace('.', '');
        } catch {
            return dataSessao;
        }
    };

    const calcularAcerto = (acertadas: number, respondidas: number) => {
        if (respondidas === 0) return 0;
        return Math.round((acertadas / respondidas) * 100);
    };

    const obterCorMateria = (disciplina: string) => {
        const materia = materiasComCores.find((m) => m.nomeExibicao === disciplina);
        return materia?.cor ?? "#4d94ff";
    };

    const obterCorAcerto = (pct: number) => {
        if (pct > 70) return HADES.green;
        if (pct <= 40) return HADES.red;
        return "#f5a623";
    };

    const sessoesAgrupadasPorPeriodo = useMemo(() => {
        const hoje = new Date();
        const umaSemanaAtras = new Date(hoje.getTime() - 7 * 86400000);
        const umMesAtras = new Date(hoje.getTime() - 30 * 86400000);

        const todasSessoes = [...savedSessions, ...pendingSessions];

        const essaSemana = todasSessoes.filter((s) => {
            const data = new Date(`${s.data_sessao}T00:00:00`);
            return data >= umaSemanaAtras;
        }).length;

        const esseMs = todasSessoes.filter((s) => {
            const data = new Date(`${s.data_sessao}T00:00:00`);
            return data >= umMesAtras;
        }).length;

        return { essaSemana, esseMs };
    }, [savedSessions, pendingSessions]);

    const sessoesAgrupadasPorPeriodoDetalhado = useMemo(() => {
        const hoje = new Date();
        const inicioSemana = new Date(hoje.getTime() - 7 * 86400000);
        const inicioMes = new Date(hoje.getTime() - 30 * 86400000);

        const grupos: { label: string; forms: typeof savedSessions }[] = [];

        const estaSemana = savedSessions.filter((s) => {
            const data = new Date(`${s.data_sessao}T00:00:00`);
            return data >= inicioSemana;
        });

        if (estaSemana.length > 0) {
            grupos.push({ label: "Esta semana", forms: estaSemana });
        }

        const otherMonths = savedSessions.filter((s) => {
            const data = new Date(`${s.data_sessao}T00:00:00`);
            return data < inicioSemana && data >= inicioMes;
        });

        if (otherMonths.length > 0) {
            const mesAtual = inicioMes.toLocaleDateString("pt-BR", { month: "long" });
            const mesCapitalizado =
                mesAtual.charAt(0).toUpperCase() + mesAtual.slice(1);
            grupos.push({ label: mesCapitalizado, forms: otherMonths });
        }

        const muitoAntigo = savedSessions.filter((s) => {
            const data = new Date(`${s.data_sessao}T00:00:00`);
            return data < inicioMes;
        });

        if (muitoAntigo.length > 0) {
            grupos.push({ label: "Anterior", forms: muitoAntigo });
        }

        return grupos;
    }, [savedSessions]);

    // Estado da aba Pessoal (cheio / poucos dados / vazio) — baseado em quantos
    // dias distintos o usuário já registrou sessão, em todo o histórico (não só
    // no período selecionado no SeletorPeriodo).
    const diasComSessaoHistorico = useMemo(
        () => new Set(sessoesUsuario.map((s) => s.data_sessao)).size,
        [sessoesUsuario]
    );
    const estadoPessoal: "vazio" | "poucos" | "cheio" =
        diasComSessaoHistorico === 0 ? "vazio" : diasComSessaoHistorico < 3 ? "poucos" : "cheio";

    // Estatísticas de hoje, usadas só no estado "poucos dados".
    const estatisticasHoje = useMemo(() => {
        const hoje = new Date();
        const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
        const sessoesDeHoje = sessoesUsuario.filter((s) => s.data_sessao === hojeStr);
        const minutosHoje = sessoesDeHoje.reduce((acc, s) => acc + (s.tempo_minutos ?? 0), 0);
        const questoesHoje = sessoesDeHoje.reduce((acc, s) => acc + (s.questoes_respondidas ?? 0), 0);
        const acertosHoje = sessoesDeHoje.reduce((acc, s) => acc + (s.questoes_acertadas ?? 0), 0);
        return {
            horasHoje: formatarHoras(minutosHoje),
            qtdSessoesHoje: sessoesDeHoje.length,
            questoesHoje,
            pctAcertoHoje: questoesHoje > 0 ? Math.round((acertosHoje / questoesHoje) * 100) : 0,
        };
    }, [sessoesUsuario]);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top"]}>
            {/* Header */}
            <View style={{ paddingTop: 6, paddingHorizontal: 20, paddingBottom: 14 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View>
                        <Text style={{ fontSize: 23, fontWeight: "700", color: HADES.text, letterSpacing: -0.3 }}>
                            {brainTab === "analytics" ? "Análise" : "Banco de dados"}
                        </Text>
                        {brainTab === "database" && (
                            <Text style={{ fontSize: 12.5, color: HADES.textDim, marginTop: 3 }}>
                                Formulários das suas sessões
                            </Text>
                        )}
                    </View>
                    {brainTab === "database" && (
                        <TouchableOpacity
                            style={{
                                width: 38,
                                height: 38,
                                borderRadius: 12,
                                backgroundColor: HADES.surface,
                                borderWidth: 1,
                                borderColor: HADES.border,
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <SlidersHorizontal size={18} color={HADES.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Tabs */}
            <View style={{ paddingHorizontal: 20, paddingBottom: 18 }}>
                <View style={{ flexDirection: "row", width: "100%" }}>
                    {BRAIN_TABS.map((tab) => {
                        const ativa = brainTab === tab.key;
                        return (
                            <TouchableOpacity
                                key={tab.key}
                                onPress={() => setBrainTab(tab.key as BrainTab)}
                                activeOpacity={0.7}
                                style={{
                                    flex: 1,
                                    alignItems: "center",
                                    paddingBottom: 8,
                                    borderBottomWidth: 2,
                                    borderBottomColor: ativa ? HADES.accentSolid : "transparent",
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 14,
                                        fontWeight: "500",
                                        color: ativa ? HADES.text : HADES.textFaint,
                                    }}
                                >
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={atualizando} onRefresh={handleRefresh} tintColor={HADES.accentSolid} />
                }
            >

                {/* ── DATABASE ─────────────────────────────────── */}
                {brainTab === "database" && (
                    <View style={{ paddingHorizontal: 20, paddingBottom: 16, gap: 0 }}>
                      {carregandoAnalise ? (
                        <BancoDadosSkeleton />
                      ) : (
                        <>
                        {/* Headers por período */}
                        <View style={{ marginBottom: 16 }}>
                            <View style={{ marginBottom: 14 }}>
                                <Text style={{ fontSize: 11.5, fontWeight: "700", color: HADES.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                                    ESSA SEMANA
                                </Text>
                                <Text style={{ fontSize: 15, fontWeight: "700", color: HADES.text }}>
                                    {sessoesAgrupadasPorPeriodo.essaSemana} formulário{sessoesAgrupadasPorPeriodo.essaSemana !== 1 ? "s" : ""}
                                </Text>
                            </View>
                            <View>
                                <Text style={{ fontSize: 11.5, fontWeight: "700", color: HADES.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                                    ESSE MÊS
                                </Text>
                                <Text style={{ fontSize: 15, fontWeight: "700", color: HADES.text }}>
                                    {sessoesAgrupadasPorPeriodo.esseMs} formulário{sessoesAgrupadasPorPeriodo.esseMs !== 1 ? "s" : ""}
                                </Text>
                            </View>
                        </View>

                        {/* Contadores */}
                        <View style={{ flexDirection: "row", gap: 10, marginBottom: 18 }}>
                            <View
                                style={{
                                    flex: 1,
                                    backgroundColor: HADES.surface,
                                    borderWidth: 1,
                                    borderColor: HADES.border,
                                    borderRadius: 16,
                                    padding: 14,
                                    opacity: selectedForm === "pending-tab" ? 0.6 : 1,
                                }}
                            >
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 8 }}>
                                    <Check size={14} color={HADES.green} />
                                    <Text style={{ fontSize: 11, fontWeight: "700", color: HADES.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>
                                        Salvos
                                    </Text>
                                </View>
                                <Text style={{ fontSize: 34, fontWeight: "800", color: HADES.text, letterSpacing: -1.4 }}>
                                    {savedSessions.length}
                                </Text>
                                <Text style={{ fontSize: 11.5, color: HADES.textDim, marginTop: 6 }}>
                                    formulários completos
                                </Text>
                            </View>

                            <View
                                style={{
                                    flex: 1,
                                    backgroundColor: selectedForm === "pending-tab" ? "rgba(240,85,107,0.1)" : "rgba(240,85,107,0.08)",
                                    borderWidth: selectedForm === "pending-tab" ? 1.5 : 1,
                                    borderColor: selectedForm === "pending-tab" ? HADES.red : "rgba(240,85,107,0.32)",
                                    borderRadius: 16,
                                    padding: 14,
                                    position: "relative",
                                    overflow: "hidden",
                                }}
                            >
                                {selectedForm !== "pending-tab" && (
                                    <View style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 3, backgroundColor: HADES.red }} />
                                )}
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 8 }}>
                                    <AlertCircle size={14} color={HADES.red} />
                                    <Text style={{ fontSize: 11, fontWeight: "700", color: HADES.red, textTransform: "uppercase", letterSpacing: 0.5 }}>
                                        Refazer
                                    </Text>
                                </View>
                                <Text style={{ fontSize: 34, fontWeight: "800", color: HADES.red, letterSpacing: -1.4 }}>
                                    {pendingSessions.length}
                                </Text>
                                <Text style={{ fontSize: 11.5, color: "#a76a75", marginTop: 6 }}>
                                    pendentes de resposta
                                </Text>
                            </View>
                        </View>

                        {/* Busca */}
                        <View style={{ marginBottom: 14 }}>
                            <View
                                style={{
                                    height: 42,
                                    borderRadius: 13,
                                    backgroundColor: HADES.surface,
                                    borderWidth: 1,
                                    borderColor: HADES.border,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 9,
                                    paddingHorizontal: 13,
                                }}
                            >
                                <Search size={16} color="#5f636c" style={{ opacity: 0.5 }} />
                                <Text style={{ fontSize: 13.5, color: "#5f636c" }}>
                                    Buscar matéria ou tópico
                                </Text>
                            </View>
                        </View>

                        {/* Abas */}
                        <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: HADES.border, marginBottom: 0, marginTop: selectedForm === "pending-tab" ? 22 : 16 }}>
                            <TouchableOpacity
                                onPress={() => setSelectedForm(null)}
                                style={{
                                    flex: 1,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 7,
                                    paddingBottom: 11,
                                    borderBottomWidth: selectedForm === null ? 2.5 : 0,
                                    borderBottomColor: HADES.accentSolid,
                                    opacity: selectedForm === "pending-tab" ? 0.6 : 1,
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 13.5,
                                        fontWeight: selectedForm === null ? "700" : "600",
                                        color: selectedForm === null ? HADES.accentSolid : HADES.textMuted,
                                    }}
                                >
                                    Salvos
                                </Text>
                                <View
                                    style={{
                                        backgroundColor: selectedForm === null ? HADES.accentSolid : (selectedForm === "pending-tab" ? "#1a1b20" : HADES.surfaceOverlay),
                                        borderRadius: 6,
                                        paddingVertical: 3,
                                        paddingHorizontal: 7,
                                        minWidth: 28,
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 11,
                                            fontWeight: "700",
                                            color: selectedForm === null ? "#000" : (selectedForm === "pending-tab" ? HADES.textMuted : HADES.textMuted),
                                            lineHeight: 1.2,
                                        }}
                                    >
                                        {savedSessions.length}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setSelectedForm("pending-tab")}
                                style={{
                                    flex: 1,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 7,
                                    paddingBottom: 11,
                                    borderBottomWidth: selectedForm === "pending-tab" ? 2.5 : 0,
                                    borderBottomColor: HADES.red,
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 13.5,
                                        fontWeight: selectedForm === "pending-tab" ? "700" : "600",
                                        color: selectedForm === "pending-tab" ? HADES.red : HADES.textMuted,
                                    }}
                                >
                                    Pendentes
                                </Text>
                                <View
                                    style={{
                                        backgroundColor: selectedForm === "pending-tab" ? HADES.red : "rgba(240,85,107,0.12)",
                                        borderRadius: 6,
                                        paddingVertical: 3,
                                        paddingHorizontal: 7,
                                        minWidth: 28,
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 11,
                                            fontWeight: "700",
                                            color: selectedForm === "pending-tab" ? "#fff" : HADES.red,
                                            lineHeight: 1.2,
                                        }}
                                    >
                                        {pendingSessions.length}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Lista de Formulários */}
                        <ScrollView
                            style={{ marginTop: 16, marginBottom: 16 }}
                            showsVerticalScrollIndicator={false}
                            scrollEventThrottle={16}
                        >
                            {selectedForm === "pending-tab" && (
                                <>
                                    <Text style={{ fontSize: 12.5, color: HADES.textDim, lineHeight: 1.5, marginBottom: 16 }}>
                                        Sessões encerradas sem formulário. Elas <Text style={{ color: HADES.text, fontWeight: "600" }}>não contam</Text> para suas horas até você responder.
                                    </Text>
                                    <View style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                        {pendingSessions.map((form, idx) => (
                                            <View
                                                key={form.id}
                                                style={{
                                                    backgroundColor: HADES.surface,
                                                    borderWidth: 1,
                                                    borderColor: "rgba(240,85,107,0.3)",
                                                    borderLeftWidth: 3,
                                                    borderLeftColor: HADES.red,
                                                    borderRadius: 15,
                                                    padding: 14,
                                                }}
                                            >
                                                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                                                    <View
                                                        style={{
                                                            width: 9,
                                                            height: 9,
                                                            borderRadius: 4.5,
                                                            backgroundColor: obterCorMateria(form.disciplina),
                                                            flexShrink: 0,
                                                        }}
                                                    />
                                                    <Text style={{ flex: 1, fontSize: 14.5, fontWeight: "700", color: HADES.text, letterSpacing: -0.2 }}>
                                                        {form.disciplina}
                                                    </Text>
                                                    <View
                                                        style={{
                                                            flexDirection: "row",
                                                            alignItems: "center",
                                                            gap: 5,
                                                            backgroundColor: "rgba(240,85,107,0.13)",
                                                            borderRadius: 7,
                                                            paddingVertical: 3,
                                                            paddingHorizontal: 8,
                                                        }}
                                                    >
                                                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: HADES.red }} />
                                                        <Text style={{ fontSize: 10.5, fontWeight: "700", color: HADES.red, letterSpacing: 0.3, textTransform: "uppercase" }}>
                                                            Pendente
                                                        </Text>
                                                    </View>
                                                </View>
                                                <Text style={{ fontSize: 12.5, color: HADES.textMuted, marginTop: 5, paddingLeft: 19 }}>
                                                    {form.conteudo_especifico}
                                                </Text>
                                                <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 11, paddingLeft: 19 }}>
                                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                                                        <Clock size={12} color="#5f636c" />
                                                        <Text style={{ fontSize: 11.5, color: HADES.textMuted }}>
                                                            {formatarData(form.data_sessao)}
                                                        </Text>
                                                    </View>
                                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                                                        <Clock size={12} color="#5f636c" />
                                                        <Text style={{ fontSize: 11.5, color: HADES.textMuted }}>
                                                            {form.tempo_minutos} min
                                                        </Text>
                                                    </View>
                                                </View>
                                                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14, paddingLeft: 19 }}>
                                                    <TouchableOpacity
                                                        onPress={() => {
                                                            if (!selectedForm || typeof selectedForm === "string") return;
                                                            const formData = form;
                                                            setSelectedForm(null);
                                                            router.push({
                                                                pathname: "/(modals)/focus-feedback",
                                                                params: {
                                                                    sessionId: formData.id,
                                                                    subject: formData.disciplina,
                                                                    content: formData.conteudo_especifico || "",
                                                                    oldDuration: formData.tempo_minutos.toString(),
                                                                    duration: "0",
                                                                    isPublic: formData.is_public.toString(),
                                                                }
                                                            });
                                                        }}
                                                        activeOpacity={0.85}
                                                        style={{
                                                            flex: 1,
                                                            height: 38,
                                                            borderRadius: 11,
                                                            backgroundColor: HADES.red,
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            flexDirection: "row",
                                                            gap: 7,
                                                        }}
                                                    >
                                                        <Edit size={14} color="#fff" />
                                                        <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>
                                                            Responder agora
                                                        </Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={{
                                                            width: 38,
                                                            height: 38,
                                                            borderRadius: 11,
                                                            borderWidth: 1,
                                                            borderColor: "rgba(255,255,255,0.1)",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                        }}
                                                    >
                                                        <Trash2 size={15} color={HADES.textSecondary} />
                                                    </TouchableOpacity>
                                                </View>
                                                <Text style={{ fontSize: 11, color: "#a76a75", marginTop: 10, paddingLeft: 19 }}>
                                                    Expira em 5 dias — depois a sessão é descartada
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                </>
                            )}

                            {selectedForm === null && (
                                <>
                                    {savedSessions.length > 0 ? (
                                        sessoesAgrupadasPorPeriodoDetalhado.map((grupo, grupoIdx) => (
                                            <View key={grupoIdx} style={{ marginBottom: 22 }}>
                                                <View style={{ display: "flex", flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
                                                    <Text style={{ fontSize: 11.5, fontWeight: "700", color: HADES.textMuted, textTransform: "uppercase", letterSpacing: 0.8 }}>
                                                        {grupo.label}
                                                    </Text>
                                                    <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.06)" }} />
                                                    <Text style={{ fontSize: 11.5, color: "#5f636c" }}>
                                                        {grupo.forms.length}
                                                    </Text>
                                                </View>
                                                <View style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                                    {grupo.forms.map((form, formIdx) => (
                                                        <TouchableOpacity
                                                            key={form.id}
                                                            onPress={() => setSelectedForm(form)}
                                                            activeOpacity={0.75}
                                                            style={{
                                                                backgroundColor: HADES.surface,
                                                                borderWidth: 1,
                                                                borderColor: HADES.border,
                                                                borderRadius: 15,
                                                                padding: 14,
                                                            }}
                                                        >
                                                            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                                                                <View
                                                                    style={{
                                                                        width: 9,
                                                                        height: 9,
                                                                        borderRadius: 4.5,
                                                                        backgroundColor: obterCorMateria(form.disciplina),
                                                                        flexShrink: 0,
                                                                    }}
                                                                />
                                                                <Text style={{ flex: 1, fontSize: 14.5, fontWeight: "700", color: HADES.text, letterSpacing: -0.2 }}>
                                                                    {form.disciplina}
                                                                </Text>
                                                                <Text style={{ fontSize: 11.5, color: HADES.textMuted }}>
                                                                    {formatarData(form.data_sessao)}
                                                                </Text>
                                                            </View>
                                                            <Text style={{ fontSize: 12.5, color: HADES.textMuted, marginTop: 5, paddingLeft: 19 }}>
                                                                {form.conteudo_especifico}
                                                            </Text>
                                                            <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 12, paddingLeft: 19 }}>
                                                                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                                                                    <Clock size={12} color="#5f636c" />
                                                                    <Text style={{ fontSize: 11.5, color: HADES.textMuted }}>
                                                                        {form.tempo_minutos} min
                                                                    </Text>
                                                                </View>
                                                                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                                                                    <Layers size={12} color="#5f636c" />
                                                                    <Text style={{ fontSize: 11.5, color: HADES.textMuted }}>
                                                                        {form.questoes_respondidas ?? 0} questões
                                                                    </Text>
                                                                </View>
                                                                <View
                                                                    style={{
                                                                        marginLeft: "auto",
                                                                        backgroundColor: obterCorAcerto(calcularAcerto(form.questoes_acertadas, form.questoes_respondidas)),
                                                                        borderRadius: 6,
                                                                        paddingVertical: 3,
                                                                        paddingHorizontal: 7,
                                                                        minWidth: 35,
                                                                        alignItems: "center",
                                                                        justifyContent: "center",
                                                                    }}
                                                                >
                                                                    <Text style={{ fontSize: 10.5, fontWeight: "700", color: "#fff", lineHeight: 1.2 }}>
                                                                        {calcularAcerto(form.questoes_acertadas, form.questoes_respondidas)}%
                                                                    </Text>
                                                                </View>
                                                            </View>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            </View>
                                        ))
                                    ) : (
                                        <View style={{ alignItems: "center", paddingVertical: 60 }}>
                                            <View
                                                style={{
                                                    width: 62,
                                                    height: 62,
                                                    borderRadius: 31,
                                                    backgroundColor: HADES.surface,
                                                    borderWidth: 1,
                                                    borderColor: HADES.border,
                                                    borderStyle: "dashed",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    marginBottom: 13,
                                                }}
                                            >
                                                <BookOpen size={27} color="#5f636c" />
                                            </View>
                                            <Text style={{ fontSize: 16, fontWeight: "700", color: HADES.textSecondary, marginBottom: 8 }}>
                                                Seu banco está vazio
                                            </Text>
                                            <Text style={{ fontSize: 13, color: HADES.textDim, lineHeight: 1.55, textAlign: "center", paddingHorizontal: 20, marginBottom: 12 }}>
                                                Ao encerrar uma sessão de foco você responde um formulário — ele fica guardado aqui.
                                            </Text>
                                            <TouchableOpacity
                                                onPress={() => router.push("/(tabs)/focus")}
                                                activeOpacity={0.85}
                                                style={{
                                                    height: 44,
                                                    borderRadius: 13,
                                                    backgroundColor: HADES.accentSolid,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    flexDirection: "row",
                                                    gap: 8,
                                                    paddingHorizontal: 20,
                                                    marginTop: 6,
                                                }}
                                            >
                                                <Play size={16} color="#000" />
                                                <Text style={{ fontSize: 14, fontWeight: "700", color: "#000" }}>
                                                    Iniciar primeira sessão
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </>
                            )}
                        </ScrollView>
                        </>
                      )}
                    </View>
                )}

                {/* ── ANALYTICS ────────────────────────────────── */}
                {brainTab === "analytics" && (
                    <View className="px-4 pb-4 gap-9">
                        {/* Share Progress Button */}
                        {/*
                            <TouchableOpacity
                                onPress={() => router.push({
                                    pathname: "/(modals)/ShareWeeklyProgress",
                                    params: {
                                        hours: `${analyticsData.horasEstaSemana}h`,
                                        streak: `${analyticsData.sequencia} dias`,
                                        totalMinutes: String(analyticsData.horasEstaSemanaMinutos),
                                        sequencia: String(analyticsData.sequencia),
                                        diasEstaSemana: String(analyticsData.diasEstaSemana),
                                        distribuicao: JSON.stringify(analyticsData.distribuicao),
                                    }
                                })}
                                activeOpacity={0.8}
                                className="bg-violet-600 py-4 rounded-3xl flex-row items-center justify-center gap-2 shadow-lg shadow-violet-500/20"
                            >
                                <Share2 size={20} color="white" />
                                <Text className="text-white font-bold text-lg">Compartilhar Progresso</Text>
                            </TouchableOpacity>
                        */}

                        {/* Seletor Pessoal / Grupo */}
                        <View className="gap-3">
                            <SeletorEscopo valor={escopoAnalise} aoAlterar={setEscopoAnalise} />
                            {(escopoAnalise === "grupo" || (!carregandoAnalise && estadoPessoal !== "vazio")) && (
                                <SeletorPeriodo valor={periodoAnalise} aoAlterar={setPeriodoAnalise} />
                            )}
                        </View>

                        {escopoAnalise === "grupo" ? (
                            grupos.length === 0 ? (
                                <EstadoSemGrupo
                                    cor={HADES.accentSolid}
                                    aoVerGrupos={() => router.push("/(groups)/browse-groups")}
                                />
                            ) : !grupoSelecionado ? null : (
                            <View className="gap-8">
                                <CabecalhoGrupo
                                    cor={HADES.accentSolid}
                                    grupos={grupos}
                                    grupoSelecionadoId={grupoSelecionadoId}
                                    aoSelecionarGrupo={(grupo) => setGrupoSelecionadoId(grupo.id)}
                                    membros={membrosPorGrupo}
                                />
                                <MetaSemanalGrupo grupos={grupos} grupoSelecionado={grupoSelecionado} horas={horasSemanaGrupo} qtdMembros={qtdMembrosGrupoSelecionado}/>

                                {sessoesGrupoNoPeriodo.length === 0 ? (
                                    <EstadoGrupoSemDadosPeriodo nomeGrupo={grupoSelecionado.nome_grupo} />
                                ) : (
                                    <>
                                        <RankingHorasGrupo cor={HADES.accentSolid} membros={membrosRanking} grupoSelecionado={grupoSelecionado} />

                                        <View className="flex-row gap-[10px]">
                                            <MateriaMaisEstudadaGrupo materias={materiasGrupo} qtdMaterias={qtdDisciplinasGrupo}/>
                                            <MembrosAtivosGrupo cor={HADES.accentSolid} membrosTotais={membrosTotais} inativos={membrosInativos}/>
                                        </View>

                                        <EvolucaoGrupo
                                            cor={HADES.accentSolid}
                                            horas={horasEvolucaoGrupo}
                                            percentual={percentualEvolucaoGrupo}
                                            pontos={pontosEvolucaoGrupo}
                                        />
                                        <QuestoesPorMembroGrupo membros={questoesPorMembroGrupo} />
                                        <GraficoOfensiva
                                            titulo="Ofensiva do grupo"
                                            ofensivaAtual={ofensivaGrupo.atual}
                                            melhorOfensiva={ofensivaGrupo.melhor}
                                            pontos={ofensivaGrupo.pontos}
                                        />
                                    </>
                                )}
                            </View>
                            )
                        ) : carregandoAnalise ? (
                            <AnalisePessoalSkeleton />
                        ) : estadoPessoal === "vazio" ? (
                            <EstadoVazioPessoal
                                cor={HADES.accentSolid}
                                aoIniciarSessao={() => router.push("/(tabs)/focus")}
                            />
                        ) : estadoPessoal === "poucos" ? (
                            <EstadoPoucosDadosPessoal
                                cor={HADES.accentSolid}
                                qtdSessoesTotal={sessoesUsuario.length}
                                diasFaltantes={3 - diasComSessaoHistorico}
                                horasHoje={estatisticasHoje.horasHoje}
                                qtdSessoesHoje={estatisticasHoje.qtdSessoesHoje}
                                questoesHoje={estatisticasHoje.questoesHoje}
                                pctAcertoHoje={estatisticasHoje.pctAcertoHoje}
                            />
                        ) : (
                            <View className="gap-8">
                                <GraficoArea cor={HADES.accentSolid} horas={horasFormatadasAtuais} percentual={variacaoPercentual} periodo={rotuloPeriodo} pontos={pontosGraficoArea}/>

                                <View className="flex-row gap-[10px]">
                                    <CartaoMetrica icone={Timer} rotulo="SESSÃO MÉDIA" valor={mediaDasHoras} legenda="por sessão" />
                                    <CartaoMetrica icone={Layers} rotulo="Nº SESSÕES" valor={qtdSessoes.toString()} legenda="esta semana" />
                                </View>

                                <GraficoComparativoSemanal cor={HADES.accentSolid} titulo={tituloComparativo} pares={paresGraficoComparativo} />
                                <GraficoDonutMaterias qtdMaterias={qtdMateriasEstudadas} materias={materiasParaDonut}/>
                                <BarraTaxaAcerto acerto={qtdQuestoesCorretas} erro={qtdQuestoesErradas} total={qtdQuestoesTotais} pct={pctAcerto}/>
                                <GraficoDiaSemana cor={HADES.accentSolid} pontos={pontosDiaSemana} />
                                <GraficoOfensiva ofensivaAtual={analise.sequencia} melhorOfensiva={analise.melhorSequencia} pontos={pontosOfensiva} />
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>

            {/* ── MODAL: Ação no Formulário ──────────────────── */}
            <Modal
                visible={!!selectedForm && typeof selectedForm !== "string"}
                transparent
                animationType="fade"
                onRequestClose={() => setSelectedForm(null)}
            >
                <View
                    className="flex-1 justify-end"
                    style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
                >
                    <View
                        style={{
                            width: "100%",
                            backgroundColor: HADES.surface,
                            borderTopWidth: 1,
                            borderTopColor: "rgba(255,255,255,0.08)",
                            borderTopLeftRadius: 24,
                            borderTopRightRadius: 24,
                            padding: 24,
                            paddingBottom: 32,
                        }}
                    >
                        {/* Header */}
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginBottom: 24,
                            }}
                        >
                            <View style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: 16 }}>
                                <View
                                    style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: 24,
                                        alignItems: "center",
                                        justifyContent: "center",
                                        backgroundColor:
                                            selectedForm && typeof selectedForm !== "string" && selectedForm?.status === 'pendente'
                                                ? "rgba(240,85,107,0.12)"
                                                : "rgba(48,209,88,0.12)",
                                    }}
                                >
                                    {selectedForm && typeof selectedForm !== "string" && selectedForm?.status === 'pendente' ? (
                                        <AlertCircle size={24} color={HADES.red} />
                                    ) : (
                                        <BookOpen size={24} color={HADES.green} />
                                    )}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text
                                        style={{ fontSize: 19, fontWeight: "700", color: HADES.text, marginBottom: 3 }}
                                    >
                                        {selectedForm && typeof selectedForm !== "string" ? selectedForm.disciplina : ""}
                                    </Text>
                                    <Text style={{ fontSize: 13, color: HADES.textMuted }} numberOfLines={2}>
                                        {selectedForm && typeof selectedForm !== "string" ? selectedForm.conteudo_especifico : ""}
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                onPress={() => setSelectedForm(null)}
                                style={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: 15,
                                    backgroundColor: HADES.surfaceOverlay,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <X size={16} color={HADES.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Botões */}
                        <View className="gap-3">
                            <TouchableOpacity
                                onPress={() => {
                                    if (!selectedForm || typeof selectedForm === "string") return;
                                    const form = selectedForm;
                                    setSelectedForm(null);
                                    router.push({
                                        pathname: "/(tabs)/focus",
                                        params: {
                                            reviewSessionId: form.id,
                                            subject: form.disciplina,
                                            content: form.conteudo_especifico || "",
                                            oldDuration: form.tempo_minutos.toString(),
                                            isPublic: form.is_public.toString(),
                                            autoStart: 'true'
                                        }
                                    });
                                }}
                                activeOpacity={0.85}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 8,
                                    height: 52,
                                    borderRadius: 14,
                                    backgroundColor: HADES.accentSolid,
                                }}
                            >
                                <Clock size={20} color="#000" />
                                <Text style={{ fontSize: 15, fontWeight: "700", color: "#000" }}>
                                    Sessão de revisão
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => {
                                    if (!selectedForm || typeof selectedForm === "string") return;
                                    const form = selectedForm;
                                    setSelectedForm(null);
                                    router.push({
                                        pathname: "/(modals)/focus-feedback",
                                        params: {
                                            sessionId: form.id,
                                            subject: form.disciplina,
                                            content: form.conteudo_especifico || "",
                                            oldDuration: form.tempo_minutos.toString(),
                                            duration: "0",
                                            isPublic: form.is_public.toString(),
                                        }
                                    });
                                }}
                                activeOpacity={0.85}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 8,
                                    height: 52,
                                    borderRadius: 14,
                                    backgroundColor: HADES.surfaceRaised,
                                    borderWidth: 1,
                                    borderColor: "rgba(255,255,255,0.10)",
                                }}
                            >
                                <RefreshCw size={20} color={HADES.textSecondary} />
                                <Text style={{ fontSize: 15, fontWeight: "600", color: HADES.textSecondary }}>
                                    Refazer agora
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setSelectedForm(null)}
                                activeOpacity={0.7}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 8,
                                    paddingVertical: 14,
                                    marginTop: 4,
                                }}
                            >
                                <ArrowLeft size={20} color={HADES.textMuted} />
                                <Text style={{ fontSize: 15, fontWeight: "500", color: HADES.textMuted }}>
                                    Voltar
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

/** Esqueleto dos cartões "Formulários pendentes" / "Formulários salvos", exibido enquanto as sessões do usuário ainda carregam. */
function BancoDadosSkeleton() {
    return (
        <>
            <View
                style={{
                    backgroundColor: HADES.surface,
                    borderWidth: 1,
                    borderColor: HADES.border,
                    borderRadius: 16,
                    padding: 16,
                }}
            >
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 16,
                    }}
                >
                    <Skeleton width={150} height={16} hades />
                    <Skeleton width={70} height={20} borderRadius={7} hades />
                </View>
                {[0, 1].map((i) => (
                    <View
                        key={i}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 12,
                            padding: 14,
                            borderRadius: 13,
                            marginBottom: 10,
                            backgroundColor: HADES.bg,
                        }}
                    >
                        <SkeletonCircle size={40} hades />
                        <View style={{ flex: 1, gap: 6 }}>
                            <Skeleton width="55%" height={13} hades />
                            <Skeleton width="75%" height={11} hades />
                        </View>
                    </View>
                ))}
            </View>

            <View
                style={{
                    backgroundColor: HADES.surface,
                    borderWidth: 1,
                    borderColor: HADES.border,
                    borderRadius: 16,
                    padding: 16,
                }}
            >
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 16,
                    }}
                >
                    <Skeleton width={140} height={16} hades />
                    <Skeleton width={60} height={20} borderRadius={7} hades />
                </View>
                {[0, 1, 2].map((i) => (
                    <View
                        key={i}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 12,
                            padding: 14,
                            borderRadius: 13,
                            marginBottom: 10,
                            backgroundColor: HADES.bg,
                        }}
                    >
                        <SkeletonCircle size={40} hades />
                        <View style={{ flex: 1, gap: 6 }}>
                            <Skeleton width="50%" height={13} hades />
                            <Skeleton width="70%" height={11} hades />
                        </View>
                    </View>
                ))}
            </View>
        </>
    );
}

/** Esqueleto da aba Análise (escopo pessoal), exibido enquanto as sessões do usuário ainda carregam — evita mostrar o estado "vazio" antes da hora. */
function AnalisePessoalSkeleton() {
    return (
        <View className="gap-8">
            <View style={{ gap: 10 }}>
                <Skeleton width={90} height={11} hades />
                <Skeleton width={130} height={26} hades />
                <Skeleton height={130} borderRadius={12} hades />
            </View>

            <View className="flex-row gap-[10px]">
                <Skeleton height={84} borderRadius={16} hades style={{ flex: 1 }} />
                <Skeleton height={84} borderRadius={16} hades style={{ flex: 1 }} />
            </View>

            <View style={{ gap: 12 }}>
                <Skeleton width={160} height={16} hades />
                <Skeleton height={130} borderRadius={12} hades />
            </View>

            <View style={{ gap: 12 }}>
                <Skeleton width={190} height={16} hades />
                <View className="flex-row items-center gap-[18px]">
                    <SkeletonCircle size={120} hades />
                    <View style={{ flex: 1, gap: 8 }}>
                        <Skeleton height={12} hades />
                        <Skeleton height={12} hades />
                        <Skeleton height={12} hades />
                    </View>
                </View>
            </View>

            <View style={{ gap: 10 }}>
                <Skeleton width={110} height={16} hades />
                <Skeleton width={90} height={30} hades />
                <Skeleton height={10} borderRadius={5} hades />
            </View>

            <View style={{ gap: 12 }}>
                <Skeleton width={200} height={16} hades />
                <Skeleton height={130} borderRadius={12} hades />
            </View>

            <View style={{ gap: 10 }}>
                <Skeleton width={170} height={16} hades />
                <Skeleton height={90} borderRadius={12} hades />
            </View>
        </View>
    );
}
