import { View, Text } from "react-native";
import { getAvatarColor } from "@/constants/helpers";

interface AvatarProps {
    foto: string;
    /** Índice para determinar a cor de fundo (via getAvatarColor) */
    colorIndex: number;
    /** Tamanho em px. Padrão: 40 */
    size?: number;
    /** Exibe ponto verde de "online" no canto inferior direito. Padrão: false */
    showOnlineDot?: boolean;
}

/**
 * Avatar circular com iniciais coloridas.
 * Reutilizado em: index.tsx, browse-groups.tsx, group-details.tsx, detailing.tsx
 */
export default function Avatar({
    foto,
    colorIndex,
    size = 40,
    showOnlineDot = false,
}: AvatarProps) {
    return (
        <View className="relative">
            <View
                className="rounded-full items-center justify-center"
                style={{
                    width: size,
                    height: size,
                    backgroundColor: getAvatarColor(colorIndex),
                }}
            >
                <Text
                    className="text-white font-bold"
                    style={{ fontSize: size * 0.35 }}
                >
                    {foto}
                </Text>
            </View>
            {showOnlineDot && (
                <View className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full" />
            )}
        </View>
    );
}
