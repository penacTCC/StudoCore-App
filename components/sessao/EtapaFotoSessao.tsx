import { useState } from "react";
import { View, Text, TextInput, Image, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "@/components/ui/TelaSegura";
import { Camera, Images, RotateCw } from "@/components/ui/icons";

import { HADES } from "@/constants/hades";
import { capturarFotoSessao, anexarFotoASessao } from "@/services/fotosSessao";
import { toast } from "@/services/toast";
import type { FotoCapturada } from "@/types/fotoSessao";

const MAX_LEGENDA = 60;

type Props = {
    userId: string;
    /** Linhas da sessão que recebem a foto (mais de uma numa execução de plano). */
    sessaoIds: string[];
    /**
     * A foto vai aparecer no Explorar para estranhos, e não só na galeria do perfil.
     * É `true` quando o opt-in do feed está ligado E esta sessão é pública.
     */
    iraParaOFeed?: boolean;
    /** Chamado quando a etapa termina — salvando ou pulando. Nunca falha o fluxo. */
    aoConcluir: () => void;
};

/**
 * Etapa opcional pós-sessão: registrar uma foto do momento de estudo.
 *
 * A ideia vem do check-in por foto de apps de treino, mas com uma diferença que muda o
 * texto todo da tela: aqui a foto NÃO valida a sessão — o cronômetro já fez isso. Ela é
 * memória, e é o que popula a aba Galeria do perfil. Por isso "Pular" é um caminho de
 * primeira classe, e nada nesta tela é obrigatório.
 *
 * A sessão já está gravada quando esta tela aparece, então qualquer falha aqui (permissão
 * negada, upload caindo) custa a foto e nada mais.
 *
 * Fica atrás da preferência "Foto ao fim da sessão" (app/(modals)/settings.tsx).
 */
export default function EtapaFotoSessao({ userId, sessaoIds, iraParaOFeed, aoConcluir }: Props) {
    const [foto, setFoto] = useState<FotoCapturada | null>(null);
    const [legenda, setLegenda] = useState("");
    const [abrindo, setAbrindo] = useState(false);
    const [enviando, setEnviando] = useState(false);

    const escolher = async (origem: "camera" | "galeria") => {
        setAbrindo(true);
        const { foto: capturada, cancelado, erro } = await capturarFotoSessao(origem);
        setAbrindo(false);

        if (cancelado) return;
        if (erro || !capturada) {
            toast.error(erro ?? "Não foi possível abrir a câmera.");
            return;
        }
        setFoto(capturada);
    };

    const salvar = async () => {
        if (!foto) return;

        setEnviando(true);
        const { erro } = await anexarFotoASessao({ userId, sessaoIds, foto, legenda });
        setEnviando(false);

        // A sessão já está salva: avisa do erro, mas segue o fluxo em vez de prender a
        // pessoa numa tela opcional que ela não consegue completar.
        if (erro) toast.error(erro);
        else toast.success("Foto salva na sua galeria.");

        aoConcluir();
    };

    const ocupado = abrindo || enviando;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top", "bottom"]}>
            <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 }}>
                <Text style={{ fontSize: 20, fontWeight: "700", color: HADES.text, letterSpacing: -0.3 }}>
                    Registre esse momento
                </Text>
                {/*
                  O destino da foto muda o que esta frase pode prometer. Com o feed
                  público ligado ela não fica só na galeria do perfil — e a hora de dizer
                  isso é antes de a pessoa apontar a câmera, não depois de salvar.
                */}
                <Text style={{ fontSize: 13, color: HADES.textMuted, marginTop: 4, lineHeight: 19 }}>
                    {iraParaOFeed
                        ? "Uma foto do seu ambiente, das anotações, do café. Como esta sessão é pública e você participa do feed, ela vai aparecer no Explorar."
                        : "Uma foto do seu ambiente, das anotações, do café. Fica na sua galeria do perfil."}
                </Text>
            </View>

            <View style={{ flex: 1, paddingHorizontal: 20 }}>
                {foto ? (
                    <>
                        <View
                            style={{
                                borderRadius: 18,
                                overflow: "hidden",
                                backgroundColor: HADES.surfaceRaised,
                                borderWidth: 1,
                                borderColor: HADES.border,
                                aspectRatio: 4 / 3,
                            }}
                        >
                            <Image source={{ uri: foto.uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />

                            <TouchableOpacity
                                onPress={() => escolher("camera")}
                                disabled={ocupado}
                                activeOpacity={0.85}
                                style={{
                                    position: "absolute",
                                    right: 10,
                                    bottom: 10,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 6,
                                    paddingVertical: 8,
                                    paddingHorizontal: 12,
                                    borderRadius: 999,
                                    backgroundColor: "rgba(0,0,0,0.6)",
                                }}
                            >
                                <RotateCw size={13} color="#fff" />
                                <Text style={{ fontSize: 12.5, fontWeight: "700", color: "#fff" }}>Refazer</Text>
                            </TouchableOpacity>
                        </View>

                        {/* A legenda vira a tag mostrada sobre a foto no grid da galeria. */}
                        <View style={{ marginTop: 22 }}>
                            <Text
                                style={{
                                    fontSize: 11.5,
                                    fontWeight: "700",
                                    letterSpacing: 0.8,
                                    textTransform: "uppercase",
                                    color: HADES.textMuted,
                                    marginBottom: 8,
                                }}
                            >
                                Legenda (opcional)
                            </Text>
                            <TextInput
                                value={legenda}
                                onChangeText={setLegenda}
                                editable={!ocupado}
                                placeholder="setup do dia"
                                placeholderTextColor={HADES.textDim}
                                maxLength={MAX_LEGENDA}
                                style={{ padding: 0, fontSize: 14, lineHeight: 22, color: HADES.text }}
                            />
                            <View
                                style={{
                                    height: 1,
                                    marginTop: 10,
                                    backgroundColor: legenda.length > 0 ? HADES.accentSolid : HADES.border,
                                }}
                            />
                        </View>
                    </>
                ) : (
                    <EscolhaVazia aoEscolher={escolher} ocupado={ocupado} />
                )}
            </View>

            <View style={{ paddingHorizontal: 20, paddingBottom: 12, paddingTop: 8, gap: 4 }}>
                <TouchableOpacity
                    onPress={salvar}
                    disabled={!foto || ocupado}
                    activeOpacity={0.85}
                    style={{
                        height: 50,
                        borderRadius: 14,
                        backgroundColor: HADES.accentSolid,
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: !foto || ocupado ? 0.4 : 1,
                    }}
                >
                    {enviando ? (
                        <ActivityIndicator color="#000" />
                    ) : (
                        <Text style={{ fontSize: 15, fontWeight: "700", color: "#000" }}>Salvar foto</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={aoConcluir}
                    disabled={enviando}
                    activeOpacity={0.7}
                    style={{ paddingVertical: 14, alignItems: "center" }}
                >
                    <Text style={{ fontSize: 14.5, fontWeight: "500", color: HADES.textMuted }}>
                        {foto ? "Descartar e continuar" : "Pular"}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

/** Estado inicial: a câmera é o caminho principal, a galeria fica como alternativa. */
function EscolhaVazia({
    aoEscolher,
    ocupado,
}: {
    aoEscolher: (origem: "camera" | "galeria") => void;
    ocupado: boolean;
}) {
    return (
        <View style={{ gap: 14 }}>
            <TouchableOpacity
                onPress={() => aoEscolher("camera")}
                disabled={ocupado}
                activeOpacity={0.85}
                style={{
                    aspectRatio: 4 / 3,
                    borderRadius: 18,
                    backgroundColor: HADES.surfaceRaised,
                    borderWidth: 1,
                    borderStyle: "dashed",
                    borderColor: HADES.borderDashed,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                    opacity: ocupado ? 0.5 : 1,
                }}
            >
                {ocupado ? (
                    <ActivityIndicator color={HADES.accentSolid} />
                ) : (
                    <>
                        <View
                            style={{
                                width: 56,
                                height: 56,
                                borderRadius: 28,
                                backgroundColor: HADES.accentTint,
                                borderWidth: 1,
                                borderColor: HADES.accentTintBorder,
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <Camera size={24} color={HADES.accentSolid} />
                        </View>
                        <Text style={{ fontSize: 14.5, fontWeight: "700", color: HADES.textSecondary }}>
                            Tirar foto
                        </Text>
                    </>
                )}
            </TouchableOpacity>

            <TouchableOpacity
                onPress={() => aoEscolher("galeria")}
                disabled={ocupado}
                activeOpacity={0.7}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }}
            >
                <Images size={15} color={HADES.textMuted} />
                <Text style={{ fontSize: 13.5, fontWeight: "500", color: HADES.textMuted }}>
                    Escolher da galeria
                </Text>
            </TouchableOpacity>
        </View>
    );
}
