import { supabase } from "@/repositories/supabase";
import { uploadFileToB2, getAuthenticatedDownloadUrl } from "@/services/backblaze";
import { tipoDoArquivo } from "@/services/visualizarArquivo";
import { File as FileClass, Paths } from "expo-file-system";
import { decode } from "base64-arraybuffer";
import { ArquivoDetalhe, ArquivoGrupoLink, UploadArquivoParams } from "@/types/archives";
import { buscarEstadoDoPlano, mensagemDeLimite, MENSAGEM_DE_LIMITE } from "@/services/assinatura";


export async function uploadArquivo({
  userId,
  arquivo,
  disciplina,
  gruposIds,
  publico = false,
}: UploadArquivoParams) {
    /*
      Pré-checagem só para feedback rápido na UI. O bloqueio real acontece na Edge Function
      `arquivos-b2`, que cria a reserva em `arquivos` antes de subir qualquer byte ao B2.
    */
    if (arquivo.size) {
      const { limites, uso } = await buscarEstadoDoPlano();

      if (limites.arquivoBytesMax !== null && arquivo.size > limites.arquivoBytesMax) {
        throw new Error(MENSAGEM_DE_LIMITE.tamanho_do_arquivo);
      }

      if (
        limites.armazenamentoBytes !== null &&
        uso.armazenamentoBytes + arquivo.size > limites.armazenamentoBytes
      ) {
        throw new Error(MENSAGEM_DE_LIMITE.armazenamento);
      }
    }

    console.log("1 - lendo arquivo");
    const objetoArquivo = new FileClass(arquivo.uri); // Cria o objeto do arquivo
    console.log("2 - convertendo base64");
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

    // A Edge Function já reservou a linha em `arquivos`; aqui finalizamos os metadados
    // editáveis de produto. Tamanho, path e fileId ficam sob controle do servidor.
    const uploadData = await upload.json();

    console.log("6 - salvando no Supabase");
    const { data: novoArquivo, error: dbError } = await supabase
    .from("arquivos")
    .update({
      titulo: nomeFormatado,
      disciplina: disciplina,
      publico,
      pendente_upload: false,
    })
    .eq("id", uploadData.id)
    .eq("user_id", userId)
    .select()
    .single();

    // Rede de segurança: se a checagem acima passou mas o trigger recusou (upload
    // concorrente, cota estourada entre uma coisa e outra), traduz antes de propagar.
    if (dbError) {
      const limite = await mensagemDeLimite(dbError);
      throw limite ? new Error(limite) : dbError;
    }

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

/**
 * "Adicionar aos meus arquivos" — botão do card de arquivo na Comunidade.
 *
 * Baixa os bytes do arquivo publicado e reenvia pro Backblaze sob um caminho novo, em vez
 * de só criar uma segunda linha em `arquivos` apontando pro mesmo `storage_path`: o delete
 * de arquivo (`archive-details.tsx`) apaga o arquivo físico do bucket junto com a linha, e
 * duas linhas compartilhando o mesmo arquivo físico faria a exclusão de uma delas destruir
 * o arquivo da outra pessoa. É o mesmo raciocínio de "copiar, não referenciar" que
 * `comunidade_importar_plano` já usa pra planos.
 */
export async function adicionarArquivoDaComunidadeAosMeus(
  userId: string,
  origem: { storagePath: string; titulo: string; disciplina: string | null }
) {
  const urlAutenticada = await getAuthenticatedDownloadUrl(origem.storagePath);
  const nomeOriginal = origem.storagePath.split("/").pop() || origem.titulo;
  const arquivoLocal = new FileClass(Paths.cache, `copia-${Date.now()}-${nomeOriginal}`);

  const baixado = await FileClass.downloadFileAsync(urlAutenticada, arquivoLocal, { idempotent: true });
  if (!baixado.exists) throw new Error("Não foi possível baixar o arquivo original.");

  const base64 = baixado.base64Sync();
  const disciplina = origem.disciplina || "Geral";
  const nomeFormatado = origem.titulo.replace(/[^a-zA-Z0-9.]/g, "_");
  const caminhoArquivo = `${disciplina}/private/${Date.now()}_${nomeFormatado}`;

  const upload = await uploadFileToB2(caminhoArquivo, tipoDoArquivo(nomeOriginal), decode(base64));
  const uploadData = await upload.json();

  const { data: novoArquivo, error } = await supabase
    .from("arquivos")
    .update({
      titulo: nomeFormatado,
      disciplina,
      publico: false,
      pendente_upload: false,
    })
    .eq("id", uploadData.id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return novoArquivo;
}

/**
 * Publica ou despublica um arquivo no Explorar.
 *
 * Independente de `arquivos_grupos`: compartilhar com o grupo e publicar para o app todo
 * são duas decisões diferentes, e uma nunca implica a outra. Despublicar tira o card do
 * feed na hora — as curtidas e comentários ficam guardados e voltam se publicar de novo,
 * mas ninguém consegue somar mais nenhum enquanto estiver fora (a RLS recusa).
 */
export const alternarArquivoPublico = async (arquivoId: string, publico: boolean) => {
  const { error } = await supabase
    .from("arquivos")
    .update({ publico })
    .eq("id", arquivoId);

  if (error) throw new Error(error.message);
};

export const buscarArquivosVisiveis = async (userId: string) => {
  const { data: userGroups } = await supabase
    .from("membros")
    .select("grupo_id")
    .eq("user_id", userId);

  const groupIds = userGroups?.map(g => g.grupo_id) || [];

  const { data: myFilesData } = await supabase
    .from("arquivos")
    .select("*, profiles(nome_usuario), arquivos_grupos(grupo_id)")
    .eq("user_id", userId)
    .eq("pendente_upload", false);

  const myFiles = (myFilesData || []) as ArquivoDetalhe[];

  let groupFiles: ArquivoDetalhe[] = [];
  if (groupIds.length > 0) {
    const { data: groupLinks } = await supabase
      .from("arquivos_grupos")
      .select("grupo_id, arquivos(*, profiles(nome_usuario), arquivos_grupos(grupo_id))")
      .in("grupo_id", groupIds);

    groupFiles = ((groupLinks || []) as ArquivoGrupoLink[])
      .flatMap(link => Array.isArray(link.arquivos) ? link.arquivos : [link.arquivos])
      .filter((arquivo): arquivo is ArquivoDetalhe => Boolean(arquivo && !(arquivo as any).pendente_upload));
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
