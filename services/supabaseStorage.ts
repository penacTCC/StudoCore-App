import { supabase } from "@/lib/supabase";
import { decode } from "base64-arraybuffer";

type uploadArquivoBucketProps = {
    bucket: string,
    fileName: string,
    fileExt: string,
    base64: string
}

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