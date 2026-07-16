import { View, Text, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView, Pressable } from "react-native";
import { Target, X, MousePointerClick } from "lucide-react-native";
import { HADES } from "@/constants/hades";
import { GradeHeatmap, LegendaHeatmap } from "@/components/profile/Heatmap";
import type { MateriaComCor } from "@/types/materias";

// ── Meta semanal ─────────────────────────────────────────────────────────────
export function ModalMetaSemanal({
    visivel,
    valor,
    onChangeValor,
    onCancelar,
    onSalvar,
}: {
    visivel: boolean;
    valor: string;
    onChangeValor: (v: string) => void;
    onCancelar: () => void;
    onSalvar: () => void;
}) {
    return (
        <Modal visible={visivel} animationType="fade" transparent onRequestClose={onCancelar}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1, justifyContent: "center", paddingHorizontal: 20, backgroundColor: "rgba(0,0,0,0.6)" }}
            >
                <View
                    style={{
                        backgroundColor: HADES.modalBg,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.08)",
                        borderRadius: 22,
                        paddingTop: 24,
                        paddingHorizontal: 22,
                        paddingBottom: 22,
                    }}
                >
                    <View style={{ alignItems: "center" }}>
                        <View
                            style={{
                                width: 46,
                                height: 46,
                                borderRadius: 13,
                                backgroundColor: HADES.tintAccent,
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <Target size={23} color={HADES.accentSolid} />
                        </View>
                        <Text style={{ fontSize: 18, fontWeight: "700", color: HADES.text, marginTop: 14 }}>
                            Meta semanal
                        </Text>
                        <Text style={{ fontSize: 13, color: HADES.textMuted, marginTop: 5 }}>
                            Quantas horas quer estudar por semana?
                        </Text>
                    </View>

                    {/* O teclado numérico do sistema sobe pelo keyboardType + autoFocus. */}
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            marginVertical: 24,
                        }}
                    >
                        <TextInput
                            value={valor}
                            onChangeText={onChangeValor}
                            keyboardType="number-pad"
                            placeholder="0"
                            placeholderTextColor={HADES.textDim}
                            autoFocus
                            style={{
                                fontSize: 60,
                                fontWeight: "700",
                                color: HADES.text,
                                letterSpacing: -2,
                                padding: 0,
                                minWidth: 90,
                                textAlign: "right",
                            }}
                        />
                        <View
                            style={{ width: 2, height: 44, borderRadius: 1, backgroundColor: HADES.accentSolid }}
                        />
                        <Text style={{ fontSize: 19, fontWeight: "600", color: HADES.textMuted }}>horas</Text>
                    </View>

                    <View style={{ flexDirection: "row", gap: 10 }}>
                        <TouchableOpacity
                            onPress={onCancelar}
                            activeOpacity={0.8}
                            style={{
                                flex: 1,
                                height: 50,
                                borderRadius: 14,
                                backgroundColor: HADES.surfaceOverlay,
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <Text style={{ fontSize: 15, fontWeight: "600", color: HADES.textSecondary }}>
                                Cancelar
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={onSalvar}
                            activeOpacity={0.85}
                            style={{
                                flex: 1,
                                height: 50,
                                borderRadius: 14,
                                backgroundColor: HADES.accentSolid,
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <Text style={{ fontSize: 15, fontWeight: "700", color: "#000" }}>Salvar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

// ── Matéria favorita ─────────────────────────────────────────────────────────
export function SheetMateriaFavorita({
    visivel,
    materias,
    atual,
    onSelecionar,
    onFechar,
}: {
    visivel: boolean;
    materias: MateriaComCor[];
    atual: string;
    onSelecionar: (nome: string) => void;
    onFechar: () => void;
}) {
    const selecionada = materias.find((m) => m.nomeExibicao === atual);
    const demais = materias.filter((m) => m.nomeExibicao !== atual);

    return (
        <Modal visible={visivel} animationType="slide" transparent onRequestClose={onFechar}>
            <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }} onPress={onFechar}>
                <View style={{ flex: 1, justifyContent: "flex-end" }}>
                    <Pressable
                        style={{
                            height: "60%",
                            backgroundColor: HADES.surface,
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.08)",
                            borderTopLeftRadius: 24,
                            borderTopRightRadius: 24,
                            paddingTop: 12,
                        }}
                    >
                        <View style={{ alignItems: "center", marginBottom: 8 }}>
                            <View
                                style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: HADES.dot }}
                            />
                        </View>

                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                paddingTop: 6,
                                paddingHorizontal: 20,
                                paddingBottom: 16,
                            }}
                        >
                            <Text style={{ fontSize: 17, fontWeight: "700", color: HADES.text }}>
                                Matéria favorita
                            </Text>
                            <TouchableOpacity
                                onPress={onFechar}
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

                        <ScrollView
                            style={{ flex: 1 }}
                            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
                            showsVerticalScrollIndicator={false}
                        >
                            {selecionada && (
                                <View
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 12,
                                        backgroundColor: `${selecionada.cor}1f`,
                                        borderWidth: 1.5,
                                        borderColor: `${selecionada.cor}73`,
                                        borderRadius: 13,
                                        padding: 14,
                                    }}
                                >
                                    <View
                                        style={{
                                            width: 11,
                                            height: 11,
                                            borderRadius: 6,
                                            backgroundColor: selecionada.cor,
                                        }}
                                    />
                                    <Text
                                        style={{ flex: 1, fontSize: 15, fontWeight: "600", color: HADES.text }}
                                    >
                                        {selecionada.nomeExibicao}
                                    </Text>
                                    <Text
                                        style={{
                                            fontSize: 11,
                                            fontWeight: "700",
                                            color: selecionada.cor,
                                            backgroundColor: `${selecionada.cor}26`,
                                            borderRadius: 6,
                                            paddingVertical: 3,
                                            paddingHorizontal: 8,
                                            overflow: "hidden",
                                        }}
                                    >
                                        Atual
                                    </Text>
                                </View>
                            )}

                            <View style={{ marginTop: 6 }}>
                                {demais.map((materia, i) => (
                                    <TouchableOpacity
                                        key={materia.nomeNormalizado}
                                        onPress={() => onSelecionar(materia.nomeExibicao)}
                                        activeOpacity={0.7}
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            gap: 12,
                                            paddingVertical: 14,
                                            paddingHorizontal: 4,
                                            borderBottomWidth: i === demais.length - 1 ? 0 : 1,
                                            borderBottomColor: "rgba(255,255,255,0.05)",
                                        }}
                                    >
                                        <View
                                            style={{
                                                width: 11,
                                                height: 11,
                                                borderRadius: 6,
                                                backgroundColor: materia.cor,
                                            }}
                                        />
                                        <Text style={{ flex: 1, fontSize: 15, color: "#e8e9ec" }}>
                                            {materia.nomeExibicao}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>
                    </Pressable>
                </View>
            </Pressable>
        </Modal>
    );
}

// ── Heatmap expandido ────────────────────────────────────────────────────────
export function ModalHeatmap({
    visivel,
    colunas,
    monthPositions,
    diaSelecionado,
    horasFormatadas,
    onSelecionarDia,
    onFechar,
}: {
    visivel: boolean;
    colunas: any[][];
    monthPositions: { colIndex: number; name: string }[];
    diaSelecionado: { date: Date; hours: number } | null;
    horasFormatadas: string;
    onSelecionarDia: (dia: any) => void;
    onFechar: () => void;
}) {
    return (
        <Modal visible={visivel} animationType="fade" transparent onRequestClose={onFechar}>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }}>
                <View
                    style={{
                        position: "absolute",
                        left: 12,
                        right: 12,
                        top: 70,
                        bottom: 24,
                        backgroundColor: HADES.modalBg,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.08)",
                        borderRadius: 22,
                        paddingVertical: 20,
                        paddingHorizontal: 18,
                    }}
                >
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 18,
                        }}
                    >
                        <Text style={{ fontSize: 17, fontWeight: "700", color: HADES.text }}>
                            Histórico de contribuições
                        </Text>
                        <TouchableOpacity
                            onPress={onFechar}
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

                    {diaSelecionado ? (
                        <View
                            style={{
                                backgroundColor: HADES.surface,
                                borderWidth: 1,
                                borderColor: HADES.border,
                                borderRadius: 16,
                                padding: 16,
                                marginBottom: 20,
                                alignItems: "center",
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 34,
                                    fontWeight: "700",
                                    color: HADES.accentSolid,
                                    letterSpacing: -1,
                                    lineHeight: 36,
                                }}
                            >
                                {horasFormatadas}
                            </Text>
                            <Text style={{ fontSize: 13, color: HADES.textMuted, marginTop: 8 }}>
                                estudados em{" "}
                                <Text style={{ color: HADES.text, fontWeight: "600" }}>
                                    {diaSelecionado.date.toLocaleDateString("pt-BR", {
                                        day: "numeric",
                                        month: "long",
                                    })}
                                </Text>
                            </Text>
                        </View>
                    ) : (
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 11,
                                backgroundColor: HADES.bg,
                                borderWidth: 1,
                                borderStyle: "dashed",
                                borderColor: "rgba(255,255,255,0.14)",
                                borderRadius: 14,
                                padding: 16,
                                marginBottom: 20,
                            }}
                        >
                            <MousePointerClick size={18} color={HADES.textMuted} />
                            <Text style={{ fontSize: 13, color: HADES.textMuted, lineHeight: 19, flex: 1 }}>
                                Toque em qualquer dia da grade abaixo para visualizar os detalhes.
                            </Text>
                        </View>
                    )}

                    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                        <GradeHeatmap
                            colunas={colunas}
                            monthPositions={monthPositions}
                            celula={20}
                            gap={5}
                            diaSelecionado={diaSelecionado?.date ?? null}
                            onSelecionarDia={onSelecionarDia}
                        />
                    </ScrollView>

                    <LegendaHeatmap celula={12} />
                </View>
            </View>
        </Modal>
    );
}
