import * as Crypto from 'expo-crypto';
import { supabase } from '@/repositories/supabase';

/*
  As credenciais do Backblaze saíram daqui.

  Elas ficavam neste arquivo como constantes e, depois, como `process.env.EXPO_PUBLIC_*` —
  as duas formas vazam. O repositório é público, e o prefixo `EXPO_PUBLIC_` faz o Expo
  substituir a variável pelo valor durante o build: as chaves saíam em texto puro dentro do
  bundle de qualquer APK, extraíveis com `strings`. Não há onde esconder segredo no cliente.

  Agora quem guarda a chave é a Edge Function `arquivos-b2`. Este arquivo virou o cliente
  dela: pede uma URL de upload temporária, um link de download assinado, ou a exclusão de um
  arquivo — e nunca vê a credencial.

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

/**
 * Envia o arquivo para o Backblaze.
 *
 * O binário vai direto do aparelho para o B2, na URL temporária que a função devolveu — não
 * passa pela Edge Function. Um PDF de 20 MB dando a volta pelo servidor esbarraria no limite
 * de corpo e no tempo de execução, e não deixaria nada mais seguro: a URL já é de uso único
 * e presa a este bucket.
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
    const { uploadUrl, authorizationToken } = await chamarFuncao('urlUpload') as {
        uploadUrl: string; authorizationToken: string;
    };

    // O B2 confere este hash contra o que recebeu: é o que detecta arquivo corrompido no envio.
    const hashBuffer = await Crypto.digest(
        Crypto.CryptoDigestAlgorithm.SHA1,
        new Uint8Array(fileBuffer)
    );
    const sha1 = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

    const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
            Authorization: authorizationToken,
            // O B2 pede a URL encodada MENOS as barras: encodar as barras cria arquivos com
            // '%2F' no nome em vez de pastas.
            'X-Bz-File-Name': fileName.split('/').map(encodeURIComponent).join('/'),
            'Content-Type': mimeType,
            'X-Bz-Content-Sha1': sha1,
            'Content-Length': fileBuffer.byteLength.toString(),
        },
        body: fileBuffer,
    });

    if (!uploadResponse.ok) {
        throw new Error('Falha no upload');
    }

    return uploadResponse;
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
