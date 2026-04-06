import { useState, useMemo } from "react";
import { View, Text, TouchableOpacity, ScrollView, Modal, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronRight, Sparkles, X, AlertCircle, BookOpen, Clock, RefreshCw, ArrowLeft } from "lucide-react-native";
import { useRouter } from "expo-router";

import { COLORS } from "@/constants/colors";
import { ProgressBar, StatCard } from "@/components/ui/";
import { useSessoesUsuario } from "@/hooks/useSessoesFoco";
import { useAuth } from "@/hooks/useAuth";
import { SessaoFocoRow } from "@/services/sessions";

type BrainTab = "database" | "analytics";

const BRAIN_TABS = [
    { key: "database", label: "Database" },
    { key: "analytics", label: "Analytics" },
];

const COLORS_PALETTE = ["#8b5cf6", "#10b981", "#fbbf24", "#f43f5e", "#3b82f6", "#ec4899", "#14b8a6", "#f97316"];

export default function BrainScreen() {
    const [brainTab, setBrainTab] = useState<BrainTab>("database");
    
    const { userId } = useAuth();
    const { savedSessions, pendingSessions, loading } = useSessoesUsuario(userId);
    const [selectedForm, setSelectedForm] = useState<SessaoFocoRow | null>(null);
    const router = useRouter();

    const analyticsData = useMemo(() => {
        const allSessions = [...savedSessions, ...pendingSessions];
        
        if (allSessions.length === 0) {
            return {
                horasEstaSemana: 0,
                questoesEstaSemana: 0,
                sequencia: 0,
                distribuicao: [],
                maxHours: 1
            };
        }

        // Helpers
        const getStartOfWeek = (d: Date) => {
            const date = new Date(d);
            const day = date.getDay(); // 0 is Sunday
            const diff = date.getDate() - day;
            return new Date(date.setDate(diff)).setHours(0, 0, 0, 0);
        };

        const today = new Date();
        const startOfThisWeek = getStartOfWeek(today);
        
        let horasTotaisMinutos = 0;
        let questoesTotais = 0;
        const distMap: Record<string, number> = {};

        const uniqueDates = new Set<string>();

        allSessions.forEach(session => {
            // Data da sessão
            const sessionDate = new Date(session.created_at || session.data_sessao);
            
            // Para "Sequência" (General Streak)
            uniqueDates.add(sessionDate.toISOString().split('T')[0]);

            // Para "Esta Semana"
            if (getStartOfWeek(sessionDate) === startOfThisWeek) {
                horasTotaisMinutos += session.tempo_minutos || 0;
                questoesTotais += session.questoes_respondidas || 0;

                const subject = session.disciplina || "Outros";
                if (!distMap[subject]) distMap[subject] = 0;
                distMap[subject] += session.tempo_minutos || 0;
            }
        });

        // Compute sequência (streak)
        const sortedDates = Array.from(uniqueDates).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        let streak = 0;
        const todayStr = today.toISOString().split('T')[0];
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (sortedDates.length > 0) {
            let expectedDateStr = sortedDates[0];
            if (expectedDateStr === todayStr || expectedDateStr === yesterdayStr) {
                let currentDate = new Date(expectedDateStr + "T12:00:00"); 
                for (let i = 0; i < sortedDates.length; i++) {
                    if (sortedDates[i] === expectedDateStr) {
                        streak++;
                        currentDate.setDate(currentDate.getDate() - 1);
                        expectedDateStr = currentDate.toISOString().split('T')[0];
                    } else {
                        break;
                    }
                }
            }
        }

        // Distribuição de matérias (ordenado, da semana em horas)
        const distribuicao = Object.keys(distMap).map((subject, index) => ({
            subject,
            hours: Math.round((distMap[subject] / 60) * 10) / 10,
            color: COLORS_PALETTE[index % COLORS_PALETTE.length]
        })).sort((a, b) => b.hours - a.hours);

        return {
            horasEstaSemana: Math.round(horasTotaisMinutos / 60),
            questoesEstaSemana: questoesTotais,
            sequencia: streak,
            distribuicao,
            maxHours: distribuicao.length > 0 ? Math.max(...distribuicao.map(d => d.hours)) : 1
        };
    }, [savedSessions, pendingSessions]);

    return (
        <SafeAreaView className="flex-1 bg-slate-950" edges={["top"]}>
            {/* Header */}
            <View className="bg-slate-950 border-b border-slate-800 px-4 py-3">
                <Text className="text-xl font-bold text-slate-200">Brain Hub</Text>
                <Text className="text-sm text-slate-400">Seu painel de aprendizado</Text>
            </View>

            {/* Tabs */}
            <View className="px-4 py-3">
                <View className="flex-row bg-slate-900 p-1 rounded-xl">
                    {BRAIN_TABS.map((tab) => (
                        <TouchableOpacity
                            key={tab.key}
                            onPress={() => setBrainTab(tab.key as BrainTab)}
                            className={`flex-1 py-2 rounded-lg items-center ${brainTab === tab.key ? "bg-violet-600" : ""
                                }`}
                        >
                            <Text
                                className={`text-sm font-medium ${brainTab === tab.key ? "text-white" : "text-slate-400"
                                    }`}
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
                    <View className="px-4 pb-4 gap-4">
                        {/* AI Insight Card */}
                        <View
                            className="border border-slate-800 rounded-3xl p-4"
                            style={{ backgroundColor: "rgba(124, 58, 237, 0.08)" }}
                        >
                            <View className="flex-row items-center gap-3">
                                <View
                                    className="w-12 h-12 rounded-xl items-center justify-center"
                                    style={{ backgroundColor: "rgba(139, 92, 246, 0.3)" }}
                                >
                                    <Sparkles size={24} color={COLORS.violetLight} />
                                </View>
                                <View>
                                    <Text className="text-sm text-slate-400">IA Insight</Text>
                                    <Text className="text-lg font-semibold text-emerald-400">
                                        +15% vs mês passado
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Distribuição de Estudo */}
                        <View className="bg-slate-900 border border-slate-800 rounded-3xl p-4">
                            <Text className="text-lg font-semibold text-slate-200 mb-4">
                                Distribuição de Estudo
                            </Text>
                            <View className="gap-3">
                                {analyticsData.distribuicao.length > 0 ? analyticsData.distribuicao.map((item) => (
                                    <View key={item.subject}>
                                        <View className="flex-row items-center justify-between mb-1">
                                            <Text className="text-sm text-slate-300">{item.subject}</Text>
                                            <Text className="text-sm text-slate-400">{item.hours}h</Text>
                                        </View>
                                        <ProgressBar
                                            progress={item.hours / analyticsData.maxHours}
                                            color={item.color}
                                            height={8}
                                            trackClassName="bg-slate-800"
                                        />
                                    </View>
                                )) : (
                                    <Text className="text-sm text-slate-500 text-center py-2">Sem registros nesta semana</Text>
                                )}
                            </View>
                        </View>

                        {/* Resumo Semanal */}
                        <View className="bg-slate-900 border border-slate-800 rounded-3xl p-4">
                            <Text className="text-lg font-semibold text-slate-200 mb-4">
                                Esta Semana
                            </Text>
                            <View className="flex-row gap-3">
                                <StatCard value={analyticsData.horasEstaSemana} label="Horas" />
                                <StatCard value={analyticsData.sequencia} label="Sequência" valueColor={COLORS.emeraldLight} />
                                <StatCard value={analyticsData.questoesEstaSemana} label="Questões" valueColor={COLORS.violetLight} />
                            </View>
                        </View>
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
