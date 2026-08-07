import { View, Text, Image, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Bell, ChevronLeft, FileText, Heart, MessageCircle, CalendarDays } from "lucide-react-native";

import Avatar from "@/components/ui/Avatar";
import { Skeleton, SkeletonCircle } from "@/components/ui/Skeleton";
import { tempoRelativo } from "@/components/comunidade/CardPublicacao";
import { HADES } from "@/constants/hades";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import type { Notificacao } from "@/types/notificacoes";

/**
 * Caixa de notificações do feed público.
 *
 * É de leitura, não de ação: mostra quem curtiu e quem comentou nas SUAS publicações, em
 * ordem cronológica. Não tem "responder" nem "abrir publicação" porque o Explorar não tem
 * tela de publicação isolada — a conversa continua na folha de comentários do card, que é
 * onde ela já vive.
 *
 * Abrir a tela zera o badge (ver useNotificacoes), mas a marca de "nova" fica nas linhas
 * desta visita: some o alerta, não a informação.
 */
export default function NotificacoesScreen() {
    const {
        itens,
        naoLidaNaEntrada,
        carregando,
        atualizando,
        carregandoMais,
        temMais,
        erro,
        atualizar,
        tentarDeNovo,
        carregarMais,
    } = useNotificacoes();

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.settingsBg }} edges={["top"]}>
            <View
                style={{
                    paddingTop: 6,
                    paddingHorizontal: 20,
                    paddingBottom: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                }}
            >
                <TouchableOpacity
                    onPress={() => router.back()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <ChevronLeft size={22} color={HADES.textSecondary} />
                </TouchableOpacity>
                <Text style={{ fontSize: 20, fontWeight: "700", color: HADES.text }}>
                    Notificações
                </Text>
            </View>

            {carregando ? (
                <View style={{ paddingHorizontal: 20, gap: 18 }}>
                    {[0, 1, 2, 3].map((i) => (
                        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                            <SkeletonCircle size={40} hades />
                            <View style={{ gap: 6 }}>
                                <Skeleton width={180} height={13} hades />
                                <Skeleton width={110} height={11} hades />
                            </View>
                        </View>
                    ))}
                </View>
            ) : erro ? (
                <View style={{ alignItems: "center", paddingTop: 80, paddingHorizontal: 30 }}>
                    <Text style={{ fontSize: 14, color: HADES.textMuted, textAlign: "center" }}>
                        Não deu para carregar suas notificações.
                    </Text>
                    <TouchableOpacity
                        onPress={tentarDeNovo}
                        activeOpacity={0.8}
                        style={{
                            marginTop: 16,
                            paddingHorizontal: 18,
                            paddingVertical: 9,
                            borderRadius: 9,
                            backgroundColor: HADES.surfaceRaised,
                            borderWidth: 1,
                            borderColor: HADES.borderStrong,
                        }}
                    >
                        <Text style={{ fontSize: 13, fontWeight: "600", color: HADES.text }}>
                            Tentar de novo
                        </Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={itens}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ paddingBottom: 32 }}
                    refreshControl={
                        <RefreshControl
                            refreshing={atualizando}
                            onRefresh={atualizar}
                            tintColor={HADES.accentSolid}
                        />
                    }
                    onEndReachedThreshold={0.4}
                    onEndReached={carregarMais}
                    ListEmptyComponent={
                        <View style={{ alignItems: "center", paddingTop: 80, paddingHorizontal: 30 }}>
                            <Bell size={30} color={HADES.dot} />
                            <Text
                                style={{
                                    fontSize: 14,
                                    color: HADES.textMuted,
                                    marginTop: 14,
                                    textAlign: "center",
                                }}
                            >
                                Nada por aqui ainda.
                            </Text>
                            <Text
                                style={{
                                    fontSize: 12.5,
                                    color: HADES.textDim,
                                    marginTop: 6,
                                    textAlign: "center",
                                    lineHeight: 19,
                                }}
                            >
                                Curtidas e comentários nas suas publicações do Explorar aparecem
                                nesta lista.
                            </Text>
                        </View>
                    }
                    ListFooterComponent={
                        carregandoMais ? (
                            <ActivityIndicator
                                color={HADES.textDim}
                                style={{ marginTop: 18 }}
                            />
                        ) : !temMais && itens.length > 0 ? (
                            <Text
                                style={{
                                    fontSize: 11.5,
                                    color: HADES.textDim,
                                    textAlign: "center",
                                    marginTop: 20,
                                }}
                            >
                                Isso é tudo.
                            </Text>
                        ) : null
                    }
                    renderItem={({ item }) => (
                        <LinhaNotificacao item={item} nova={naoLidaNaEntrada(item.id)} />
                    )}
                />
            )}
        </SafeAreaView>
    );
}

function LinhaNotificacao({ item, nova }: { item: Notificacao; nova: boolean }) {
    const curtida = item.tipo === "curtida";

    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 12,
                paddingVertical: 13,
                paddingHorizontal: 20,
                // A faixa das novas é o único destaque: sem ponto, sem negrito extra —
                // a lista inteira já é curta.
                backgroundColor: nova ? HADES.accentTint : "transparent",
                borderBottomWidth: 1,
                borderBottomColor: HADES.borderSettings,
            }}
        >
            <View>
                <Avatar foto={item.autor.foto} nome={item.autor.nome} size={40} />
                {/* O selo diz o que aconteceu antes de a pessoa ler a frase inteira. */}
                <View
                    style={{
                        position: "absolute",
                        bottom: -2,
                        right: -3,
                        width: 19,
                        height: 19,
                        borderRadius: 10,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: curtida ? HADES.red : HADES.blue,
                        borderWidth: 2,
                        borderColor: HADES.settingsBg,
                    }}
                >
                    {curtida ? (
                        <Heart size={9} color="#fff" fill="#fff" />
                    ) : (
                        <MessageCircle size={9} color="#fff" fill="#fff" />
                    )}
                </View>
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 13.5, color: HADES.textSecondary, lineHeight: 19 }}>
                    <Text style={{ fontWeight: "700", color: HADES.text }}>{item.autor.nome}</Text>
                    {curtida ? " curtiu " : " comentou em "}
                    {descreverAlvo(item)}
                </Text>

                {item.texto && (
                    <Text
                        numberOfLines={2}
                        style={{
                            fontSize: 12.5,
                            color: HADES.textMuted,
                            marginTop: 4,
                            fontStyle: "italic",
                            lineHeight: 18,
                        }}
                    >
                        “{item.texto}”
                    </Text>
                )}

                <Text style={{ fontSize: 11.5, color: HADES.textDim, marginTop: 5 }}>
                    {tempoRelativo(item.criadoEm)}
                </Text>
            </View>

            <MiniaturaDaPublicacao item={item} />
        </View>
    );
}

/** "sua foto de Matemática", "seu arquivo Resumo.pdf", "seu plano Semana de provas". */
function descreverAlvo(item: Notificacao): string {
    if (item.origem === "galeria") {
        return item.resumo ? `sua foto de ${item.resumo}.` : "sua foto de estudo.";
    }
    if (item.origem === "arquivo") {
        return item.resumo ? `seu arquivo ${item.resumo}.` : "seu arquivo.";
    }
    return item.resumo ? `seu plano ${item.resumo}.` : "seu plano.";
}

/**
 * O canto direito da linha: a foto da sessão quando existe, um ícone da origem quando não.
 *
 * Serve para reconhecer QUAL publicação recebeu a interação, que é a primeira pergunta de
 * quem publica mais de uma coisa por dia.
 */
function MiniaturaDaPublicacao({ item }: { item: Notificacao }) {
    if (item.origem === "galeria" && item.fotoUrl) {
        return (
            <Image
                source={{ uri: item.fotoUrl }}
                style={{ width: 42, height: 42, borderRadius: 8, backgroundColor: HADES.surface }}
            />
        );
    }

    const Icone = item.origem === "plano" ? CalendarDays : FileText;

    return (
        <View
            style={{
                width: 42,
                height: 42,
                borderRadius: 8,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: HADES.surfaceRaised,
                borderWidth: 1,
                borderColor: HADES.borderSettings,
            }}
        >
            <Icone size={17} color={HADES.textFaint} />
        </View>
    );
}
