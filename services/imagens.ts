import * as ImagePicker from "expo-image-picker";
import { uploadArquivoBucket } from "@/services/supabaseStorage";

export type ResultadoEscolhaImagem = {
    /** URI local da imagem escolhida — serve de preview enquanto o upload não termina. */
    uriLocal: string | null;
    /** URL pública no bucket, já com o upload concluído. */
    publicUrl: string | null;
    /** `null` quando o usuário simplesmente cancelou a galeria. */
    error: string | null;
    cancelado: boolean;
};

/**
 * Abre a galeria, recorta em 1:1 e sobe a imagem escolhida pro bucket.
 *
 * Usado pelo ImagePickerAvatar (onboarding, criar grupo) e pelo avatar da tela de editar
 * perfil — os dois precisam do mesmo fluxo, só mudam no visual em volta.
 */
export const escolherEEnviarImagem = async (
    bucket = "images"
): Promise<ResultadoEscolhaImagem> => {
    try {
        const resultado = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
            base64: true,
        });

        if (resultado.canceled) {
            return { uriLocal: null, publicUrl: null, error: null, cancelado: true };
        }

        const asset = resultado.assets[0];
        const base64 = asset.base64;
        if (!base64) {
            return {
                uriLocal: asset.uri,
                publicUrl: null,
                error: "Não foi possível ler a imagem escolhida.",
                cancelado: false,
            };
        }

        const fileExt = asset.uri.split(".").pop() || "jpg";
        const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`;

        const { publicUrl, error } = await uploadArquivoBucket({ fileName, base64, fileExt, bucket });

        if (error || !publicUrl) {
            return {
                uriLocal: asset.uri,
                publicUrl: null,
                error: "Não foi possível enviar a imagem.",
                cancelado: false,
            };
        }

        return { uriLocal: asset.uri, publicUrl, error: null, cancelado: false };
    } catch (erro) {
        console.warn("Erro ao escolher imagem:", erro);
        return {
            uriLocal: null,
            publicUrl: null,
            error: "Não foi possível selecionar a imagem.",
            cancelado: false,
        };
    }
};
