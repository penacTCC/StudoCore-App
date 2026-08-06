// Edge Function do botão "mandar força": registra o incentivo, com limite de 3 envios a cada
// 15min por par remetente/destinatário.
//
// Fica no servidor porque o cliente não pode ser a fonte da verdade sobre "posso mandar de
// novo?" — a checagem do cooldown e o INSERT rodam aqui com a service role key (injetada
// automaticamente pelo Supabase em toda Edge Function), pra que a regra não dependa de
// nada que o app diga.
//
// A notificação de quem recebe NÃO sai daqui: push remoto exigiria credenciais do
// Firebase/FCM no Android, que este projeto não usa. Em vez disso o INSERT abaixo viaja por
// Realtime até o aparelho do destinatário, que dispara uma notificação local
// (ver hooks/useForcasRecebidas.ts e services/notificacoesForca.ts).
//
// Deploy: `supabase functions deploy mandar-forca` (sem secret novo).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Janela móvel: até LIMITE_ENVIOS forças por (remetente, destinatário) a cada JANELA_MS.
// Estourou, só libera quando a mais antiga das 3 sair da janela.
const JANELA_MS = 15 * 60 * 1000;
const LIMITE_ENVIOS = 3;

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ ok: false, error: "Não autenticado." }, 401);
    }

    // Client "como o usuário": só serve pra descobrir quem está chamando, a partir do JWT.
    const clienteUsuario = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: erroUsuario } = await clienteUsuario.auth.getUser();
    if (erroUsuario || !user) {
      return jsonResponse({ ok: false, error: "Não autenticado." }, 401);
    }
    const remetenteId = user.id;

    const corpo = await req.json();
    /*
      A torcida é da SALA, não do registro pessoal de estudo do anfitrião (ver a migration
      `20260806140000_salas_foco.sql`). `sessaoId` continua aceito para não quebrar um app
      que ainda não atualizou.
    */
    const salaId = (corpo?.salaId ?? corpo?.sessaoId) as string | undefined;
    const destinatarioId = corpo?.destinatarioId as string | undefined;

    if (!salaId || !destinatarioId) {
      return jsonResponse({ ok: false, error: "Informe 'salaId' e 'destinatarioId'." }, 400);
    }
    if (destinatarioId === remetenteId) {
      return jsonResponse({ ok: false, error: "Você não pode mandar força pra si mesmo." }, 400);
    }

    // Client com service role: bypassa RLS pra checar o cooldown de forma autoritativa e inserir.
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Forças que já mandei pra essa pessoa dentro da janela, da mais antiga pra mais nova.
    const inicioDaJanela = new Date(Date.now() - JANELA_MS).toISOString();
    const { data: recentes, error: erroRecentes } = await admin
      .from("incentivos")
      .select("created_at")
      .eq("remetente_id", remetenteId)
      .eq("destinatario_id", destinatarioId)
      .gt("created_at", inicioDaJanela)
      .order("created_at", { ascending: true });

    if (erroRecentes) {
      console.error("Erro ao checar cooldown:", erroRecentes);
      return jsonResponse({ ok: false, error: "Não foi possível verificar o cooldown." }, 500);
    }

    if (recentes && recentes.length >= LIMITE_ENVIOS) {
      // Libera quando a mais antiga da janela completar 15min.
      const maisAntiga = new Date(recentes[0].created_at).getTime();
      const retryAfterSeconds = Math.max(1, Math.ceil((maisAntiga + JANELA_MS - Date.now()) / 1000));
      return jsonResponse({ ok: false, error: "cooldown", retryAfterSeconds }, 429);
    }

    const { data: incentivo, error: erroInsert } = await admin
      .from("incentivos")
      .insert({ sala_id: salaId, remetente_id: remetenteId, destinatario_id: destinatarioId })
      .select()
      .maybeSingle();

    if (erroInsert) {
      console.error("Erro ao registrar força:", erroInsert);
      return jsonResponse({ ok: false, error: "Não foi possível registrar a força." }, 500);
    }

    // Daqui em diante quem trabalha é o Realtime: o INSERT acima chega no app do
    // destinatário, que mostra a notificação local.
    return jsonResponse({ ok: true, incentivo }, 200);
  } catch (erro) {
    console.error("Erro inesperado em mandar-forca:", erro);
    return jsonResponse({ ok: false, error: "Erro inesperado." }, 500);
  }
});
