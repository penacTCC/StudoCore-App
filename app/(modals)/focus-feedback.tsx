import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { CheckCircle2, ChevronLeft, BookOpen, XCircle, AlertCircle } from "lucide-react-native";
import { COLORS } from "@/constants/colors";
import { useAuth } from "@/hooks/useAuth";
import { salvarSessaoFoco, atualizarSessaoFoco } from "@/services/sessions";

// Helper para misturar qualquer array (Fisher-Yates) sem mutar o original
const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

export default function FocusFeedbackModal() {
    const router = useRouter();
    const params = useLocalSearchParams();

    // Pega o ID do usuário para salvar no Supabase
    const { userId } = useAuth();

    // Estado das 10 respostas
    const [answers, setAnswers] = useState<Record<number, string | null>>({
        1: null, 2: null, 3: null, 4: null, 5: null,
        6: null, 7: null, 8: null, 9: null, 10: null
    });

    // Mostra as respotas corretas e erradas após o "Enviar"
    const [showResults, setShowResults] = useState(false);

    const isComplete = Object.values(answers).every(val => val !== null);

    // Substitua este array com as suas perguntas reais do banco de dados (adicione o 'correctAnswer')
    const contentQuestions = [
        { id: 1, text: "Qual a principal vantagem deste conceito estudado?", options: ["Aumenta o foco", "Reduz o tempo", "Nenhuma das anteriores", "Todas as anteriores"], correctAnswer: "Aumenta o foco" },
        { id: 2, text: "Substitua a pergunta 2 aqui", options: ["Opção 1", "Opção errada", "Certa", "Falsa"], correctAnswer: "Certa" },
        { id: 3, text: "Substitua a pergunta 3 aqui", options: ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D"], correctAnswer: "Alternativa A" },
        { id: 4, text: "Substitua a pergunta 4 aqui", options: ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D"], correctAnswer: "Alternativa B" },
        { id: 5, text: "Substitua a pergunta 5 aqui", options: ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D"], correctAnswer: "Alternativa C" },
        { id: 6, text: "Substitua a pergunta 6 aqui", options: ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D"], correctAnswer: "Alternativa D" },
        { id: 7, text: "Substitua a pergunta 7 aqui", options: ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D"], correctAnswer: "Alternativa A" },
        { id: 8, text: "Substitua a pergunta 8 aqui", options: ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D"], correctAnswer: "Alternativa A" },
        { id: 9, text: "Substitua a pergunta 9 aqui", options: ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D"], correctAnswer: "Alternativa A" },
        { id: 10, text: "Substitua a pergunta 10 aqui", options: ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D"], correctAnswer: "Alternativa A" },
    ];

    // Aqui geramos e guardamos no STATE a versão embaralhada das opções.
    // Usar o useState com função (() => ...) garante que o sorteio só vai acontecer UMA ÚNICA VEZ
    // quando a tela de Quiz abrir. Ao clicar e a tela atualizar pra mostrar a resposta com cor verde
    // as opções NÂO vão mudar de lugar de novo.
    const [shuffledQuestions] = useState(() =>
        contentQuestions.map(q => ({
            ...q,
            options: shuffleArray(q.options)
        }))
    );

    const [saving, setSaving] = useState(false);

    const handleSubmit = async (status: string = "salvo") => {
        if (!showResults) {
            // Passo 1: Avaliar/Validar
            if (!isComplete) {
                Alert.alert("Incompleto", "Por favor, responda todas as questões.");
                return;
            }
            setShowResults(true); // Muda pra tela de review do gabarito
        } else {
            // Passo 2: Salvar ou atualizar sessão no Supabase
            if (!userId) {
                Alert.alert("Erro", "Usuário não autenticado.");
                return;
            }

            setSaving(true);

            const durationSecs = Number(params.duration) || 0;
            const tempoMinutos = Math.round(durationSecs / 60);
            
            let dbError = null;

            if (params.sessionId) {
                // É um refazer ou término de sessão de revisão
                const oldDuration = Number(params.oldDuration) || 0;
                const totalMinutes = oldDuration + tempoMinutos;
                
                const { error } = await atualizarSessaoFoco(params.sessionId as string, {
                    questoes_acertadas: score,
                    status: status,
                    tempo_minutos: totalMinutes,
                });
                dbError = error;
            } else {
                // É uma sessão nova
                const { error } = await salvarSessaoFoco({
                    user_id: userId,
                    disciplina: params.subject as string || "Estudo Geral",
                    conteudo_especifico: params.content as string || "Sessão livre",
                    tempo_minutos: tempoMinutos,
                    questoes_respondidas: shuffledQuestions.length,
                    questoes_acertadas: score,
                    is_public: params.isPublic === "true",
                    status: status,
                });
                dbError = error;
            }

            setSaving(false);

            if (dbError) {
                console.error("Erro ao salvar sessão:", dbError);
                Alert.alert("Erro", "Não foi possível salvar a sessão. Tente novamente.");
                return;
            }

            router.back();
        }
    };

    const handleAnswerChange = (questionNumber: number, val: string) => {
        if (showResults) return; // Se já avaliou, não pode trocar
        setAnswers(prev => ({ ...prev, [questionNumber]: val }));
    };

    // Conta quantos acertos teve no geral só para mostrar ao usuário um resumo (opcional)
    const score = shuffledQuestions.reduce((acc, curr) => {
        return answers[curr.id] === curr.correctAnswer ? acc + 1 : acc;
    }, 0);

    return (
        <SafeAreaView className="flex-1 bg-slate-950" edges={['top', 'bottom']}>
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 py-4 border-b border-slate-800 bg-slate-950 z-10">
                <View className="w-10" />
                <Text className="text-slate-200 text-lg font-bold">
                    {showResults ? "Gabarito" : "Quiz do Conteúdo"}
                </Text>
                <View className="w-10" />
            </View>

            <ScrollView
                className="flex-1 px-4 pt-6"
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            >
                <View className="items-center mb-8">
                    <View className={`w-16 h-16 ${showResults ? (score > 7 ? 'bg-emerald-600/20' : score > 5 ? 'bg-amber-600/20' : 'bg-rose-600/20') : 'bg-violet-600/20'} rounded-full items-center justify-center mb-4`}>
                        {showResults ? (
                            score > 7 ? <CheckCircle2 color="#34d399" size={32} /> :
                                score > 5 ? <AlertCircle color="#fbbf24" size={32} /> :
                                    <XCircle color="#fb7185" size={32} />
                        ) : <BookOpen color={COLORS.violet} size={32} />}
                    </View>
                    <Text className="text-2xl font-bold text-slate-100 mb-2">
                        {showResults ? `Você acertou ${score} de 10!` : "Teste seus Conhecimentos"}
                    </Text>
                    <Text className="text-slate-400 text-center px-4">
                        {showResults
                            ? "Confira abaixo os seus acertos e os pontos que precisa melhorar."
                            : "Responda as questões abaixo baseadas no conteúdo que acabou de estudar."}
                    </Text>
                </View>

                {/* Renderizando as questões personalizadas e embaralhadas */}
                {shuffledQuestions.map((question) => {
                    const isQuestionCorrect = answers[question.id] === question.correctAnswer;

                    return (
                        <View key={question.id} className="mb-6 bg-slate-900 p-5 rounded-2xl border border-slate-800">
                            <Text className="text-slate-200 font-semibold text-base mb-4">
                                Questão {question.id}: {question.text}
                            </Text>
                            <View className="flex-col gap-3">
                                {question.options.map((opt) => {
                                    const isSelected = answers[question.id] === opt;
                                    const isCorrectOpt = opt === question.correctAnswer;

                                    // A Lógica visual (Google Forms style)
                                    let itemContainerStyle = 'bg-slate-800 border-slate-700';
                                    let itemTextColor = 'text-slate-300';
                                    let itemIcon = null;

                                    if (!showResults) {
                                        // Fase de respostas (Normal)
                                        if (isSelected) {
                                            itemContainerStyle = 'bg-violet-600/20 border-violet-500';
                                            itemTextColor = 'text-violet-400';
                                            itemIcon = <CheckCircle2 color={COLORS.violet} size={20} />;
                                        }
                                    } else {
                                        // Fase de Gabarito (Review)
                                        if (isSelected && isCorrectOpt) {
                                            // Ele selecionou a correta
                                            itemContainerStyle = 'bg-emerald-600/20 border-emerald-500';
                                            itemTextColor = 'text-emerald-400 font-bold';
                                            itemIcon = <CheckCircle2 color="#34d399" size={20} />;
                                        } else if (isSelected && !isCorrectOpt) {
                                            // Se ele escolheu algo que NÃO é correto (Vermelho)
                                            itemContainerStyle = 'bg-rose-600/20 border-rose-500';
                                            itemTextColor = 'text-rose-400 line-through opacity-80';
                                            itemIcon = <XCircle color="#fb7185" size={20} />;
                                        } else {
                                            // Opções ignoradas (incluindo a correta, se ele não tiver escolhido ela)
                                            itemContainerStyle = 'bg-slate-900 border-slate-800 opacity-50';
                                            itemTextColor = 'text-slate-500';
                                        }
                                    }

                                    return (
                                        <TouchableOpacity
                                            key={opt}
                                            onPress={() => handleAnswerChange(question.id, opt)}
                                            activeOpacity={0.7}
                                            disabled={showResults} // Se estiver mostrando o gabarito, não deixa clicar
                                            className={`py-3.5 px-4 rounded-xl border flex-row items-center justify-between ${itemContainerStyle}`}
                                        >
                                            <Text className={`font-medium flex-1 mr-2 ${itemTextColor}`}>
                                                {opt}
                                            </Text>
                                            {itemIcon}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Removida a mensagem de review por escolha do usuário para manter o app blindado */}
                        </View>
                    );
                })}

            </ScrollView>

            {/* Submit Buttons fixados na parte inferior */}
            <View className="absolute bottom-0 left-0 right-0 p-4 bg-slate-950 border-t border-slate-900">
                {!showResults ? (
                    <TouchableOpacity
                        onPress={() => handleSubmit('salvo')}
                        disabled={saving}
                        activeOpacity={0.8}
                        className={`flex-row items-center justify-center py-4 rounded-2xl ${isComplete ? 'bg-violet-600' : 'bg-slate-800'}`}
                        style={isComplete ? {
                            shadowColor: COLORS.violet,
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 12,
                            elevation: 8,
                        } : {}}
                    >
                        <Text className={`text-lg font-bold mr-2 ${isComplete ? 'text-white' : 'text-slate-500'}`}>
                            {isComplete ? 'Enviar Respostas' : 'Responda as 10 Questões'}
                        </Text>
                        {isComplete && <CheckCircle2 color={COLORS.white} size={20} />}
                    </TouchableOpacity>
                ) : (
                    score > 7 ? (
                        <TouchableOpacity
                            onPress={() => handleSubmit('salvo')}
                            activeOpacity={0.8}
                            disabled={saving}
                            className="flex-row items-center justify-center py-4 rounded-2xl bg-violet-600"
                            style={{
                                shadowColor: COLORS.violet,
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.3,
                                shadowRadius: 12,
                                elevation: 8,
                            }}
                        >
                            <Text className="text-lg font-bold mr-2 text-white">Guardar Questões</Text>
                            <BookOpen color={COLORS.white} size={20} />
                        </TouchableOpacity>
                    ) : (
                        <View className="flex-col gap-3">
                            <TouchableOpacity
                                onPress={() => {
                                    setAnswers({ 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null, 8: null, 9: null, 10: null });
                                    setShowResults(false);
                                }}
                                activeOpacity={0.8}
                                className="flex-row items-center justify-center py-4 rounded-2xl bg-violet-600"
                                style={{
                                    shadowColor: COLORS.violet,
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.3,
                                    shadowRadius: 12,
                                    elevation: 8,
                                }}
                            >
                                <Text className="text-lg font-bold text-white">Revisar e refazer agora</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => handleSubmit('pendente')}
                                activeOpacity={0.8}
                                disabled={saving}
                                className="flex-row items-center justify-center py-4 rounded-2xl bg-slate-900 border border-slate-700"
                            >
                                <Text className="text-lg font-bold text-slate-300">Salvar e refazer mais tarde</Text>
                            </TouchableOpacity>
                        </View>
                    )
                )}
            </View>
        </SafeAreaView>
    );
}
