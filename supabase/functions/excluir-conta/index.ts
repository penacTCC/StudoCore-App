// Edge Function "excluir conta": apaga de vez o usuário que está chamando.
//
// Fica no servidor porque apagar de auth.users exige a service role key — o app nunca tem
// essa chave, e nenhuma policy de RLS dá a um cliente o direito de remover a própria linha
// de auth. A função só apaga QUEM ESTÁ CHAMANDO: o id sai do JWT, nunca do corpo do
// request, então não dá pra pedir a exclusão de outra pessoa.
//
// A maior parte dos dados some sozinha: profiles.id referencia auth.users com ON DELETE
// CASCADE, e sessoes_foco / membros / gamificacoes / incentivos / tab_sessao_membros /
// banco_erros (e materias_usuario, planos, preferencias_cronograma, rotina_semanal_blocos,
// que apontam direto pra auth.users) também cascateiam. As tabelas do SClass e
// alunos_turmas usam NO ACTION e travariam o DELETE, por isso são limpas antes, na mão.
// arquivos.user_id é SET NULL de propósito: material enviado pra um grupo continua lá,
// sem dono. Storage não cascateia com o Postgres, então as fotos de sessão do bucket
// `sessao-fotos` são apagadas na mão, antes do DELETE do usuário.
//
// Deploy: `supabase functions deploy excluir-conta` (sem secret novo).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tabelas que referenciam o usuário sem ON DELETE CASCADE: precisam sair antes do DELETE
// em auth.users, senão o banco recusa a exclusão por violação de chave estrangeira.
const TABELAS_SEM_CASCADE: { tabela: string; coluna: string }[] = [
  { tabela: "alunos_turmas", coluna: "user_id" },
  { tabela: "sclass_conquistas_alunos", coluna: "user_id" },
  { tabela: "sclass_professores_turmas", coluna: "user_id" },
  { tabela: "sclass_progresso_roadmaps", coluna: "user_id" },
];

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

    const admin = createClient(supabaseUrl, serviceRoleKey);

    for (const { tabela, coluna } of TABELAS_SEM_CASCADE) {
      const { error } = await admin.from(tabela).delete().eq(coluna, user.id);
      if (error) {
        console.error(`Erro ao limpar ${tabela}:`, error);
        return jsonResponse({ ok: false, error: "Não foi possível limpar seus dados." }, 500);
      }
    }

    // Storage não tem CASCADE com o Postgres: sem isto, a foto de cada sessão de foco
    // sobrevive à conta apagada. O caminho é sempre `${user.id}/...` (services/fotosSessao.ts),
    // então listar a pasta do usuário já basta. Best-effort de propósito — um bucket órfão
    // é bem melhor do que travar a exclusão de conta que a pessoa pediu.
    const { data: fotosSessao, error: erroListarFotos } = await admin.storage
      .from("sessao-fotos")
      .list(user.id);
    if (erroListarFotos) {
      console.error("Erro ao listar fotos de sessão do usuário:", erroListarFotos);
    } else if (fotosSessao && fotosSessao.length > 0) {
      const caminhos = fotosSessao.map((arquivo) => `${user.id}/${arquivo.name}`);
      const { error: erroRemoverFotos } = await admin.storage.from("sessao-fotos").remove(caminhos);
      if (erroRemoverFotos) {
        console.error("Erro ao apagar fotos de sessão do usuário:", erroRemoverFotos);
      }
    }

    const { error: erroDelete } = await admin.auth.admin.deleteUser(user.id);
    if (erroDelete) {
      console.error("Erro ao excluir usuário:", erroDelete);
      return jsonResponse({ ok: false, error: "Não foi possível excluir a conta." }, 500);
    }

    return jsonResponse({ ok: true }, 200);
  } catch (erro) {
    console.error("Erro inesperado em excluir-conta:", erro);
    return jsonResponse({ ok: false, error: "Erro inesperado." }, 500);
  }
});
