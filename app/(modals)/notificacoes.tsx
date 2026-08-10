import { View, Text, Image, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "@/components/ui/TelaSegura";
import { router } from "expo-router";
import {
    Bell,
    CalendarDays,
    ChevronLeft,
    FileText,
    Flame,
    Heart,
    MessageCircle,
    UserPlus,
    Users,
} from "@/components/ui/icons";

import Avatar from "@/components/ui/Avatar";
import { Skeleton, SkeletonCircle } from "@/components/ui/Skeleton";
import { tempoRelativo } from "@/components/comunidade/CardPublicacao";
import { HADES } from "@/constants/hades";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import type { Notificacao, TipoNotificacao } from "@/types/notificacoes";

/**
 * Caixa de notificações do app.
 *
 * É de leitura, não de ação: mostra, em ordem cronológica, o que aconteceu com as suas
 * coisas — curtida, comentário, força recebida, gente nova no grupo, sala de foco aberta.
 * Não tem "responder" nem "abrir publicação" porque o Explorar não tem tela de publicação
 * isolada — a conversa continua na folha de comentários do card, que é onde ela já vive.
 *
 * O que NÃO chega aqui são os avisos locais (lembrete do cronograma, ofensiva em risco,
 * cronômetro parado): eles valem por minutos e não sobrevivem a uma releitura.
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
                <View>
                    {[0, 1, 2, 3].map((i) => (
                        <View
                            key={i}
                            style={{
                                flexDirection: "row",
                                alignItems: "flex-start",
                                gap: 12,
                                paddingVertical: 13,
                                paddingHorizontal: 20,
                                borderBottomWidth: 1,
                                borderBottomColor: HADES.borderSettings,
                            }}
                        >
                            <SkeletonCircle size={40} hades />
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <Skeleton width="90%" height={13.5} hades />
                                <Skeleton width="55%" height={13.5} hades style={{ marginTop: 5 }} />
                                <Skeleton width={70} height={11.5} hades style={{ marginTop: 6 }} />
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
                                Curtidas, comentários, forças recebidas e novidades do seu
                                grupo aparecem nesta lista.
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

/**
 * O selo e a frase de cada tipo, num lugar só.
 *
 * Ficam numa tabela, e não numa cadeia de `if`, porque tipo novo é o que mais muda nesta
 * tela: acrescentar uma entrada aqui é o bastante para a linha aparecer certa, e o
 * TypeScript cobra a entrada que faltar (o Record é sobre `TipoNotificacao` inteiro).
 */
const SELO: Record<TipoNotificacao, { Icone: typeof Heart; cor: string; solido?: boolean }> = {
    // `solido` preenche o traço: a 9px, coração e balão só se reconhecem cheios. Chama e
    // bonequinho, ao contrário, viram uma mancha branca se preenchidos — ficam de traço.
    curtida: { Icone: Heart, cor: HADES.red, solido: true },
    comentario: { Icone: MessageCircle, cor: HADES.blue, solido: true },
    forca: { Icone: Flame, cor: HADES.accentSolid },
    novo_membro: { Icone: UserPlus, cor: HADES.green },
    sala_aberta: { Icone: Users, cor: HADES.amber },
};

function LinhaNotificacao({ item, nova }: { item: Notificacao; nova: boolean }) {
    const { Icone: IconeSelo, cor: corSelo, solido } = SELO[item.tipo];

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
                        backgroundColor: corSelo,
                        borderWidth: 2,
                        borderColor: HADES.settingsBg,
                    }}
                >
                    <IconeSelo size={solido ? 9 : 11} color="#fff" fill={solido ? "#fff" : "none"} />
                </View>
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 13.5, color: HADES.textSecondary, lineHeight: 19 }}>
                    <Text style={{ fontWeight: "700", color: HADES.text }}>{item.autor.nome}</Text>
                    {descreverAcao(item)}
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

/**
 * O que vem depois do nome: " curtiu sua foto de Matemática.", " entrou no Turma do ENEM.".
 *
 * O nome do autor já foi escrito em negrito pela linha, então tudo aqui começa com espaço
 * e é a continuação da mesma frase.
 */
function descreverAcao(item: Notificacao): string {
    switch (item.tipo) {
        case "curtida":
            return ` curtiu ${descreverPublicacao(item)}`;
        case "comentario":
            return ` comentou em ${descreverPublicacao(item)}`;
        case "forca":
            return item.resumo
                ? ` mandou força na sua sessão de ${item.resumo}.`
                : " mandou força pra você.";
        case "novo_membro":
            return item.resumo ? ` entrou no ${item.resumo}.` : " entrou no seu grupo.";
        case "sala_aberta":
            return item.resumo
                ? ` abriu uma sala de foco no ${item.resumo}.`
                : " abriu uma sala de foco no seu grupo.";
    }
}

/** "sua foto de Matemática", "seu arquivo Resumo.pdf", "seu plano Semana de provas". */
function descreverPublicacao(item: Notificacao): string {
    if (item.origem === "galeria") {
        return item.resumo ? `sua foto de ${item.resumo}.` : "sua foto de estudo.";
    }
    if (item.origem === "arquivo") {
        return item.resumo ? `seu arquivo ${item.resumo}.` : "seu arquivo.";
    }
    return item.resumo ? `seu plano ${item.resumo}.` : "seu plano.";
}

/**
 * O canto direito da linha: a foto da sessão quando existe, um ícone do alvo quando não.
 *
 * Serve para reconhecer O QUE a notificação toca — qual publicação recebeu a interação,
 * que é a primeira pergunta de quem publica mais de uma coisa por dia, e qual grupo se
 * mexeu para quem está em mais de um.
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

    const Icone = iconeDoAlvo(item);

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

/** O ícone que substitui a miniatura: o do grupo, o da sessão, ou o da publicação. */
function iconeDoAlvo(item: Notificacao) {
    if (item.categoria === "grupo") return Users;
    if (item.categoria === "foco") return Flame;
    return item.origem === "plano" ? CalendarDays : FileText;
}
