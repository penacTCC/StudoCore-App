import { supabase } from "@/lib/supabase";
import { uploadFileToB2 } from "@/services/backblaze";
import { File as FileClass } from "expo-file-system";
import { decode } from "base64-arraybuffer";
import { DeletaRegistroProps, UploadArquivoParams } from "@/types/archives";


export async function uploadArquivo({
  userId,
  arquivo,
  disciplina,
  gruposIds,
}: UploadArquivoParams) {
    const objetoArquivo = new FileClass(arquivo.uri); // Cria o objeto do arquivo
    const base64 = await objetoArquivo.base64Sync(); // Lê o arquivo em base64

    const nomeFormatado = arquivo.name.replace(/[^a-zA-Z0-9.]/g, '_'); // Limpa o nome
    const caminhoGrupo = gruposIds.length > 0 ? gruposIds.join(",") : "private";
    // coloca a disciplina como uma PASTA no bucket.
    const caminhoArquivo = `${disciplina}/${caminhoGrupo}/${nomeFormatado}`;

    //Faz o upload para o bucket com o novo caminho (Pasta/Arquivo)
    const upload = await uploadFileToB2(
        caminhoArquivo,
        arquivo.mimeType,
        decode(base64),
    );

    // O fetch do Backblaze retorna uma Response. Precisamos extrair o JSON dela:
    const uploadData = await upload.json();

    const { data: novoArquivo, error: dbError } = await supabase
    .from("arquivos")
    .insert({
      user_id: userId,
      titulo: nomeFormatado,
      disciplina: disciplina,
      storage_path: caminhoArquivo,
      backblaze_file_id: uploadData.fileId,
    })
    .select()
    .single();

    if (dbError) throw dbError;

    if (gruposIds.length > 0) {
      const relations = gruposIds.map((groupId) => ({
        arquivo_id: novoArquivo.id,
        grupo_id: groupId,
    }));

    const { error } = await supabase
      .from("arquivos_grupos")
      .insert(relations);

    if (error) throw error;
  }

  return novoArquivo;
}

export const deletaRegistro = async ({arquivoId}: DeletaRegistroProps) => {
  return await supabase
  .from("arquivos") // Nome da sua tabela
  .delete() // Operação de deleção
  .eq("id", arquivoId); // Condição: onde o ID for igual ao ID do arquivo atual
}
