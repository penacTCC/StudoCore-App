import * as Crypto from 'expo-crypto';


const KEY_ID = "005893297dce6c50000000002";
const APPLICATION_KEY = "K005fW6VRQX0lqwQqxatQot2a+GbMBI";
const BUCKET_ID = "8859e372c9274dfc9ed60c15";
//const KEY_ID = process.env.KEY_ID;
//const APPLICATION_KEY = process.env.APPLICATION_KEY;
//const BUCKET_ID = process.env.BUCKET_ID;

/**
 * Autoriza a conta Backblaze
 * @returns autorização.json
 */
export async function _authorizeB2() {

    console.log("3.1 - iniciando auth");
    console.log("KEY_ID", KEY_ID);
    console.log("APPLICATION_KEY", APPLICATION_KEY);
    console.log("BUCKET_ID", BUCKET_ID);
    const res = await fetch(
        "https://api.backblazeb2.com/b2api/v2/b2_authorize_account",
        {
            method: "GET",
            headers: {
                Authorization: "Basic " + btoa(`${KEY_ID}:${APPLICATION_KEY}`),
            },
        }
    );
    console.log("status auth:", res.status);

    const data = await res.json();

    console.log("AUTH:", data);

    return data;
}



/**
 * Pega a url de upload
 * @param apiUrl 
 * @param authToken
 * @returns url de upload.json
 */
export async function _getUploadUrl(apiUrl: string, authToken: string) {
    console.log("4.1 - entrando em _getUploadUrl");
    try {
        console.log("API URL:", apiUrl);
        console.log("URL final:", `${apiUrl}/b2api/v2/b2_get_upload_url`);
        console.log("BUCKET_ID:", BUCKET_ID);
        const res = await fetch(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
            method: "POST",
            headers: {
                Authorization: authToken,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                bucketId: BUCKET_ID,
            }),
        });
        console.log("4.2 - resposta recebida", res.status);

        return res.json();
    } catch (err) {
        console.error("ERRO _getUploadUrl:", err);
        throw err;
    }
}



/**
 * Executa o upload do arquivo para o Backblaze
 * @param fileName 
 * @param mimeType 
 * @param fileBuffer 
 * @returns fetch response com os dados do arquivo (headers)
 */
export async function uploadFileToB2(
    fileName: string,
    mimeType: string,
    fileBuffer: ArrayBuffer //formato binário genérico e bruto do arquivo
) {

    //Autorizar conta Backblaze
    console.log("3 - autorizando B2");
    const auth = await _authorizeB2();
    console.log("AUTH:", auth);

    //pegar upload url do Backblaze
    console.log("4 - obtendo upload URL");
    const uploadData = await _getUploadUrl(
        auth.apiUrl,
        auth.authorizationToken
    );


    async function getSha1(arrayBuffer: ArrayBuffer) {
        const buffer = new Uint8Array(arrayBuffer);
        //Gera um hash usando o algoritmo SHA-1
        const hashBuffer = await Crypto.digest(
            Crypto.CryptoDigestAlgorithm.SHA1,
            buffer
        );

        //Converte o buffer do hash em uma string hexadecimal
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        return hashHex; //Retorna o hash (é o arquivo em linha de texto, caracteres que identificam o conteudo do arquivo)
    }

    const realSha1 = await getSha1(fileBuffer);

    console.log("5 - enviando arquivo");
    const uploadResponse = await fetch(uploadData.uploadUrl, {
        method: "POST",
        headers: {
            Authorization: uploadData.authorizationToken, //Token de autorização
            // IMPORTANTE: O B2 orienta a encodar a URL, MAS NÃO as barras (/). 
            // Se encodar as barras, ele cria arquivos com '%2F' no nome ao invés de pastas!
            "X-Bz-File-Name": fileName.split('/').map(encodeURIComponent).join('/'), //Nome do arquivo
            "Content-Type": mimeType, //Tipo do arquivo
            "X-Bz-Content-Sha1": realSha1, //SHA1 do arquivo, serve para verificar se o arquivo foi enviado corretamente (sem corromper ou ser alterado no envio)
            "Content-Length": fileBuffer.byteLength.toString(), //Tamanho do arquivo
        },
        body: fileBuffer, //Buffer do arquivo, buffer é o arquivo em linguagem de maquina
    });

    if (!uploadResponse.ok) {
        throw new Error("Falha no upload");
    }

    return uploadResponse;
}



/**
 * Deleta fisicamente um arquivo do Backblaze B2
 * @param fileName Nome do arquivo salvo no bucket (caminho completo)
 * @param fileId O ID do arquivo retornado pelo B2 no upload
 */
export async function deleteFileFromB2(fileName: string, fileId: string) {
    // Autorizar conta Backblaze
    const auth = await _authorizeB2();

    // Chama o endpoint de deleção
    const res = await fetch(`${auth.apiUrl}/b2api/v2/b2_delete_file_version`, {
        method: "POST",
        headers: {
            Authorization: auth.authorizationToken,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            fileName: fileName,
            fileId: fileId,
        }),
    });

    if (!res.ok) {
        const errorData = await res.json();

        // Retorno gracioso se o arquivo já foi excluído do B2
        if (errorData.code === "file_not_present") {
            console.warn("Backblaze: O arquivo já não existe no bucket.");
            return { success: true };
        }

        console.error("Erro na API Backblaze ao deletar:", errorData);
        throw new Error("Falha ao deletar arquivo no Backblaze B2");
    }

    return res.json();
}



/**
 * Gera uma URL autenticada e temporária para download/visualização de um arquivo privado.
 * @param fileName Nome completo do arquivo no bucket (storage_path)
 * @returns URL completa com o token de autorização embutido
 */
export async function getAuthenticatedDownloadUrl(fileName: string) {
    // Autoriza a conta Backblaze para obter o Token mestre e a URL da API
    const auth = await _authorizeB2();

    // Solicita o Token de autorização específico para este arquivo/prefixo
    // O token é gerado com validade de 1 hora (3600 segundos)
    const res = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_download_authorization`, {
        method: "POST",
        headers: {
            Authorization: auth.authorizationToken,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            bucketId: BUCKET_ID,
            fileNamePrefix: fileName,
            validDurationInSeconds: 3600,
        }),
    });

    if (!res.ok) {
        console.error("Erro ao obter autorização de download");
        throw new Error("Não foi possível autorizar a visualização do arquivo.");
    }

    const data = await res.json();

    // Retorna a URL final formatada que permite o acesso ao arquivo privado
    // O parâmetro 'Authorization' na query string é o que permite burlar o erro 401
    return `${auth.downloadUrl}/file/vaultstudocore/${fileName}?Authorization=${data.authorizationToken}`;
}
