import { supabase } from "@/repositories/supabase";
import { uploadArquivoBucketProps } from "@/types/archives";
import { decode } from "base64-arraybuffer";

//Faz upload da imagem no bucket do Supabase
export const uploadArquivoBucket = async ({bucket, fileName, base64, fileExt}: uploadArquivoBucketProps ) => {
    const {error} = await supabase.storage
        .from(bucket)
        .upload(fileName, decode(base64), {
            contentType: `image/${fileExt}`,
        });
        
    if (error) {
        return { publicUrl: null, error };
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);

    return {publicUrl: data.publicUrl, error: null};
}
