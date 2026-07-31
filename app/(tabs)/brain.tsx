import { useState, useEffect, useMemo, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView, Modal, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronRight, X, AlertCircle, BookOpen, Clock, RefreshCw, ArrowLeft, Timer, Layers } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

import { HADES } from "@/constants/hades";
import { Skeleton, SkeletonCircle } from "@/components/ui/Skeleton";
import { useGraficosAnalytics } from "@/lib/graphics-analytics";
import { useAnalisePessoal } from "@/hooks/useAnalisePessoal";
import { useAuth } from "@/hooks/useAuth";
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
    const [selectedForm, setSelectedForm] = useState<SessaoFocoRow | null>(null);
    const router = useRouter();

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
                <Text style={{ fontSize: 23, fontWeight: "700", color: HADES.text, letterSpacing: -0.3 }}>
                    {brainTab === "analytics" ? "Análise" : "Central de aprendizado"}
                </Text>
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
                    <View style={{ paddingHorizontal: 20, paddingBottom: 16, gap: 16 }}>
                      {carregandoAnalise ? (
                        <BancoDadosSkeleton />
                      ) : (
                        <>
                        {/* Formulários Pendentes */}
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
                                <Text
                                    style={{ fontSize: 16, fontWeight: "700", color: HADES.text, letterSpacing: -0.2 }}
                                >
                                    Formulários pendentes
                                </Text>
                                <Text
                                    style={{
                                        fontSize: 11,
                                        fontWeight: "600",
                                        color: HADES.red,
                                        backgroundColor: "rgba(240,85,107,0.12)",
                                        borderRadius: 7,
                                        paddingVertical: 4,
                                        paddingHorizontal: 8,
                                        overflow: "hidden",
                                    }}
                                >
                                    {pendingSessions.length} para refazer
                                </Text>
                            </View>

                            {pendingSessions.length > 0 ? (
                                pendingSessions.map((form) => (
                                    <TouchableOpacity
                                        key={form.id}
                                        onPress={() => setSelectedForm(form)}
                                        activeOpacity={0.75}
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            gap: 12,
                                            padding: 14,
                                            borderRadius: 13,
                                            marginBottom: 10,
                                            backgroundColor: HADES.bg,
                                            borderWidth: 1,
                                            borderColor: "rgba(240,85,107,0.3)",
                                        }}
                                    >
                                        <View
                                            style={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: 20,
                                                backgroundColor: "rgba(240,85,107,0.12)",
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}
                                        >
                                            <AlertCircle size={20} color={HADES.red} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 14, fontWeight: "600", color: HADES.text }}>
                                                {form.disciplina}
                                            </Text>
                                            <Text
                                                style={{ fontSize: 12, color: HADES.textFaint, marginTop: 2 }}
                                                numberOfLines={1}
                                            >
                                                {form.conteudo_especifico}
                                            </Text>
                                        </View>
                                        <ChevronRight size={16} color={HADES.textFaint} />
                                    </TouchableOpacity>
                                ))
                            ) : (
                                <View style={{ alignItems: "center", paddingVertical: 24 }}>
                                    <Text
                                        style={{ fontSize: 14, fontWeight: "600", color: HADES.green, marginBottom: 4 }}
                                    >
                                        Nenhuma pendência 🎉
                                    </Text>
                                    <Text style={{ fontSize: 12, color: HADES.textDim, textAlign: "center" }}>
                                        Você está em dia com seus estudos!
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Formulários Salvos */}
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
                                <Text
                                    style={{ fontSize: 16, fontWeight: "700", color: HADES.text, letterSpacing: -0.2 }}
                                >
                                    Formulários salvos
                                </Text>
                                <Text
                                    style={{
                                        fontSize: 11,
                                        fontWeight: "600",
                                        color: HADES.green,
                                        backgroundColor: "rgba(48,209,88,0.12)",
                                        borderRadius: 7,
                                        paddingVertical: 4,
                                        paddingHorizontal: 8,
                                        overflow: "hidden",
                                    }}
                                >
                                    {savedSessions.length} salvos
                                </Text>
                            </View>

                            {savedSessions.length > 0 ? (
                                savedSessions.map((form) => (
                                    <TouchableOpacity
                                        key={form.id}
                                        onPress={() => setSelectedForm(form)}
                                        activeOpacity={0.75}
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            gap: 12,
                                            padding: 14,
                                            borderRadius: 13,
                                            marginBottom: 10,
                                            backgroundColor: HADES.bg,
                                            borderWidth: 1,
                                            borderColor: "rgba(255,255,255,0.07)",
                                        }}
                                    >
                                        <View
                                            style={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: 20,
                                                backgroundColor: "rgba(48,209,88,0.12)",
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}
                                        >
                                            <BookOpen size={20} color={HADES.green} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 14, fontWeight: "600", color: HADES.text }}>
                                                {form.disciplina}
                                            </Text>
                                            <Text
                                                style={{ fontSize: 12, color: HADES.textFaint, marginTop: 2 }}
                                                numberOfLines={1}
                                            >
                                                {form.conteudo_especifico}
                                            </Text>
                                        </View>
                                        <ChevronRight size={16} color={HADES.textFaint} />
                                    </TouchableOpacity>
                                ))
                            ) : (
                                <View style={{ alignItems: "center", paddingVertical: 24 }}>
                                    <Text style={{ fontSize: 12, color: HADES.textDim, textAlign: "center" }}>
                                        Nenhum formulário salvo ainda.
                                    </Text>
                                </View>
                            )}
                        </View>
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
            <Modal visible={!!selectedForm} transparent animationType="fade" onRequestClose={() => setSelectedForm(null)}>
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
                                            selectedForm?.status === 'pendente'
                                                ? "rgba(240,85,107,0.12)"
                                                : "rgba(48,209,88,0.12)",
                                    }}
                                >
                                    {selectedForm?.status === 'pendente' ? (
                                        <AlertCircle size={24} color={HADES.red} />
                                    ) : (
                                        <BookOpen size={24} color={HADES.green} />
                                    )}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text
                                        style={{ fontSize: 19, fontWeight: "700", color: HADES.text, marginBottom: 3 }}
                                    >
                                        {selectedForm?.disciplina}
                                    </Text>
                                    <Text style={{ fontSize: 13, color: HADES.textMuted }} numberOfLines={2}>
                                        {selectedForm?.conteudo_especifico}
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
                                    if (!selectedForm) return;
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
                                    if (!selectedForm) return;
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
