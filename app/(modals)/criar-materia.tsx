import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Plus, BookOpen, AlertCircle, Check, Users } from "lucide-react-native";
import { router } from "expo-router";

import { HADES } from "@/constants/hades";
import { useAuth } from "@/hooks/useAuth";
import { useMaterias } from "@/hooks/useMaterias";
import { criarMateria, normalizarNomeMateria, buscarMateriasComunidade } from "@/services/materias";
import type { Materia } from "@/types/materias";

export default function CriarMateriaScreen() {
    const [nomeMateria, setNomeMateria] = useState("");
    const [criando, setCriando] = useState(false);
    const [materiasComunidade, setMateriasComunidade] = useState<Materia[]>([]);
    const [carregandoComunidade, setCarregandoComunidade] = useState(false);

    const { userId } = useAuth();
    const { materias, materiasCustomizadas, recarregarMaterias, deletarMateriaComVerificacao } = useMaterias(userId);

    // Carrega matérias da comunidade ao montar
    useEffect(() => {
        const carregarComunidade = async () => {
            if (!userId) return;
            setCarregandoComunidade(true);
            const resultado = await buscarMateriasComunidade(userId, materias);
            setMateriasComunidade(resultado);
            setCarregandoComunidade(false);
        };
        carregarComunidade();
    }, [userId, materias]);

    // Verifica em tempo real se a matéria já existe
    const nomeNormalizado = normalizarNomeMateria(nomeMateria);
    const jaExiste =
        nomeMateria.trim().length > 0 && materias.some((m) => m.nomeNormalizado === nomeNormalizado);
    const nomeValido = nomeMateria.trim().length >= 2 && !jaExiste;

    const handleCriar = async () => {
        if (!userId || !nomeValido || criando) return;

        setCriando(true);
        const resultado = await criarMateria(userId, nomeMateria);
        setCriando(false);

        if (!resultado.sucesso) {
            Alert.alert("Erro", resultado.erro || "Não foi possível criar a matéria.");
            return;
        }

        await recarregarMaterias();
        Alert.alert("Sucesso!", `"${resultado.materia?.nomeExibicao}" foi adicionada às suas matérias.`);
        router.back();
    };

    const handleRemover = async (materia: Materia) => {
        if (!materia.id) return;

        Alert.alert("Remover matéria", `Deseja remover "${materia.nomeExibicao}" da sua lista?`, [
            { text: "Cancelar", style: "cancel" },
            {
                text: "Remover",
                style: "destructive",
                onPress: async () => {
                    await deletarMateriaComVerificacao(materia.id!, materia.nomeExibicao);
                },
            },
        ]);
    };

    const handleAdotarComunidade = async (materia: Materia) => {
        if (!userId || criando) return;

        setCriando(true);
        const resultado = await criarMateria(userId, materia.nomeExibicao);
        setCriando(false);

        if (!resultado.sucesso) {
            Alert.alert("Erro", resultado.erro || "Não foi possível adicionar a matéria.");
            return;
        }

        await recarregarMaterias();
        Alert.alert("Adicionada!", `"${materia.nomeExibicao}" foi adicionada à sua lista.`);
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top"]}>
            {/* Header */}
            <View
                style={{
                    paddingTop: 6,
                    paddingHorizontal: 20,
                    paddingBottom: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <Text style={{ fontSize: 20, fontWeight: "700", color: HADES.text }}>Nova Matéria</Text>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: HADES.surfaceRaised,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <X size={18} color={HADES.textSecondary} />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 20 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Input de Nome */}
                <View style={{ marginBottom: 24 }}>
                    <Text style={{ fontSize: 14, fontWeight: "500", color: HADES.textMuted, marginBottom: 8 }}>
                        Nome da Matéria
                    </Text>
                    <TextInput
                        value={nomeMateria}
                        onChangeText={setNomeMateria}
                        placeholder="ex.: Cálculo III, Redação, Filosofia..."
                        placeholderTextColor={HADES.textFaint}
                        autoFocus
                        maxLength={50}
                        style={{
                            backgroundColor: HADES.surfaceRaised,
                            borderWidth: 1,
                            borderRadius: 13,
                            paddingHorizontal: 16,
                            paddingVertical: 13,
                            color: HADES.text,
                            fontSize: 15,
                            borderColor: jaExiste ? HADES.red : nomeValido ? HADES.green : HADES.border,
                        }}
                    />

                    {/* Feedback visual em tempo real */}
                    {nomeMateria.trim().length > 0 && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
                            {jaExiste ? (
                                <>
                                    <AlertCircle size={14} color={HADES.red} />
                                    <Text style={{ fontSize: 12, color: HADES.red }}>
                                        Essa matéria já existe na sua lista
                                    </Text>
                                </>
                            ) : nomeValido ? (
                                <>
                                    <Check size={14} color={HADES.green} />
                                    <Text style={{ fontSize: 12, color: HADES.green }}>Nome disponível!</Text>
                                </>
                            ) : (
                                <Text style={{ fontSize: 12, color: HADES.textDim }}>
                                    O nome precisa ter pelo menos 2 caracteres
                                </Text>
                            )}
                        </View>
                    )}
                </View>

                {/* Matérias Customizadas do Usuário (com remoção) */}
                {materiasCustomizadas.length > 0 && (
                    <View style={{ marginBottom: 24 }}>
                        <Text style={{ fontSize: 14, fontWeight: "500", color: HADES.textMuted, marginBottom: 12 }}>
                            Suas matérias criadas
                        </Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                            {materiasCustomizadas.map((materia) => (
                                <View
                                    key={materia.id || materia.nomeNormalizado}
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 6,
                                        paddingHorizontal: 12,
                                        paddingVertical: 8,
                                        borderRadius: 12,
                                        borderWidth: 1,
                                        backgroundColor: HADES.greenTint,
                                        borderColor: "rgba(48,209,88,0.25)",
                                    }}
                                >
                                    <BookOpen size={12} color={HADES.green} />
                                    <Text style={{ fontSize: 12, fontWeight: "500", color: HADES.textSecondary }}>
                                        {materia.nomeExibicao}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => handleRemover(materia)}
                                        style={{
                                            marginLeft: 2,
                                            width: 20,
                                            height: 20,
                                            borderRadius: 10,
                                            alignItems: "center",
                                            justifyContent: "center",
                                            backgroundColor: "rgba(240,85,107,0.18)",
                                        }}
                                    >
                                        <X size={10} color={HADES.red} />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Matérias Padrão */}
                <View style={{ marginBottom: 24 }}>
                    <Text style={{ fontSize: 14, fontWeight: "500", color: HADES.textMuted, marginBottom: 12 }}>
                        Matérias padrão do app
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        {materias
                            .filter((m) => m.isPadrao)
                            .map((materia) => {
                                const selecionada = materia.nomeNormalizado === nomeNormalizado;
                                return (
                                    <View
                                        key={materia.nomeNormalizado}
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            gap: 6,
                                            paddingHorizontal: 12,
                                            paddingVertical: 8,
                                            borderRadius: 12,
                                            borderWidth: 1,
                                            backgroundColor: selecionada ? "rgba(240,85,107,0.15)" : HADES.surfaceOverlay,
                                            borderColor: selecionada ? "rgba(240,85,107,0.4)" : HADES.border,
                                        }}
                                    >
                                        <BookOpen size={12} color={selecionada ? HADES.red : HADES.groupViolet} />
                                        <Text
                                            style={{
                                                fontSize: 12,
                                                fontWeight: "500",
                                                color: selecionada ? HADES.red : HADES.textSecondary,
                                            }}
                                        >
                                            {materia.nomeExibicao}
                                        </Text>
                                    </View>
                                );
                            })}
                    </View>
                </View>

                {/* Matérias da Comunidade */}
                <View style={{ marginBottom: 24 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <Users size={14} color={HADES.textFaint} />
                        <Text style={{ fontSize: 14, fontWeight: "500", color: HADES.textMuted }}>
                            Matérias da comunidade
                        </Text>
                    </View>

                    {carregandoComunidade ? (
                        <View style={{ paddingVertical: 16, alignItems: "center" }}>
                            <ActivityIndicator color={HADES.groupViolet} size="small" />
                            <Text style={{ fontSize: 12, color: HADES.textDim, marginTop: 8 }}>Buscando matérias...</Text>
                        </View>
                    ) : materiasComunidade.length > 0 ? (
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                            {materiasComunidade.map((materia) => (
                                <TouchableOpacity
                                    key={materia.id || materia.nomeNormalizado}
                                    onPress={() => handleAdotarComunidade(materia)}
                                    disabled={criando}
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 6,
                                        paddingHorizontal: 12,
                                        paddingVertical: 8,
                                        borderRadius: 12,
                                        borderWidth: 1,
                                        backgroundColor: HADES.groupVioletTint,
                                        borderColor: "rgba(124,92,252,0.28)",
                                    }}
                                >
                                    <Plus size={12} color={HADES.groupViolet} />
                                    <Text style={{ fontSize: 12, fontWeight: "500", color: HADES.groupViolet }}>
                                        {materia.nomeExibicao}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : (
                        <Text style={{ fontSize: 12, color: HADES.textDim }}>
                            Nenhuma matéria nova encontrada na comunidade
                        </Text>
                    )}
                </View>
            </ScrollView>

            {/* Botão de Criar */}
            <View style={{ paddingHorizontal: 20, paddingBottom: 24, paddingTop: 8, borderTopWidth: 1, borderTopColor: HADES.border }}>
                <TouchableOpacity
                    disabled={!nomeValido || criando}
                    onPress={handleCriar}
                    activeOpacity={0.85}
                    style={{
                        height: 54,
                        borderRadius: 15,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 9,
                        backgroundColor: nomeValido && !criando ? HADES.violet : HADES.surfaceOverlay,
                    }}
                >
                    {criando ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Plus size={20} color={nomeValido ? "#fff" : HADES.textFaint} />
                            <Text style={{ fontSize: 16, fontWeight: "700", color: nomeValido ? "#fff" : HADES.textFaint }}>
                                Criar Matéria
                            </Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
