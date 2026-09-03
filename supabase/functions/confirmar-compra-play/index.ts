// Edge Function chamada uma vez, logo depois que o app completa uma compra na Play Store.
//
// Por que existe no servidor: `assinaturas` só aceita escrita da service role (ver RLS na
// migration `20260902120000_planos_e_limites.sql`) — o app nunca poderia gravar "sou Pro"
// sozinho, senão qualquer cliente adulterado se autopromovia. Esta função é a única porta:
// recebe o purchaseToken que o Google deu pro app, confere DIRETO com o Google que aquela
// compra é real e pertence a este pacote/produto, confirma (acknowledge) se preciso, e só
// então grava.
//
// Deploy:
//   supabase secrets set GOOGLE_PLAY_CLIENT_EMAIL=... GOOGLE_PLAY_PRIVATE_KEY=... GOOGLE_PLAY_PACKAGE_NAME=com.studocore.app --project-ref <ref>
//   supabase functions deploy confirmar-compra-play --project-ref <ref> --use-api

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buscarAssinaturaGoogle,
  confirmarAssinaturaGoogle,
  mapearEstadoDoGoogle,
  obterTokenDeAcesso,
} from "../_shared/googlePlay.ts";

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

    // Client "como o usuário": só serve pra descobrir quem está chamando, a partir do JWT.
    // O id nunca vem do corpo — senão qualquer conta poderia confirmar compra de outra.
    const clienteUsuario = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: erroUsuario } = await clienteUsuario.auth.getUser();
    if (erroUsuario || !user) return jsonResponse({ ok: false, error: "Não autenticado." }, 401);

    const corpo = await req.json().catch(() => ({}));
    const purchaseToken = corpo?.purchaseToken as string | undefined;
    const productId = corpo?.productId as string | undefined;
    if (!purchaseToken || !productId) {
      return jsonResponse({ ok: false, error: "Informe 'purchaseToken' e 'productId'." }, 400);
    }

    const accessToken = await obterTokenDeAcesso();
    const assinaturaGoogle = await buscarAssinaturaGoogle(purchaseToken, accessToken);

    if (assinaturaGoogle.produtoId && assinaturaGoogle.produtoId !== productId) {
      return jsonResponse({ ok: false, error: "O produto da compra não confere." }, 400);
    }

    if (assinaturaGoogle.estado === "SUBSCRIPTION_STATE_PENDING") {
      // Compra iniciada mas ainda não paga (ex: aguardando aprovação de pagamento).
      // Não vira Pro ainda — o app deve tentar de novo mais tarde (o listener de compra
      // do react-native-iap recebe a atualização quando o pagamento for aprovado).
      return jsonResponse({ ok: true, pendente: true }, 200);
    }

    if (!assinaturaGoogle.reconhecida) {
      await confirmarAssinaturaGoogle(productId, purchaseToken, accessToken);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // O purchase_token já pode estar preso a OUTRA conta (reinstalação sob conta diferente,
    // token reenviado, fraude). Trocar o dono silenciosamente roubaria a assinatura de quem
    // pagou por ela — melhor recusar e deixar o suporte investigar.
    const { data: dono } = await admin
      .from("assinaturas")
      .select("usuario_id")
      .eq("purchase_token", purchaseToken)
      .maybeSingle();
    if (dono && dono.usuario_id !== user.id) {
      return jsonResponse({ ok: false, error: "Esta compra já está associada a outra conta." }, 409);
    }

    const status = mapearEstadoDoGoogle(assinaturaGoogle.estado, assinaturaGoogle.expiraEm);

    const { error: erroUpsert } = await admin.from("assinaturas").upsert({
      usuario_id: user.id,
      plano: "pro",
      status,
      expira_em: assinaturaGoogle.expiraEm,
      origem: "play_store",
      purchase_token: purchaseToken,
      order_id: assinaturaGoogle.orderId,
      product_id: productId,
      atualizado_em: new Date().toISOString(),
    });

    if (erroUpsert) {
      console.error("confirmar-compra-play upsert:", erroUpsert);
      return jsonResponse({ ok: false, error: "Não foi possível ativar a assinatura." }, 500);
    }

    return jsonResponse({ ok: true, status, expiraEm: assinaturaGoogle.expiraEm }, 200);
  } catch (erro) {
    console.error("Erro inesperado em confirmar-compra-play:", erro);
    return jsonResponse({ ok: false, error: "Erro inesperado." }, 500);
  }
});
