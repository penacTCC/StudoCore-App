#!/usr/bin/env node
// CENÁRIO 5 — Volume de registros armazenados em `sessoes_foco`.
//
// Este não é teste de concorrência. Ele semeia N registros e mede consultas quentes do app:
// histórico pessoal, feed do grupo e ranking. O tamanho do banco é lido via `podman exec`
// quando o container local está disponível.
//
// Uso: REGISTROS=10000 node scripts/load/cenario-volumetria.mjs

import { spawnSync } from "node:child_process";
import {
  carregarAmbiente, criarClienteDoUsuario, criarClienteAdmin,
  dataLocalISO, estatisticas, formatarEstat, publicarResultado,
} from "./_comum.mjs";
import { exigirSeed } from "./seed.mjs";

const REGISTROS = Number(process.env.REGISTROS ?? 1000);
const LOTE = Number(process.env.LOTE ?? 1000);
const CONSULTAS = Number(process.env.CONSULTAS ?? 10);
const MARCADOR = "[carga-volumetria]";

function tamanhoBancoLocal() {
  const r = spawnSync("podman", [
    "exec",
    "-i",
    "supabase_db_StudoCore-Mobile",
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-Atc",
    "select pg_size_pretty(pg_database_size(current_database()))",
  ], { encoding: "utf8" });
  if (r.status !== 0) return null;
  return r.stdout.trim() || null;
}

async function main() {
  const ambiente = carregarAmbiente();
  const seed = exigirSeed(1);
  const admin = criarClienteAdmin(ambiente);
  const grupo = seed.grupos[0];
  const membros = grupo.membros.length ? grupo.membros : seed.usuarios.map((u) => u.id);
  const hoje = dataLocalISO();

  console.log(`Limpando volumetria anterior e semeando ${REGISTROS} registros em sessoes_foco...`);
  await admin.from("sessoes_foco").delete().like("disciplina", `${MARCADOR}%`);

  let inseridos = 0;
  const tSeed = Date.now();
  while (inseridos < REGISTROS) {
    const tamanho = Math.min(LOTE, REGISTROS - inseridos);
    const linhas = Array.from({ length: tamanho }, (_, j) => {
      const i = inseridos + j;
      const userId = membros[i % membros.length];
      return {
        user_id: userId,
        grupo_id: grupo.id,
        disciplina: `${MARCADOR} #${i}`,
        tempo_minutos: 10 + (i % 80),
        questoes_respondidas: i % 20,
        questoes_acertadas: i % 15,
        data_sessao: hoje,
        status: "salvo",
        is_public: i % 4 !== 0,
        concluido_em: new Date().toISOString(),
      };
    });
    const { error } = await admin.from("sessoes_foco").insert(linhas);
    if (error) {
      console.error(`Falha inserindo lote a partir de ${inseridos}:`, error.message);
      process.exit(1);
    }
    inseridos += tamanho;
    if (inseridos % (LOTE * 5) === 0 || inseridos === REGISTROS) {
      console.log(`  ${inseridos}/${REGISTROS}`);
    }
  }
  const msSeed = Date.now() - tSeed;

  const usuario = seed.usuarios.find((u) => membros.includes(u.id)) ?? seed.usuarios[0];
  const client = criarClienteDoUsuario(ambiente, usuario.id);
  const historico = [];
  const feed = [];
  const ranking = [];

  for (let i = 0; i < CONSULTAS; i++) {
    let ini = Date.now();
    const h = await client
      .from("sessoes_foco")
      .select("id, disciplina, tempo_minutos, data_sessao, created_at")
      .eq("user_id", usuario.id)
      .eq("status", "salvo")
      .order("created_at", { ascending: false })
      .limit(50);
    if (h.error) throw new Error(`histórico: ${h.error.message}`);
    historico.push(Date.now() - ini);

    ini = Date.now();
    const f = await client
      .from("sessoes_foco")
      .select("id, user_id, disciplina, tempo_minutos, data_sessao, created_at")
      .eq("grupo_id", grupo.id)
      .eq("status", "salvo")
      .order("created_at", { ascending: false })
      .limit(50);
    if (f.error) throw new Error(`feed: ${f.error.message}`);
    feed.push(Date.now() - ini);

    ini = Date.now();
    const r = await client.rpc("ranking_horas_membros_grupo", {
      p_grupo_id: grupo.id,
      p_periodo: "total",
    });
    if (r.error) throw new Error(`ranking: ${r.error.message}`);
    ranking.push(Date.now() - ini);
  }

  const total = await admin.from("sessoes_foco").select("id", { count: "exact", head: true });
  const tamanhoBanco = tamanhoBancoLocal();
  const historicoMs = estatisticas(historico);
  const feedMs = estatisticas(feed);
  const rankingMs = estatisticas(ranking);

  console.log("\n=== Resultado ===");
  console.log(`Registros de carga: ${REGISTROS} inseridos em ${(msSeed / 1000).toFixed(1)}s`);
  console.log(`Registros totais em sessoes_foco: ${total.count ?? "?"}`);
  console.log(`Tamanho do banco: ${tamanhoBanco ?? "não disponível"}`);
  console.log(`Histórico pessoal p50/p95 (ms): ${Math.round(historicoMs.p50)} / ${Math.round(historicoMs.p95)}`);
  console.log(`Feed do grupo p50/p95 (ms): ${Math.round(feedMs.p50)} / ${Math.round(feedMs.p95)}`);
  console.log(`Ranking p50/p95 (ms): ${Math.round(rankingMs.p50)} / ${Math.round(rankingMs.p95)}`);

  publicarResultado({
    cenario: "volumetria",
    registros: REGISTROS,
    registrosTotais: total.count,
    tamanhoBanco,
    seedMs: msSeed,
    historicoMs,
    feedMs,
    rankingMs,
  });

  await client.realtime.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error("Erro fatal:", e);
  process.exit(1);
});
