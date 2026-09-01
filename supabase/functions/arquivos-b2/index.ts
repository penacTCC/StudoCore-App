// Edge Function do Vault: guarda as credenciais do Backblaze e empresta ao app só o que ele
// precisa, por vez.
//
// Por que existe: as chaves do B2 estavam dentro de `services/backblaze.ts`, ou seja, dentro
// do app. Isso vaza por dois caminhos ao mesmo tempo — o repositório é público, e as
// variáveis `EXPO_PUBLIC_*` são substituídas pelo valor no build, então saem em texto puro
// no bundle de qualquer APK. Não existe jeito de esconder segredo no cliente; a única
// correção é ele nunca chegar lá.
//
// O que o app recebe no lugar da chave mestra:
//   - upload:   uma URL de upload do próprio B2, temporária e válida para um envio
//   - download: um link assinado com validade de 1 hora, só se a RLS deixar ler o arquivo
//   - exclusão: nada — quem apaga é esta função, depois de conferir que o arquivo é seu
//
// O arquivo em si nunca passa por aqui: o app envia direto para a URL que o B2 devolveu.
// Uma Edge Function tem limite de corpo e de tempo, e fazer um PDF de 20 MB dar a volta
// pelo servidor só gastaria os dois.
//
// Deploy:
//   supabase secrets set B2_KEY_ID=... B2_APPLICATION_KEY=... B2_BUCKET_ID=... --project-ref <ref>
//   supabase functions deploy arquivos-b2 --project-ref <ref>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET_NOME = "vaultstudocore";

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });

type AutorizacaoB2 = {
  authorizationToken: string;
  apiUrl: string;
  downloadUrl: string;
  accountId: string;
};

/**
 * Autoriza na conta B2 e devolve token + endpoints.
 *
 * Usa a v3 da API: a v2 entrega `apiUrl`/`downloadUrl` na raiz, a v3 os aninha em
 * `apiInfo.storageApi`. Ler os dois formatos evita que a função quebre se a conta for
 * migrada de versão por fora.
 */
async function autorizar(): Promise<AutorizacaoB2> {
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

const bucketId = () => Deno.env.get("B2_BUCKET_ID")!;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ ok: false, error: "Não autenticado." }, 401);

    // Client "como o usuário": serve só para descobrir quem está chamando, a partir do JWT.
    const clienteUsuario = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: erroUsuario } = await clienteUsuario.auth.getUser();
    if (erroUsuario || !user) return jsonResponse({ ok: false, error: "Não autenticado." }, 401);

    const corpo = await req.json().catch(() => ({}));
    const acao = corpo?.acao as string | undefined;

    /* ── upload ──────────────────────────────────────────────────────────────────────
       Devolve a URL de upload do B2. `b2_get_upload_url` sozinho só prende o token ao
       bucket — o nome final do arquivo (X-Bz-File-Name) quem escolhe é o cliente no PUT,
       e o servidor nunca vê esse PUT para conferir depois. Sem mais nada, qualquer conta
       logada podia pedir a URL e escrever em cima do storage_path de outra pessoa (o B2
       versiona em vez de rejeitar nome duplicado, e download sem fileId serve a versão
       mais nova — troca silenciosa de conteúdo alheio).

       storage_path aqui não é prefixado por usuário (é `disciplina/grupo-ou-sessão/nome`),
       então a checagem não pode ser um prefixo fixo. Em vez disso: o cliente informa o
       storagePath pretendido, e a função confere em `arquivos` (via service role, para não
       depender da RLS de SELECT) se aquele caminho já é de outra pessoa. Se for, nega.
       Aí, em vez de devolver o token mestre, cria uma Application Key do B2 restrita a
       esse namePrefix exato antes de pedir a URL de upload — o token que volta para o app
       só grava naquele caminho, então nem um cliente malicioso consegue trocar o
       X-Bz-File-Name para escrever em outro lugar depois de receber a URL.              */
    if (acao === "urlUpload") {
      const storagePath = corpo?.storagePath as string | undefined;
      if (!storagePath) return jsonResponse({ ok: false, error: "Informe 'storagePath'." }, 400);

      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: existente } = await admin
        .from("arquivos")
        .select("user_id")
        .eq("storage_path", storagePath)
        .maybeSingle();

      if (existente && existente.user_id !== user.id) {
        return jsonResponse({ ok: false, error: "Este caminho já pertence a outro arquivo." }, 403);
      }

      const auth = await autorizar();

      const resKey = await fetch(`${auth.apiUrl}/b2api/v3/b2_create_key`, {
        method: "POST",
        headers: { Authorization: auth.authorizationToken, "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: auth.accountId,
          bucketId: bucketId(),
          capabilities: ["writeFiles"],
          keyName: `upload-${user.id}-${Date.now()}`.slice(0, 100),
          namePrefix: storagePath,
          validDurationInSeconds: 3600,
        }),
      });

      if (!resKey.ok) return jsonResponse({ ok: false, error: "Backblaze não devolveu chave de upload." }, 502);

      const chave = await resKey.json();

      const resAuthChave = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", {
        headers: {
          Authorization: "Basic " + btoa(`${chave.applicationKeyId}:${chave.applicationKey}`),
        },
      });

      if (!resAuthChave.ok) return jsonResponse({ ok: false, error: "Falha ao autorizar chave restrita." }, 502);

      const dadosAuthChave = await resAuthChave.json();
      const storageChave = dadosAuthChave?.apiInfo?.storageApi ?? {};
      const apiUrlChave = storageChave.apiUrl ?? dadosAuthChave.apiUrl;

      const res = await fetch(`${apiUrlChave}/b2api/v3/b2_get_upload_url`, {
        method: "POST",
        headers: {
          Authorization: dadosAuthChave.authorizationToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bucketId: bucketId() }),
      });

      if (!res.ok) return jsonResponse({ ok: false, error: "Backblaze não devolveu URL de upload." }, 502);

      const dados = await res.json();
      return jsonResponse(
        { ok: true, uploadUrl: dados.uploadUrl, authorizationToken: dados.authorizationToken },
        200,
      );
    }

    /* ── download ────────────────────────────────────────────────────────────────────
       Link assinado válido por 1 hora, com o prefixo preso ao arquivo pedido — um token
       gerado para um PDF não abre os outros.

       A consulta usa o client do usuário de propósito — o contrário da exclusão logo
       abaixo, e pelo mesmo motivo de fundo: a pergunta aqui é "esta pessoa pode LER este
       arquivo?", e a policy de SELECT de `arquivos` já é exatamente essa definição (dono,
       membro de um grupo com quem foi compartilhado, ou público de autor não bloqueado).
       Deixar a RLS responder evita reescrever os três braços aqui e sair de sincronia
       quando a policy mudar. Na exclusão o raciocínio se inverte: lá a decisão não pode
       depender de uma policy de leitura que pode ser afrouxada.

       Sem esta checagem, qualquer conta logada que descobrisse um `storagePath` recebia
       link de download válido por 1 hora para arquivo privado alheio.                    */
    if (acao === "urlDownload") {
      const storagePath = corpo?.storagePath as string | undefined;
      if (!storagePath) return jsonResponse({ ok: false, error: "Informe 'storagePath'." }, 400);

      // Linha escondida pela RLS e linha inexistente devolvem o mesmo 404 de propósito:
      // separar os dois casos confirmaria a existência de um arquivo alheio a quem chutou
      // o caminho, que é justamente o que esta checagem existe para impedir.
      const { data: arquivo } = await clienteUsuario
        .from("arquivos")
        .select("id")
        .eq("storage_path", storagePath)
        .maybeSingle();

      if (!arquivo) return jsonResponse({ ok: false, error: "Arquivo não encontrado." }, 404);

      const auth = await autorizar();
      const res = await fetch(`${auth.apiUrl}/b2api/v3/b2_get_download_authorization`, {
        method: "POST",
        headers: { Authorization: auth.authorizationToken, "Content-Type": "application/json" },
        body: JSON.stringify({
          bucketId: bucketId(),
          fileNamePrefix: storagePath,
          validDurationInSeconds: 3600,
        }),
      });

      if (!res.ok) return jsonResponse({ ok: false, error: "Não foi possível autorizar a visualização." }, 502);

      const dados = await res.json();
      const caminho = storagePath.split("/").map(encodeURIComponent).join("/");
      return jsonResponse(
        { ok: true, url: `${auth.downloadUrl}/file/${BUCKET_NOME}/${caminho}?Authorization=${dados.authorizationToken}` },
        200,
      );
    }

    /* ── exclusão ────────────────────────────────────────────────────────────────────
       A única operação destrutiva, e a única que precisa de dono. Sem esta checagem a
       função seria um "apague qualquer arquivo do bucket" liberado a qualquer conta
       logada — pior do que a chave no cliente, porque nem exigiria engenharia reversa.

       A consulta usa service role de propósito: a resposta não pode depender da RLS de
       `arquivos`. Se a policy de SELECT for afrouxada um dia, a decisão de quem pode
       apagar continua valendo aqui.                                                     */
    if (acao === "excluir") {
      const storagePath = corpo?.storagePath as string | undefined;
      const fileId = corpo?.fileId as string | undefined;
      if (!storagePath || !fileId) {
        return jsonResponse({ ok: false, error: "Informe 'storagePath' e 'fileId'." }, 400);
      }

      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: arquivo } = await admin
        .from("arquivos")
        .select("user_id")
        .eq("storage_path", storagePath)
        .maybeSingle();

      if (!arquivo) return jsonResponse({ ok: false, error: "Arquivo não encontrado." }, 404);
      if (arquivo.user_id !== user.id) {
        return jsonResponse({ ok: false, error: "Este arquivo não é seu." }, 403);
      }

      const auth = await autorizar();
      const res = await fetch(`${auth.apiUrl}/b2api/v3/b2_delete_file_version`, {
        method: "POST",
        headers: { Authorization: auth.authorizationToken, "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: storagePath, fileId }),
      });

      if (!res.ok) {
        const erro = await res.json().catch(() => ({}));
        // Já não existe no bucket: para quem chamou, o resultado desejado é o mesmo.
        if (erro?.code === "file_not_present") return jsonResponse({ ok: true }, 200);
        return jsonResponse({ ok: false, error: "Falha ao excluir no Backblaze." }, 502);
      }

      return jsonResponse({ ok: true }, 200);
    }

    return jsonResponse({ ok: false, error: `Ação desconhecida: ${acao ?? "(vazia)"}.` }, 400);
  } catch (erro) {
    console.error("arquivos-b2:", erro);
    return jsonResponse({ ok: false, error: "Erro interno." }, 500);
  }
});
