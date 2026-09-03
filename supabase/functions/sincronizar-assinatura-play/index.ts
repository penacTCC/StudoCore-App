// Reconciliação da assinatura Play: chamada pelo app quando a tela de plano abre ou o app
// volta pro primeiro plano, para pegar renovação/cancelamento/expiração sem depender de
// webhook (RTDN) — decisão deliberada para o lançamento, ver `docs/project-context.md` §8.
// Isso significa que uma mudança de estado só reflete quando o usuário reabre o app; é uma
// defasagem aceita, não um esquecimento.
//
// Deploy:
//   supabase secrets set GOOGLE_PLAY_CLIENT_EMAIL=... GOOGLE_PLAY_PRIVATE_KEY=... GOOGLE_PLAY_PACKAGE_NAME=com.studocore.app --project-ref <ref>
//   supabase functions deploy sincronizar-assinatura-play --project-ref <ref> --use-api

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buscarAssinaturaGoogle, mapearEstadoDoGoogle, obterTokenDeAcesso } from "../_shared/googlePlay.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ ok: false, error: "Não autenticado." }, 401);

    const clienteUsuario = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: erroUsuario } = await clienteUsuario.auth.getUser();
    if (erroUsuario || !user) return jsonResponse({ ok: false, error: "Não autenticado." }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: assinatura, error: erroLeitura } = await admin
      .from("assinaturas")
      .select("purchase_token, product_id, status, expira_em")
      .eq("usuario_id", user.id)
      .maybeSingle();

    if (erroLeitura) {
      console.error("sincronizar-assinatura-play leitura:", erroLeitura);
      return jsonResponse({ ok: false, error: "Não foi possível ler a assinatura." }, 500);
    }

    // Sem token guardado: conta grátis, de cortesia, ou assinatura manual — nada a
    // reconciliar com o Google.
    if (!assinatura?.purchase_token || !assinatura?.product_id) {
      return jsonResponse({ ok: true, alterado: false }, 200);
    }

    const accessToken = await obterTokenDeAcesso();
    const assinaturaGoogle = await buscarAssinaturaGoogle(assinatura.purchase_token, accessToken);
    const status = mapearEstadoDoGoogle(assinaturaGoogle.estado, assinaturaGoogle.expiraEm);

    const mudou = status !== assinatura.status || assinaturaGoogle.expiraEm !== assinatura.expira_em;
    if (!mudou) {
      return jsonResponse({ ok: true, alterado: false }, 200);
    }

    const { error: erroUpdate } = await admin
      .from("assinaturas")
      .update({
        status,
        expira_em: assinaturaGoogle.expiraEm,
        order_id: assinaturaGoogle.orderId,
        atualizado_em: new Date().toISOString(),
      })
      .eq("usuario_id", user.id);

    if (erroUpdate) {
      console.error("sincronizar-assinatura-play update:", erroUpdate);
      return jsonResponse({ ok: false, error: "Não foi possível atualizar a assinatura." }, 500);
    }

    return jsonResponse({ ok: true, alterado: true, status, expiraEm: assinaturaGoogle.expiraEm }, 200);
  } catch (erro) {
    console.error("Erro inesperado em sincronizar-assinatura-play:", erro);
    return jsonResponse({ ok: false, error: "Erro inesperado." }, 500);
  }
});
