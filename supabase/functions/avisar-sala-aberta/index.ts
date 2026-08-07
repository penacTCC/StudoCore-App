// Edge Function do aviso "abriram uma sala de foco no seu grupo".
//
// Roda no servidor pelo mesmo motivo da `mandar-forca`: quem envia precisa ler o token de
// push dos OUTROS, e a RLS de `push_tokens` (corretamente) só deixa cada um ler o próprio.
// Além disso o rate limit não pode morar no cliente — quem controla o app controlaria o
// limite, e um grupo grande viraria máquina de spam.
//
// Deploy: `supabase functions deploy avisar-sala-aberta` (sem secret novo).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enviarPush } from "../_shared/push.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/*
  Só um aviso por grupo a cada 30min.

  Sem isso, um grupo de 15 pessoas numa tarde de estudo vira dezenas de notificações: cada
  pessoa que abre e fecha o app reabre uma sala. A janela é do GRUPO, não de quem abriu —
  o que incomoda quem recebe é o volume total, não quem mandou.

  A janela é medida sobre `salas_foco` em vez de uma tabela de controle nova: a sala
  anterior já é o registro de que houve aviso recente.
*/
const JANELA_AVISO_MS = 30 * 60 * 1000;

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

    const clienteUsuario = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: erroUsuario } = await clienteUsuario.auth.getUser();
    if (erroUsuario || !user) {
      return jsonResponse({ ok: false, error: "Não autenticado." }, 401);
    }

    const corpo = await req.json();
    const salaId = corpo?.salaId as string | undefined;
    if (!salaId) {
      return jsonResponse({ ok: false, error: "Informe 'salaId'." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: sala } = await admin
      .from("salas_foco")
      .select("id, grupo_id, anfitriao_id, criada_em, encerrada_em")
      .eq("id", salaId)
      .maybeSingle();

    if (!sala) {
      return jsonResponse({ ok: false, error: "Sala não encontrada." }, 404);
    }

    /*
      Só o anfitrião da sala avisa sobre ela. Sem esta checagem, qualquer usuário logado
      poderia chamar a função com o id de uma sala qualquer e disparar push pro grupo
      inteiro — o `salaId` vem do cliente e não prova nada sozinho.
    */
    if (sala.anfitriao_id !== user.id) {
      return jsonResponse({ ok: false, error: "Só o anfitrião avisa sobre a sala." }, 403);
    }
    if (sala.encerrada_em) {
      return jsonResponse({ ok: true, avisados: 0, motivo: "sala já encerrada" }, 200);
    }
    if (!sala.grupo_id) {
      // Sala sem grupo é estudo solo: não há quem avisar.
      return jsonResponse({ ok: true, avisados: 0, motivo: "sala sem grupo" }, 200);
    }

    // Rate limit: houve outra sala nesse grupo dentro da janela?
    const inicioDaJanela = new Date(Date.now() - JANELA_AVISO_MS).toISOString();
    const { data: salasRecentes } = await admin
      .from("salas_foco")
      .select("id")
      .eq("grupo_id", sala.grupo_id)
      .neq("id", sala.id)
      .gt("criada_em", inicioDaJanela)
      .limit(1);

    if (salasRecentes && salasRecentes.length > 0) {
      return jsonResponse({ ok: true, avisados: 0, motivo: "aviso recente no grupo" }, 200);
    }

    const [{ data: membros }, { data: perfil }, { data: grupo }] = await Promise.all([
      admin.from("membros").select("user_id").eq("grupo_id", sala.grupo_id),
      admin.from("profiles").select("nome_usuario, nome_real").eq("id", user.id).maybeSingle(),
      admin.from("grupos").select("nome_grupo").eq("id", sala.grupo_id).maybeSingle(),
    ]);

    // Todo mundo do grupo menos quem abriu — avisar o anfitrião da própria sala seria bobo.
    const destinatarios = ((membros ?? []) as Array<{ user_id: string }>)
      .map((m) => m.user_id)
      .filter((id) => id !== user.id);

    if (destinatarios.length === 0) {
      return jsonResponse({ ok: true, avisados: 0, motivo: "ninguém pra avisar" }, 200);
    }

    const nomeAnfitriao =
      (perfil as { nome_usuario?: string; nome_real?: string } | null)?.nome_usuario ||
      (perfil as { nome_usuario?: string; nome_real?: string } | null)?.nome_real ||
      "Alguém";
    const nomeGrupo = (grupo as { nome_grupo?: string } | null)?.nome_grupo;

    // `enviarPush` ainda filtra por preferências (notificações desligadas, não perturbar),
    // então `avisados` é o teto, não o número real de aparelhos que tocaram.
    await enviarPush(
      admin,
      destinatarios.map((destinatarioId) => ({
        destinatarioId,
        title: "📚 Tem gente estudando",
        body: nomeGrupo
          ? `${nomeAnfitriao} abriu uma sala de foco em ${nomeGrupo}. Bora junto?`
          : `${nomeAnfitriao} abriu uma sala de foco. Bora junto?`,
        data: { tipo: "sala-aberta", salaId: sala.id, grupoId: sala.grupo_id },
      }))
    );

    return jsonResponse({ ok: true, avisados: destinatarios.length }, 200);
  } catch (erro) {
    console.error("Erro inesperado em avisar-sala-aberta:", erro);
    return jsonResponse({ ok: false, error: "Erro inesperado." }, 500);
  }
});
