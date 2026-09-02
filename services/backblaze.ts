import { supabase } from '@/repositories/supabase';

/*
  As credenciais do Backblaze saíram daqui.

  Elas ficavam neste arquivo como constantes e, depois, como `process.env.EXPO_PUBLIC_*` —
  as duas formas vazam. O repositório é público, e o prefixo `EXPO_PUBLIC_` faz o Expo
  substituir a variável pelo valor durante o build: as chaves saíam em texto puro dentro do
  bundle de qualquer APK, extraíveis com `strings`. Não há onde esconder segredo no cliente.

  Agora quem guarda a chave é a Edge Function `arquivos-b2`. Este arquivo virou o cliente
  dela: envia o arquivo, gera um link de download assinado, ou exclui um arquivo — e nunca
  vê a credencial nem um token temporário de escrita.

  As assinaturas exportadas continuam as mesmas de antes, então quem consome
  (`archives.ts`, `anexosSessao.ts`, `visualizarArquivo.ts`, `archive-details.tsx`) não muda.
*/

type RespostaFuncao = { ok?: boolean; error?: string; [chave: string]: unknown };

/** Chama a Edge Function com o JWT do usuário e devolve o corpo já validado. */
async function chamarFuncao(acao: string, dados: Record<string, unknown> = {}) {
    const { data, error } = await supabase.functions.invoke<RespostaFuncao>('arquivos-b2', {
        body: { acao, ...dados },
    });

    if (error) {
        console.error(`arquivos-b2 (${acao}):`, error);
        throw new Error('Não foi possível falar com o servidor de arquivos.');
    }
    if (!data?.ok) {
        throw new Error(String(data?.error ?? 'Falha no servidor de arquivos.'));
    }

    return data;
}

/** Envia o binário para a Edge Function; ela valida cota/tamanho e só então sobe ao B2. */
async function chamarUpload(storagePath: string, mimeType: string, fileBuffer: ArrayBuffer) {
    const { data, error } = await supabase.functions.invoke<RespostaFuncao>('arquivos-b2', {
        body: fileBuffer,
        headers: {
            'content-type': mimeType,
            'x-acao': 'upload',
            'x-storage-path': storagePath,
            'x-mime-type': mimeType,
        },
    });

    if (error) {
        console.error('arquivos-b2 (upload):', error);
        throw new Error('Não foi possível falar com o servidor de arquivos.');
    }
    if (!data?.ok) {
        throw new Error(String(data?.error ?? 'Falha no servidor de arquivos.'));
    }

    return data;
}

/**
 * Envia o arquivo para o Backblaze.
 *
 * O binário passa pela Edge Function para que o servidor valide tamanho, cota e caminho
 * antes de qualquer byte chegar ao B2. Isso evita que um app modificado peça token
 * temporário e envie arquivo fora do fluxo normal.
 *
 * @param fileName caminho completo do arquivo no bucket
 * @param mimeType tipo do conteúdo
 * @param fileBuffer conteúdo binário
 */
export async function uploadFileToB2(
    fileName: string,
    mimeType: string,
    fileBuffer: ArrayBuffer
) {
    const data = await chamarUpload(fileName, mimeType, fileBuffer);
    return {
        ok: true,
        json: async () => data,
    };
}

/**
 * Apaga o arquivo do bucket.
 *
 * Quem executa é a Edge Function, que antes confere em `arquivos` se o `storage_path` é seu.
 * O app não tem como apagar arquivo de outra pessoa nem pedindo direto.
 *
 * @param fileName caminho do arquivo no bucket (`storage_path`)
 * @param fileId id devolvido pelo B2 no upload
 */
export async function deleteFileFromB2(fileName: string, fileId: string) {
    await chamarFuncao('excluir', { storagePath: fileName, fileId });
    return { success: true };
}

/**
 * URL temporária para abrir um arquivo privado, válida por 1 hora.
 *
 * @param fileName caminho do arquivo no bucket (`storage_path`)
 */
export async function getAuthenticatedDownloadUrl(fileName: string) {
    const { url } = await chamarFuncao('urlDownload', { storagePath: fileName }) as { url: string };
    return url;
}
