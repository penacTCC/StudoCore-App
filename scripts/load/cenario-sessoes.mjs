#!/usr/bin/env node
// CENÁRIO 3 — Escrita concorrente: N pessoas começando e encerrando sessão ao mesmo tempo.
//
// É o caminho mais pisado do app e não tem Realtime no meio: é PostgREST escrevendo em
// `sessoes_foco`. O caso real é um grupo inteiro apertando "iniciar" no mesmo minuto, ou o
// fim de um pomodoro coletivo, quando todo mundo grava o resultado junto.
//
// Diferente da versão antiga deste script, cada sessão é de um USUÁRIO diferente, com o seu
// próprio JWT: a política de INSERT é `auth.uid() = user_id`, então N linhas de N pessoas
// exercitam a RLS como em produção — e não N linhas da mesma pessoa.
//
// Uso: CONCURRENCY=60 node scripts/load/cenario-sessoes.mjs

import {
  carregarAmbiente, criarClienteDoUsuario, criarClienteAdmin,
  estatisticas, formatarEstat, publicarResultado,
} from "./_comum.mjs";
import { exigirSeed } from "./seed.mjs";

const CONCURRENCY = Number(process.env.CONCURRENCY ?? 20);
const MARCADOR = "[carga-sessoes]";

async function main() {
  const ambiente = carregarAmbiente();
  const seed = exigirSeed(CONCURRENCY);
  const admin = criarClienteAdmin(ambiente);
  const usuarios = seed.usuarios.slice(0, CONCURRENCY);

  // Os clients são criados antes da rajada: o que se mede é a escrita, não o setup.
  const clientes = usuarios.map((u) => ({ userId: u.id, client: criarClienteDoUsuario(ambiente, u.id) }));

  console.log(`Disparando ${CONCURRENCY} "iniciar sessão" de ${CONCURRENCY} usuários distintos, tudo junto...`);
  const tInicio = Date.now();
  const inserts = await Promise.all(
    clientes.map(async ({ userId, client }, i) => {
      const t0 = Date.now();
      const { data, error } = await client
        .from("sessoes_foco")
        .insert({ user_id: userId, disciplina: `${MARCADOR} #${i}`, tempo_minutos: 0, status: "ativo", is_public: false })
        .select("id")
        .single();
      return { ok: !error, erro: error?.message, ms: Date.now() - t0, id: data?.id, client };
    })
  );
  const duracaoInsert = Date.now() - tInicio;
  const insertsOk = inserts.filter((r) => r.ok);
  if (inserts.length !== insertsOk.length) {
    console.log("  Falhas:", [...new Set(inserts.filter((r) => !r.ok).map((r) => r.erro))]);
  }

  console.log(`Disparando ${insertsOk.length} "encerrar sessão" juntos...`);
  const tUpdate = Date.now();
  const updates = await Promise.all(
    insertsOk.map(async (r) => {
      const t0 = Date.now();
      const { error } = await r.client
        .from("sessoes_foco")
        .update({ status: "salvo", tempo_minutos: 25, concluido_em: new Date().toISOString() })
        .eq("id", r.id);
      return { ok: !error, erro: error?.message, ms: Date.now() - t0 };
    })
  );
  const duracaoUpdate = Date.now() - tUpdate;
  const updatesOk = updates.filter((r) => r.ok);

  const latInsert = estatisticas(insertsOk.map((r) => r.ms));
  const latUpdate = estatisticas(updatesOk.map((r) => r.ms));
  const vazao = ((insertsOk.length + updatesOk.length) / (duracaoInsert + duracaoUpdate)) * 1000;

  console.log("\n=== Resultado ===");
  console.log(`Concorrência: ${CONCURRENCY} usuários distintos`);
  console.log(`INSERT: ${insertsOk.length}/${CONCURRENCY} ok, rajada em ${duracaoInsert}ms — ${formatarEstat(latInsert)}`);
  console.log(`UPDATE: ${updatesOk.length}/${insertsOk.length} ok, rajada em ${duracaoUpdate}ms — ${formatarEstat(latUpdate)}`);
  console.log(`Vazão combinada: ${vazao.toFixed(1)} requisições/s`);

  publicarResultado({
    cenario: "sessoes",
    concorrencia: CONCURRENCY,
    taxaInsert: insertsOk.length / CONCURRENCY,
    taxaUpdate: updatesOk.length / (insertsOk.length || 1),
    insertMs: latInsert,
    updateMs: latUpdate,
    vazao,
  });

  await admin.from("sessoes_foco").delete().like("disciplina", `${MARCADOR}%`);
  process.exit(0);
}

main().catch((e) => {
  console.error("Erro fatal:", e);
  process.exit(1);
});
