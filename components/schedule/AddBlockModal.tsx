import { useState, useEffect } from "react";
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    TextInput,
    ScrollView,
} from "react-native";
import { X, Trash2 } from "lucide-react-native";
import { COLORS } from "@/constants/colors";
import { disciplinasComCores } from "@/constants/mock-data";
import { ScheduleBlockData } from "./ScheduleBlock";

type Props = {
    visible: boolean;
    diaNome: string;
    existingBlock?: ScheduleBlockData | null;
    onClose: () => void;
    onConfirm: (block: Omit<ScheduleBlockData, "id">) => void;
    onRemove?: () => void;
};

const DURACOES = [1, 2, 3, 4];

export default function AddBlockModal({
    visible,
    diaNome,
    existingBlock,
    onClose,
    onConfirm,
    onRemove,
}: Props) {
    const [disciplina, setDisciplina] = useState(disciplinasComCores[0].name);
    const [cor, setCor] = useState(disciplinasComCores[0].color);
    const [topico, setTopico] = useState("");
    const [duracao, setDuracao] = useState(1);

    // Preenche campos ao editar bloco existente
    useEffect(() => {
        if (existingBlock) {
            setDisciplina(existingBlock.disciplina);
            setCor(existingBlock.cor);
            setTopico(existingBlock.topico);
            setDuracao(existingBlock.duracao);
        } else {
            setDisciplina(disciplinasComCores[0].name);
            setCor(disciplinasComCores[0].color);
            setTopico("");
            setDuracao(1);
        }
    }, [existingBlock, visible]);

    const handleSelectDisciplina = (item: { name: string; color: string }) => {
        setDisciplina(item.name);
        setCor(item.color);
    };

    const handleConfirm = () => {
        onConfirm({ disciplina, cor, topico, duracao });
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View
                style={{
                    flex: 1,
                    justifyContent: "flex-end",
                    backgroundColor: "rgba(0,0,0,0.7)",
                }}
            >
                <View
                    style={{
                        backgroundColor: "#0f172a",
                        borderTopLeftRadius: 28,
                        borderTopRightRadius: 28,
                        paddingHorizontal: 20,
                        paddingTop: 24,
                        paddingBottom: 36,
                        borderWidth: 1,
                        borderColor: "#1e293b",
                    }}
                >
                    {/* Cabeçalho */}
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 4,
                        }}
                    >
                        <Text style={{ color: "#e2e8f0", fontSize: 17, fontWeight: "700" }}>
                            {existingBlock ? "Editar bloco" : "Adicionar bloco"}
                        </Text>
                        <TouchableOpacity onPress={onClose}>
                            <X size={20} color={COLORS.textMuted} />
                        </TouchableOpacity>
                    </View>
                    <Text style={{ color: COLORS.textMuted, fontSize: 13, marginBottom: 20 }}>
                        {diaNome}
                    </Text>

                    {/* Campo Tópico */}
                    <Text style={labelStyle}>Tópico</Text>
                    <TextInput
                        value={topico}
                        onChangeText={setTopico}
                        placeholder="Ex: Derivadas e Integrais"
                        placeholderTextColor={COLORS.textMuted}
                        style={inputStyle}
                    />

                    {/* Duração */}
                    <Text style={[labelStyle, { marginTop: 16 }]}>Duração do bloco</Text>
                    <View style={{ flexDirection: "row", gap: 10, marginBottom: 18 }}>
                        {DURACOES.map((d) => (
                            <TouchableOpacity
                                key={d}
                                onPress={() => setDuracao(d)}
                                style={{
                                    flex: 1,
                                    paddingVertical: 10,
                                    borderRadius: 12,
                                    alignItems: "center",
                                    backgroundColor: duracao === d ? COLORS.violet : "#1e293b",
                                    borderWidth: 1,
                                    borderColor: duracao === d ? COLORS.violet : "#334155",
                                }}
                            >
                                <Text
                                    style={{
                                        color: duracao === d ? "#fff" : "#94a3b8",
                                        fontWeight: "700",
                                        fontSize: 14,
                                    }}
                                >
                                    {d}h
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Disciplinas */}
                    <Text style={labelStyle}>Disciplina</Text>
                    <ScrollView
                        horizontal={false}
                        style={{ maxHeight: 200, marginBottom: 20 }}
                        showsVerticalScrollIndicator={false}
                    >
                        <View
                            style={{
                                flexDirection: "row",
                                flexWrap: "wrap",
                                gap: 8,
                            }}
                        >
                            {disciplinasComCores.map((item) => {
                                const selected = disciplina === item.name;
                                return (
                                    <TouchableOpacity
                                        key={item.name}
                                        onPress={() => handleSelectDisciplina(item)}
                                        style={{
                                            paddingHorizontal: 14,
                                            paddingVertical: 8,
                                            borderRadius: 20,
                                            backgroundColor: selected ? item.color : "rgba(255,255,255,0.06)",
                                            borderWidth: 1.5,
                                            borderColor: selected ? item.color : "transparent",
                                        }}
                                    >
                                        <Text
                                            style={{
                                                color: selected ? "#fff" : "#94a3b8",
                                                fontSize: 13,
                                                fontWeight: selected ? "700" : "400",
                                            }}
                                        >
                                            {item.name}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </ScrollView>

                    {/* Botão Remover (só aparece em modo edição) */}
                    {existingBlock && onRemove && (
                        <TouchableOpacity
                            onPress={onRemove}
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                                paddingVertical: 14,
                                borderRadius: 16,
                                backgroundColor: "rgba(244, 63, 94, 0.15)",
                                borderWidth: 1,
                                borderColor: "rgba(244, 63, 94, 0.4)",
                                marginBottom: 10,
                            }}
                        >
                            <Trash2 size={16} color={COLORS.rose} />
                            <Text style={{ color: COLORS.rose, fontWeight: "700", fontSize: 15 }}>
                                Remover bloco
                            </Text>
                        </TouchableOpacity>
                    )}

                    {/* Botão Confirmar */}
                    <TouchableOpacity
                        onPress={handleConfirm}
                        style={{
                            paddingVertical: 16,
                            borderRadius: 16,
                            alignItems: "center",
                            backgroundColor: cor || COLORS.violet,
                            shadowColor: cor || COLORS.violet,
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.35,
                            shadowRadius: 10,
                            elevation: 6,
                        }}
                    >
                        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
                            {existingBlock ? "Salvar alterações" : "Adicionar ao cronograma"}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const labelStyle = {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.6,
    marginBottom: 8,
};

const inputStyle = {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#e2e8f0",
    fontSize: 14,
};
