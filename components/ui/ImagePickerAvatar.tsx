import { useState, useEffect } from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { Plus, Users } from "lucide-react-native";
import { COLORS } from "@/constants/colors";
import { HADES } from "@/constants/hades";
import { escolherEEnviarImagem } from "@/services/imagens";
import { toast } from "@/services/toast";

type ImagePickerAvatarProps = {
    /** Bucket do Supabase Storage onde a imagem será enviada. Padrão: 'images' */
    bucket?: string;
    /** Chamado com a URL pública da imagem após upload bem-sucedido */
    onImageUploaded: (url: string) => void;
    /** Define se o avatar deve ser circular ou retangular. Padrão: true */
    circle?: boolean;
    /** Imagem para carregar previamente */
    defaultImage?: string;
    /** Aplica o visual HADES (escuro). Padrão: false (mantém o tema legado do onboarding). */
    hades?: boolean;
};

/**
 * Avatar circular clicável com botão "+". Ao tocar, abre a galeria,
 * faz upload para o Supabase Storage e retorna a URL pública via callback.
 *
 * Reutilizado em: onboarding-profile.tsx (legado), create-group.tsx, settings.
 */
export default function ImagePickerAvatar({
    bucket = "images",
    onImageUploaded,
    circle,
    defaultImage,
    hades = false,
}: ImagePickerAvatarProps) {
    const [imagePreview, setImagePreview] = useState<string | null>(defaultImage || null);

    // Sincroniza se o defaultImage mudar (ex: ao carregar profile assincronamente)
    useEffect(() => {
        if (defaultImage && !imagePreview) {
            setImagePreview(defaultImage);
        }
    }, [defaultImage]);

    const selectImage = async () => {
        const { uriLocal, publicUrl, error, cancelado } = await escolherEEnviarImagem(bucket);
        if (cancelado) return;

        if (uriLocal) setImagePreview(uriLocal);

        if (error || !publicUrl) {
            toast.error(error ?? "Erro ao enviar imagem");
            return;
        }

        onImageUploaded(publicUrl);
    };

    return (
        <View className="items-center mb-8 mt-2">
            <View className="relative">
                <TouchableOpacity
                    onPress={selectImage}
                    className={`w-32 h-32 ${circle ? "rounded-full" : "rounded-xl"} border-[3px] items-center justify-center overflow-hidden`}
                    style={{
                        backgroundColor: hades ? HADES.surfaceRaised : "#1e293b",
                        borderColor: hades ? HADES.borderStrong : "#334155",
                        shadowColor: "#000",
                        shadowOpacity: 0.2,
                        shadowRadius: 8,
                        shadowOffset: { width: 0, height: 4 },
                        elevation: 5,
                    }}
                >
                    {imagePreview ? (
                        <Image className="h-full w-full" source={{ uri: imagePreview }} />
                    ) : (
                        <View className="items-center">
                            <Users size={46} color={hades ? HADES.textFaint : COLORS.textMuted} />
                            <Text
                                className="text-[10px] font-bold mt-1 uppercase tracking-wider"
                                style={{ color: hades ? HADES.textFaint : "#94a3b8" }}
                            >
                                Foto
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={selectImage}
                    className="absolute bottom-0 right-0 w-9 h-9 rounded-full items-center justify-center border-[3px]"
                    style={{
                        backgroundColor: hades ? HADES.accentSolid : "#f7982c",
                        borderColor: hades ? HADES.settingsBg : "#020617",
                    }}
                >
                    <Plus size={18} color={hades ? "#000" : "#ffffff"} strokeWidth={3} />
                </TouchableOpacity>
            </View>
        </View>
    );
}
