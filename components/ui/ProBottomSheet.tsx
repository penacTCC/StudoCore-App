import React, { ComponentType, useEffect, useRef, useState } from "react";
import {
    Animated,
    Dimensions,
    Modal,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { router } from "expo-router";
import { HADES } from "@/constants/hades";
import {
    ArrowRightCircle,
    BarChart3,
    Clock,
    Compass,
    Crown,
    FileUp,
    FolderArchive,
    GitCompareArrows,
    ListChecks,
    Lock,
    MessageCircle,
    PartyPopper,
    Play,
    Sparkles,
    Swords,
    UserPlus,
    Users,
    X,
} from "@/components/ui/icons";
import { subscribePaywallPro, type PaywallProOptions } from "@/services/paywall";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_MAX_HEIGHT = Math.min(720, Math.round(SCREEN_HEIGHT * 0.86));

type IconType = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/** O que muda na tela conforme a funcionalidade que travou o usuário. */
const CONTEXTO_DO_RECURSO: Record<string, { icone: IconType; titulo: string; headline: string }> = {
    chat: {
        icone: MessageCircle,
        titulo: "Chat com o anexo",
        headline: "Pergunte qualquer coisa\nsobre esse arquivo.",
    },
    anexo: {
        icone: FileUp,
        titulo: "Análise de anexo por IA",
        headline: "Envie mais anexos\npara a IA analisar.",
    },
    roadmap: {
        icone: Compass,
        titulo: "Plano de estudos por IA",
        headline: "Gere um plano de estudos\nsob medida.",
    },
    quiz: {
        icone: Sparkles,
        titulo: "Quiz por IA",
        headline: "Pratique com quizzes\nilimitados.",
    },
    wrapped: {
        icone: PartyPopper,
        titulo: "Wrapped mensal",
        headline: "Veja o resumo completo\ndo seu mês.",
    },
    historico: {
        icone: Clock,
        titulo: "Histórico completo",
        headline: "Reabra todo o seu\nhistórico de sessões.",
    },
    analises: {
        icone: BarChart3,
        titulo: "Análises completas",
        headline: "Acompanhe sua evolução\nsem limite de dias.",
    },
    comparacao_perfil: {
        icone: GitCompareArrows,
        titulo: "Comparação de perfil",
        headline: "Compare seu perfil\ncom qualquer usuário.",
    },
    grupos: {
        icone: Users,
        titulo: "Grupos ilimitados",
        headline: "Crie quantos grupos\nprecisar.",
    },
    membros_por_grupo: {
        icone: UserPlus,
        titulo: "Mais vagas no grupo",
        headline: "Abra mais vagas\nnesse grupo.",
    },
    planos: {
        icone: ListChecks,
        titulo: "Planos de estudo",
        headline: "Crie quantos planos\nde estudo quiser.",
    },
    armazenamento: {
        icone: FolderArchive,
        titulo: "Mais espaço no Cofre",
        headline: "Amplie o espaço\ndo seu Cofre.",
    },
};

const CONTEXTO_PADRAO = {
    icone: Crown,
    titulo: "Recurso Pro",
    headline: "Esse recurso é\nexclusivo do Pro.",
};

const DESTAQUES = [
    { icone: MessageCircle, titulo: "Chat com o anexo", sub: "Perguntas e respostas sobre qualquer arquivo do Cofre" },
    { icone: Sparkles, titulo: "IA sem limite diário", sub: "Quiz pós-sessão e plano de estudos gerados por IA" },
    { icone: Swords, titulo: "Duelos ilimitados", sub: "Escolha o adversário, veja histórico e peça revanche" },
    { icone: FolderArchive, titulo: "Mais espaço no Cofre", sub: "Bem mais espaço que no plano Grátis" },
];

type ProBottomSheetProps = {
    visible: boolean;
    onClose: () => void;
    recurso?: string;
    mensagem?: string;
};

export function ProBottomSheet({ visible, onClose, recurso, mensagem }: ProBottomSheetProps) {
    const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const backdropOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(translateY, {
                    toValue: 0,
                    useNativeDriver: true,
                    damping: 22,
                    stiffness: 180,
                    mass: 0.9,
                }),
                Animated.timing(backdropOpacity, {
                    toValue: 1,
                    duration: 220,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [backdropOpacity, translateY, visible]);

    const closeSheet = () => {
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: SCREEN_HEIGHT,
                duration: 260,
                useNativeDriver: true,
            }),
            Animated.timing(backdropOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onClose();
        });
    };

    const contexto = (recurso && CONTEXTO_DO_RECURSO[recurso]) || CONTEXTO_PADRAO;
    const Icone = contexto.icone;

    const verPlano = () => {
        closeSheet();
        router.push("/(modals)/plano");
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={closeSheet}
        >
            <StatusBar barStyle="light-content" />

            <View style={styles.container}>
                <Animated.View
                    style={[
                        StyleSheet.absoluteFillObject,
                        styles.backdrop,
                        { opacity: backdropOpacity },
                    ]}
                >
                    <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
                </Animated.View>

                <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
                    <View style={styles.handle} />

                    <View style={styles.closeRow}>
                        <Pressable style={styles.closeButton} onPress={closeSheet} hitSlop={10}>
                            <X size={16} color={HADES.textMuted} />
                        </Pressable>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        bounces={false}
                        contentContainerStyle={styles.content}
                    >
                        {/* Feature travada */}
                        <View style={styles.featureRow}>
                            <View style={styles.featureIcon}>
                                <Icone size={20} color={HADES.accentSolid} />
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={styles.featureTitle}>{contexto.titulo}</Text>
                                <Text style={styles.featureSub}>Disponível no Pro</Text>
                            </View>
                            <Lock size={15} color={HADES.textDim} />
                        </View>

                        <Text style={styles.headline}>{contexto.headline}</Text>
                        <Text style={styles.description}>
                            {mensagem ?? "O Pro libera esse e outros recursos avançados para você estudar com mais estratégia."}
                        </Text>

                        {/* Destaques do Pro */}
                        <View style={styles.highlights}>
                            {DESTAQUES.map((d, i) => {
                                const DIcone = d.icone;
                                return (
                                    <View
                                        key={d.titulo}
                                        style={[styles.highlightRow, i > 0 && styles.highlightDivider]}
                                    >
                                        <DIcone size={17} color={HADES.accentSolid} />
                                        <View style={{ flex: 1, minWidth: 0 }}>
                                            <Text style={styles.highlightTitle}>{d.titulo}</Text>
                                            <Text style={styles.highlightSub}>{d.sub}</Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </ScrollView>

                    {/* CTA — leva para a tela de plano, onde fica o botão de compra real */}
                    <View style={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: 12 }}>
                        <Pressable
                            onPress={verPlano}
                            style={{
                                height: 54,
                                borderRadius: 15,
                                backgroundColor: HADES.accentSolid,
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 9,
                            }}
                        >
                            <Text style={{ fontSize: 16, fontWeight: "700", color: "#000" }}>
                                Ver plano pro
                            </Text>
                            <ArrowRightCircle size={22} color="#000" />
                        </Pressable>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

export function ProBottomSheetHost() {
    const [paywall, setPaywall] = useState<PaywallProOptions | null>(null);

    useEffect(() => subscribePaywallPro((options) => setPaywall(options)), []);

    if (!paywall) return null;

    return (
        <ProBottomSheet
            visible
            onClose={() => setPaywall(null)}
            recurso={paywall.recurso}
            mensagem={paywall.mensagem}
        />
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "flex-end",
    },
    backdrop: {
        backgroundColor: "rgba(0,0,0,0.72)",
    },
    sheet: {
        width: "100%",
        maxHeight: SHEET_MAX_HEIGHT,
        backgroundColor: HADES.surface,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: HADES.borderStrong,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.4,
        shadowRadius: 25,
        elevation: 30,
    },
    handle: {
        width: 38,
        height: 4,
        borderRadius: 3,
        backgroundColor: "rgba(255,255,255,0.16)",
        alignSelf: "center",
        marginTop: 12,
    },
    closeRow: {
        paddingHorizontal: 18,
        paddingTop: 6,
        flexDirection: "row",
        justifyContent: "flex-end",
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: HADES.surfaceRaised,
        alignItems: "center",
        justifyContent: "center",
    },
    content: {
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    featureRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 14,
        backgroundColor: HADES.surfaceRaised,
        borderWidth: 1,
        borderColor: HADES.border,
        borderRadius: 15,
    },
    featureIcon: {
        width: 42,
        height: 42,
        borderRadius: 12,
        backgroundColor: HADES.accentTint,
        alignItems: "center",
        justifyContent: "center",
    },
    featureTitle: {
        color: HADES.text,
        fontSize: 14,
        fontWeight: "700",
    },
    featureSub: {
        color: HADES.textMuted,
        fontSize: 12,
        marginTop: 2,
    },
    headline: {
        color: HADES.text,
        fontSize: 25,
        lineHeight: 31,
        fontWeight: "700",
        letterSpacing: -0.4,
        marginTop: 22,
        marginBottom: 8,
    },
    description: {
        color: HADES.textMuted,
        fontSize: 13.5,
        lineHeight: 20,
    },
    highlights: {
        marginTop: 20,
        borderRadius: 16,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: HADES.border,
    },
    highlightRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 13,
        backgroundColor: HADES.surfaceRaised,
    },
    highlightDivider: {
        borderTopWidth: 1,
        borderTopColor: HADES.border,
    },
    highlightTitle: {
        color: HADES.text,
        fontSize: 13.5,
        fontWeight: "600",
    },
    highlightSub: {
        color: HADES.textFaint,
        fontSize: 11.5,
        marginTop: 2,
    },
    compareRow: {
        marginTop: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        padding: 12,
        borderRadius: 13,
        borderWidth: 1,
        borderColor: HADES.border,
        backgroundColor: HADES.surfaceRaised,
    },
    compareText: {
        color: HADES.textSecondary,
        fontSize: 13,
        fontWeight: "600",
    },
    footer: {
        padding: 20,
        paddingBottom: 28,
        borderTopWidth: 1,
        borderTopColor: HADES.border,
        backgroundColor: HADES.surface,
    },
    button: {
        padding: 16,
        borderRadius: 15,
        backgroundColor: HADES.accentSolid,
        alignItems: "center",
        justifyContent: "center",
    },
    buttonPressed: {
        opacity: 0.88,
    },
    buttonText: {
        color: "#000000",
        fontSize: 15.5,
        fontWeight: "700",
        letterSpacing: -0.2,
    },
    footerNote: {
        textAlign: "center",
        color: HADES.textDim,
        fontSize: 11.5,
        marginTop: 11,
    },
});
