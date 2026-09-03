#!/usr/bin/env node
// CENÁRIO 4 — N usuários consultando simultaneamente o ranking do grupo.
//
// Mede a RPC `ranking_horas_membros_grupo`, que é o caminho usado por `services/ranking.ts`.
// Antes da rajada o script garante dados de ranking no grupo escolhido; a medição inclui só
// chamadas concorrentes de leitura feitas por usuários distintos.
//
// Uso: CONCURRENCY=100 node scripts/load/cenario-ranking.mjs

import {
  carregarAmbiente, criarClienteDoUsuario, criarClienteAdmin,
  dataLocalISO, estatisticas, formatarEstat, publicarResultado,
} from "./_comum.mjs";
import { exigirSeed } from "./seed.mjs";

const CONCURRENCY = Number(process.env.CONCURRENCY ?? 50);
const PERIODO = process.env.PERIODO ?? "total";
const MARCADOR = "[carga-ranking]";

async function main() {
  const ambiente = carregarAmbiente();
  const seed = exigirSeed(CONCURRENCY);
  const admin = criarClienteAdmin(ambiente);
  const grupo = seed.grupos.find((g) => g.membros.length >= CONCURRENCY);

  if (!grupo) {
    console.error(
      `Nenhum grupo semeado tem ${CONCURRENCY} membros. Rode: ` +
        `USUARIOS=${CONCURRENCY * 2} GRUPOS=2 node scripts/load/seed.mjs`
    );
    process.exit(1);
  }

  const membros = grupo.membros.slice(0, CONCURRENCY);
  const hoje = dataLocalISO();
  const { error: erroSeed } = await admin.from("sessoes_foco").upsert(
    membros.map((userId, i) => ({
      user_id: userId,
      grupo_id: grupo.id,
      disciplina: `${MARCADOR} #${i}`,
      tempo_minutos: 15 + (i % 90),
      questoes_respondidas: i % 12,
      questoes_acertadas: i % 10,
      data_sessao: hoje,
      status: "salvo",
      is_public: true,
      concluido_em: new Date().toISOString(),
    }))
  );
  if (erroSeed) {
    console.error("Falha preparando dados do ranking:", erroSeed.message);
    process.exit(1);
  }

  const clientes = membros.map((userId) => criarClienteDoUsuario(ambiente, userId));
  console.log(`Disparando ${CONCURRENCY} consultas simultâneas ao ranking (${PERIODO}) do grupo ${grupo.id}...`);
  const t0 = Date.now();
  const resultados = await Promise.all(
    clientes.map(async (client) => {
      const ini = Date.now();
      const { data, error } = await client.rpc("ranking_horas_membros_grupo", {
        p_grupo_id: grupo.id,
        p_periodo: PERIODO,
      });
      return { ok: !error, erro: error?.message, ms: Date.now() - ini, linhas: data?.length ?? 0 };
    })
  );
  const duracao = Date.now() - t0;
  const ok = resultados.filter((r) => r.ok);
  const falhas = resultados.filter((r) => !r.ok);
  const lat = estatisticas(ok.map((r) => r.ms));
  const linhas = estatisticas(ok.map((r) => r.linhas));
  const vazao = (ok.length / duracao) * 1000;

  if (falhas.length) {
    console.log("  Falhas:", [...new Set(falhas.map((r) => r.erro))]);
  }

  console.log("\n=== Resultado ===");
  console.log(`Consultas: ${ok.length}/${CONCURRENCY} ok em ${duracao}ms`);
  console.log(`Latência da RPC (ms): ${formatarEstat(lat)}`);
  console.log(`Linhas retornadas: p50=${Math.round(linhas.p50)} p95=${Math.round(linhas.p95)}`);
  console.log(`Vazão: ${vazao.toFixed(1)} consultas/s`);

  publicarResultado({
    cenario: "ranking",
    concorrencia: CONCURRENCY,
    taxaSucesso: ok.length / CONCURRENCY,
    rankingMs: lat,
    linhas,
    vazao,
  });

  await admin.from("sessoes_foco").delete().like("disciplina", `${MARCADOR}%`);
  for (const client of clientes) await client.realtime.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error("Erro fatal:", e);
  process.exit(1);
});
