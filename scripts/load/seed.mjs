#!/usr/bin/env node
// Cria as contas de teste no Supabase LOCAL e guarda os ids em scripts/load/.seed.local.json.
//
// Por que contas de verdade, e não uma só repetida: as policies de RLS das tabelas que
// interessam (`sessoes_foco`, `tab_sessao_membros`, `incentivos`) exigem `auth.uid() = user_id`
// para escrever. Com uma única identidade, N "usuários" simulados são na prática N abas da
// mesma pessoa — o banco vê 1 usuário, e o teste não mede concorrência real entre linhas de
// pessoas diferentes. Aqui cada usuário simulado é uma linha em `auth.users` com o seu perfil.
//
// Uso:
//   node scripts/load/seed.mjs                 # 300 usuários, 10 grupos (default)
//   USUARIOS=600 GRUPOS=20 node scripts/load/seed.mjs
//   RECRIAR=1 node scripts/load/seed.mjs       # ignora o cache e semeia de novo
//   PLANO=pro node scripts/load/seed.mjs       # grupos com o teto do plano Pro (50 membros)
//
// PLANO controla o teto de membros por grupo, que a migration `planos_e_limites` aplica por
// trigger a partir do plano do DONO do grupo: `gratis` = 5, `pro` = 50, `carga` = sem teto.
// O default é `carga` porque o objetivo destes testes é achar o limite TÉCNICO; para medir o
// produto como ele é vendido, rode com PLANO=gratis ou PLANO=pro.

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { carregarAmbiente, criarClienteAdmin, emLotes } from "./_comum.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
export const ARQUIVO_SEED = join(AQUI, ".seed.local.json");

const USUARIOS = Number(process.env.USUARIOS ?? 300);
const GRUPOS = Number(process.env.GRUPOS ?? 10);
const PARALELISMO = Number(process.env.PARALELISMO ?? 20);
const PLANO = process.env.PLANO ?? "carga";

export function lerSeed() {
  if (!existsSync(ARQUIVO_SEED)) return null;
  try {
    return JSON.parse(readFileSync(ARQUIVO_SEED, "utf8"));
  } catch {
    return null;
  }
}

export function exigirSeed(minimoUsuarios = 1) {
  const seed = lerSeed();
  if (!seed || seed.usuarios.length < minimoUsuarios) {
    console.error(
      `Faltam contas de teste (preciso de ${minimoUsuarios}, tenho ${seed?.usuarios.length ?? 0}).\n` +
        `Rode: USUARIOS=${minimoUsuarios} node scripts/load/seed.mjs`
    );
    process.exit(1);
  }
  return seed;
}

async function main() {
  const ambiente = carregarAmbiente();
  const admin = criarClienteAdmin(ambiente);

  const cache = process.env.RECRIAR === "1" ? null : lerSeed();
  if (cache && cache.usuarios.length >= USUARIOS && cache.grupos.length >= GRUPOS) {
    // O cache pode ter sobrevivido a um `supabase db reset`, que apaga auth.users. Confere.
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .in("id", cache.usuarios.slice(0, 5).map((u) => u.id));
    if (count === Math.min(5, cache.usuarios.length)) {
      console.log(`Reaproveitando ${cache.usuarios.length} contas já semeadas (${ARQUIVO_SEED}).`);
      return;
    }
    console.log("O cache não bate com o banco (provavelmente houve um db reset). Semeando de novo.");
  }

  console.log(`Semeando ${USUARIOS} contas e ${GRUPOS} grupos em ${ambiente.url}...`);
  const t0 = Date.now();

  // O seed é reexecutável: contas de rodadas anteriores são reaproveitadas em vez de dar
  // "email already registered". Mapeia o que já existe antes de criar o que falta.
  const existentes = new Map();
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 1000 });
    if (error) {
      console.error("Falha listando contas existentes:", error.message);
      process.exit(1);
    }
    for (const u of data.users) if (u.email?.endsWith("@carga.local")) existentes.set(u.email, u.id);
    if (data.users.length < 1000) break;
  }

  const indices = Array.from({ length: USUARIOS }, (_, i) => i);
  const usuarios = await emLotes(indices, PARALELISMO, async (i) => {
    const email = `carga-${i}@carga.local`;
    const jaExiste = existentes.get(email);
    if (jaExiste) return { indice: i, email, id: jaExiste };

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: `carga-${i}-senha`,
      email_confirm: true,
    });
    if (error) return { indice: i, email, id: null, erro: error.message };
    return { indice: i, email, id: data.user.id };
  });

  const criados = usuarios.filter((u) => u.id);
  const falhos = usuarios.filter((u) => !u.id);
  if (falhos.length) {
    console.error(`Falha criando ${falhos.length} contas. Primeiro erro: ${falhos[0].erro}`);
    if (criados.length === 0) process.exit(1);
  }

  const { error: erroPerfis } = await admin.from("profiles").upsert(
    criados.map((u) => ({
      id: u.id,
      nome_real: `Carga ${u.indice}`,
      nome_usuario: `carga_${u.indice}`,
      perfil_publico: true,
    })),
    { onConflict: "id" }
  );
  if (erroPerfis) {
    console.error("Falha criando profiles:", erroPerfis.message);
    process.exit(1);
  }

  // Um plano só do teste de carga, sem nenhum teto, para o limite medido ser o da
  // infraestrutura e não o comercial. Fica no banco local; nunca vai para produção.
  if (PLANO === "carga") {
    const { error: erroPlano } = await admin.from("planos_limites").upsert(
      {
        plano: "carga",
        rotulo: "[teste de carga] sem limites",
        grupos_max: null,
        membros_por_grupo_max: null,
        sala_foco_max: null,
        planos_max: null,
      },
      { onConflict: "plano" }
    );
    if (erroPlano) {
      console.error("Falha criando o plano de carga:", erroPlano.message);
      process.exit(1);
    }
  }

  const { data: grupos, error: erroGrupos } = await admin
    .from("grupos")
    .insert(
      Array.from({ length: GRUPOS }, (_, g) => ({
        nome_grupo: `[carga] grupo ${g}`,
        codigo_convite: `CARGA${g}${Date.now().toString(36).slice(-4)}`.toUpperCase(),
        publico: true,
      }))
    )
    .select("id");
  if (erroGrupos) {
    console.error("Falha criando grupos:", erroGrupos.message);
    process.exit(1);
  }

  // Distribui as contas pelos grupos em round-robin: assim todo grupo tem mais ou menos o
  // mesmo tamanho, que é o que o teste de presença precisa para comparar grupo x total.
  const membros = criados.map((u, i) => ({
    user_id: u.id,
    grupo_id: grupos[i % grupos.length].id,
    administrador: i < grupos.length,
  }));

  // Os donos precisam da assinatura ANTES de o grupo encher: o trigger lê o plano do dono a
  // cada novo membro, e o dono é o primeiro administrador que entrou.
  if (PLANO !== "gratis") {
    const donos = criados.slice(0, grupos.length);
    const { error: erroAssinaturas } = await admin.from("assinaturas").upsert(
      donos.map((u) => ({
        usuario_id: u.id,
        plano: PLANO,
        status: "ativa",
        origem: "teste-de-carga",
      })),
      { onConflict: "usuario_id" }
    );
    if (erroAssinaturas) {
      console.error("Falha criando assinaturas dos donos:", erroAssinaturas.message);
      process.exit(1);
    }
    // Administradores primeiro, para que o dono exista quando os demais entrarem.
    const { error: erroDonos } = await admin.from("membros").upsert(membros.slice(0, grupos.length), {
      onConflict: "user_id,grupo_id",
    });
    if (erroDonos) {
      console.error("Falha criando os donos dos grupos:", erroDonos.message);
      process.exit(1);
    }
  }
  const { error: erroMembros } = await admin.from("membros").upsert(membros, { onConflict: "user_id,grupo_id" });
  if (erroMembros) {
    console.error("Falha criando membros:", erroMembros.message);
    process.exit(1);
  }

  const seed = {
    url: ambiente.url,
    plano: PLANO,
    criadoEm: new Date().toISOString(),
    usuarios: criados.map((u) => ({ id: u.id, email: u.email, indice: u.indice })),
    grupos: grupos.map((g, i) => ({
      id: g.id,
      membros: criados.filter((_, j) => j % grupos.length === i).map((u) => u.id),
    })),
  };
  writeFileSync(ARQUIVO_SEED, JSON.stringify(seed, null, 2));

  console.log(
    `Pronto em ${((Date.now() - t0) / 1000).toFixed(1)}s: ${criados.length} contas, ${grupos.length} grupos ` +
      `(~${Math.round(criados.length / grupos.length)} membros por grupo, plano "${PLANO}").`
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error("Erro no seed:", e);
    process.exit(1);
  });
}
