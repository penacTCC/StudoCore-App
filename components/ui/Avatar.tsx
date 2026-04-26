import { View, Text, Image } from "react-native";
import { getAvatarColor } from "@/constants/helpers";

interface AvatarProps {
    foto?: string;
    nome?: string;
    /** Tamanho em px. Padrão: 40 */
    size?: number;
    /** Exibe ponto verde de "online" no canto inferior direito. Padrão: false */
    showOnlineDot?: boolean;
}

/**
 * Avatar circular com imagem ou fallback padrão.
 * Reutilizado em: index.tsx, browse-groups.tsx, group-details.tsx, detailing.tsx
 */
export default function Avatar({
    foto,
    nome,
    size = 40,
    showOnlineDot
}: AvatarProps) {
    const initials = nome 
        ? nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
        : '?';

    const colorIndex = nome ? nome.charCodeAt(0) % 5 : 0;
    const bgColor = foto ? "#191919" : getAvatarColor(colorIndex);
    return (
        <View className="relative">
            <View
                className="rounded-full items-center justify-center overflow-hidden"
                style={{
                    width: size,
                    height: size,
                    backgroundColor: bgColor,
                }}
            >
                {foto ? (
                    <Image
                        source={{ uri: foto }}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode="cover"
                    />
                ) : (
                    <Text className="text-white font-bold" style={{ fontSize: size * 0.4 }}>
                        {initials}
                    </Text>
                )}
            </View>
            {showOnlineDot && (
                <View className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full" />
            )}
        </View>
    );
}
