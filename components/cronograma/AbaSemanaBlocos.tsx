import { useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, Pressable, findNodeHandle, UIManager } from "react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    useAnimatedScrollHandler,
    withSpring,
    runOnJS,
    type SharedValue,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Plus, Trash2, Coffee } from "lucide-react-native";
import { HADES } from "@/constants/hades";
import { diasDaSemanaLista } from "@/constants/cronograma-mock";
import type { BlocoListaDia } from "@/types/cronograma";
import { confirm } from "@/services/confirm";

const LARGURA_COLUNA = 158;
const GAP_COLUNA = 12;
const PADDING_HORIZONTAL = 20;

type Props = {
    blocos: BlocoListaDia[];
    totais: { materia: string; cor: string; total: string }[];
    totalSemanal: string;
    conflitos: Map<string, string>;
    onAdicionarBloco: (dia: number) => void;
    onEditarBloco: (blocoId: string) => void;
    onExcluirBloco: (blocoId: string) => void;
    onMoverBloco: (blocoId: string, novoDia: number) => void;
};

export default function AbaSemanaBlocos({
    blocos,
    totais,
    totalSemanal,
    conflitos,
    onAdicionarBloco,
    onEditarBloco,
    onExcluirBloco,
    onMoverBloco,
}: Props) {
    // Posição de scroll horizontal (compartilhada com os cartões, pra saber sobre
    // qual coluna de dia o dedo está durante o arrasto) e origem da ScrollView na
    // tela (medida uma vez, usada pra converter coordenadas absolutas em "espaço
    // de conteúdo"). coluna-alvo fica em -1 quando nada está sendo arrastado.
    const scrollX = useSharedValue(0);
    const origemX = useSharedValue(0);
    const colunaAlvo = useSharedValue(-1);
    const scrollViewRef = useRef<Animated.ScrollView>(null);

    const aoRolar = useAnimatedScrollHandler((evento) => {
        scrollX.value = evento.contentOffset.x;
    });

    const medirOrigem = () => {
        const node = findNodeHandle(scrollViewRef.current);
        if (!node) return;
        UIManager.measureInWindow(node, (x) => {
            origemX.value = x;
        });
    };

    const confirmarExclusao = (blocoId: string, rotulo: string) => {
        confirm({
            title: "Excluir bloco",
            message: `Remover "${rotulo}" da rotina semanal?`,
            confirmText: "Excluir",
            destructive: true,
            onConfirm: () => onExcluirBloco(blocoId),
        });
    };

    return (
        <View style={{ flex: 1 }}>
            <Animated.ScrollView
                ref={scrollViewRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: PADDING_HORIZONTAL, gap: GAP_COLUNA }}
                onLayout={medirOrigem}
                onScroll={aoRolar}
                scrollEventThrottle={16}
            >
                {diasDaSemanaLista.map((dia, i) => (
                    <View key={dia} style={{ width: LARGURA_COLUNA }}>
                        <ColunaCabecalho dia={dia} indice={i} colunaAlvo={colunaAlvo} />

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            style={{ marginTop: 12 }}
                            contentContainerStyle={{ gap: 10, paddingBottom: 16 }}
                        >
                            {blocos
                                .filter((b) => b.dia === i)
                                .map((bloco) => (
                                    <CartaoBlocoArrastavel
                                        key={bloco.id}
                                        bloco={bloco}
                                        scrollX={scrollX}
                                        origemX={origemX}
                                        colunaAlvo={colunaAlvo}
                                        onEditar={onEditarBloco}
                                        conflitaCom={conflitos.get(bloco.id)}
                                        onExcluir={() =>
                                            confirmarExclusao(
                                                bloco.id,
                                                bloco.tipo === "descanso"
                                                    ? "Descanso"
                                                    : bloco.topico.trim() ? bloco.topico : bloco.materia
                                            )
                                        }
                                        onMover={onMoverBloco}
                                    />
                                ))}

                            {blocos.filter((b) => b.dia === i).length === 0 && (
                                <Text
                                    style={{
                                        fontSize: 11.5,
                                        color: HADES.textFaint,
                                        textAlign: "center",
                                        marginBottom: 8,
                                    }}
                                >
                                    Sem blocos neste dia
                                </Text>
                            )}

                            <TouchableOpacity
                                onPress={() => onAdicionarBloco(i)}
                                activeOpacity={0.7}
                                style={{
                                    height: 74,
                                    borderWidth: 1.5,
                                    borderStyle: "dashed",
                                    borderColor: HADES.borderDashed,
                                    borderRadius: 13,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <Plus size={18} color={HADES.textFaint} />
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                ))}
            </Animated.ScrollView>

            {/* Total semanal */}
            <View
                style={{
                    borderTopWidth: 1,
                    borderTopColor: "rgba(255,255,255,0.07)",
                    paddingTop: 14,
                    paddingBottom: 10,
                    paddingHorizontal: 20,
                }}
            >
                <Text
                    style={{
                        fontSize: 11,
                        color: HADES.textFaint,
                        fontWeight: "700",
                        letterSpacing: 0.8,
                        marginBottom: 10,
                    }}
                >
                    TOTAL SEMANAL · {totalSemanal.toUpperCase()}
                </Text>
                {totais.length === 0 ? (
                    <Text style={{ fontSize: 12, color: HADES.textFaint }}>
                        Adicione blocos de estudo pra ver o total por matéria aqui.
                    </Text>
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                        {totais.map((t) => (
                            <View
                                key={t.materia}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 7,
                                    backgroundColor: HADES.surface,
                                    borderWidth: 1,
                                    borderColor: HADES.border,
                                    borderRadius: 18,
                                    paddingVertical: 7,
                                    paddingHorizontal: 12,
                                }}
                            >
                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.cor }} />
                                <Text style={{ fontSize: 12, color: HADES.textSecondary, fontWeight: "600" }}>
                                    {t.materia}
                                </Text>
                                <Text style={{ fontSize: 12, color: t.cor, fontWeight: "700" }}>{t.total}</Text>
                            </View>
                        ))}
                    </ScrollView>
                )}
            </View>
        </View>
    );
}

/** Cabeçalho da coluna do dia — acende quando é o alvo do arrasto em andamento. */
function ColunaCabecalho({
    dia,
    indice,
    colunaAlvo,
}: {
    dia: string;
    indice: number;
    colunaAlvo: SharedValue<number>;
}) {
    const estiloAnimado = useAnimatedStyle(() => {
        const ativo = colunaAlvo.value === indice;
        return {
            backgroundColor: ativo ? `${HADES.accentSolid}26` : HADES.surface,
            borderColor: ativo ? HADES.accentSolid : HADES.border,
        };
    });

    return (
        <Animated.View
            style={[
                {
                    borderWidth: 1,
                    borderRadius: 10,
                    paddingVertical: 8,
                    alignItems: "center",
                },
                estiloAnimado,
            ]}
        >
            <Text
                style={{
                    fontSize: 12,
                    fontWeight: "700",
                    letterSpacing: 1,
                    color: HADES.textSecondary,
                }}
            >
                {dia}
            </Text>
        </Animated.View>
    );
}

/**
 * Cartão de bloco que também é arrastável: pressionar e segurar (e só depois
 * disso arrastar) move o cartão pra cima do conteúdo e reporta em qual coluna
 * de dia o dedo está soltando. Um toque simples continua abrindo a edição —
 * o gesto só "ativa" depois do long-press, então não briga com o Pressable.
 */
function CartaoBlocoArrastavel({
    bloco,
    scrollX,
    origemX,
    colunaAlvo,
    conflitaCom,
    onEditar,
    onExcluir,
    onMover,
}: {
    bloco: BlocoListaDia;
    scrollX: SharedValue<number>;
    origemX: SharedValue<number>;
    colunaAlvo: SharedValue<number>;
    conflitaCom?: string;
    onEditar: (blocoId: string) => void;
    onExcluir: () => void;
    onMover: (blocoId: string, novoDia: number) => void;
}) {
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const escala = useSharedValue(1);
    const arrastando = useSharedValue(false);

    const soltar = (novoDia: number) => {
        if (novoDia !== bloco.dia) {
            onMover(bloco.id, novoDia);
        }
    };

    const gesto = Gesture.Pan()
        .activateAfterLongPress(280)
        .onStart(() => {
            arrastando.value = true;
            escala.value = withSpring(1.05);
        })
        .onUpdate((evento) => {
            translateX.value = evento.translationX;
            translateY.value = evento.translationY;

            const xConteudo = evento.absoluteX - origemX.value + scrollX.value - PADDING_HORIZONTAL;
            const coluna = Math.floor(xConteudo / (LARGURA_COLUNA + GAP_COLUNA));
            colunaAlvo.value = Math.min(6, Math.max(0, coluna));
        })
        .onEnd(() => {
            runOnJS(soltar)(colunaAlvo.value);
        })
        .onFinalize(() => {
            translateX.value = withSpring(0);
            translateY.value = withSpring(0);
            escala.value = withSpring(1);
            arrastando.value = false;
            colunaAlvo.value = -1;
        });

    const estiloAnimado = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: escala.value },
        ],
        zIndex: arrastando.value ? 50 : 0,
        elevation: arrastando.value ? 12 : 0,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: arrastando.value ? 0.4 : 0,
        shadowRadius: 14,
        opacity: arrastando.value ? 0.97 : 1,
    }));

    const temTopico = bloco.topico.trim().length > 0;
    const descanso = bloco.tipo === "descanso";

    return (
        <GestureDetector gesture={gesto}>
            <Animated.View
                style={[
                    {
                        backgroundColor: descanso ? "rgba(48,209,88,0.10)" : `${bloco.cor}32`,
                        borderWidth: 1,
                        borderColor: descanso ? "rgba(48,209,88,0.35)" : `${bloco.cor}59`,
                        borderLeftWidth: 3,
                        borderLeftColor: descanso ? HADES.green : bloco.cor,
                        borderRadius: 13,
                        padding: 9,
                        paddingVertical: 22,
                    },
                    estiloAnimado,
                ]}
            >
                <Pressable onPress={() => onEditar(bloco.id)}>
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: 8,
                        }}
                    >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                            {descanso && <Coffee size={13} color={HADES.green} />}
                            <Text
                                style={{
                                    fontSize: 14,
                                    fontWeight: "700",
                                    color: temTopico ? HADES.text : bloco.cor,
                                    lineHeight: 18,
                                    flex: 1,
                                }}
                            >
                                {temTopico ? bloco.topico : bloco.materia}
                            </Text>
                        </View>
                        <Text
                            style={{
                                fontSize: 11,
                                fontWeight: "700",
                                color: HADES.text,
                                backgroundColor: "rgba(0,0,0,0.4)",
                                borderRadius: 7,
                                paddingVertical: 2,
                                paddingHorizontal: 7,
                            }}
                        >
                            {bloco.duracaoRotulo}
                        </Text>
                    </View>
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginTop: 14,
                        }}
                    >
                        {temTopico ? (
                            <Text style={{ fontSize: 12, fontWeight: "600", color: bloco.cor }}>
                                {bloco.materia}
                            </Text>
                        ) : (
                            <Text style={{ fontSize: 12, fontWeight: "600", color: HADES.textFaint }}>
                                {bloco.horaInicio}
                            </Text>
                        )}
                        <TouchableOpacity
                            onPress={onExcluir}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Trash2 size={14} color={HADES.textFaint} />
                        </TouchableOpacity>
                    </View>
                    {conflitaCom && (
                        <Text style={{ fontSize: 11, color: HADES.amber, marginTop: 8 }}>
                            ⚠ Conflita com {conflitaCom}
                        </Text>
                    )}
                </Pressable>
            </Animated.View>
        </GestureDetector>
    );
}
