import { useEffect, useMemo, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { File as FileClass } from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import { SafeAreaView } from "@/components/ui/TelaSegura";
import { useRouter, useLocalSearchParams } from "expo-router";
import { X, Sparkles, Target, BookOpen, FileUp, Clock, FileText, Trash2 } from "@/components/ui/icons";

import { HADES } from "@/constants/hades";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { gerarRoadmap } from "@/services/roadmapIA";
import { toast } from "@/services/toast";
import type { EscopoRoadmap } from "@/types/roadmap";

/** Mesmo limite do inline data do Gemini usado pela análise de anexo. */
const LIMITE_ARQUIVO_BYTES = 15 * 1024 * 1024;

type ArquivoSelecionado = { uri: string; name: string; mimeType: string; size: number };

/**
 * Entrada do roadmap por IA (pessoal e de grupo).
 *
 * Pede o objetivo (texto livre), matérias, disponibilidade e, opcionalmente, um ou mais
 * PDFs (editais, ementas, listas de tópicos). Ao confirmar, chama a Edge Function
 * `gerar-roadmap-estudo` — que devolve uma PROPOSTA, nada é gravado — e navega para
 * `roadmap-preview`, onde a pessoa revisa antes de aceitar. Sem IA, sem promessa: falha
 * aqui apenas mostra o erro e deixa tentar de novo ou cair para o plano manual.
 *
 * Recebe `escopo` ("pessoal" | "grupo"): no de grupo o aviso deixa claro que o roadmap
 * vale para todo mundo, não só para quem está gerando.
 */
export default function GerarRoadmapScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        escopo?: string;
        grupoId?: string;
        grupoNome?: string;
        objetivo?: string;
        contexto?: string;
    }>();

    const escopo: EscopoRoadmap = params.escopo === "grupo" ? "grupo" : "pessoal";
    const ehGrupo = escopo === "grupo";

    const { userId } = useAuth();
    const { profile } = useProfile(userId ?? "");

    const [objetivo, setObjetivo] = useState(params.objetivo ?? "");
    const [disponibilidade, setDisponibilidade] = useState("");
    const [arquivos, setArquivos] = useState<ArquivoSelecionado[]>([]);
    const [gerando, setGerando] = useState(false);

    // No pessoal, o objetivo do perfil já entra pré-preenchido — é a fonte mais provável
    // do que a pessoa quer estudar. No grupo o contexto é o próprio grupo.
    useEffect(() => {
        if (!ehGrupo && !objetivo && profile?.objetivo) {
            setObjetivo(profile.objetivo);
        }
    }, [ehGrupo, profile?.objetivo, objetivo]);

    const contexto = useMemo(() => {
        if (ehGrupo) return `Estudantes do grupo "${params.grupoNome ?? ""}".`;
        if (profile?.nivel_ensino) return `Nível de ensino: ${profile.nivel_ensino}.`;
        return null;
    }, [ehGrupo, params.grupoNome, profile?.nivel_ensino]);

    const adicionarArquivo = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ["application/pdf"],
                copyToCacheDirectory: true,
                multiple: true,
            });

            if (result.canceled) return;

            const novos = result.assets.map((asset) => ({
                uri: asset.uri,
                name: asset.name,
                mimeType: asset.mimeType || "application/pdf",
                size: asset.size || 0,
            }));

            setArquivos((atuais) => [...atuais, ...novos]);
        } catch (error: any) {
            console.error("Erro ao selecionar arquivo:", error);
            toast.error("Não foi possível selecionar o arquivo.");
        }
    };

    const removerArquivo = (indice: number) => {
        setArquivos((atuais) => atuais.filter((_, i) => i !== indice));
    };

    const gerar = async () => {
        const objetivoLimpo = objetivo.trim();
        if (!objetivoLimpo) {
            toast.warning("Conte qual é o seu objetivo para a IA montar o roadmap.");
            return;
        }

        setGerando(true);
        try {
            const arquivosProcessados: { base64: string; mimeType: string; nome: string }[] = [];

            for (const arquivo of arquivos) {
                if (arquivo.size > LIMITE_ARQUIVO_BYTES) {
                    toast.error(`"${arquivo.name}" é grande demais (máximo 15MB).`);
                    setGerando(false);
                    return;
                }
                const objeto = new FileClass(arquivo.uri);
                const base64 = await objeto.base64Sync();
                arquivosProcessados.push({
                    base64,
                    mimeType: arquivo.mimeType.includes("pdf") ? "application/pdf" : arquivo.mimeType,
                    nome: arquivo.name,
                });
            }

            const { data: proposta, error } = await gerarRoadmap({
                objetivo: objetivoLimpo,
                contexto,
                escopo,
                arquivos: arquivosProcessados.length > 0 ? arquivosProcessados : undefined,
                disponibilidade: disponibilidade.trim() || undefined,
            });

            if (!proposta) {
                toast.error(error ?? "Não foi possível gerar o roadmap.");
                return;
            }

            router.push({
                pathname: "/(modals)/roadmap-preview",
                params: {
                    proposta: JSON.stringify(proposta),
                    escopo,
                    ...(params.grupoId ? { grupoId: params.grupoId } : {}),
                    ...(params.grupoNome ? { grupoNome: params.grupoNome } : {}),
                },
            });
        } catch (erro) {
            console.warn("Erro inesperado ao gerar roadmap:", erro);
            toast.error("Não foi possível gerar o roadmap. Tente de novo.");
        } finally {
            setGerando(false);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top"]}>
            <View
                style={{
                    paddingHorizontal: 20,
                    paddingTop: 6,
                    paddingBottom: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                }}
            >
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 18, fontWeight: "700", color: HADES.text, letterSpacing: -0.3 }}>
                        {ehGrupo ? "Roadmap do grupo" : "Roadmap por IA"}
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={() => router.back()}
                    hitSlop={8}
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

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View
                        style={{
                            flexDirection: "row",
                            gap: 9,
                            padding: 12,
                            borderRadius: 13,
                            backgroundColor: HADES.accentTint,
                            borderWidth: 1,
                            borderColor: HADES.accentTintBorder,
                            marginBottom: 18,
                        }}
                    >
                        <Sparkles size={15} color={HADES.accentSolid} />
                        <Text style={{ flex: 1, fontSize: 12.5, color: HADES.textSecondary, lineHeight: 18 }}>
                            A IA monta uma proposta de blocos semanais a partir do seu objetivo
                            {ehGrupo ? " — e o administrador decide antes de publicar para o grupo" : ""}.
                            Você revisa tudo antes de aceitar.
                        </Text>
                    </View>

                    <Text style={{ fontSize: 12, fontWeight: "700", color: HADES.textMuted, letterSpacing: 0.8, marginBottom: 8 }}>
                        QUAL É O SEU OBJETIVO?
                    </Text>
                    <TextInput
                        value={objetivo}
                        onChangeText={setObjetivo}
                        placeholder={
                            ehGrupo
                                ? "Ex.: Cobrir o edital do vestibular da Etec até dezembro"
                                : "Ex.: Passar no ENEM 2026 com foco em exatas"
                        }
                        placeholderTextColor={HADES.textDim}
                        multiline
                        textAlignVertical="top"
                        style={{
                            minHeight: 108,
                            backgroundColor: HADES.surface,
                            borderWidth: 1,
                            borderColor: HADES.border,
                            borderRadius: 14,
                            paddingHorizontal: 16,
                            paddingVertical: 14,
                            color: HADES.text,
                            fontSize: 15,
                            lineHeight: 22,
                        }}
                    />

                    {/*
                      Disponibilidade de estudos — restrições de horário/dia.
                      Campo opcional: ajuda a IA a respeitar a rotina do usuário.
                    */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 20, marginBottom: 8 }}>
                        <Clock size={13} color={HADES.textMuted} />
                        <Text style={{ fontSize: 12, fontWeight: "700", color: HADES.textMuted, letterSpacing: 0.8 }}>
                            DISPONIBILIDADE (OPCIONAL)
                        </Text>
                    </View>
                    <Text style={{ fontSize: 12.5, color: HADES.textDim, marginBottom: 10, lineHeight: 18 }}>
                        Conte sua rotina para a IA não marcar blocos em horários ruins. Ex.: Não consigo estudar sexta-feira, ou quinta somente das 14h às 18h.
                    </Text>
                    <TextInput
                        value={disponibilidade}
                        onChangeText={setDisponibilidade}
                        placeholder="Ex.: Só estudo de segunda a quinta, das 14h às 18h"
                        placeholderTextColor={HADES.textDim}
                        style={{
                            backgroundColor: HADES.surface,
                            borderWidth: 1,
                            borderColor: HADES.border,
                            borderRadius: 14,
                            paddingHorizontal: 16,
                            paddingVertical: 14,
                            color: HADES.text,
                            fontSize: 15,
                            lineHeight: 22,
                        }}
                    />

                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            marginTop: 22,
                            marginBottom: 10,
                        }}
                    >
                        <BookOpen size={13} color={HADES.textMuted} />
                        <Text style={{ fontSize: 12, fontWeight: "700", color: HADES.textMuted, letterSpacing: 0.8 }}>
                            MATERIAIS (OPCIONAL)
                        </Text>
                    </View>
                    <Text style={{ fontSize: 12.5, color: HADES.textDim, marginBottom: 12, lineHeight: 18 }}>
                        A IA monta um cronograma cobrindo todos os documentos.
                    </Text>

                    {/* Botão de adicionar arquivo */}
                    <TouchableOpacity
                        onPress={adicionarArquivo}
                        activeOpacity={0.8}
                        style={{
                            borderRadius: 16,
                            padding: 28,
                            alignItems: "center",
                            borderWidth: 2,
                            borderStyle: "dashed",
                            borderColor: HADES.borderDashed,
                            backgroundColor: HADES.surface,
                            marginBottom: 8,
                        }}
                    >
                        <View
                            style={{
                                width: 56,
                                height: 56,
                                borderRadius: 28,
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: HADES.accentTint,
                            }}
                        >
                            <FileUp size={24} color={HADES.accentSolid} />
                        </View>
                        <Text style={{ color: HADES.text, fontWeight: "500", marginTop: 12, textAlign: "center" }}>
                            Adicionar material
                        </Text>
                        <Text style={{ fontSize: 13, color: HADES.textDim, marginTop: 4, textAlign: "center" }}>
                            Toque para selecionar um ou mais PDFs
                        </Text>
                    </TouchableOpacity>

                    {/* Lista de arquivos selecionados */}
                    {arquivos.map((arq, i) => (
                        <View
                            key={arq.uri}
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 10,
                                padding: 12,
                                borderRadius: 12,
                                backgroundColor: HADES.surfaceRaised,
                                borderWidth: 1,
                                borderColor: HADES.borderStrong,
                                marginBottom: 6,
                            }}
                        >
                            <FileText size={16} color={HADES.accentSolid} />
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <Text
                                    style={{ fontSize: 13, fontWeight: "600", color: HADES.text }}
                                    numberOfLines={1}
                                >
                                    {arq.name}
                                </Text>
                                <Text style={{ fontSize: 11, color: HADES.textDim, marginTop: 1 }}>
                                    {(arq.size / 1024 / 1024).toFixed(1)} MB
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => removerArquivo(i)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Trash2 size={15} color={HADES.textFaint} />
                            </TouchableOpacity>
                        </View>
                    ))}
                </ScrollView>

                <View style={{ paddingHorizontal: 20, paddingBottom: 16, paddingTop: 8 }}>
                    <TouchableOpacity
                        onPress={gerar}
                        disabled={gerando}
                        activeOpacity={0.85}
                        style={{
                            flexDirection: "row",
                            gap: 9,
                            height: 52,
                            borderRadius: 15,
                            backgroundColor: HADES.accentSolid,
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: gerando ? 0.6 : 1,
                        }}
                    >
                        {gerando ? (
                            <>
                                <ActivityIndicator color="#000" size="small" />
                                <Text style={{ fontSize: 15, fontWeight: "700", color: "#000" }}>
                                    Montando proposta...
                                </Text>
                            </>
                        ) : (
                            <>
                                <FileUp size={18} color="#000" />
                                <Text style={{ fontSize: 15, fontWeight: "700", color: "#000" }}>
                                    {ehGrupo ? "Gerar proposta do grupo" : "Gerar proposta"}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => router.back()}
                        activeOpacity={0.8}
                        style={{ alignSelf: "center", paddingVertical: 12 }}
                    >
                        <Text style={{ fontSize: 13.5, color: HADES.textMuted }}>
                            Crie um plano manual
                        </Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
