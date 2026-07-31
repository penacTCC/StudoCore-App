import { useEffect, useRef } from "react";
import { ScrollView, View, Text, Pressable, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { HADES } from "@/constants/hades";

const ITEM_HEIGHT = 52;
const VISIBLE = 5; // itens visíveis (2 acima + central + 2 abaixo)

export interface WheelPickerProps {
    /** Rótulos exibidos na roda. */
    items: string[];
    /** Índice selecionado (0-based). */
    selectedIndex: number;
    /** Chamado quando a roda para sobre um novo índice. */
    onChange: (index: number) => void;
    /** Peso relativo da coluna (flex). Padrão: 1. */
    flex?: number;
    /** Altura de cada item. Padrão: 52. */
    itemHeight?: number;
    /** Quantos itens cabem na janela (ímpar). Padrão: 5. */
    visible?: number;
    /** Cor do item central. Padrão: acento (laranja). */
    corAtiva?: string;
    /** Corpo do item central. Padrão: 27. */
    fonteAtiva?: number;
    /** Corpo dos demais itens. Padrão: 24. */
    fonteInativa?: number;
}

/**
 * Roda de seleção estilo iOS: uma ScrollView com snapping em que o item central
 * fica em destaque. Usada no aniversário do onboarding (dia · mês · ano) e nas
 * folhas de pomodoro/horário do cronograma.
 *
 * O item central é marcado só pela cor de acento — sem faixa nem borda em volta;
 * os demais ficam em cinza. Aqui cuidamos do scroll com snap e da tipografia.
 */
export default function WheelPicker({
    items,
    selectedIndex,
    onChange,
    flex = 1,
    itemHeight = ITEM_HEIGHT,
    visible = VISIBLE,
    corAtiva = HADES.accentSolid,
    fonteAtiva = 27,
    fonteInativa = 24,
}: WheelPickerProps) {
    const scrollRef = useRef<ScrollView>(null);
    // Índice que a roda já está mostrando. Sem isso, o scrollTo do efeito abaixo
    // dispara em resposta ao nosso próprio onChange e briga com o gesto do dedo.
    const indiceNaRoda = useRef(selectedIndex);
    const posicionada = useRef(false);

    // Mantém a roda alinhada quando o índice muda de fora (ex.: reset).
    useEffect(() => {
        if (indiceNaRoda.current === selectedIndex) return;
        indiceNaRoda.current = selectedIndex;
        scrollRef.current?.scrollTo({ y: selectedIndex * itemHeight, animated: posicionada.current });
    }, [selectedIndex, itemHeight]);

    // Dentro de <Modal> o conteúdo só ganha altura depois da montagem, então o
    // scrollTo do efeito acima vira no-op: reposiciona quando o conteúdo mede.
    const posicionarInicial = () => {
        if (posicionada.current) return;
        posicionada.current = true;
        scrollRef.current?.scrollTo({ y: indiceNaRoda.current * itemHeight, animated: false });
    };

    const aplicarOffset = (y: number) => {
        const index = Math.max(0, Math.min(items.length - 1, Math.round(y / itemHeight)));
        indiceNaRoda.current = index;
        if (index !== selectedIndex) onChange(index);
    };

    const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        aplicarOffset(e.nativeEvent.contentOffset.y);
    };

    // Arraste curto e lento não gera momentum em todas as plataformas — sem isto
    // o onChange nunca chega quando o usuário move só um item por vez.
    const handleDragEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (Math.abs(e.nativeEvent.velocity?.y ?? 0) > 0.05) return;
        aplicarOffset(e.nativeEvent.contentOffset.y);
    };

    const selecionarPorToque = (index: number) => {
        indiceNaRoda.current = index;
        scrollRef.current?.scrollTo({ y: index * itemHeight, animated: true });
        if (index !== selectedIndex) onChange(index);
    };

    const padding = (itemHeight * (visible - 1)) / 2;

    return (
        <View style={{ flex, height: itemHeight * visible }}>
            <ScrollView
                ref={scrollRef}
                showsVerticalScrollIndicator={false}
                snapToInterval={itemHeight}
                disableIntervalMomentum
                decelerationRate="fast"
                onMomentumScrollEnd={handleMomentumEnd}
                onScrollEndDrag={handleDragEnd}
                onContentSizeChange={posicionarInicial}
                contentContainerStyle={{ paddingVertical: padding }}
                nestedScrollEnabled
            >
                {items.map((item, i) => {
                    const active = i === selectedIndex;
                    return (
                        <Pressable
                            key={`${item}-${i}`}
                            onPress={() => selecionarPorToque(i)}
                            style={{ height: itemHeight, alignItems: "center", justifyContent: "center" }}
                        >
                            <Text
                                style={{
                                    fontSize: active ? fonteAtiva : fonteInativa,
                                    fontWeight: active ? "800" : "500",
                                    color: active ? corAtiva : HADES.textDim,
                                }}
                            >
                                {item}
                            </Text>
                        </Pressable>
                    );
                })}
            </ScrollView>
        </View>
    );
}

export { ITEM_HEIGHT as WHEEL_ITEM_HEIGHT, VISIBLE as WHEEL_VISIBLE };
