// Push de "fulano curtiu" / "fulano comentou".
//
// Diferente de `mandar-forca`, esta função NÃO grava nada de conteúdo: a curtida e o
// comentário já foram inseridos pelo app, com a RLS decidindo se podiam, e o gatilho
// `comunidade_notificar_interacao` já criou a linha em `notificacoes`. O que
// falta é só o push, que precisa da service role key para ler `push_tokens` de outra
// pessoa — daí ele viver aqui.
//
// Isso é o que impede a forja: o app não diz o texto nem para quem notificar. Ele diz
// "acabei de interagir com esta publicação", e a função procura a notificação PENDENTE
// que o banco criou em nome dele. Sem essa linha, nenhum push sai.
//
// Chamada em fire-and-forget pelo app (ver services/notificacoes.ts). Se falhar,
// a notificação continua na caixa de entrada de quem recebeu — só não toca o aparelho.
//
// Deploy: `supabase functions deploy avisar-interacao` (sem secret novo).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CANAL_COMUNIDADE, enviarPush } from "../_shared/push.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Curtir cinco publicações de alguém em sequência é uma coisa só acontecendo; virar cinco
// pushes seria motivo para desligar as notificações. Dentro da janela, a notificação ainda
// entra na caixa — só não toca o aparelho de novo.
const JANELA_CURTIDAS_MS = 10 * 60 * 1000;

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });

/** Como a publicação é chamada no corpo da notificação. */
const NOME_DA_ORIGEM: Record<string, string> = {
  galeria: "sua foto de estudo",
  arquivo: "seu arquivo",
  plano: "seu plano",
};

/** Comentário longo vira reticências: a notificação do sistema corta de qualquer jeito. */
function resumir(texto: string, limite = 90): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  return limpo.length <= limite ? limpo : `${limpo.slice(0, limite - 1)}…`;
}

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
    const atorId = user.id;

    const corpo = await req.json();
    const tipo = corpo?.tipo as string | undefined;
    const origem = corpo?.origem as string | undefined;
    const referenciaId = corpo?.referenciaId as string | undefined;

    if (!origem || !referenciaId || (tipo !== "curtida" && tipo !== "comentario")) {
      return jsonResponse({ ok: false, error: "Informe 'tipo', 'origem' e 'referenciaId'." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // A notificação que o gatilho criou por esta interação, ainda sem push. Mais de uma
    // só acontece com comentário (um por linha) — todas são avisadas de uma vez, o que
    // também cobre o caso de um push anterior ter falhado.
    //
    // A tabela é a caixa do app inteiro desde a migration 20260807240000; `origem` e
    // `tipo` já restringem à Comunidade, então nenhum filtro por categoria é preciso aqui.
    const { data: pendentes, error: erroPendentes } = await admin
      .from("notificacoes")
      .select("id, destinatario_id, tipo, criado_em")
      .eq("ator_id", atorId)
      .eq("origem", origem)
      .eq("referencia_id", referenciaId)
      .eq("tipo", tipo)
      .eq("push_enviado", false)
      .order("criado_em", { ascending: true });

    if (erroPendentes) {
      console.error("Erro ao buscar notificação pendente:", erroPendentes);
      return jsonResponse({ ok: false, error: "Não foi possível avisar." }, 500);
    }

    // Nada pendente é o caso normal de quem curte o próprio post, de publicação fora do
    // ar ou de push já mandado. Não é erro.
    if (!pendentes || pendentes.length === 0) {
      return jsonResponse({ ok: true, enviados: 0 }, 200);
    }

    const destinatarioId = pendentes[0].destinatario_id as string;

    const { data: perfil } = await admin
      .from("profiles")
      .select("nome_usuario, nome_real")
      .eq("id", atorId)
      .maybeSingle();

    const nomeAtor =
      (perfil as { nome_usuario?: string; nome_real?: string } | null)?.nome_usuario ||
      (perfil as { nome_usuario?: string; nome_real?: string } | null)?.nome_real ||
      "Alguém";

    const alvo = NOME_DA_ORIGEM[origem] ?? "sua publicação";

    let deveNotificar = true;

    if (tipo === "curtida") {
      // Já tocou o aparelho dessa pessoa por uma curtida minha há pouco?
      const { count } = await admin
        .from("notificacoes")
        .select("id", { count: "exact", head: true })
        .eq("ator_id", atorId)
        .eq("destinatario_id", destinatarioId)
        .eq("tipo", "curtida")
        .eq("push_enviado", true)
        .gt("criado_em", new Date(Date.now() - JANELA_CURTIDAS_MS).toISOString());

      deveNotificar = (count ?? 0) === 0;
    }

    if (deveNotificar) {
      const { data: comentario } = tipo === "comentario"
        ? await admin
          .from("comunidade_comentarios")
          .select("texto")
          .eq("user_id", atorId)
          .eq("origem", origem)
          .eq("referencia_id", referenciaId)
          .order("criado_em", { ascending: false })
          .limit(1)
          .maybeSingle()
        : { data: null };

      const texto = (comentario as { texto?: string } | null)?.texto;

      await enviarPush(admin, [
        {
          destinatarioId,
          title: tipo === "curtida" ? "❤️ Nova curtida" : "💬 Novo comentário",
          body: tipo === "curtida"
            ? `${nomeAtor} curtiu ${alvo}.`
            : texto
              ? `${nomeAtor}: ${resumir(texto)}`
              : `${nomeAtor} comentou em ${alvo}.`,
          data: { tipo: "comunidade" },
          canal: CANAL_COMUNIDADE,
        },
      ]);
    }

    // Marcado mesmo quando a janela segurou o push: o que a coluna quer dizer é "esta
    // notificação já foi tratada", não "o Expo aceitou". Sem isso, uma chamada repetida
    // dela recomeçaria a contagem da janela.
    await admin
      .from("notificacoes")
      .update({ push_enviado: true })
      .in("id", pendentes.map((n) => n.id));

    return jsonResponse({ ok: true, enviados: deveNotificar ? 1 : 0 }, 200);
  } catch (erro) {
    console.error("Erro inesperado em avisar-interacao:", erro);
    return jsonResponse({ ok: false, error: "Erro inesperado." }, 500);
  }
});
