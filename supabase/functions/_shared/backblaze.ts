// Acesso ao Backblaze B2 compartilhado pelas Edge Functions.
//
// Existe porque duas funções falam com o bucket — `arquivos-b2`, que é a porta normal do
// Cofre, e `excluir-conta`, que precisa apagar o material da pessoa junto com a conta. As
// duas precisam da MESMA autorização e do MESMO tratamento de "arquivo já não está lá".
// Duplicar isso significaria, mais cedo ou mais tarde, uma das duas ficar para trás numa
// mudança de API e passar a falhar em silêncio — no caso da exclusão, deixando objeto pago
// no bucket sem ninguém perceber.
//
// Nenhuma credencial sai daqui: quem chama recebe token de escopo curto ou só o resultado.

const BUCKET_NOME = "vaultstudocore";

export type AutorizacaoB2 = {
  authorizationToken: string;
  apiUrl: string;
  downloadUrl: string;
  accountId: string;
};

export const bucketNome = () => BUCKET_NOME;
export const bucketId = () => Deno.env.get("B2_BUCKET_ID")!;

/**
 * Autoriza na conta B2 e devolve token + endpoints.
 *
 * Usa a v3 da API: a v2 entrega `apiUrl`/`downloadUrl` na raiz, a v3 os aninha em
 * `apiInfo.storageApi`. Ler os dois formatos evita que a função quebre se a conta for
 * migrada de versão por fora.
 */
export async function autorizar(): Promise<AutorizacaoB2> {
  const keyId = Deno.env.get("B2_KEY_ID");
  const applicationKey = Deno.env.get("B2_APPLICATION_KEY");

  if (!keyId || !applicationKey) {
    throw new Error("B2_KEY_ID/B2_APPLICATION_KEY não configurados nos secrets.");
  }

  const res = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", {
    headers: { Authorization: "Basic " + btoa(`${keyId}:${applicationKey}`) },
  });

  if (!res.ok) {
    throw new Error(`Backblaze recusou a autorização (HTTP ${res.status}).`);
  }

  const dados = await res.json();
  const storage = dados?.apiInfo?.storageApi ?? {};

  return {
    authorizationToken: dados.authorizationToken,
    apiUrl: storage.apiUrl ?? dados.apiUrl,
    downloadUrl: storage.downloadUrl ?? dados.downloadUrl,
    accountId: dados.accountId,
  };
}

export function encodeB2FileName(fileName: string) {
  // O B2 pede a URL encodada MENOS as barras: encodar as barras cria arquivos com "%2F"
  // no nome em vez de pastas.
  return fileName.split("/").map(encodeURIComponent).join("/");
}

/**
 * Apaga uma versão de arquivo do bucket.
 *
 * `file_not_present` conta como sucesso: para quem chamou, o resultado desejado — o arquivo
 * não está mais lá — já vale. Tratar como erro faria uma exclusão repetida (retry, duplo
 * toque) parecer falha.
 */
export async function apagarArquivoB2(
  auth: AutorizacaoB2,
  storagePath: string,
  fileId: string
): Promise<{ ok: true } | { ok: false; detalhe: string }> {
  const res = await fetch(`${auth.apiUrl}/b2api/v3/b2_delete_file_version`, {
    method: "POST",
    headers: { Authorization: auth.authorizationToken, "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: storagePath, fileId }),
  });

  if (res.ok) return { ok: true };

  const erro = await res.json().catch(() => ({}));
  if (erro?.code === "file_not_present") return { ok: true };

  return { ok: false, detalhe: `HTTP ${res.status} ${erro?.code ?? ""}`.trim() };
}
