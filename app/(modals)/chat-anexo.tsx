import { useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { SafeAreaView } from "@/components/ui/TelaSegura";
import { useRouter, useLocalSearchParams } from "expo-router";
import { X, Send, Sparkles } from "@/components/ui/icons";

import { HADES } from "@/constants/hades";
import { buscarAnexo } from "@/services/anexosSessao";
import { buscarMensagensChat, enviarMensagemChatAnexo } from "@/services/chatAnexoSessao";
import { toast } from "@/services/toast";
import { mostrarPaywallProSeLimite } from "@/services/paywall";
import type { AnexoSessao, MensagemChatAnexo } from "@/types/anotacoes";

/*
  Sugestões clicáveis pra primeira mensagem — poupam o aluno de digitar algo óbvio quando
  acabou de abrir o chat. Somem assim que a primeira mensagem é enviada.
*/
const SUGESTOES = [
    "Explique a questão que eu mais errei",
    "Gere 3 questões parecidas com as do documento",
    "Quais tópicos esse documento cobre?",
];

export default function ChatAnexoModal() {
    const router = useRouter();
    const { anexoId, conteudo } = useLocalSearchParams<{ anexoId: string; conteudo?: string }>();

    const [anexo, setAnexo] = useState<AnexoSessao | null>(null);
    const [mensagens, setMensagens] = useState<MensagemChatAnexo[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [texto, setTexto] = useState("");
    const [enviando, setEnviando] = useState(false);
    const listaRef = useRef<FlatList>(null);

    useEffect(() => {
        if (!anexoId) {
            setCarregando(false);
            return;
        }
        Promise.all([buscarAnexo(anexoId), buscarMensagensChat(anexoId)]).then(([encontrado, historico]) => {
            setAnexo(encontrado);
            setMensagens(historico);
            setCarregando(false);
        });
    }, [anexoId]);

    const enviar = async (pergunta: string) => {
        const perguntaLimpa = pergunta.trim();
        if (!perguntaLimpa || !anexo || enviando) return;

        setTexto("");
        setEnviando(true);
        // Mostra a pergunta na hora, sem esperar a IA responder — a resposta some da lista e
        // reaparece com o texto final se der erro, pra não deixar a tela "comendo" a pergunta.
        const pendente: MensagemChatAnexo = {
            id: `pendente-${Date.now()}`,
            anexo_id: anexo.id,
            papel: "user",
            texto: perguntaLimpa,
            created_at: new Date().toISOString(),
        };
        setMensagens((atual) => [...atual, pendente]);

        const { sucesso, erro } = await enviarMensagemChatAnexo({
            anexo,
            conteudo: conteudo ?? null,
            historico: mensagens,
            pergunta: perguntaLimpa,
        });

        if (!sucesso) {
            if (mostrarPaywallProSeLimite(erro)) {
                setMensagens((atual) => atual.filter((m) => m.id !== pendente.id));
                setTexto(perguntaLimpa);
                setEnviando(false);
                return;
            }
            toast.error(erro || "Não foi possível responder agora.");
            setMensagens((atual) => atual.filter((m) => m.id !== pendente.id));
            setTexto(perguntaLimpa);
            setEnviando(false);
            return;
        }

        const historicoAtualizado = await buscarMensagensChat(anexo.id);
        setMensagens(historicoAtualizado);
        setEnviando(false);
    };

    if (carregando) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator color={HADES.accentSolid} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top"]}>
            <View style={{ paddingHorizontal: 20, paddingTop: 2, paddingBottom: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 17, fontWeight: "700", color: "#fff", letterSpacing: -0.3 }}>
                        Tirar dúvida
                    </Text>
                    <Text style={{ fontSize: 12.5, color: HADES.textMuted, marginTop: 2 }} numberOfLines={1}>
                        {anexo?.titulo}
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
                <FlatList
                    ref={listaRef}
                    data={mensagens}
                    keyExtractor={(m) => m.id}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16, gap: 12 }}
                    onContentSizeChange={() => listaRef.current?.scrollToEnd({ animated: true })}
                    ListEmptyComponent={
                        <View style={{ paddingVertical: 30, gap: 14 }}>
                            <View
                                style={{
                                    flexDirection: "row",
                                    gap: 9,
                                    padding: 12,
                                    borderRadius: 13,
                                    backgroundColor: HADES.accentTint,
                                    borderWidth: 1,
                                    borderColor: HADES.accentTintBorder,
                                }}
                            >
                                <Sparkles size={15} color={HADES.accentSolid} />
                                <Text style={{ flex: 1, fontSize: 12.5, color: HADES.textSecondary, lineHeight: 18 }}>
                                    Pergunte qualquer coisa sobre esse documento — explicações passo a passo, ou peça
                                    questões parecidas pra praticar.
                                </Text>
                            </View>

                            <View style={{ gap: 8 }}>
                                {SUGESTOES.map((sugestao) => (
                                    <TouchableOpacity
                                        key={sugestao}
                                        onPress={() => enviar(sugestao)}
                                        activeOpacity={0.75}
                                        style={{
                                            paddingVertical: 12,
                                            paddingHorizontal: 14,
                                            borderRadius: 12,
                                            backgroundColor: HADES.surfaceRaised,
                                            borderWidth: 1,
                                            borderColor: HADES.border,
                                        }}
                                    >
                                        <Text style={{ fontSize: 13, color: HADES.textSecondary }}>{sugestao}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    }
                    renderItem={({ item }) => <BolhaMensagem mensagem={item} />}
                />

                {enviando && (
                    <View style={{ paddingHorizontal: 20, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <ActivityIndicator size="small" color={HADES.accentSolid} />
                        <Text style={{ fontSize: 12.5, color: HADES.textMuted }}>Pensando...</Text>
                    </View>
                )}

                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "flex-end",
                        gap: 10,
                        paddingHorizontal: 20,
                        paddingBottom: 16,
                        paddingTop: 8,
                    }}
                >
                    <TextInput
                        value={texto}
                        onChangeText={setTexto}
                        placeholder="Pergunte sobre o documento..."
                        placeholderTextColor={HADES.textDim}
                        multiline
                        editable={!enviando}
                        style={{
                            flex: 1,
                            maxHeight: 100,
                            borderRadius: 14,
                            backgroundColor: HADES.surfaceRaised,
                            borderWidth: 1,
                            borderColor: HADES.border,
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            fontSize: 14,
                            color: HADES.text,
                        }}
                    />
                    <TouchableOpacity
                        onPress={() => enviar(texto)}
                        disabled={enviando || !texto.trim()}
                        activeOpacity={0.85}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 14,
                            backgroundColor: HADES.accentSolid,
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: enviando || !texto.trim() ? 0.5 : 1,
                        }}
                    >
                        <Send size={18} color="#000" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const BolhaMensagem = ({ mensagem }: { mensagem: MensagemChatAnexo }) => {
    const deUsuario = mensagem.papel === "user";
    return (
        <View style={{ alignItems: deUsuario ? "flex-end" : "flex-start" }}>
            <View
                style={{
                    maxWidth: "85%",
                    borderRadius: 16,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    backgroundColor: deUsuario ? HADES.accentSolid : HADES.surfaceRaised,
                    borderWidth: deUsuario ? 0 : 1,
                    borderColor: HADES.border,
                }}
            >
                <Text style={{ fontSize: 14, lineHeight: 20, color: deUsuario ? "#000" : HADES.text }}>
                    {mensagem.texto}
                </Text>
            </View>
        </View>
    );
};
