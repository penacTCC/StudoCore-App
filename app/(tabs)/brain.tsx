import { useState } from "react";

//Componentes do native
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    Modal,
    TextInput,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronRight, Sparkles, Plus, X } from "lucide-react-native";

//Constantes
import { COLORS } from "@/constants/colors";
import { mockFailedQuestions } from "@/constants/mock-data";

//Componentes do projeto
import { ProgressBar, StatCard } from "@/components/ui/";

type BrainTab = "database" | "analytics";

const BRAIN_TABS = [
    { key: "database", label: "Database" },
    { key: "analytics", label: "Analytics" },
];

const studyDistribution = [
    { subject: "Matemática", hours: 12, color: "#8b5cf6" },
    { subject: "Física", hours: 8, color: "#10b981" },
    { subject: "Química", hours: 5, color: "#fbbf24" },
    { subject: "Biologia", hours: 3, color: "#f43f5e" },
];

type FailedQuestion = {
    id: number;
    subject: string;
    question: string;
    date: string;
};

export default function BrainScreen() {
    const [brainTab, setBrainTab] = useState<BrainTab>("database");
    const [questions, setQuestions] = useState<FailedQuestion[]>(mockFailedQuestions);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newSubject, setNewSubject] = useState("");
    const [newQuestion, setNewQuestion] = useState("");

    const handleAddQuestion = () => {
        if (!newSubject.trim() || !newQuestion.trim()) {
            Alert.alert("Atenção", "Preencha a matéria e a questão.");
            return;
        }
        const today = new Date();
        const dateStr = `${String(today.getDate()).padStart(2, "0")}/${String(
            today.getMonth() + 1
        ).padStart(2, "0")}/${today.getFullYear()}`;
        setQuestions((prev) => [
            ...prev,
            { id: Date.now(), subject: newSubject.trim(), question: newQuestion.trim(), date: dateStr },
        ]);
        setNewSubject("");
        setNewQuestion("");
        setShowAddModal(false);
    };

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
                    <View className="px-4 pb-4">
                        <View className="bg-slate-900 border border-slate-800 rounded-3xl p-4">
                            {/* Cabeçalho do painel */}
                            <View className="flex-row items-center justify-between mb-4">
                                <Text className="text-lg font-semibold text-slate-200">
                                    Questões Erradas
                                </Text>
                                <View
                                    className="px-2 py-1 rounded-lg"
                                    style={{ backgroundColor: "rgba(244, 63, 94, 0.2)" }}
                                >
                                    <Text className="text-xs font-medium text-rose-400">
                                        {questions.length} para revisar
                                    </Text>
                                </View>
                            </View>

                            {/* Lista de questões */}
                            {questions.length > 0 ? (
                                questions.map((q) => (
                                    <View
                                        key={q.id}
                                        className="p-4 rounded-xl mb-3"
                                        style={{
                                            backgroundColor: "rgba(30, 41, 59, 0.5)",
                                            borderWidth: 1,
                                            borderColor: "rgba(244, 63, 94, 0.3)",
                                        }}
                                    >
                                        <View className="flex-row items-center justify-between mb-2">
                                            <View
                                                className="px-2 py-0.5 rounded"
                                                style={{ backgroundColor: "rgba(244, 63, 94, 0.2)" }}
                                            >
                                                <Text className="text-xs font-medium text-rose-400">
                                                    {q.subject}
                                                </Text>
                                            </View>
                                            <Text className="text-xs text-slate-500">{q.date}</Text>
                                        </View>
                                        <Text className="text-sm text-slate-200">{q.question}</Text>
                                        <TouchableOpacity className="flex-row items-center gap-1 mt-3">
                                            <Text className="text-sm font-medium text-violet-400">
                                                Tentar novamente
                                            </Text>
                                            <ChevronRight size={14} color={COLORS.violetLight} />
                                        </TouchableOpacity>
                                    </View>
                                ))
                            ) : (
                                <View className="items-center py-8">
                                    <Text className="text-lg font-semibold text-emerald-400 mb-1">
                                        Tudo certo! 🎉
                                    </Text>
                                    <Text className="text-sm text-slate-400 text-center">
                                        Nenhuma questão errada. Continue assim!
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
                                {studyDistribution.map((item) => (
                                    <View key={item.subject}>
                                        <View className="flex-row items-center justify-between mb-1">
                                            <Text className="text-sm text-slate-300">{item.subject}</Text>
                                            <Text className="text-sm text-slate-400">{item.hours}h</Text>
                                        </View>
                                        <ProgressBar
                                            progress={item.hours / 12}
                                            color={item.color}
                                            height={8}
                                            trackClassName="bg-slate-800"
                                        />
                                    </View>
                                ))}
                            </View>
                        </View>

                        {/* Resumo Semanal */}
                        <View className="bg-slate-900 border border-slate-800 rounded-3xl p-4">
                            <Text className="text-lg font-semibold text-slate-200 mb-4">
                                Esta Semana
                            </Text>
                            <View className="flex-row gap-3">
                                <StatCard value={28} label="Horas" />
                                <StatCard value={10} label="Sequência" valueColor={COLORS.emeraldLight} />
                                <StatCard value={45} label="Questões" valueColor={COLORS.violetLight} />
                            </View>
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* ── MODAL: Adicionar Questão ──────────────────── */}
            <Modal visible={showAddModal} transparent animationType="fade">
                <View
                    className="flex-1 justify-center items-center px-4"
                    style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
                >
                    <View className="w-full bg-slate-900 border border-slate-700 rounded-3xl p-6">
                        {/* Header */}
                        <View className="flex-row items-center justify-between mb-5">
                            <Text className="text-lg font-bold text-slate-100">
                                Adicionar questão errada
                            </Text>
                            <TouchableOpacity onPress={() => setShowAddModal(false)}>
                                <X size={20} color={COLORS.textMuted} />
                            </TouchableOpacity>
                        </View>

                        {/* Matéria */}
                        <Text className="text-xs text-slate-400 mb-1 font-medium uppercase tracking-wide">
                            Matéria
                        </Text>
                        <TextInput
                            value={newSubject}
                            onChangeText={setNewSubject}
                            placeholder="Ex: Matemática"
                            placeholderTextColor={COLORS.textMuted}
                            className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 text-sm mb-4"
                        />

                        {/* Questão */}
                        <Text className="text-xs text-slate-400 mb-1 font-medium uppercase tracking-wide">
                            Questão
                        </Text>
                        <TextInput
                            value={newQuestion}
                            onChangeText={setNewQuestion}
                            placeholder="Descreva a questão que errou..."
                            placeholderTextColor={COLORS.textMuted}
                            multiline
                            numberOfLines={3}
                            className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 text-sm mb-6"
                            style={{ textAlignVertical: "top" }}
                        />

                        {/* Botões */}
                        <View className="flex-row gap-3">
                            <TouchableOpacity
                                onPress={() => setShowAddModal(false)}
                                className="flex-1 py-3 rounded-xl border border-slate-600 items-center"
                            >
                                <Text className="text-slate-400 font-medium">Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleAddQuestion}
                                className="flex-1 py-3 rounded-xl items-center"
                                style={{ backgroundColor: COLORS.violetDark }}
                            >
                                <Text className="text-white font-semibold">Adicionar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
