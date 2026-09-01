import { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, ImageBackground, Dimensions, Modal, Pressable, ActivityIndicator, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { router } from "expo-router";
import Svg, { Circle, Line, Rect, Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import RNShare, { Social } from "react-native-share";
import { useFonts as useFontsPlayfair, PlayfairDisplay_800ExtraBold_Italic } from "@expo-google-fonts/playfair-display";
import { useFonts as useFontsQuicksand, Quicksand_700Bold } from "@expo-google-fonts/quicksand";
import { useFonts as useFontsUnbounded, Unbounded_800ExtraBold } from "@expo-google-fonts/unbounded";
import { SafeAreaView } from "@/components/ui/TelaSegura";
import { ArrowLeft, Share2, Clock, CheckCircle, Flame, PieChart, FileText, MessageCircle, MoreHorizontal, X } from "@/components/ui/icons";
import { toast } from "@/services/toast";
import { useAuth } from "@/hooks/useAuth";
import { useWrappedMensal } from "@/hooks/useWrappedMensal";
import { estaNaJanelaDoWrapped, mesFechadoAnterior } from "@/lib/wrappedMensal";
import type { DadosWrapped } from "@/types/analytics";

/**
 * Fonte de destaque só do título "Wrapped de [mês]" — o resto da tela segue a fonte padrão
 * do app. Pra testar as três opções baixadas, troque só essa linha (o nome tem que bater
 * com o `fontFamily` real do arquivo carregado lá embaixo, em `useFontsPlayfair`/etc).
 */
const FONTE_TITULO: "PlayfairDisplay_800ExtraBold_Italic" | "Quicksand_700Bold" | "Unbounded_800ExtraBold" = "Unbounded_800ExtraBold";

/**
 * Paleta própria do Wrapped — deliberadamente mais azulada e saturada que o HADES
 * padrão (que é quase puro preto/laranja), pra reproduzir fielmente o mockup aprovado.
 */
const CORES = {
    bg: "#010611",
    card: "#0d0f1a",
    cardGradiente: ["#0a101c", "#070e19"] as const,
    cardBorder: "rgba(255,255,255,0.06)",
    trilha: "#1a1c28",
    azul: "#4C6EF5",
    azulEscuro: "#2541b8",
    laranja: "#FF9A3D",
    branco: "#f5f6f8",
    textoSecundario: "#9599a6",
    textoMuted: "#6b6f7d",
    cinza: "#4a4d58",
};

/** Margem lateral da página — a foto da ofensiva usa isso (negativo) pra vazar até a borda da tela. */
const PADDING_PAGINA = 20;
const LARGURA_TELA = Dimensions.get("window").width;
/** Altura exata de um story do Instagram (proporção 9:16), usada só nas versões pra compartilhar. */
const ALTURA_STORY = LARGURA_TELA * (16 / 9);

/**
 * `rgba(cor, alpha)` a partir de um hex. Um `LinearGradient` de 2 pontas (cor sólida →
 * transparente) interpola o alfa de forma linear, o que o olho lê como uma transição
 * abrupta perto da ponta transparente. Com mais paradas (alfa em degraus decrescentes,
 * não uniformes) a curva fica com essa suavidade — é uma easing manual, já que a lib não
 * tem `easing` nativo.
 */
function comAlfa(hex: string, alfa: number) {
    const n = parseInt(hex.replace("#", ""), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r},${g},${b},${alfa})`;
}

/**
 * Layouts pro compartilhamento — o mesmo design do Wrapped completo (ver ConteudoWrapped),
 * só que cada um sem uma seção e com espaçamento/fonte reduzidos (`compacto`, ver
 * ConteudoWrapped). Tirar uma seção inteira sozinho não é suficiente pra bater a proporção
 * de tela de um story (9:16) — sobrava ~8-12% de altura mesmo assim, medido direto no
 * aparelho — por isso o modo compacto entra junto. O layout "completo" (sem cortar seção
 * nenhuma) segue tendo altura demais mesmo compacto, por isso não é uma opção aqui.
 */
const LAYOUTS_CARTAO = [
    { id: "semOfensiva", rotulo: "Sem ofensiva", mostrarOfensiva: false, mostrarDistribuicao: true },
    { id: "semDistribuicao", rotulo: "Sem distribuição", mostrarOfensiva: true, mostrarDistribuicao: false },
] as const;

export default function WrappedMensal() {
    const refsCartoes = [useRef<any>(null), useRef<any>(null)];
    const { userId } = useAuth();
    // Estável entre renders — recriar `new Date()` a cada render faria o hook refazer a
    // busca (a chave do cache inclui ano/mês) o tempo todo à toa.
    const [mesReferencia] = useState(() => mesFechadoAnterior());
    // Trava de acesso: fora dos 3 primeiros dias do mês o Wrapped do mês passado não é mais
    // mostrado (ver lib/wrappedMensal.ts). Quem chega aqui atrasado — link antigo, notificação
    // não tocada a tempo — volta pro perfil em vez de ver a tela pela metade.
    useEffect(() => {
        if (!estaNaJanelaDoWrapped()) {
            router.replace("/(tabs)/profile");
        }
    }, []);
    const { wrapped: dados, temSessoes, loading } = useWrappedMensal(userId, mesReferencia);

    if (!estaNaJanelaDoWrapped()) return null;
    const [seletorAberto, setSeletorAberto] = useState(false);
    const [layoutSelecionado, setLayoutSelecionado] = useState(0);
    // Carrega as três fontes baixadas pra teste (ver FONTE_TITULO lá em cima) — só a
    // selecionada é usada no título, as outras duas ficam ociosas até trocar a constante.
    const [playfairCarregada] = useFontsPlayfair({ PlayfairDisplay_800ExtraBold_Italic });
    const [quicksandCarregada] = useFontsQuicksand({ Quicksand_700Bold });
    const [unboundedCarregada] = useFontsUnbounded({ Unbounded_800ExtraBold });
    const fonteCarregada = playfairCarregada && quicksandCarregada && unboundedCarregada;

    /**
     * `destino` manda direto pro app certo (igual ao "Share to" do Strava — um toque já
     * compartilha, sem passar por um botão genérico no meio). "instagram"/"whatsapp" usam
     * o `react-native-share` (já configurado em app.json com o esquema do Instagram) pra
     * abrir o app específico; "mais" cai na folha de compartilhamento nativa de sempre.
     */
    async function compartilhar(indice: number, destino: DestinoCompartilhamento) {
        try {
            // Captura a versão sem seção renderizada fora da tela (ver ConteudoWrapped),
            // não o Wrapped completo — esse é bem mais alto que um story e sairia com
            // margem nas laterais e nitidez perdida quando o app de destino o encolhe.
            const uri = await refsCartoes[indice].current?.capture?.();
            if (!uri) {
                toast.error("Não foi possível gerar a imagem do Wrapped.");
                return;
            }

            if (destino === "instagram") {
                const resultado = await RNShare.shareSingle({
                    social: Social.InstagramStories,
                    appId: "com.studocore.app",
                    backgroundImage: uri,
                });
                if (!resultado.success) toast.error("Não foi possível abrir o Instagram.");
                return;
            }

            if (destino === "whatsapp") {
                const resultado = await RNShare.shareSingle({
                    social: Social.Whatsapp,
                    url: uri,
                    type: "image/png",
                });
                if (!resultado.success) toast.error("Não foi possível abrir o WhatsApp.");
                return;
            }

            const disponivel = await Sharing.isAvailableAsync();
            if (!disponivel) {
                toast.error("Compartilhamento não disponível nesse aparelho.");
                return;
            }
            await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Compartilhar Wrapped" });
        } catch (error) {
            console.log("Erro ao compartilhar wrapped:", error);
            toast.error("Não foi possível compartilhar o Wrapped.");
        }
    }

    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: CORES.bg }} edges={["top"]}>
            {/* Cabeçalho de navegação da tela — o que é compartilhado é uma versão sem uma seção, ver ConteudoWrapped */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 }}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    activeOpacity={0.7}
                    style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: CORES.card, borderWidth: 1, borderColor: CORES.cardBorder, alignItems: "center", justifyContent: "center" }}
                >
                    <ArrowLeft size={19} color={CORES.textoSecundario} />
                </TouchableOpacity>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Image source={require("@/assets/logo-studocore.png")} style={{ width: 24, height: 24 }} resizeMode="contain" />
                    <Text style={{ fontSize: 14, fontWeight: "800", letterSpacing: 1.5, color: CORES.branco }}>STUDOCORE</Text>
                </View>

                <TouchableOpacity
                    onPress={() => setSeletorAberto(true)}
                    activeOpacity={0.7}
                    disabled={!dados}
                    style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: CORES.card, borderWidth: 1, borderColor: CORES.cardBorder, alignItems: "center", justifyContent: "center", opacity: dados ? 1 : 0.4 }}
                >
                    <Share2 size={17} color={CORES.textoSecundario} />
                </TouchableOpacity>
            </View>

            {loading && !dados && (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <ActivityIndicator color={CORES.laranja} />
                </View>
            )}

            {!loading && !temSessoes && (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 6 }}>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: CORES.branco, textAlign: "center" }}>
                        {dados ? `Sem sessões em ${dados.mesRotulo}` : "Sem sessões nesse mês"}
                    </Text>
                    <Text style={{ fontSize: 13, color: CORES.textoSecundario, textAlign: "center" }}>
                        Estude ao menos uma vez no mês pra ver o Wrapped dele aqui.
                    </Text>
                </View>
            )}

            {dados && temSessoes && (
                <>
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
                        <View style={{ backgroundColor: CORES.bg, paddingHorizontal: PADDING_PAGINA, paddingTop: 8 }}>
                            <ConteudoWrapped dados={dados} fonteCarregada={fonteCarregada} />
                        </View>
                    </ScrollView>

                    {/* Uma cópia do Wrapped completo por layout, fora da tela — nunca visíveis, cada
                        uma sem a seção correspondente (ver LAYOUTS_CARTAO), mantidas montadas pro
                        ViewShot de cada uma conseguir capturar. Altura fixa em ALTURA_STORY (9:16
                        exato, proporção de story do Instagram) com o conteúdo centralizado — sobra
                        de espaço vira respiro no topo/embaixo em vez de o conteúdo ficar esticado
                        ou colado nas bordas. */}
                    <View style={{ position: "absolute", top: 0, left: -9999 }} pointerEvents="none">
                        {LAYOUTS_CARTAO.map((layout, i) => (
                            <ViewShot key={layout.id} ref={refsCartoes[i]} options={{ format: "png", quality: 1 }}>
                                <View
                                    style={{
                                        width: LARGURA_TELA,
                                        height: ALTURA_STORY,
                                        backgroundColor: CORES.bg,
                                        paddingHorizontal: PADDING_PAGINA,
                                        justifyContent: "center",
                                    }}
                                >
                                    <ConteudoWrapped
                                        dados={dados}
                                        mostrarOfensiva={layout.mostrarOfensiva}
                                        mostrarDistribuicao={layout.mostrarDistribuicao}
                                        compacto
                                        fonteCarregada={fonteCarregada}
                                    />
                                </View>
                            </ViewShot>
                        ))}
                    </View>

                    {seletorAberto && (
                        <SeletorLayout
                            dados={dados}
                            fonteCarregada={fonteCarregada}
                            selecionado={layoutSelecionado}
                            onSelecionar={setLayoutSelecionado}
                            onFechar={() => setSeletorAberto(false)}
                            onCompartilhar={(destino) => compartilhar(layoutSelecionado, destino)}
                        />
                    )}
                </>
            )}
        </SafeAreaView>
    );
}

/**
 * O conteúdo do Wrapped completo (mesmo design de sempre — título, desempenho, questões,
 * ofensiva, distribuição do tempo, marca d'água), fatorado à parte pra poder ser reusado
 * tanto na tela normal quanto nas versões sem seção usadas pra compartilhar (ver
 * LAYOUTS_CARTAO). `mostrarOfensiva`/`mostrarDistribuicao` só omitem a seção inteira — o
 * que fica não muda em nada, sem redesenhar espaçamento nem tamanho de nada.
 */
function ConteudoWrapped({
    dados,
    mostrarOfensiva = true,
    mostrarDistribuicao = true,
    compacto = false,
    fonteCarregada = false,
}: {
    dados: DadosWrapped;
    mostrarOfensiva?: boolean;
    mostrarDistribuicao?: boolean;
    /**
     * Aperta fonte/espaçamento pra a versão só-com-uma-seção (ver LAYOUTS_CARTAO) chegar
     * na proporção 9:16 dos stories — sem isso, mesmo tirando uma seção inteira, sobra
     * altura demais (fontes e paddings pensados pra tela cheia, não pra um card de story).
     * Não é usado na tela normal, só nas cópias renderizadas pra compartilhar.
     */
    compacto?: boolean;
    /** Enquanto a fonte de destaque do título não termina de carregar (useFonts em WrappedMensal), cai no peso 800 padrão pra não piscar sem título. */
    fonteCarregada?: boolean;
}) {
    return (
        <>
            {/* ── Marca d'água ── */}
            {compacto &&
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: compacto ? 20 : 24, zIndex: 100 }}>
                  <Image source={require("@/assets/logo-studocore.png")} style={{ width: compacto ? 26 : 18, height: compacto ? 26 : 18 }} resizeMode="contain" />
                  <Text style={{ fontSize: compacto ? 15 : 11, fontWeight: "800", letterSpacing: 1.5, color: CORES.branco }}>
                      STUDOCORE
                  </Text>
              </View>
            }

            {/* ── Título + decoração ── */}
            <View style={{ marginBottom: compacto ? 18 : 22 }}>
                <Image
                    source={require("@/assets/wrapped/header-decoration.png")}
                    style={{ position: "absolute", top: -30, right: -5, width: 310, height: 240 }}
                />
                <Text
                    style={{
                        fontFamily: fonteCarregada ? FONTE_TITULO : undefined,
                        fontSize: compacto ? 38 : 41,
                        letterSpacing: 1,
                        fontWeight: fonteCarregada ? undefined : "800",
                        color: CORES.branco,
                        lineHeight: compacto ? 43 : 46,
                        fontStyle: fonteCarregada ? undefined : "italic",
                    }}
                >
                    Wrapped
                </Text>
                <Text
                    style={{
                        fontFamily: fonteCarregada ? FONTE_TITULO : undefined,
                        fontSize: compacto ? 38 : 41,
                        letterSpacing: 1,
                        fontWeight: fonteCarregada ? undefined : "800",
                        lineHeight: compacto ? 43 : 46,
                        fontStyle: fonteCarregada ? undefined : "italic",
                    }}
                >
                    <Text style={{ color: CORES.laranja }}>de </Text>
                    <Text style={{ color: CORES.laranja }}>{dados.mesRotulo}</Text>
                </Text>
                {!compacto && (
                    <Text style={{ marginTop: 14, fontSize: 14, lineHeight: 20, color: CORES.textoSecundario }}>
                        Um mês de foco.{"\n"}Um passo mais perto do seu objetivo.
                    </Text>
                )}
            </View>

            <SecaoTitulo cor={CORES.azul} compacto={compacto}>DESEMPENHO</SecaoTitulo>

            {/* ── Horas totais (anel) + Média diária (barras) ── */}
            <View style={{ flexDirection: "row", gap: compacto ? 10 : 12, marginBottom: compacto ? 15 : 12 }}>
              <View style={{ flex: 1, maxWidth: compacto ? 165 : undefined, aspectRatio: 1, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 10, fontWeight: "700", letterSpacing: 0.5, color: CORES.textoSecundario, textAlign: "center", top: compacto ? 4 : 7 }}>
                      HORAS TOTAIS{"\n"}
                  </Text>
                  <AnelHoras progresso={dados.progressoHoras} tamanho={compacto ? 140 : 145} />
                  <View style={{ position: "absolute", alignItems: "center" }}>
                      <Text style={{ marginTop: compacto ? 30 : 36, fontSize: 21, fontWeight: "800", color: CORES.branco }}>{dados.horasTotais}</Text>
                      <Text style={{ marginTop: 2, fontSize: compacto ? 9 : 11, fontWeight: "700", color: CORES.laranja }}>
                          {dados.variacaoHorasPositiva ? "↑" : "↓"} {dados.variacaoHoras}
                      </Text>
                      <Text style={{ fontSize: compacto ? 8 : 10, color: CORES.textoMuted }}>vs. {dados.mesAnterior}</Text>
                  </View>
              </View>

                <LinearGradient
                    colors={CORES.cardGradiente}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={{ flex: 1, borderRadius: 20, borderWidth: 1, borderColor: CORES.cardBorder, padding: compacto ? 10 : 14, justifyContent: "space-between" }}
                >
                    <View>
                        <Text style={{ fontSize: compacto ? 9 : 10, fontWeight: "700", letterSpacing: 0.5, color: CORES.textoSecundario }}>
                            MÉDIA DE HORAS{"\n"}DIÁRIAS
                        </Text>
                        <Text style={{ marginTop: compacto ? 3 : 6, fontSize: compacto ? 17 : 22, fontWeight: "800", color: CORES.branco }}>{dados.mediaDiaria}</Text>
                    </View>
                    <GraficoBarrasDiarias valores={dados.barrasDiarias} picoRotulo={dados.picoDiario} compacto={compacto} />
                </LinearGradient>
            </View>

            {/* ── Questões ── */}
            <LinearGradient
                colors={CORES.cardGradiente}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{ flexDirection: "row", borderRadius: 20, borderWidth: 1, borderColor: CORES.cardBorder, marginBottom: compacto ? 16 : 18, overflow: "hidden" }}
            >
                <View style={{ flex: 1, padding: compacto ? 13 : 16, gap: compacto ? 7 : 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: compacto ? 6 : 8 }}>
                        <View style={{ width: compacto ? 34 : 40, height: compacto ? 34 : 40, borderRadius: 12, backgroundColor: "rgba(76,110,245,0.14)", alignItems: "center", justifyContent: "center" }}>
                            <FileText size={compacto ? 15 : 19} color={CORES.azul} />
                        </View>
                        <Text style={{ fontSize: compacto ? 10 : 11, fontWeight: "700", letterSpacing: 0.5, color: CORES.textoSecundario }}>
                            QUESTÕES{"\n"}TOTAIS
                        </Text>
                    </View>
                    <Text style={{ fontSize: compacto ? 21 : 24, fontWeight: "800", color: CORES.branco }}>{dados.questoesTotais}</Text>
                    <View style={{ height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                        <View style={{ width: "78%", height: "100%", backgroundColor: CORES.azul, borderRadius: 2 }} />
                    </View>
                </View>

                <View style={{ width: 1, backgroundColor: CORES.cardBorder }} />

                <View style={{ flex: 1, padding: compacto ? 13 : 16, gap: compacto ? 7 : 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: compacto ? 6 : 8 }}>
                        <View style={{ width: compacto ? 34 : 40, height: compacto ? 34 : 40, borderRadius: 20, borderWidth: 1.5, borderColor: CORES.laranja, alignItems: "center", justifyContent: "center" }}>
                            <CheckCircle size={compacto ? 15 : 19} color={CORES.laranja} />
                        </View>
                        <Text style={{ fontSize: compacto ? 10 : 11, fontWeight: "700", letterSpacing: 0.5, color: CORES.textoSecundario }}>
                            QUESTÕES{"\n"}CORRETAS
                        </Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: compacto ? 21 : 24, fontWeight: "800", color: CORES.branco }}>{dados.questoesCorretas}</Text>
                        <Text style={{ fontSize: compacto ? 10 : 11, fontWeight: "700", color: CORES.laranja }}>{dados.pctAcerto}%</Text>
                    </View>
                    <View style={{ height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                        <View style={{ width: `${dados.pctAcerto}%`, height: "100%", backgroundColor: CORES.laranja, borderRadius: 2 }} />
                    </View>
                </View>
            </LinearGradient>

            {mostrarOfensiva && (
                /* ── Ofensiva: sem card — a foto vaza (margem negativa) até a borda da
                    tela, com uma vinheta nos quatro lados (não só embaixo) fundindo ela
                    no fundo da tela, e o texto por cima. ── */
                <View style={{ marginHorizontal: -PADDING_PAGINA, marginBottom: compacto ? 12 : 22 }}>
                    <ImageBackground
                        source={require("@/assets/wrapped/streak-mountain.png")}
                        style={{ width: LARGURA_TELA }}
                        imageStyle={{ resizeMode: "cover" }}
                    >
                        <LinearGradient
                            colors={[
                                comAlfa(CORES.bg, 1), comAlfa(CORES.bg, 0.9), comAlfa(CORES.bg, 0.68),
                                comAlfa(CORES.bg, 0.4), comAlfa(CORES.bg, 0.16), "transparent",
                            ]}
                            locations={[0, 0.2, 0.42, 0.64, 0.84, 1]}
                            style={{ position: "absolute", top: 0, left: 0, right: 0, height: 64 }}
                        />
                        <LinearGradient
                            colors={[
                                comAlfa(CORES.bg, 1), comAlfa(CORES.bg, 0.9), comAlfa(CORES.bg, 0.68),
                                comAlfa(CORES.bg, 0.4), comAlfa(CORES.bg, 0.16), "transparent",
                            ]}
                            locations={[0, 0.2, 0.42, 0.64, 0.84, 1]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 48 }}
                        />

                        <LinearGradient
                            colors={[
                                "transparent", comAlfa(CORES.bg, 0.1), comAlfa(CORES.bg, 0.28),
                                comAlfa(CORES.bg, 0.55), comAlfa(CORES.bg, 0.85), CORES.bg,
                            ]}
                            locations={[0, 0.35, 0.55, 0.72, 0.88, 1]}
                            style={{ paddingHorizontal: PADDING_PAGINA, paddingTop: compacto ? 16 : 22, paddingBottom: compacto ? 10 : 16, gap: 5 }}
                        >
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: compacto ? 6 : 8 }}>
                                <Flame size={compacto ? 13 : 14} color={CORES.laranja} />
                                <Text style={{ fontSize: compacto ? 10 : 11, fontWeight: "800", letterSpacing: 0.5, color: CORES.laranja }}>OFENSIVA</Text>
                            </View>
                            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
                                <Text style={{ fontSize: compacto ? 40 : 48, fontWeight: "800", color: CORES.branco, lineHeight: compacto ? 40 : 48 }}>{dados.ofensivaDias}</Text>
                                <Text style={{ fontSize: compacto ? 22 : 26, fontWeight: "600", color: CORES.branco, marginBottom: compacto ? 2 : 3 }}>dias</Text>
                            </View>
                            {dados.ofensivaRecorde && (
                                <Text style={{ marginTop: 2, fontSize: compacto ? 11 : 12, color: CORES.textoSecundario }}>A maior desse mês!</Text>
                            )}

                            <View style={{ flexDirection: "row", gap: compacto ? 7 : 8, marginTop: compacto ? 12 : 18 }}>
                                {dados.trilhaOfensiva.map((ativo, i) => (
                                    <View
                                        key={i}
                                        style={{
                                            width: compacto ? 20 : 26, height: compacto ? 20 : 26, borderRadius: compacto ? 10 : 13,
                                            borderWidth: 1.5,
                                            borderColor: ativo ? CORES.laranja : CORES.cardBorder,
                                            backgroundColor: ativo ? "rgba(255,154,61,0.12)" : "transparent",
                                            alignItems: "center", justifyContent: "center",
                                        }}
                                    >
                                        <Flame size={compacto ? 10 : 12} color={ativo ? CORES.laranja : CORES.textoMuted} />
                                    </View>
                                ))}
                            </View>
                        </LinearGradient>
                    </ImageBackground>
                </View>
            )}

            {mostrarDistribuicao && (
                <>
                    {/* ── Distribuição do tempo ── */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: compacto ? 12 : 14 }}>
                        <PieChart size={compacto ? 13 : 14} color={CORES.azul} />
                        <Text style={{ fontSize: compacto ? 11 : 12, fontWeight: "800", letterSpacing: 1, color: CORES.azul }}>DISTRIBUIÇÃO DO TEMPO</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: compacto ? 18 : 22, marginBottom: compacto ? 20 : 24 }}>
                        <DonutMaterias materias={dados.materias} tamanho={compacto ? 114 : 120} />
                        <View style={{ flex: 1, gap: compacto ? 10 : 12 }}>
                            {dados.materias.map((m) => (
                                <View key={m.nome} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                        <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: m.cor }} />
                                        <Text style={{ fontSize: compacto ? 12 : 13, color: CORES.textoSecundario }}>{m.nome}</Text>
                                    </View>
                                    <Text style={{ fontSize: compacto ? 12 : 13, fontWeight: "600", color: CORES.branco }}>{m.tempo}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                </>
            )}

        </>
    );
}

/** Destinos do "Compartilhar para" (ver SeletorLayout) — mesmo tipo usado em `compartilhar`, WrappedMensal. */
type DestinoCompartilhamento = "instagram" | "whatsapp" | "mais";

/**
 * Seletor de layout + destino, estilo bottom sheet "Share Activity" do Strava: sobe de
 * baixo com o fundo da tela escurecido por trás (`Modal` de verdade, mesmo padrão do
 * DetalheMedalhaSheet), com um carrossel horizontal de preview em miniatura de cada
 * layout (arrasta pra trocar, os pontinhos embaixo mostram qual tá selecionado) e a linha
 * "Compartilhar para" com os apps direto — nada de botão genérico no meio, um toque no
 * ícone já compartilha (ver `compartilhar` em WrappedMensal).
 *
 * O backdrop (Pressable que fecha ao tocar fora) e a folha em si são *irmãos*, não
 * pai/filho — colocar a folha dentro do Pressable do backdrop (como era antes) fazia o
 * Pressable disputar o toque com o ScrollView horizontal do carrossel e travava o swipe.
 * Como irmãos, o toque na área da folha nunca chega a percorrer o Pressable do backdrop.
 *
 * A miniatura é o próprio `ConteudoWrapped` real encolhido via `transform: scale` dentro
 * de um container do tamanho final com `overflow: hidden` — não é uma versão simplificada
 * à parte, então o preview é sempre fiel ao que vai ser compartilhado. Todo layout usa a
 * mesma altura fixa (ALTURA_STORY, proporção 9:16 exata de story), então a miniatura
 * escala direto a partir dela.
 */
function SeletorLayout({
    dados,
    fonteCarregada,
    selecionado,
    onSelecionar,
    onFechar,
    onCompartilhar,
}: {
    dados: DadosWrapped;
    fonteCarregada: boolean;
    selecionado: number;
    onSelecionar: (indice: number) => void;
    onFechar: () => void;
    onCompartilhar: (destino: DestinoCompartilhamento) => void;
}) {
    const larguraMiniatura = LARGURA_TELA * 0.62;
    const escala = larguraMiniatura / LARGURA_TELA;
    const espacamento = 16;
    const passo = larguraMiniatura + espacamento;
    const paddingLateral = (LARGURA_TELA - larguraMiniatura) / 2;
    const alturaMiniatura = ALTURA_STORY * escala;

    function aoParar(evento: NativeSyntheticEvent<NativeScrollEvent>) {
        const indice = Math.round(evento.nativeEvent.contentOffset.x / passo);
        onSelecionar(Math.min(LAYOUTS_CARTAO.length - 1, Math.max(0, indice)));
    }

    return (
        <Modal visible transparent animationType="slide" onRequestClose={onFechar}>
            <View style={{ flex: 1, justifyContent: "flex-end" }}>
                {/* Backdrop sozinho, sem a folha dentro — ver nota acima sobre o bug do swipe. */}
                <Pressable
                    style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(1,6,17,0.75)" }}
                    onPress={onFechar}
                />

                <View
                    style={{
                        backgroundColor: CORES.card,
                        borderWidth: 1,
                        borderColor: CORES.cardBorder,
                        borderTopLeftRadius: 26,
                        borderTopRightRadius: 26,
                        paddingTop: 10,
                        paddingHorizontal: 16,
                    }}
                >
                    <SafeAreaView edges={["bottom"]}>
                        <View style={{ alignItems: "center", marginBottom: 10 }}>
                            <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: CORES.trilha }} />
                        </View>

                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, paddingBottom: 6 }}>
                            <View style={{ width: 22 }} />
                            <Text style={{ fontSize: 15, fontWeight: "700", color: CORES.branco }}>Compartilhar Wrapped</Text>
                            <TouchableOpacity onPress={onFechar} activeOpacity={0.7} hitSlop={10}>
                                <X size={20} color={CORES.textoSecundario} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            decelerationRate="fast"
                            snapToInterval={passo}
                            snapToAlignment="start"
                            contentContainerStyle={{ paddingHorizontal: paddingLateral, alignItems: "center" }}
                            onMomentumScrollEnd={aoParar}
                            style={{ flexGrow: 0, marginTop: 8 }}
                        >
                            {LAYOUTS_CARTAO.map((layout, i) => (
                                <View
                                    key={layout.id}
                                    style={{
                                        width: larguraMiniatura,
                                        height: alturaMiniatura,
                                        marginRight: i === LAYOUTS_CARTAO.length - 1 ? 0 : espacamento,
                                        borderRadius: 22,
                                        overflow: "hidden",
                                        borderWidth: 2,
                                        borderColor: i === selecionado ? CORES.laranja : "transparent",
                                    }}
                                >
                                    <View
                                        style={{
                                            width: LARGURA_TELA,
                                            height: ALTURA_STORY,
                                            backgroundColor: CORES.bg,
                                            paddingHorizontal: PADDING_PAGINA,
                                            justifyContent: "center",
                                            transform: [{ scale: escala }],
                                            transformOrigin: "top left",
                                        }}
                                    >
                                        <ConteudoWrapped
                                            dados={dados}
                                            mostrarOfensiva={layout.mostrarOfensiva}
                                            mostrarDistribuicao={layout.mostrarDistribuicao}
                                            compacto
                                            fonteCarregada={fonteCarregada}
                                        />
                                    </View>
                                </View>
                            ))}
                        </ScrollView>

                        <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 14 }}>
                            {LAYOUTS_CARTAO.map((layout, i) => (
                                <View
                                    key={layout.id}
                                    style={{
                                        width: i === selecionado ? 16 : 6,
                                        height: 6,
                                        borderRadius: 3,
                                        backgroundColor: i === selecionado ? CORES.laranja : CORES.cardBorder,
                                    }}
                                />
                            ))}
                        </View>

                        <Text style={{ textAlign: "center", marginTop: 8, fontSize: 12, color: CORES.textoSecundario }}>
                            {LAYOUTS_CARTAO[selecionado].rotulo}
                        </Text>

                        {/* ── Compartilhar para ── */}
                        <Text style={{ marginTop: 20, marginBottom: 12, fontSize: 11, fontWeight: "800", letterSpacing: 1, color: CORES.textoSecundario }}>
                            COMPARTILHAR PARA
                        </Text>

                        <View style={{ flexDirection: "row", gap: 14, paddingBottom: 8 }}>
                            <BotaoDestino rotulo="Instagram" onPress={() => onCompartilhar("instagram")}>
                                <LinearGradient
                                    colors={["#FEDA77", "#DD2A7B", "#4F5BD5"]}
                                    start={{ x: 0, y: 1 }}
                                    end={{ x: 1, y: 0 }}
                                    style={{ width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}
                                >
                                    <IconeInstagram size={24} color="#fff" />
                                </LinearGradient>
                            </BotaoDestino>

                            <BotaoDestino rotulo="WhatsApp" onPress={() => onCompartilhar("whatsapp")}>
                                <View style={{ width: "100%", height: "100%", backgroundColor: "#25D366", alignItems: "center", justifyContent: "center" }}>
                                    <MessageCircle size={23} color="#04120a" fill="#04120a" />
                                </View>
                            </BotaoDestino>

                            <BotaoDestino rotulo="Mais" onPress={() => onCompartilhar("mais")}>
                                <View style={{ width: "100%", height: "100%", backgroundColor: CORES.trilha, alignItems: "center", justifyContent: "center" }}>
                                    <MoreHorizontal size={23} color={CORES.branco} />
                                </View>
                            </BotaoDestino>
                        </View>
                    </SafeAreaView>
                </View>
            </View>
        </Modal>
    );
}

/**
 * Um destino do "Compartilhar para": o ícone (passado como children, já com a cor/marca
 * do app) fica num quadrado com cantos arredondados — o "container" de fundo próprio de
 * cada botão pedido no mockup do Strava — e o nome do app embaixo.
 */
function BotaoDestino({ rotulo, onPress, children }: { rotulo: string; onPress: () => void; children: React.ReactNode }) {
    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ alignItems: "center", gap: 6 }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, overflow: "hidden" }}>{children}</View>
            <Text style={{ fontSize: 11, fontWeight: "600", color: CORES.textoSecundario }}>{rotulo}</Text>
        </TouchableOpacity>
    );
}

/** Câmera estilizada — glifo simples do Instagram, só pra identificar o ícone no quadrado colorido. */
function IconeInstagram({ size = 24, color = "#fff" }: { size?: number; color?: string }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Rect x={3} y={3} width={18} height={18} rx={5} stroke={color} strokeWidth={1.8} />
            <Circle cx={12} cy={12} r={4.2} stroke={color} strokeWidth={1.8} />
            <Circle cx={17.2} cy={6.8} r={1.1} fill={color} />
        </Svg>
    );
}

function SecaoTitulo({ children, cor, compacto = false }: { children: string; cor: string; compacto?: boolean }) {
    return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: compacto ? 11 : 14 }}>
            <Text style={{ fontSize: compacto ? 11 : 12, fontWeight: "800", letterSpacing: 1, color: cor }}>{children}</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: CORES.cardBorder }} />
        </View>
    );
}

/** Anel de progresso das horas totais do mês — mesma técnica do AnelPomodoro. */
function AnelHoras({ progresso, tamanho = 145 }: { progresso: number; tamanho?: number }) {
    const raio = tamanho * 0.469;
    const espessura = Math.max(6, tamanho * 0.062);
    const centro = tamanho / 2;
    const perimetro = 2 * Math.PI * raio;
    const limitado = Math.min(1, Math.max(0, progresso));

    return (
        <Svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`}>
            <Circle cx={centro} cy={centro} r={raio} fill="none" stroke={CORES.trilha} strokeWidth={espessura} />
            <Circle
                cx={centro}
                cy={centro}
                r={raio}
                fill="none"
                stroke={CORES.laranja}
                strokeWidth={espessura}
                strokeLinecap="round"
                strokeDasharray={perimetro}
                strokeDashoffset={perimetro * (1 - limitado)}
                transform={`rotate(-90 ${centro} ${centro})`}
            />
        </Svg>
    );
}

/** Barras diárias com linha de média tracejada e balão no pico, como no mockup. */
function GraficoBarrasDiarias({ valores, picoRotulo, compacto = false }: { valores: number[]; picoRotulo: string; compacto?: boolean }) {
    const largura = 150;
    const altura = compacto ? 32 : 46;
    const max = Math.max(...valores, 1);
    const media = valores.reduce((a, b) => a + b, 0) / valores.length;
    const passo = largura / valores.length;
    const indicePico = valores.reduce((melhor, v, i, arr) => (v > arr[melhor] ? i : melhor), 0);
    const yMedia = altura - (media / max) * altura;
    const xPico = indicePico * passo + passo / 2;

    return (
        <View style={{ marginTop: compacto ? 6 : 10 }}>
            <View style={{ height: 20, position: "absolute", left: Math.min(Math.max(xPico - 26, 0), largura - 52), top: -22 }}>
                <View style={{ backgroundColor: "#1c2a5c", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 9, fontWeight: "700", color: CORES.branco }}>{picoRotulo}</Text>
                </View>
            </View>
            <Svg width="100%" height={altura} viewBox={`0 0 ${largura} ${altura}`}>
                <Line x1={0} y1={yMedia} x2={largura} y2={yMedia} stroke="rgba(255,255,255,0.18)" strokeWidth={1} strokeDasharray="3 3" />
                {valores.map((v, i) => {
                    const h = (v / max) * altura;
                    const destaque = i === indicePico;
                    return (
                        <Rect
                            key={i}
                            x={i * passo + passo * 0.2}
                            y={altura - h}
                            width={passo * 0.6}
                            height={h}
                            rx={1}
                            fill={destaque ? CORES.branco : CORES.azul}
                            opacity={destaque ? 1 : 0.85}
                        />
                    );
                })}
            </Svg>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                <Text style={{ fontSize: 9, color: CORES.textoMuted }}>1</Text>
                <Text style={{ fontSize: 9, color: CORES.textoMuted }}>10</Text>
                <Text style={{ fontSize: 9, color: CORES.textoMuted }}>20</Text>
                <Text style={{ fontSize: 9, color: CORES.textoMuted }}>31</Text>
            </View>
        </View>
    );
}

/** Donut de distribuição por matéria com o total de matérias no centro. */
function DonutMaterias({ materias, tamanho = 120 }: { materias: { nome: string; pct: number; cor: string }[]; tamanho?: number }) {
    const raio = tamanho * 0.375;
    const espessura = tamanho * 0.133;
    const centro = tamanho / 2;
    const circunferencia = 2 * Math.PI * raio;
    let acumulado = 0;
    const segmentos = materias
        .filter((m) => m.pct > 0)
        .map((m) => {
            const dash = (m.pct / 100) * circunferencia;
            const offset = -acumulado;
            acumulado += dash;
            return { ...m, dash, offset };
        });

    return (
        <View style={{ width: tamanho, height: tamanho }}>
            <Svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`}>
                <Circle cx={centro} cy={centro} r={raio} fill="none" stroke={CORES.trilha} strokeWidth={espessura} />
                {segmentos.map((s) => (
                    <Circle
                        key={s.nome}
                        cx={centro}
                        cy={centro}
                        r={raio}
                        fill="none"
                        stroke={s.cor}
                        strokeWidth={espessura}
                        strokeDasharray={`${s.dash} ${circunferencia}`}
                        strokeDashoffset={s.offset}
                        rotation={-90}
                        origin={`${centro}, ${centro}`}
                    />
                ))}
            </Svg>
            <View style={{ position: "absolute", left: 0, top: 0, width: tamanho, height: tamanho, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: tamanho * 0.167, fontWeight: "800", color: CORES.branco }}>{materias.length}</Text>
                <Text style={{ fontSize: tamanho * 0.075, fontWeight: "700", letterSpacing: 0.5, color: CORES.textoMuted }}>MATÉRIAS</Text>
            </View>
        </View>
    );
}
