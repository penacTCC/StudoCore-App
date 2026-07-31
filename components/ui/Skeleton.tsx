import { StyleProp, View, ViewStyle, DimensionValue } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { COLORS } from '@/constants/colors';
import { HADES } from '@/constants/hades';

type SkeletonProps = {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  /** Telas já migradas pro redesign HADES devem passar `hades`, seguindo o padrão opt-in dos primitivos compartilhados. */
  hades?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Bloco base de loading (placeholder pulsante). Componha vários pra montar o
 * skeleton de uma tela, imitando as dimensões do conteúdo real.
 */
export function Skeleton({ width = '100%', height = 16, borderRadius = 8, hades = false, style }: SkeletonProps) {
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 750, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.35, { duration: 750, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: hades ? HADES.surfaceOverlay : COLORS.bgQuaternary,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

/** Placeholder circular pra avatares/ícones. */
export function SkeletonCircle({ size = 40, hades = false, style }: { size?: number; hades?: boolean; style?: StyleProp<ViewStyle> }) {
  return <Skeleton width={size} height={size} borderRadius={size / 2} hades={hades} style={style} />;
}

/** Placeholder de uma linha de texto. */
export function SkeletonText({
  width = '100%',
  height = 12,
  hades = false,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  hades?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return <Skeleton width={width} height={height} borderRadius={height / 2} hades={hades} style={style} />;
}

/** Container simples pra empilhar blocos de skeleton com espaçamento. */
export function SkeletonStack({
  gap = 8,
  style,
  children,
}: {
  gap?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  return <View style={[{ gap }, style]}>{children}</View>;
}
