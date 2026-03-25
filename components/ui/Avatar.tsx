import { View, Text, Image } from "react-native";
import { getAvatarColor } from "@/constants/helpers";

interface AvatarProps {
    foto?: string;
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
    size = 40,
    showOnlineDot
}: AvatarProps) {
    return (
        <View className="relative">
            <View
                className="rounded-full items-center justify-center overflow-hidden"
                style={{
                    width: size,
                    height: size,
                    backgroundColor: "#191919",
                }}
            >
                <Image
                    source={{ uri: foto || "https://towardly-insensately-mose.ngrok-free.dev/storage/v1/object/public/images/user2.png" }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                />
            </View>
            {showOnlineDot && (
                <View className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full" />
            )}
        </View>
    );
}
