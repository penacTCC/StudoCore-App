import { supabase } from "@/repositories/supabase";
import { uploadFileToB2 } from "@/services/backblaze";
import { File as FileClass } from "expo-file-system";
import { decode } from "base64-arraybuffer";
import { ArquivoDetalhe, ArquivoGrupoLink, DeletaRegistroProps, UploadArquivoParams } from "@/types/archives";


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

export const buscarArquivosVisiveis = async (userId: string) => {
  const { data: userGroups } = await supabase
    .from("membros")
    .select("grupo_id")
    .eq("user_id", userId);

  const groupIds = userGroups?.map(g => g.grupo_id) || [];

  const { data: myFilesData } = await supabase
    .from("arquivos")
    .select("*, profiles(nome_usuario), arquivos_grupos(grupo_id)")
    .eq("user_id", userId);

  const myFiles = (myFilesData || []) as ArquivoDetalhe[];

  let groupFiles: ArquivoDetalhe[] = [];
  if (groupIds.length > 0) {
    const { data: groupLinks } = await supabase
      .from("arquivos_grupos")
      .select("grupo_id, arquivos(*, profiles(nome_usuario), arquivos_grupos(grupo_id))")
      .in("grupo_id", groupIds);

    groupFiles = ((groupLinks || []) as ArquivoGrupoLink[])
      .flatMap(link => Array.isArray(link.arquivos) ? link.arquivos : [link.arquivos])
      .filter((arquivo): arquivo is ArquivoDetalhe => Boolean(arquivo));
  }

  const uniqueMap = new Map<string, ArquivoDetalhe>();
  [...myFiles, ...groupFiles].forEach(file => {
    if (!uniqueMap.has(file.id)) {
      uniqueMap.set(file.id, file);
    }
  });

  return Array.from(uniqueMap.values())
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};
