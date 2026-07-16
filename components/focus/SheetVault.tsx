import { View, Text, TouchableOpacity, Modal, Pressable } from "react-native";
import { FolderOpen, FileText } from "lucide-react-native";
import { HADES } from "@/constants/hades";
import type { ArquivoDetalhe } from "@/types/archives";

type Props = {
    visivel: boolean;
    materia: string;
    arquivos: ArquivoDetalhe[];
    onVerMateriais: () => void;
    onAgoraNao: () => void;
};

export default function SheetVault({
    visivel,
    materia,
    arquivos,
    onVerMateriais,
    onAgoraNao,
}: Props) {
    const total = arquivos.length;
    const plural = total === 1 ? "material" : "materiais";

    return (
        <Modal visible={visivel} transparent animationType="slide" onRequestClose={onAgoraNao}>
            <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }} onPress={onAgoraNao}>
                <View style={{ flex: 1, justifyContent: "flex-end" }}>
                    <Pressable
                        style={{
                            backgroundColor: HADES.surface,
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.08)",
                            borderTopLeftRadius: 24,
                            borderTopRightRadius: 24,
                            paddingTop: 12,
                            paddingHorizontal: 22,
                            paddingBottom: 28,
                        }}
                    >
                        <View style={{ alignItems: "center", marginBottom: 22 }}>
                            <View
                                style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: HADES.dot }}
                            />
                        </View>

                        <View
                            style={{
                                width: 56,
                                height: 56,
                                borderRadius: 16,
                                backgroundColor: "rgba(59,130,246,0.12)",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <FolderOpen size={28} color={HADES.blue} />
                        </View>

                        <Text
                            style={{
                                fontSize: 20,
                                fontWeight: "700",
                                color: HADES.text,
                                marginTop: 18,
                                lineHeight: 26,
                            }}
                        >
                            {total} {plural} de {materia} no seu Vault
                        </Text>
                        <Text style={{ fontSize: 14, color: HADES.textMuted, marginTop: 8, lineHeight: 21 }}>
                            Quer dar uma revisada antes de começar a focar?
                        </Text>

                        <View style={{ marginTop: 18, gap: 8 }}>
                            {arquivos.slice(0, 3).map((arquivo) => (
                                <View
                                    key={arquivo.id}
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 12,
                                        backgroundColor: HADES.bg,
                                        borderWidth: 1,
                                        borderColor: "rgba(255,255,255,0.07)",
                                        borderRadius: 12,
                                        paddingVertical: 12,
                                        paddingHorizontal: 14,
                                    }}
                                >
                                    <FileText size={18} color={HADES.textMuted} />
                                    <Text
                                        style={{ flex: 1, fontSize: 14, color: "#e8e9ec" }}
                                        numberOfLines={1}
                                    >
                                        {arquivo.titulo}
                                    </Text>
                                </View>
                            ))}
                        </View>

                        <View style={{ marginTop: 20, gap: 10 }}>
                            <TouchableOpacity
                                onPress={onVerMateriais}
                                activeOpacity={0.85}
                                style={{
                                    height: 52,
                                    borderRadius: 14,
                                    backgroundColor: HADES.accentSolid,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 8,
                                }}
                            >
                                <FolderOpen size={18} color="#000" />
                                <Text style={{ fontSize: 15, fontWeight: "700", color: "#000" }}>
                                    Ver materiais
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={onAgoraNao}
                                activeOpacity={0.7}
                                style={{
                                    height: 52,
                                    borderRadius: 14,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <Text style={{ fontSize: 15, fontWeight: "600", color: HADES.textMuted }}>
                                    Agora não
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </View>
            </Pressable>
        </Modal>
    );
}
