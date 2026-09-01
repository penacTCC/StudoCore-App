#!/usr/bin/env node
// Teste de carga de `services/sessions.ts` — o caminho mais pisado do app: iniciar e encerrar
// sessão de foco.
//
// Diferente dos dois testes anteriores (presence e postgres_changes), aqui não tem
// mecanismo de fanout pra medir — é tráfego de escrita direto no Postgres via PostgREST.
// A pergunta é outra: quando N pessoas apertam "iniciar sessão" ao mesmo tempo (ex.: todo
// mundo de um grupo começando um pomodoro junto), o INSERT/UPDATE em `sessoes_foco` continua
// rápido, ou a concorrência derruba a latência?
//
// Só 1 identidade real participa pelo mesmo motivo dos testes anteriores: a policy de INSERT
// exige `auth.uid() = user_id`. Isso ainda testa o que importa — throughput de escrita da
// tabela sob concorrência —, porque cada "sessão" simulada é uma linha NOVA (sem contenção de
// lock entre elas); múltiplos usuários reais gerariam a mesma carga no Postgres.
//
// Uso:
//   TEST_EMAIL=teste@gmail.com TEST_SENHA=123456 node --env-file=.env scripts/load/sessions-load.mjs
//   CONCURRENCY=50 TEST_EMAIL=... TEST_SENHA=... node --env-file=.env scripts/load/sessions-load.mjs
//
// Variáveis:
//   CONCURRENCY   quantas sessões "iniciar+encerrar" disparadas juntas em uma rajada (default 20)

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_SENHA = process.env.TEST_SENHA;
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 20);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Faltam EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY (use --env-file=.env).");
  process.exit(1);
}
if (!TEST_EMAIL || !TEST_SENHA) {
  console.error("Faltam TEST_EMAIL e TEST_SENHA (a conta de teste descartável).");
  process.exit(1);
}

// Marcador único por rodada — facilita limpar depois (SQL: delete where disciplina like '[teste-carga-sessions]%').
const MARCADOR = "[teste-carga-sessions]";

function estatisticas(valores) {
  if (valores.length === 0) return { min: 0, media: 0, p95: 0, max: 0 };
  const ordenado = [...valores].sort((a, b) => a - b);
  const soma = ordenado.reduce((a, b) => a + b, 0);
  const p95 = ordenado[Math.floor(ordenado.length * 0.95)] ?? ordenado[ordenado.length - 1];
  return { min: ordenado[0], media: soma / ordenado.length, p95, max: ordenado[ordenado.length - 1] };
}

async function iniciarSessao(client, userId, indice) {
  const t0 = Date.now();
  const { data, error } = await client
    .from("sessoes_foco")
    .insert({
      user_id: userId,
      disciplina: `${MARCADOR} #${indice}`,
      tempo_minutos: 0,
      status: "ativo",
      is_public: false,
    })
    .select("id")
    .single();
  const latencia = Date.now() - t0;
  return { ok: !error, erro: error?.message, latencia, id: data?.id };
}

async function encerrarSessao(client, id) {
  const t0 = Date.now();
  const { error } = await client
    .from("sessoes_foco")
    .update({ status: "salvo", tempo_minutos: 25, concluido_em: new Date().toISOString() })
    .eq("id", id);
  const latencia = Date.now() - t0;
  return { ok: !error, erro: error?.message, latencia };
}

async function main() {
  console.log(`Autenticando como ${TEST_EMAIL}...`);
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_SENHA,
  });
  if (authError || !authData.session) {
    console.error("Falha no login:", authError?.message ?? "sem sessão retornada");
    process.exit(1);
  }
  const userId = authData.user.id;

  console.log(`Disparando ${CONCURRENCY} "iniciar sessão" ao mesmo tempo (rajada única)...`);
  const tRajadaInicio = Date.now();
  const resultadosInsert = await Promise.all(
    Array.from({ length: CONCURRENCY }, (_, i) => iniciarSessao(client, userId, i))
  );
  const duracaoRajadaInsert = Date.now() - tRajadaInicio;

  const insertsOk = resultadosInsert.filter((r) => r.ok);
  const insertsFalha = resultadosInsert.filter((r) => !r.ok);
  const latInsert = estatisticas(insertsOk.map((r) => r.latencia));

  console.log(`  ${insertsOk.length}/${CONCURRENCY} ok em ${duracaoRajadaInsert}ms de parede`);
  if (insertsFalha.length > 0) {
    console.log("  Falhas:", [...new Set(insertsFalha.map((r) => r.erro))]);
  }

  console.log(`Disparando ${insertsOk.length} "encerrar sessão" ao mesmo tempo...`);
  const tRajadaUpdate = Date.now();
  const resultadosUpdate = await Promise.all(insertsOk.map((r) => encerrarSessao(client, r.id)));
  const duracaoRajadaUpdate = Date.now() - tRajadaUpdate;

  const updatesOk = resultadosUpdate.filter((r) => r.ok);
  const updatesFalha = resultadosUpdate.filter((r) => !r.ok);
  const latUpdate = estatisticas(updatesOk.map((r) => r.latencia));

  console.log(`  ${updatesOk.length}/${insertsOk.length} ok em ${duracaoRajadaUpdate}ms de parede`);
  if (updatesFalha.length > 0) {
    console.log("  Falhas:", [...new Set(updatesFalha.map((r) => r.erro))]);
  }

  console.log("\n=== Resultado ===");
  console.log(`Concorrência: ${CONCURRENCY}`);
  console.log(
    `INSERT (iniciar sessão): ${insertsOk.length}/${CONCURRENCY} ok | rajada levou ${duracaoRajadaInsert}ms | ` +
      `latência por request (ms): min=${latInsert.min} media=${latInsert.media.toFixed(0)} ` +
      `p95=${latInsert.p95} max=${latInsert.max}`
  );
  console.log(
    `UPDATE (encerrar sessão): ${updatesOk.length}/${insertsOk.length} ok | rajada levou ${duracaoRajadaUpdate}ms | ` +
      `latência por request (ms): min=${latUpdate.min} media=${latUpdate.media.toFixed(0)} ` +
      `p95=${latUpdate.p95} max=${latUpdate.max}`
  );
  console.log(
    "\nCheck de escala: rode com CONCURRENCY crescente (ex.: 10, 30, 60) e compare a latência\n" +
      "média/p95 entre rodadas. Se ela crescer bem mais rápido que a concorrência (ex.: 3x a\n" +
      "concorrência causa 10x a latência), a escrita da tabela é o gargalo. Falhas em qualquer\n" +
      "escala são sempre um problema, não só questão de tendência."
  );
  console.log(
    `\nLinhas de teste ficaram gravadas com a disciplina começando em "${MARCADOR}" — ` +
      "eu removo com uma query direta depois de você conferir os números."
  );

  process.exit(insertsFalha.length > 0 || updatesFalha.length > 0 ? 1 : 0);
}

main().catch((erro) => {
  console.error("Erro fatal no teste de carga:", erro);
  process.exit(1);
});
