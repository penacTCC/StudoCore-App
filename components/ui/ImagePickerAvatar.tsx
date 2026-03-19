import { useState } from "react";
import { View, Text, Image, TouchableOpacity, Alert } from "react-native";
import { Image as ImageIcon, Plus, Users } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { decode } from "base64-arraybuffer";
import { supabase } from "@/supabase";
import { COLORS } from "@/constants/colors";

interface ImagePickerAvatarProps {
    /** Bucket do Supabase Storage onde a imagem será enviada. Padrão: 'images' */
    bucket?: string;
    /** Chamado com a URL pública da imagem após upload bem-sucedido */
    onImageUploaded: (url: string) => void;
    /** Define se o avatar deve ser circular ou retangular. Padrão: true */
    circle?: boolean;
}

/**
 * Avatar circular clicável com botão "+". Ao tocar, abre a galeria,
 * faz upload para o Supabase Storage e retorna a URL pública via callback.
 *
 * Reutilizado em: onboarding-profile.tsx, create-group.tsx
 */
export default function ImagePickerAvatar({
    bucket = "images",
    onImageUploaded,
    circle,
}: ImagePickerAvatarProps) {
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const selectImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.5,
                base64: true,
            });

            if (result.canceled) return;

            const imageUri = result.assets[0].uri;
            setImagePreview(imageUri);

            const base64 = result.assets[0].base64;
            if (!base64) {
                console.log("Erro: base64 da imagem não foi gerado.");
                return;
            }

            const fileExt = imageUri.split(".").pop();
            const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`;

            const { error } = await supabase.storage
                .from(bucket)
                .upload(fileName, decode(base64), {
                    contentType: `image/${fileExt}`,
                });

            if (error) {
                Alert.alert("Erro ao enviar imagem", JSON.stringify(error));
                return;
            }

            const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
            onImageUploaded(urlData.publicUrl);
        } catch (error) {
            Alert.alert("Erro ao selecionar imagem", JSON.stringify(error));
        }
    };

    return (
        <View className="items-center mb-8 mt-2">
            <View className="relative">
                <TouchableOpacity
                    onPress={selectImage}
                    className={`w-32 h-32 ${circle ? "rounded-full" : "rounded-xl"} bg-navy-800 border-[3px] border-navy-700 items-center justify-center overflow-hidden`}
                    style={{
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
                        <Users size={46} color={COLORS.textMuted} />
                    )}
                    <Text className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">
                        Photo
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={selectImage}
                    className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-brand-500 items-center justify-center border-[3px] border-navy-950"
                >
                    <Plus size={18} color="#ffffff" strokeWidth={3} />
                </TouchableOpacity>
            </View>
        </View>
    );
}
