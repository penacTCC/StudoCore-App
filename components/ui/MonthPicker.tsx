import { Modal, Pressable, TouchableOpacity, View, Text } from "react-native";
import { COLORS } from "@/constants/colors";

const MONTHS = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface MonthPickerProps {
    visible: boolean;
    selected: number;
    onSelect: (monthIndex: number) => void;
    onClose: () => void;
}

/**
 * Modal de seleção de mês, com highlight no mês selecionado.
 * `selected` deve ser o número do mês (1-12).
 */
export default function MonthPicker({ visible, selected, onSelect, onClose }: MonthPickerProps) {
    return (
        <Modal visible={visible} transparent animationType="fade">
            <Pressable
                onPress={onClose}
                style={{
                    flex: 1,
                    backgroundColor: "rgba(0,0,0,0.65)",
                    justifyContent: "center",
                    paddingHorizontal: 24,
                }}
            >
                <Pressable
                    onPress={() => {}}
                    style={{
                        backgroundColor: COLORS.bgSecondary,
                        borderRadius: 20,
                        overflow: "hidden",
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.1)",
                    }}
                >
                    <View
                        style={{
                            paddingHorizontal: 20,
                            paddingVertical: 16,
                            borderBottomWidth: 1,
                            borderColor: "rgba(255,255,255,0.07)",
                        }}
                    >
                        <Text style={{ fontSize: 15, fontWeight: "700", color: COLORS.textPrimary }}>
                            Selecionar Mês
                        </Text>
                    </View>

                    {MONTHS.map((m, i) => (
                        <TouchableOpacity
                            key={m}
                            onPress={() => { onSelect(i + 1); onClose(); }}
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                paddingHorizontal: 20,
                                paddingVertical: 13,
                                backgroundColor:
                                    selected === i + 1 ? COLORS.primary + "18" : "transparent",
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 14,
                                    color: selected === i + 1 ? COLORS.primary : COLORS.textSecondary,
                                    fontWeight: selected === i + 1 ? "700" : "400",
                                }}
                            >
                                {m}
                            </Text>
                            {selected === i + 1 && (
                                <View
                                    style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: 4,
                                        backgroundColor: COLORS.primary,
                                    }}
                                />
                            )}
                        </TouchableOpacity>
                    ))}
                </Pressable>
            </Pressable>
        </Modal>
    );
}
