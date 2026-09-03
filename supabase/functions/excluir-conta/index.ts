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
// sem dono. Isso vale pro que foi COMPARTILHADO — o arquivo que a pessoa só guardou pra si
// não tem esse motivo, e virava lixo caro: com a RLS do Cofre, linha sem dono não passa em
// nenhum braço da policy de SELECT, então some pra todo mundo, e a ação `excluir` da
// `arquivos-b2` compara `user_id` com quem chamou e nunca casa com NULL. Ninguém mais
// consegue enxergar nem apagar, mas o objeto continua ocupando (e cobrando) espaço no B2.
// Por isso o material exclusivo sai do bucket e do banco aqui, antes do DELETE do usuário.
// Storage do Supabase também não cascateia, então as fotos de sessão do bucket
// `sessao-fotos` são apagadas na mão pelo mesmo motivo.
//
// Antes de apagar o usuário, a função chama `sair_do_grupo` para cada grupo do qual ele
// participa. Essa RPC promove outro administrador quando necessário e apaga o grupo se o
// usuário era o último membro. Fazer isso antes do deleteUser é essencial: o CASCADE da
// FK em `membros` removeria apenas o vínculo e deixaria um grupo vazio para trás.
//
// Deploy: `supabase functions deploy excluir-conta --use-api` (usa os secrets B2_* que a
// `arquivos-b2` já configurou; secrets são do projeto, não da função).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { apagarArquivoB2, autorizar } from "../_shared/backblaze.ts";

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

/**
 * Retira a pessoa de todos os grupos antes de excluir a conta.
 *
 * A lista é lida com o client administrativo para não depender das policies de SELECT,
 * mas cada saída roda como o próprio usuário: `sair_do_grupo` usa `auth.uid()` para
 * transferir a administração ou apagar o grupo que ficou sem membros.
 */
async function sairDeTodosOsGrupos(
  admin: ReturnType<typeof createClient>,
  clienteUsuario: ReturnType<typeof createClient>,
  userId: string
) {
  const { data: vinculos, error: erroVinculos } = await admin
    .from("membros")
    .select("grupo_id")
    .eq("user_id", userId);

  if (erroVinculos) {
    console.error("Erro ao listar grupos antes da exclusão da conta:", erroVinculos);
    return false;
  }

  for (const vinculo of vinculos ?? []) {
    const { error } = await clienteUsuario.rpc("sair_do_grupo", {
      p_grupo_id: vinculo.grupo_id,
      p_novo_admin_id: null,
    });

    if (error) {
      console.error(`Erro ao sair do grupo ${vinculo.grupo_id}:`, error);
      return false;
    }
  }

  return true;
}

/**
 * Apaga do B2 e do banco os arquivos que a pessoa NÃO compartilhou com nenhum grupo.
 *
 * O que está em `arquivos_grupos` fica: é o material que outras pessoas ainda usam, e o
 * SET NULL da FK existe justamente pra ele sobreviver ao autor.
 *
 * Best-effort de propósito, como as fotos de sessão: travar a exclusão de conta que a
 * pessoa pediu por causa de uma falha no bucket seria pior. Quando o B2 recusa, a LINHA É
 * MANTIDA — ela guarda o `storage_path` e o `backblaze_file_id`, que é a única informação
 * capaz de encontrar o objeto depois. Apagar a linha aí perderia o rastro e deixaria o
 * arquivo pago no bucket para sempre, sem ninguém saber que ele existe.
 */
async function limparArquivosExclusivos(
  admin: ReturnType<typeof createClient>,
  userId: string
) {
  const { data: meusArquivos, error: erroListar } = await admin
    .from("arquivos")
    .select("id, storage_path, backblaze_file_id")
    .eq("user_id", userId);

  if (erroListar) {
    console.error("Erro ao listar arquivos do usuário:", erroListar);
    return;
  }
  if (!meusArquivos || meusArquivos.length === 0) return;

  const { data: vinculos, error: erroVinculos } = await admin
    .from("arquivos_grupos")
    .select("arquivo_id")
    .in("arquivo_id", meusArquivos.map((a) => a.id));

  if (erroVinculos) {
    // Sem saber o que foi compartilhado, apagar seria arriscar levar junto material de
    // grupo. Melhor não apagar nada: o pior caso vira o comportamento antigo.
    console.error("Erro ao checar compartilhamentos; nada será apagado:", erroVinculos);
    return;
  }

  const compartilhados = new Set((vinculos ?? []).map((v) => v.arquivo_id));
  const exclusivos = meusArquivos.filter((a) => !compartilhados.has(a.id));
  if (exclusivos.length === 0) return;

  // Uma autorização só para o lote inteiro.
  const auth = await autorizar().catch((erro) => {
    console.error("Erro ao autorizar no Backblaze; arquivos mantidos:", erro);
    return null;
  });
  if (!auth) return;

  const idsParaApagar: string[] = [];
  for (const arquivo of exclusivos) {
    // Reserva que nunca completou o upload: não há objeto no bucket, só a linha.
    if (!arquivo.backblaze_file_id) {
      idsParaApagar.push(arquivo.id as string);
      continue;
    }

    const apagado = await apagarArquivoB2(
      auth,
      arquivo.storage_path as string,
      arquivo.backblaze_file_id as string
    );
    if (apagado.ok) {
      idsParaApagar.push(arquivo.id as string);
    } else {
      console.error(`Erro ao apagar ${arquivo.storage_path} no B2:`, apagado.detalhe);
    }
  }

  if (idsParaApagar.length === 0) return;

  const { error: erroApagar } = await admin.from("arquivos").delete().in("id", idsParaApagar);
  if (erroApagar) {
    console.error("Erro ao remover registros de arquivos:", erroApagar);
  }
}

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

    /*
      Não deixar este trabalho para o CASCADE de auth.users. A remoção explícita passa
      pela regra de domínio de cada grupo: transfere a administração quando há outros
      membros e apaga o grupo quando esta era a última pessoa.

      Também precisa acontecer antes de `limparArquivosExclusivos`: ao apagar um grupo
      vazio, os vínculos em arquivos_grupos caem por CASCADE e os arquivos que deixaram de
      ser compartilhados podem ser reconhecidos e limpos corretamente.
    */
    const saiuDosGrupos = await sairDeTodosOsGrupos(admin, clienteUsuario, user.id);
    if (!saiuDosGrupos) {
      return jsonResponse({ ok: false, error: "Não foi possível remover você dos seus grupos." }, 500);
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

    // Precisa vir ANTES do deleteUser: depois dele o SET NULL já apagou o vínculo e não há
    // mais como saber quais arquivos eram desta pessoa.
    await limparArquivosExclusivos(admin, user.id);

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
