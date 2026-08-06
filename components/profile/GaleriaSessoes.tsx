import { useCallback, useState } from "react";
import { View, Text, Image, Modal, Pressable, TouchableOpacity, ActivityIndicator } from "react-native";
import { useFocusEffect } from "expo-router";
import { Camera, ImageOff, Timer, Trash2, X } from "lucide-react-native";

import { HADES } from "@/constants/hades";
import { Skeleton } from "@/components/ui/Skeleton";
import { buscarFotosDoUsuario, removerFotoDaSessao } from "@/services/fotosSessao";
import { toast } from "@/services/toast";
import type { FotoSessao } from "@/types/fotoSessao";

/**
 * Duas colunas: a miniatura continua quadrada, só ocupa quase metade da largura em vez de
 * um terço. Foto de ambiente de estudo tem detalhe demais (mesa, caderno, tela) pra
 * sobreviver a um quadrado de ~110px. O gap de 5px cabe nos 2% que sobram.
 */
const LARGURA_ITEM = "49%";

type Props = {
    userId: string;
    /** Quantos itens carregar. A seção do próprio perfil mostra uma prévia curta. */
    limite?: number;
    /** Nome usado no texto de "ainda não tem foto". Ausente = é o próprio usuário. */
    nomeDoDono?: string;
    /** Só o dono pode apagar — o visualizador não recebe a ação. */
    permitirRemover?: boolean;
};

/**
 * Grid de fotos das sessões, compartilhado pela aba Galeria do perfil de outro membro
 * (app/(modals)/member-profile.tsx) e pela seção do próprio perfil (app/(tabs)/profile.tsx).
 *
 * Cada item é um *momento* de estudo, não uma linha de sessão: o service já agrupa as
 * matérias de uma execução de plano numa foto só (ver services/fotosSessao.ts).
 *
 * As URLs são assinadas e expiram (bucket privado), então a lista é recarregada a cada
 * montagem em vez de ficar em cache — uma URL guardada de ontem só renderia um quadrado
 * quebrado. Tocar numa foto abre o visualizador aqui mesmo; a tela de detalhes da sessão
 * ainda não exibe foto.
 */
export default function GaleriaSessoes({
    userId,
    limite = 60,
    nomeDoDono,
    permitirRemover = false,
}: Props) {
    const [fotos, setFotos] = useState<FotoSessao[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [aberta, setAberta] = useState<FotoSessao | null>(null);

    /*
      Recarrega a cada foco em vez de só na montagem. Duas razões: a aba de perfil fica
      montada enquanto o app roda, então uma foto tirada agora não apareceria; e as URLs
      assinadas expiram, então uma lista velha renderiza quadrados quebrados.
    */
    useFocusEffect(
        useCallback(() => {
            let ativo = true;

            buscarFotosDoUsuario(userId, limite).then((resultado) => {
                if (!ativo) return;
                setFotos(resultado);
                setCarregando(false);
            });

            return () => {
                ativo = false;
            };
        }, [userId, limite])
    );

    const remover = async (foto: FotoSessao) => {
        const { sucesso, erro } = await removerFotoDaSessao(foto.sessaoId);
        if (!sucesso) {
            toast.error(erro ?? "Não foi possível remover a foto.");
            return;
        }

        setAberta(null);
        setFotos((atuais) => atuais.filter((item) => item.path !== foto.path));
        toast.success("Foto removida.");
    };

    if (carregando) return <GridEsqueleto />;
    if (fotos.length === 0) return <GaleriaVazia nomeDoDono={nomeDoDono} />;

    return (
        <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
                {fotos.map((foto) => (
                    <MiniaturaFoto key={foto.path} foto={foto} aoTocar={() => setAberta(foto)} />
                ))}
            </View>

            <VisualizadorFoto
                foto={aberta}
                aoFechar={() => setAberta(null)}
                aoRemover={permitirRemover ? remover : undefined}
            />
        </>
    );
}

function MiniaturaFoto({ foto, aoTocar }: { foto: FotoSessao; aoTocar: () => void }) {
    return (
        <Pressable
            onPress={aoTocar}
            style={{
                width: LARGURA_ITEM,
                aspectRatio: 1,
                borderRadius: 10,
                overflow: "hidden",
                backgroundColor: HADES.surfaceRaised,
                borderWidth: 1,
                borderColor: HADES.border,
            }}
        >
            {foto.url ? (
                <Image source={{ uri: foto.url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            ) : (
                // A assinatura da URL falhou (sessão virou privada, ou rede). Um quadrado
                // apagado é mais honesto que um espaço vazio no meio do grid.
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <ImageOff size={22} color={HADES.textDim} />
                </View>
            )}

            {/* Os textos sobrepostos acompanham o tamanho do tile: nas antigas 3 colunas
                eles eram minúsculos de propósito, e ficariam perdidos numa foto grande. */}
            {foto.legenda && (
                <View
                    style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        bottom: 0,
                        paddingVertical: 7,
                        paddingHorizontal: 9,
                        backgroundColor: "rgba(0,0,0,0.55)",
                    }}
                >
                    <Text style={{ fontSize: 10.5, fontFamily: "monospace", color: "#fff" }} numberOfLines={1}>
                        {foto.legenda}
                    </Text>
                </View>
            )}

            {foto.tempoMinutos > 0 && (
                <View
                    style={{
                        position: "absolute",
                        top: 7,
                        right: 7,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        backgroundColor: "rgba(0,0,0,0.55)",
                        borderRadius: 7,
                        paddingVertical: 3,
                        paddingHorizontal: 7,
                    }}
                >
                    <Timer size={11} color={HADES.accentSolid} />
                    <Text style={{ fontSize: 10, fontWeight: "700", color: "#fff" }}>
                        {formatarDuracao(foto.tempoMinutos)}
                    </Text>
                </View>
            )}
        </Pressable>
    );
}

/** Visualizador em tela cheia. Fecha tocando fora da foto, como qualquer lightbox. */
function VisualizadorFoto({
    foto,
    aoFechar,
    aoRemover,
}: {
    foto: FotoSessao | null;
    aoFechar: () => void;
    aoRemover?: (foto: FotoSessao) => Promise<void>;
}) {
    const [removendo, setRemovendo] = useState(false);

    if (!foto) return null;

    const confirmarRemocao = async () => {
        if (!aoRemover) return;
        setRemovendo(true);
        await aoRemover(foto);
        setRemovendo(false);
    };

    return (
        <Modal visible transparent animationType="fade" onRequestClose={aoFechar} statusBarTranslucent>
            <Pressable
                onPress={aoFechar}
                style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.94)", justifyContent: "center", padding: 16 }}
            >
                <View style={{ position: "absolute", top: 48, right: 16, flexDirection: "row", gap: 10 }}>
                    {aoRemover && (
                        <TouchableOpacity
                            onPress={confirmarRemocao}
                            disabled={removendo}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            style={botaoFlutuante}
                        >
                            {removendo ? (
                                <ActivityIndicator size="small" color={HADES.red} />
                            ) : (
                                <Trash2 size={17} color={HADES.red} />
                            )}
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        onPress={aoFechar}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={botaoFlutuante}
                    >
                        <X size={17} color={HADES.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* Pressable interno sem onPress: segura o toque pra não fechar ao tocar na foto. */}
                <Pressable style={{ gap: 14 }}>
                    {foto.url && (
                        <Image
                            source={{ uri: foto.url }}
                            style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: 16 }}
                            resizeMode="contain"
                        />
                    )}

                    <View style={{ gap: 4, paddingHorizontal: 4 }}>
                        {foto.legenda && (
                            <Text style={{ fontSize: 16, fontWeight: "700", color: HADES.text }}>{foto.legenda}</Text>
                        )}
                        <Text style={{ fontSize: 13, color: HADES.textMuted }}>
                            {[foto.disciplina, foto.tempoMinutos > 0 ? formatarDuracao(foto.tempoMinutos) : null]
                                .filter(Boolean)
                                .join(" · ")}
                        </Text>
                        {foto.criadaEm && (
                            <Text style={{ fontSize: 12, color: HADES.textDim }}>{formatarData(foto.criadaEm)}</Text>
                        )}
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

function GridEsqueleto() {
    return (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
            {[0, 1, 2, 3].map((i) => (
                <View key={i} style={{ width: LARGURA_ITEM, aspectRatio: 1 }}>
                    <Skeleton width="100%" height="100%" borderRadius={10} hades />
                </View>
            ))}
        </View>
    );
}

function GaleriaVazia({ nomeDoDono }: { nomeDoDono?: string }) {
    return (
        <View style={{ alignItems: "center", gap: 12, paddingVertical: 40 }}>
            <View
                style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: HADES.surfaceRaised,
                    borderWidth: 1,
                    borderStyle: "dashed",
                    borderColor: HADES.borderDashed,
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <Camera size={24} color={HADES.textDim} />
            </View>
            <Text style={{ fontSize: 14.5, fontWeight: "700", color: HADES.textSecondary }}>Nenhuma foto ainda</Text>
            <Text
                style={{
                    fontSize: 13,
                    color: HADES.textFaint,
                    lineHeight: 19,
                    textAlign: "center",
                    maxWidth: 240,
                }}
            >
                {nomeDoDono
                    ? `Os registros do cantinho de estudo de ${nomeDoDono} vão aparecer aqui.`
                    : "Ao fim de uma sessão, registre uma foto do seu momento de estudo — ela aparece aqui."}
            </Text>
        </View>
    );
}

const botaoFlutuante = {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: HADES.surfaceRaised,
    alignItems: "center" as const,
    justifyContent: "center" as const,
};

function formatarDuracao(minutos: number) {
    const horas = Math.floor(minutos / 60);
    const resto = minutos % 60;
    if (horas === 0) return `${resto}min`;
    return `${horas}h${String(resto).padStart(2, "0")}`;
}

function formatarData(iso: string) {
    return new Date(iso)
        .toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })
        .replace(/^./, (c) => c.toUpperCase());
}
