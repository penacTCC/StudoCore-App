import { useEffect, useRef } from "react";
import { ScrollView, View, Text, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
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
}

/**
 * Roda de seleção estilo iOS: uma ScrollView com snapping em que o item central
 * fica em destaque. Usada no slide de aniversário do onboarding (dia · mês · ano).
 *
 * O destaque visual central e as bordas são desenhados pelo componente pai, que
 * sobrepõe uma faixa; aqui cuidamos só do scroll com snap e do peso tipográfico.
 */
export default function WheelPicker({ items, selectedIndex, onChange, flex = 1 }: WheelPickerProps) {
    const scrollRef = useRef<ScrollView>(null);

    // Mantém a roda alinhada quando o índice muda de fora (ex.: reset).
    useEffect(() => {
        scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false });
    }, [selectedIndex]);

    const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const y = e.nativeEvent.contentOffset.y;
        const index = Math.max(0, Math.min(items.length - 1, Math.round(y / ITEM_HEIGHT)));
        if (index !== selectedIndex) onChange(index);
    };

    const padding = (ITEM_HEIGHT * (VISIBLE - 1)) / 2;

    return (
        <View style={{ flex, height: ITEM_HEIGHT * VISIBLE }}>
            <ScrollView
                ref={scrollRef}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_HEIGHT}
                decelerationRate="fast"
                onMomentumScrollEnd={handleMomentumEnd}
                contentContainerStyle={{ paddingVertical: padding }}
            >
                {items.map((item, i) => {
                    const active = i === selectedIndex;
                    const adjacent = Math.abs(i - selectedIndex) === 1;
                    return (
                        <View
                            key={`${item}-${i}`}
                            style={{ height: ITEM_HEIGHT, alignItems: "center", justifyContent: "center" }}
                        >
                            <Text
                                style={{
                                    fontSize: active ? 27 : 24,
                                    fontWeight: active ? "800" : "500",
                                    color: active ? HADES.text : adjacent ? "#54565e" : HADES.textDim,
                                }}
                            >
                                {item}
                            </Text>
                        </View>
                    );
                })}
            </ScrollView>
        </View>
    );
}

export { ITEM_HEIGHT as WHEEL_ITEM_HEIGHT, VISIBLE as WHEEL_VISIBLE };
