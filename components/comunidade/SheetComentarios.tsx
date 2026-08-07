import { useCallback, useEffect, useState } from "react";
import {
    View,
    Text,
    Modal,
    Pressable,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { ArrowUp, Flag, Trash2 } from "lucide-react-native";

import Avatar from "@/components/ui/Avatar";
import { tempoRelativo } from "@/components/comunidade/CardPublicacao";
import { HADES } from "@/constants/hades";
import { confirm } from "@/services/confirm";
import { toast } from "@/services/toast";
import {
    apagarComentario,
    buscarComentarios,
    denunciar,
    publicarComentario,
} from "@/services/comunidade";
import type { ComentarioPublicacao, Publicacao } from "@/types/comunidade";

/**
 * Comentários de uma publicação, em um nível só.
 *
 * Sem respostas aninhadas de propósito: a conversa aqui é curta ("qual caderno é esse?")
 * e uma árvore de respostas traria moderação de sobra para o que o feed precisa. Apagar
 * é de quem escreveu e de quem publicou; denunciar é de qualquer um.
 */
export default function SheetComentarios({
    publicacao,
    eu,
    onFechar,
    onContagemMudou,
}: {
    /** `null` mantém a folha fechada. */
    publicacao: Publicacao | null;
    /** Usuário logado: avatar do campo de escrita e quem pode apagar comentário alheio. */
    eu: { id: string | null; nome: string | null; foto: string | null };
    onFechar: () => void;
    onContagemMudou: (delta: number) => void;
}) {
    const [comentarios, setComentarios] = useState<ComentarioPublicacao[]>([]);
    const [carregando, setCarregando] = useState(false);
    const [texto, setTexto] = useState("");
    const [enviando, setEnviando] = useState(false);

    const publicacaoId = publicacao?.id ?? null;
    const donoId = publicacao?.autor.id ?? null;

    useEffect(() => {
        if (!publicacao) return;

        let ativo = true;
        setCarregando(true);
        setComentarios([]);
        setTexto("");

        buscarComentarios(
            { origem: publicacao.origem, referenciaId: publicacao.referenciaId },
            publicacao.autor.id
        )
            .then((lista) => {
                if (ativo) setComentarios(lista);
            })
            .catch(() => {
                if (ativo) toast.error("Não deu para carregar os comentários.");
            })
            .finally(() => {
                if (ativo) setCarregando(false);
            });

        return () => {
            ativo = false;
        };
        // A folha recarrega quando troca de publicação, não a cada render do feed.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [publicacaoId]);

    const enviar = useCallback(async () => {
        const conteudo = texto.trim();
        if (!publicacao || !conteudo || enviando) return;

        setEnviando(true);
        try {
            const comentario = await publicarComentario(
                { origem: publicacao.origem, referenciaId: publicacao.referenciaId },
                conteudo,
                donoId
            );
            setComentarios((atuais) => [...atuais, comentario]);
            setTexto("");
            onContagemMudou(1);
        } catch {
            toast.error("Não deu para publicar seu comentário.");
        } finally {
            setEnviando(false);
        }
    }, [publicacao, donoId, texto, enviando, onContagemMudou]);

    const apagar = useCallback(
        (comentario: ComentarioPublicacao) => {
            confirm({
                title: "Apagar comentário",
                message: "Ele some para todo mundo. Não dá para desfazer.",
                confirmText: "Apagar",
                destructive: true,
                onConfirm: async () => {
                    setComentarios((atuais) => atuais.filter((item) => item.id !== comentario.id));
                    onContagemMudou(-1);

                    try {
                        await apagarComentario(comentario.id);
                    } catch {
                        // Devolve o comentário à lista: some da tela só o que realmente saiu.
                        setComentarios((atuais) => [...atuais, comentario]);
                        onContagemMudou(1);
                        toast.error("Não deu para apagar o comentário.");
                    }
                },
            });
        },
        [onContagemMudou]
    );

    const reportar = useCallback(
        async (comentarioId: string) => {
            if (!publicacao) return;
            try {
                await denunciar({
                    ref: { origem: publicacao.origem, referenciaId: publicacao.referenciaId },
                    comentarioId,
                });
                toast.success("Denúncia enviada. Vamos analisar.");
            } catch {
                toast.error("Não deu para enviar a denúncia.");
            }
        },
        [publicacao]
    );

    return (
        <Modal visible={!!publicacao} transparent animationType="slide" onRequestClose={onFechar}>
            <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }} onPress={onFechar} />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={{
                    height: "76%",
                    backgroundColor: "#101116",
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    borderTopWidth: 1,
                    borderTopColor: HADES.borderStrong,
                }}
            >
                <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 4 }}>
                    <View style={{ width: 38, height: 4, borderRadius: 3, backgroundColor: HADES.trackOff }} />
                </View>

                <View
                    style={{
                        paddingHorizontal: 20,
                        paddingTop: 8,
                        paddingBottom: 14,
                        borderBottomWidth: 1,
                        borderBottomColor: HADES.border,
                        flexDirection: "row",
                        alignItems: "center",
                    }}
                >
                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>Comentários</Text>
                    {!carregando && (
                        <Text style={{ fontSize: 14, color: HADES.textFaint, fontWeight: "600" }}>
                            {" "}
                            · {comentarios.length}
                        </Text>
                    )}
                </View>

                {carregando ? (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <ActivityIndicator color={HADES.accentSolid} />
                    </View>
                ) : (
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{ padding: 20, paddingTop: 14, gap: 18 }}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {comentarios.length === 0 ? (
                            <Text
                                style={{
                                    fontSize: 13,
                                    color: HADES.textMuted,
                                    textAlign: "center",
                                    marginTop: 30,
                                }}
                            >
                                Ninguém comentou ainda. Seja o primeiro.
                            </Text>
                        ) : (
                            comentarios.map((comentario) => (
                                <View key={comentario.id} style={{ flexDirection: "row", gap: 10 }}>
                                    <Avatar
                                        foto={comentario.autor.foto}
                                        nome={comentario.autor.nome}
                                        size={30}
                                    />

                                    <View style={{ flex: 1, minWidth: 0 }}>
                                        <View
                                            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                                        >
                                            <Text
                                                style={{ fontSize: 13, fontWeight: "600", color: "#fff" }}
                                            >
                                                {comentario.autor.nome}
                                            </Text>

                                            {comentario.meu && <Selo texto="VOCÊ" destacado />}
                                            {comentario.doAutorDaPublicacao && <Selo texto="AUTOR" />}

                                            <Text style={{ fontSize: 11.5, color: HADES.textFaint }}>
                                                · {tempoRelativo(comentario.criadoEm)}
                                            </Text>
                                        </View>

                                        <Text
                                            style={{
                                                fontSize: 13.5,
                                                color: HADES.textSecondary,
                                                lineHeight: 20,
                                                marginTop: 3,
                                            }}
                                        >
                                            {comentario.texto}
                                        </Text>
                                    </View>

                                    {/* A RLS é quem decide de verdade; aqui é só qual ícone mostrar. */}
                                    {comentario.meu || (!!eu.id && eu.id === donoId) ? (
                                        <TouchableOpacity
                                            onPress={() => apagar(comentario)}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        >
                                            <Trash2 size={14} color={HADES.textMuted} />
                                        </TouchableOpacity>
                                    ) : (
                                        <TouchableOpacity
                                            onPress={() => reportar(comentario.id)}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        >
                                            <Flag size={14} color={HADES.dot} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))
                        )}
                    </ScrollView>
                )}

                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        paddingHorizontal: 16,
                        paddingTop: 12,
                        paddingBottom: 26,
                        borderTopWidth: 1,
                        borderTopColor: HADES.border,
                    }}
                >
                    <Avatar foto={eu.foto} nome={eu.nome} size={32} />

                    <TextInput
                        value={texto}
                        onChangeText={setTexto}
                        placeholder="Escreva um comentário…"
                        placeholderTextColor={HADES.textDim}
                        multiline
                        style={{
                            flex: 1,
                            maxHeight: 90,
                            minHeight: 42,
                            borderRadius: 21,
                            backgroundColor: "#16171c",
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.07)",
                            paddingHorizontal: 16,
                            paddingTop: Platform.OS === "ios" ? 12 : 8,
                            paddingBottom: Platform.OS === "ios" ? 12 : 8,
                            color: HADES.text,
                            fontSize: 13.5,
                        }}
                    />

                    <TouchableOpacity
                        onPress={enviar}
                        disabled={!texto.trim() || enviando}
                        activeOpacity={0.85}
                        style={{
                            width: 38,
                            height: 38,
                            borderRadius: 19,
                            backgroundColor: texto.trim() ? HADES.accentSolid : HADES.surfaceOverlay,
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        {enviando ? (
                            <ActivityIndicator size="small" color="#000" />
                        ) : (
                            <ArrowUp size={18} color={texto.trim() ? "#000" : HADES.textDim} />
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

function Selo({ texto, destacado }: { texto: string; destacado?: boolean }) {
    return (
        <Text
            style={{
                fontSize: 8,
                fontWeight: "800",
                letterSpacing: 0.4,
                color: destacado ? "#000" : HADES.textMuted,
                backgroundColor: destacado ? HADES.accentSolid : HADES.surfaceOverlay,
                borderRadius: 4,
                paddingHorizontal: 5,
                paddingVertical: 2,
                overflow: "hidden",
            }}
        >
            {texto}
        </Text>
    );
}
