import { useState, useMemo, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, Modal, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronRight, X, AlertCircle, BookOpen, Clock, RefreshCw, ArrowLeft, Share2, Timer, Layers } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

import { COLORS } from "@/constants/colors";
import { useSessoesUsuario } from "@/hooks/useSessoesFoco";
import { useAuth } from "@/hooks/useAuth";
import { SessaoFocoRow } from "@/types/sessions";
import { buscarGamificacao } from "@/services/gamificacao";
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

const COLORS_PALETTE = ["#8b5cf6", "#10b981", "#fbbf24", "#f43f5e", "#3b82f6", "#ec4899", "#14b8a6", "#f97316"];

export default function BrainScreen() {
    const [brainTab, setBrainTab] = useState<BrainTab>("database");
    const [weekStartsOn, setWeekStartsOn] = useState<'sunday' | 'monday'>('sunday');
    const [escopoAnalise, setEscopoAnalise] = useState<EscopoAnalise>("pessoal");
    const [periodoAnalise, setPeriodoAnalise] = useState<PeriodoAnalise>("7d");

    useEffect(() => {
        const loadPref = async () => {
            const pref = await AsyncStorage.getItem('@app_week_starts_on');
            if (pref === 'monday') {
                setWeekStartsOn('monday');
            }
        };
        loadPref();
    }, []);

    const { userId } = useAuth();
    const { savedSessions, pendingSessions, loading } = useSessoesUsuario(userId);
    const [selectedForm, setSelectedForm] = useState<SessaoFocoRow | null>(null);
    const router = useRouter();

    // Ofensiva é calculada e persistida no backend (tabela gamificacoes) ao concluir uma sessão,
    // então aqui só buscamos o valor já pronto em vez de recalcular a partir do histórico de sessões.
    const [ofensivaReal, setOfensivaReal] = useState(0);
    useEffect(() => {
        if (!userId) return;
        buscarGamificacao(userId).then((gamificacao) => {
            setOfensivaReal(gamificacao?.ofensiva ?? 0);
        });
    }, [userId]);

    const analyticsData = useMemo(() => {
        const allSessions = [...savedSessions, ...pendingSessions];

        if (allSessions.length === 0) {
            return {
                horasEstaSemana: "0h",
                questoesEstaSemana: 0,
                sequencia: ofensivaReal,
                horasSemanaPasada: "0h",
                questoesSemanaPasada: 0,
                diasSemanaPasada: 0,
                diasEstaSemana: 0,
                distribuicao: [],
                maxHours: 1,
                horasEstaSemanaMinutos: 0,
                horasSemanaPasadaMinutos: 0
            };
        }

        // Helpers
        const getStartOfWeek = (d: Date, start: 'sunday' | 'monday') => {
            const date = new Date(d);
            const day = date.getDay();
            let diff = date.getDate() - day;
            if (start === 'monday') {
                const offset = day === 0 ? -6 : 1;
                diff = date.getDate() - day + offset;
            }
            return new Date(date.setDate(diff)).setHours(0, 0, 0, 0);
        };

        const today = new Date();
        const startOfThisWeek = getStartOfWeek(today, weekStartsOn);
        // Semana passada: 7 dias antes do início desta semana
        const startOfLastWeek = startOfThisWeek - 7 * 24 * 60 * 60 * 1000;
        const endOfLastWeek = startOfThisWeek - 1;

        let horasTotaisMinutos = 0;
        let questoesTotais = 0;
        let horasSemanaPasadaMinutos = 0;
        let questoesSemanaPasada = 0;
        const diasEstaSemana = new Set<string>();
        const diasSemanaPasada = new Set<string>();
        const distMap: Record<string, number> = {};

        allSessions.forEach(session => {
            const sessionDate = new Date(session.created_at || session.data_sessao);
            const sessionTime = sessionDate.getTime();

            // Para "Esta Semana"
            if (getStartOfWeek(sessionDate, weekStartsOn) === startOfThisWeek) {
                horasTotaisMinutos += session.tempo_minutos || 0;
                questoesTotais += session.questoes_respondidas || 0;
                diasEstaSemana.add(sessionDate.toISOString().split('T')[0]);

                const subject = session.disciplina || "Outros";
                if (!distMap[subject]) distMap[subject] = 0;
                distMap[subject] += session.tempo_minutos || 0;
            }

            // Para "Semana Passada"
            if (sessionTime >= startOfLastWeek && sessionTime <= endOfLastWeek) {
                horasSemanaPasadaMinutos += session.tempo_minutos || 0;
                questoesSemanaPasada += session.questoes_respondidas || 0;
                diasSemanaPasada.add(sessionDate.toISOString().split('T')[0]);
            }
        });

        // Distribuição de matérias (ordenado, da semana em horas)
        const distribuicao = Object.keys(distMap).map((subject, index) => ({
            subject,
            hours: Math.round((distMap[subject] / 60) * 10) / 10,
            color: COLORS_PALETTE[index % COLORS_PALETTE.length]
        })).sort((a, b) => b.hours - a.hours);

        horasTotaisMinutos = 30;
        horasSemanaPasadaMinutos = 70;

        return {
            horasEstaSemana: `${Math.floor(horasTotaisMinutos / 60)}h${String(horasTotaisMinutos % 60).padStart(2, '0')}`,
            questoesEstaSemana: questoesTotais,
            sequencia: ofensivaReal,
            diasEstaSemana: diasEstaSemana.size,
            // Semana passada
            horasSemanaPasada: `${Math.floor(horasSemanaPasadaMinutos / 60)}h${String(horasSemanaPasadaMinutos % 60).padStart(2, '0')}`,
            questoesSemanaPasada,
            diasSemanaPasada: diasSemanaPasada.size,
            distribuicao,
            maxHours: distribuicao.length > 0 ? Math.max(...distribuicao.map(d => d.hours)) : 1,
            horasEstaSemanaMinutos: horasTotaisMinutos,
            horasSemanaPasadaMinutos: horasSemanaPasadaMinutos
        };
    }, [savedSessions, pendingSessions, weekStartsOn, ofensivaReal]);

    return (
        <SafeAreaView className="flex-1 bg-slate-950" edges={["top"]}>
            {/* Header */}
            <View className="bg-slate-950 px-4 py-3">
                <Text className="text-xl font-bold text-slate-200">
                    {brainTab === "analytics" ? "Central de análises" : "Central de aprendizado"}
                </Text>
            </View>

            {/* Tabs */}
            <View className="px-4 py-3">
                <View className="flex-row w-full">
                    {BRAIN_TABS.map((tab) => (
                        <TouchableOpacity
                            key={tab.key}
                            onPress={() => setBrainTab(tab.key as BrainTab)}
                            className={`flex-1 items-center pb-2 border-b-2 ${brainTab === tab.key ? "border-brand-500" : "border-transparent"}`}
                        >
                            <Text
                                className={`text-sm font-medium ${brainTab === tab.key ? "text-white" : "text-slate-400"}`}
                            >
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* ── DATABASE ─────────────────────────────────── */}
                {brainTab === "database" && (
                    <View className="px-4 pb-4 gap-4">
                        {/* Formulários Pendentes */}
                        <View className="bg-slate-900 border border-slate-800 rounded-3xl p-4">
                            <View className="flex-row items-center justify-between mb-4">
                                <Text className="text-lg font-semibold text-slate-200">
                                    Formulários Pendentes
                                </Text>
                                <View
                                    className="px-2 py-1 rounded-lg"
                                    style={{ backgroundColor: "rgba(244, 63, 94, 0.2)" }}
                                >
                                    <Text className="text-xs font-medium text-rose-400">
                                        {pendingSessions.length} para refazer
                                    </Text>
                                </View>
                            </View>

                            {pendingSessions.length > 0 ? (
                                pendingSessions.map((form) => (
                                    <TouchableOpacity
                                        key={form.id}
                                        onPress={() => setSelectedForm(form)}
                                        activeOpacity={0.7}
                                        className="p-4 rounded-xl mb-3 flex-row items-center border"
                                        style={{ backgroundColor: "rgba(30, 41, 59, 0.5)", borderColor: "rgba(244, 63, 94, 0.3)" }}
                                    >
                                        <View className="w-10 h-10 rounded-full bg-rose-500/20 items-center justify-center mr-3">
                                            <AlertCircle size={20} color={COLORS.rose} />
                                        </View>
                                        <View className="flex-1">
                                            <Text className="text-sm font-semibold text-slate-200">{form.disciplina}</Text>
                                            <Text className="text-xs text-slate-400 mt-1" numberOfLines={1}>{form.conteudo_especifico}</Text>
                                        </View>
                                        <ChevronRight size={16} color={COLORS.textMuted} />
                                    </TouchableOpacity>
                                ))
                            ) : (
                                <View className="items-center py-6">
                                    <Text className="text-sm font-medium text-emerald-400 mb-1">
                                        Nenhuma pendência 🎉
                                    </Text>
                                    <Text className="text-xs text-slate-500 text-center">
                                        Você está em dia com seus estudos!
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Formulários Salvos */}
                        <View className="bg-slate-900 border border-slate-800 rounded-3xl p-4">
                            <View className="flex-row items-center justify-between mb-4">
                                <Text className="text-lg font-semibold text-slate-200">
                                    Formulários Salvos
                                </Text>
                                <View
                                    className="px-2 py-1 rounded-lg"
                                    style={{ backgroundColor: "rgba(16, 185, 129, 0.2)" }}
                                >
                                    <Text className="text-xs font-medium text-emerald-400">
                                        {savedSessions.length} salvos
                                    </Text>
                                </View>
                            </View>

                            {savedSessions.length > 0 ? (
                                savedSessions.map((form) => (
                                    <TouchableOpacity
                                        key={form.id}
                                        onPress={() => setSelectedForm(form)}
                                        activeOpacity={0.7}
                                        className="p-4 rounded-xl mb-3 flex-row items-center border border-slate-800 bg-slate-800/50"
                                    >
                                        <View className="w-10 h-10 rounded-full bg-emerald-500/20 items-center justify-center mr-3">
                                            <BookOpen size={20} color={COLORS.emerald} />
                                        </View>
                                        <View className="flex-1">
                                            <Text className="text-sm font-semibold text-slate-200">{form.disciplina}</Text>
                                            <Text className="text-xs text-slate-400 mt-1" numberOfLines={1}>{form.conteudo_especifico}</Text>
                                        </View>
                                        <ChevronRight size={16} color={COLORS.textMuted} />
                                    </TouchableOpacity>
                                ))
                            ) : (
                                <View className="items-center py-6">
                                    <Text className="text-xs text-slate-500 text-center">
                                        Nenhum formulário salvo ainda.
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                )}

                {/* ── ANALYTICS ────────────────────────────────── */}
                {brainTab === "analytics" && (
                    <View className="px-4 pb-4 gap-7">
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
                            <SeletorPeriodo valor={periodoAnalise} aoAlterar={setPeriodoAnalise} />
                        </View>

                        {escopoAnalise === "grupo" ? (
                            <View className="gap-5">
                                <CabecalhoGrupo cor={COLORS.primary} />
                                <MetaSemanalGrupo />
                                <RankingHorasGrupo cor={COLORS.primary} />

                                <View className="flex-row gap-[10px]">
                                    <MateriaMaisEstudadaGrupo />
                                    <MembrosAtivosGrupo cor={COLORS.primary} />
                                </View>

                                <EvolucaoGrupo cor={COLORS.primary} />
                                <QuestoesPorMembroGrupo />
                            </View>
                        ) : (
                            <View className="gap-5">
                                <GraficoArea cor={COLORS.primary} />

                                <View className="flex-row gap-[10px]">
                                    <CartaoMetrica icone={Timer} rotulo="SESSÃO MÉDIA" valor="1h 42m" legenda="por sessão" />
                                    <CartaoMetrica icone={Layers} rotulo="Nº SESSÕES" valor="17" legenda="esta semana" />
                                </View>

                                <GraficoComparativoSemanal cor={COLORS.primary} />
                                <GraficoDonutMaterias />
                                <BarraTaxaAcerto />
                                <GraficoDiaSemana cor={COLORS.primary} />
                                <GraficoOfensiva />
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
                    <View className="w-full bg-slate-900 border-t border-slate-800 rounded-t-3xl p-6 pb-8">
                        {/* Header */}
                        <View className="flex-row items-center justify-between mb-6">
                            <View className="flex-row items-center flex-1">
                                <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${selectedForm?.status === 'pendente' ? 'bg-rose-500/20' : 'bg-emerald-500/20'}`}>
                                    {selectedForm?.status === 'pendente' ? (
                                        <AlertCircle size={24} color={COLORS.rose} />
                                    ) : (
                                        <BookOpen size={24} color={COLORS.emerald} />
                                    )}
                                </View>
                                <View className="flex-1">
                                    <Text className="text-xl font-bold text-slate-100 mb-1">{selectedForm?.disciplina}</Text>
                                    <Text className="text-sm text-slate-400" numberOfLines={2}>{selectedForm?.conteudo_especifico}</Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={() => setSelectedForm(null)} className="p-2 bg-slate-800 rounded-full">
                                <X size={20} color={COLORS.textMuted} />
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
                                className="flex-row items-center justify-center gap-2 py-4 rounded-xl bg-violet-600"
                            >
                                <Clock size={20} color={COLORS.white} />
                                <Text className="text-white font-semibold text-lg">Sessão de revisão</Text>
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
                                className="flex-row items-center justify-center gap-2 py-4 rounded-xl bg-slate-800 border border-slate-700"
                            >
                                <RefreshCw size={20} color="#cbd5e1" />
                                <Text className="font-semibold text-lg" style={{ color: "#cbd5e1" }}>Refazer agora</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setSelectedForm(null)}
                                className="flex-row items-center justify-center gap-2 py-4 mt-2"
                            >
                                <ArrowLeft size={20} color={COLORS.textMuted} />
                                <Text className="text-slate-400 font-medium text-base">Voltar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
