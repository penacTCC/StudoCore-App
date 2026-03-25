import { useState, useCallback } from "react";
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus } from "lucide-react-native";
import { COLORS } from "@/constants/colors";
import { diasDaSemana, disciplinasComCores } from "@/constants/mock-data";
import ScheduleBlock, { ScheduleBlockData } from "@/components/schedule/ScheduleBlock";
import AddBlockModal from "@/components/schedule/AddBlockModal";

// ──────────────────────────────────────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────────────────────────────────────
type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

type ScheduleState = {
    [day: number]: ScheduleBlockData[];
};

// ──────────────────────────────────────────────────────────────────────────────
// Tela principal
// ──────────────────────────────────────────────────────────────────────────────
export default function ScheduleScreen() {
    const [schedule, setSchedule] = useState<ScheduleState>({});
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedDay, setSelectedDay] = useState<DayIndex>(0);
    const [editingBlock, setEditingBlock] = useState<ScheduleBlockData | null>(null);

    // ── Abertura do modal para adicionar bloco ───────────────────────────────
    const handleAddBlock = (dayIndex: DayIndex) => {
        setSelectedDay(dayIndex);
        setEditingBlock(null);
        setModalVisible(true);
    };

    // ── Abertura do modal para editar bloco ─────────────────────────────────
    const handleEditBlock = (dayIndex: DayIndex, block: ScheduleBlockData) => {
        setSelectedDay(dayIndex);
        setEditingBlock(block);
        setModalVisible(true);
    };

    // ── Confirmação do modal ─────────────────────────────────────────────────
    const handleConfirm = useCallback(
        (data: Omit<ScheduleBlockData, "id">) => {
            setSchedule((prev) => {
                const dayBlocks = prev[selectedDay] ?? [];
                if (editingBlock) {
                    // Editar existente
                    return {
                        ...prev,
                        [selectedDay]: dayBlocks.map((b) =>
                            b.id === editingBlock.id ? { ...b, ...data } : b
                        ),
                    };
                }
                // Adicionar novo
                const newBlock: ScheduleBlockData = { id: `${Date.now()}`, ...data };
                return { ...prev, [selectedDay]: [...dayBlocks, newBlock] };
            });
            setModalVisible(false);
        },
        [selectedDay, editingBlock]
    );

    // ── Remoção de bloco via Modal ───────────────────────────────────────────
    const handleRemove = useCallback(() => {
        if (!editingBlock) return;
        setSchedule((prev) => {
            const dayBlocks = (prev[selectedDay] ?? []).filter(
                (b) => b.id !== editingBlock.id
            );
            return { ...prev, [selectedDay]: dayBlocks };
        });
        setModalVisible(false);
    }, [selectedDay, editingBlock]);

    // ── Remoção direta pelo Card ─────────────────────────────────────────────
    const handleRemoveCard = useCallback((dayIndex: DayIndex, blockId: string) => {
        setSchedule((prev) => {
            const dayBlocks = (prev[dayIndex] ?? []).filter((b) => b.id !== blockId);
            return { ...prev, [dayIndex]: dayBlocks };
        });
    }, []);

    // ── Totais por disciplina (legenda do rodapé) ────────────────────────────
    const totaisPorDisciplina = useCallback(() => {
        const totais: Record<string, { horas: number; cor: string }> = {};
        Object.values(schedule).forEach((blocks) => {
            blocks.forEach((b) => {
                if (!totais[b.disciplina]) {
                    totais[b.disciplina] = { horas: 0, cor: b.cor };
                }
                totais[b.disciplina].horas += b.duracao;
            });
        });
        return Object.entries(totais).map(([nome, data]) => ({ nome, ...data }));
    }, [schedule]);

    const resumo = totaisPorDisciplina();

    // ──────────────────────────────────────────────────────────────────────────
    // Render
    // ──────────────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a" }} edges={["top"]}>
            {/* ── Header ──────────────────────────────────────────────────── */}
            <View
                style={{
                    backgroundColor: "#0f172a",
                    borderBottomWidth: 1,
                    borderBottomColor: "#1e293b",
                    paddingHorizontal: 20,
                    paddingVertical: 14,
                }}
            >
                <Text style={{ color: "#e2e8f0", fontSize: 22, fontWeight: "800" }}>
                    Cronograma
                </Text>
                <Text style={{ color: COLORS.textMuted, fontSize: 13, marginTop: 2 }}>
                    Monte sua semana de estudos
                </Text>
            </View>

            {/* ── Grade semanal ────────────────────────────────────────────── */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 16, paddingBottom: 8 }}
                style={{ flexGrow: 0 }}
            >
                {diasDaSemana.map((dia, index) => {
                    const dayBlocks = schedule[index] ?? [];
                    return (
                        <View
                            key={dia}
                            style={{
                                width: 140,
                                marginHorizontal: 5,
                            }}
                        >
                            {/* Cabeçalho do dia */}
                            <View
                                style={{
                                    backgroundColor: "#1e293b",
                                    borderRadius: 12,
                                    paddingVertical: 8,
                                    alignItems: "center",
                                    marginBottom: 10,
                                }}
                            >
                                <Text
                                    style={{
                                        color: "#94a3b8",
                                        fontSize: 11,
                                        fontWeight: "700",
                                        textTransform: "uppercase",
                                        letterSpacing: 1,
                                    }}
                                >
                                    {dia}
                                </Text>
                            </View>

                            {/* Blocos do dia */}
                            <ScrollView
                                showsVerticalScrollIndicator={false}
                                nestedScrollEnabled
                                style={{ maxHeight: 520 }} // aumentada ligeiramente para os novos blocos
                            >
                                {dayBlocks.map((block) => (
                                    <ScheduleBlock
                                        key={block.id}
                                        block={block}
                                        onPress={(b) => handleEditBlock(index as DayIndex, b)}
                                        onRemove={(b) => handleRemoveCard(index as DayIndex, b.id)}
                                    />
                                ))}

                                {/* Slots vazios para completar 4 botões iniciais */}
                                {Array.from({ length: Math.max(0, 4 - dayBlocks.length) }).map((_, i) => (
                                    <TouchableOpacity
                                        key={`empty-${index}-${i}`}
                                        onPress={() => handleAddBlock(index as DayIndex)}
                                        activeOpacity={0.7}
                                        style={{
                                            borderWidth: 1.5,
                                            borderStyle: "dashed",
                                            borderColor: "#334155",
                                            borderRadius: 14,
                                            height: 100, // mesmo minHeight do ScheduleBlock
                                            alignItems: "center",
                                            justifyContent: "center",
                                            marginBottom: 8,
                                        }}
                                    >
                                        <Plus size={22} color="#475569" />
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    );
                })}
            </ScrollView>

            {/* ── Legenda de horas por disciplina ──────────────────────────── */}
            {resumo.length > 0 && (
                <View
                    style={{
                        borderTopWidth: 1,
                        borderTopColor: "#1e293b",
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        backgroundColor: "#0f172a",
                    }}
                >
                    <Text
                        style={{
                            color: "#64748b",
                            fontSize: 11,
                            fontWeight: "700",
                            textTransform: "uppercase",
                            letterSpacing: 0.8,
                            marginBottom: 10,
                        }}
                    >
                        Total semanal
                    </Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 8 }}
                    >
                        {resumo.map((item) => (
                            <View
                                key={item.nome}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 6,
                                    backgroundColor: "rgba(255,255,255,0.05)",
                                    borderRadius: 20,
                                    paddingHorizontal: 12,
                                    paddingVertical: 7,
                                    borderWidth: 1,
                                    borderColor: item.cor + "55",
                                }}
                            >
                                <View
                                    style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: 4,
                                        backgroundColor: item.cor,
                                    }}
                                />
                                <Text style={{ color: "#cbd5e1", fontSize: 13, fontWeight: "600" }}>
                                    {item.nome}
                                </Text>
                                <Text
                                    style={{
                                        color: item.cor,
                                        fontSize: 13,
                                        fontWeight: "800",
                                    }}
                                >
                                    {item.horas}h
                                </Text>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* ── Instrução quando cronograma vazio ────────────────────────── */}
            {resumo.length === 0 && (
                <View
                    style={{
                        flex: 1,
                        alignItems: "center",
                        justifyContent: "center",
                        paddingHorizontal: 32,
                    }}
                >
                    <Text style={{ fontSize: 36, marginBottom: 12 }}>📅</Text>
                    <Text
                        style={{
                            color: "#e2e8f0",
                            fontSize: 17,
                            fontWeight: "700",
                            textAlign: "center",
                            marginBottom: 6,
                        }}
                    >
                        Seu cronograma está vazio
                    </Text>
                    <Text
                        style={{ color: "#64748b", fontSize: 13, textAlign: "center", lineHeight: 20 }}
                    >
                        Toque no{" "}
                        <Text style={{ color: "#94a3b8", fontWeight: "600" }}>+</Text> em qualquer
                        dia para adicionar um bloco de estudos.
                    </Text>
                </View>
            )}

            {/* ── Modal ────────────────────────────────────────────────────── */}
            <AddBlockModal
                visible={modalVisible}
                diaNome={`${diasDaSemana[selectedDay]}-feira`}
                existingBlock={editingBlock}
                onClose={() => setModalVisible(false)}
                onConfirm={handleConfirm}
                onRemove={handleRemove}
            />
        </SafeAreaView>
    );
}
