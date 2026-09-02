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
//   - upload:   só o resultado do envio; o token de escrita nunca sai do servidor
//   - download: um link assinado com validade de 1 hora, só se a RLS deixar ler o arquivo
//   - exclusão: nada — quem apaga é esta função, depois de conferir que o arquivo é seu
//
// O arquivo passa por aqui no upload para que cota/tamanho sejam enforcement de servidor.
// Como o app limita arquivo a 25 MB, o corpo binário continua dentro de um tamanho
// controlado; em troca, nenhum token de escrita do B2 sai para o cliente.
//
// Deploy:
//   supabase secrets set B2_KEY_ID=... B2_APPLICATION_KEY=... B2_BUCKET_ID=... --project-ref <ref>
//   supabase functions deploy arquivos-b2 --project-ref <ref> --use-api

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  apagarArquivoB2,
  autorizar,
  bucketId,
  bucketNome,
  encodeB2FileName,
  type AutorizacaoB2,
} from "../_shared/backblaze.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-acao, x-storage-path, x-mime-type",
};

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });

type UsoDoPlano = {
  limites?: {
    armazenamento_bytes?: number | null;
    arquivo_bytes_max?: number | null;
  };
  uso?: {
    armazenamento_bytes?: number | null;
  };
};

function hex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function subirArquivoB2(auth: AutorizacaoB2, storagePath: string, mimeType: string, bytes: ArrayBuffer) {
  const urlRes = await fetch(`${auth.apiUrl}/b2api/v3/b2_get_upload_url`, {
    method: "POST",
    headers: { Authorization: auth.authorizationToken, "Content-Type": "application/json" },
    body: JSON.stringify({ bucketId: bucketId() }),
  });

  if (!urlRes.ok) throw new Error("Backblaze não devolveu URL de upload.");

  const upload = await urlRes.json();
  const sha1 = hex(await crypto.subtle.digest("SHA-1", bytes));
  const res = await fetch(upload.uploadUrl, {
    method: "POST",
    headers: {
      Authorization: upload.authorizationToken,
      "X-Bz-File-Name": encodeB2FileName(storagePath),
      "Content-Type": mimeType,
      "X-Bz-Content-Sha1": sha1,
      "Content-Length": String(bytes.byteLength),
    },
    body: bytes,
  });

  if (!res.ok) {
    const detalhe = await res.text().catch(() => "");
    throw new Error(`Falha no upload ao Backblaze (${res.status}): ${detalhe.slice(0, 180)}`);
  }

  return await res.json();
}

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

    const acaoHeader = req.headers.get("x-acao") ?? undefined;

    if (acaoHeader === "upload") {
      const storagePath = req.headers.get("x-storage-path") ?? "";
      const mimeType = req.headers.get("x-mime-type") || req.headers.get("content-type") || "application/octet-stream";
      if (!storagePath) return jsonResponse({ ok: false, error: "Informe 'storagePath'." }, 400);

      const bytes = await req.arrayBuffer();
      if (bytes.byteLength <= 0) return jsonResponse({ ok: false, error: "Arquivo vazio." }, 400);

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

      const { data: uso, error: erroUso } = await clienteUsuario.rpc("uso_do_plano");
      if (erroUso || !uso) {
        return jsonResponse({ ok: false, error: "Não foi possível validar sua cota de armazenamento." }, 503);
      }

      const estado = uso as UsoDoPlano;
      const arquivoMax = estado.limites?.arquivo_bytes_max ?? null;
      const armazenamentoMax = estado.limites?.armazenamento_bytes ?? null;
      const armazenamentoUsado = estado.uso?.armazenamento_bytes ?? 0;

      if (arquivoMax !== null && bytes.byteLength > arquivoMax) {
        return jsonResponse({ ok: false, error: "Esse arquivo é grande demais. O limite por arquivo é 25 MB." }, 413);
      }

      if (armazenamentoMax !== null && armazenamentoUsado + bytes.byteLength > armazenamentoMax) {
        return jsonResponse({ ok: false, error: "Seu espaço acabou. Apague algum arquivo ou assine o Pro para ampliar o Cofre." }, 403);
      }

      const titulo = storagePath.split("/").pop() || "arquivo";
      const disciplina = storagePath.split("/")[0] || "Geral";
      const { data: reserva, error: erroReserva } = await admin
        .from("arquivos")
        .insert({
          user_id: user.id,
          titulo,
          disciplina,
          storage_path: storagePath,
          tamanho_bytes: bytes.byteLength,
          pendente_upload: true,
        })
        .select("id")
        .single();

      if (erroReserva || !reserva) {
        console.error("arquivos-b2 reserva:", erroReserva);
        if (erroReserva?.message?.includes("LIMITE_PLANO:tamanho_do_arquivo")) {
          return jsonResponse({ ok: false, error: "Esse arquivo é grande demais. O limite por arquivo é 25 MB." }, 413);
        }
        if (erroReserva?.message?.includes("LIMITE_PLANO:armazenamento")) {
          return jsonResponse({ ok: false, error: "Seu espaço acabou. Apague algum arquivo ou assine o Pro para ampliar o Cofre." }, 403);
        }
        if (erroReserva?.code === "23503") {
          return jsonResponse({ ok: false, error: "Perfil do usuário não encontrado para reservar armazenamento." }, 403);
        }
        if (erroReserva?.code === "42501") {
          return jsonResponse({ ok: false, error: "Permissão recusada ao reservar armazenamento. Verifique as migrations/RLS do Cofre." }, 403);
        }
        /* Erro que não é do usuário: schema fora do esperado, banco fora do ar, coluna que
           mudou. Vai como 500 porque 403 dizia "você não pode" para um problema que não era
           dele — foi assim que um NOT NULL esquecido em `backblaze_file_id` passou tempo
           parecendo falta de cota. O código do Postgres viaja junto: não vaza nada sobre
           outros usuários e é o que separa "seu banco está desatualizado" de "caiu". */
        return jsonResponse({
          ok: false,
          error: "Não foi possível reservar armazenamento.",
          codigo: erroReserva?.code ?? null,
        }, 500);
      }

      let enviado;
      try {
        enviado = await subirArquivoB2(await autorizar(), storagePath, mimeType, bytes);
      } catch (erro) {
        await admin.from("arquivos").delete().eq("id", reserva.id);
        throw erro;
      }

      await admin
        .from("arquivos")
        .update({ backblaze_file_id: enviado.fileId })
        .eq("id", reserva.id);

      return jsonResponse({
        ok: true,
        id: reserva.id,
        fileId: enviado.fileId,
        fileName: enviado.fileName,
        contentLength: enviado.contentLength ?? bytes.byteLength,
      }, 200);
    }

    const corpo = await req.json().catch(() => ({}));
    const acao = corpo?.acao as string | undefined;

    /* Upload direto antigo. Mantido só para responder explicitamente que o contrato foi
       desativado; o app atual usa `x-acao: upload` e não recebe token de escrita do B2. */
    if (acao === "urlUpload") {
      return jsonResponse({ ok: false, error: "Upload direto desativado." }, 410);
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
        { ok: true, url: `${auth.downloadUrl}/file/${bucketNome()}/${caminho}?Authorization=${dados.authorizationToken}` },
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
        .select("id, user_id, backblaze_file_id")
        .eq("storage_path", storagePath)
        .maybeSingle();

      if (!arquivo) return jsonResponse({ ok: false, error: "Arquivo não encontrado." }, 404);
      if (arquivo.user_id !== user.id) {
        return jsonResponse({ ok: false, error: "Este arquivo não é seu." }, 403);
      }

      if (arquivo.backblaze_file_id && arquivo.backblaze_file_id !== fileId) {
        return jsonResponse({ ok: false, error: "Metadados do arquivo não conferem." }, 403);
      }

      if (arquivo.backblaze_file_id) {
        const apagado = await apagarArquivoB2(await autorizar(), storagePath, arquivo.backblaze_file_id);
        if (!apagado.ok) {
          console.error("arquivos-b2 excluir:", apagado.detalhe);
          return jsonResponse({ ok: false, error: "Falha ao excluir no Backblaze." }, 502);
        }
      }

      const { error: erroDelete } = await admin.from("arquivos").delete().eq("id", arquivo.id);
      if (erroDelete) {
        return jsonResponse({ ok: false, error: "Arquivo apagado, mas não foi possível remover o registro." }, 500);
      }

      return jsonResponse({ ok: true }, 200);
    }

    return jsonResponse({ ok: false, error: `Ação desconhecida: ${acao ?? "(vazia)"}.` }, 400);
  } catch (erro) {
    console.error("arquivos-b2:", erro);
    return jsonResponse({ ok: false, error: "Erro interno." }, 500);
  }
});
