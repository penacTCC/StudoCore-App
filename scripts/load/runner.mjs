#!/usr/bin/env node
// Roda um cenário em vários tamanhos e imprime a tabela em Markdown pronta para a
// documentação. Um teste de carga solto não diz nada: o que responde "quantos usuários
// aguenta" é a COMPARAÇÃO entre rampas — a latência cresce junto com N ou dispara?
//
// Uso:
//   node scripts/load/runner.mjs conexoes 25 50 100 200
//   node scripts/load/runner.mjs sala 4 8 12 25
//   node scripts/load/runner.mjs sessoes 10 30 60
//   node scripts/load/runner.mjs login 10 30 60
//   node scripts/load/runner.mjs ranking 25 50 100
//   node scripts/load/runner.mjs volumetria 1000 5000 10000
//
// Entre uma rampa e outra o runner espera (PAUSA_MS, default 15s) para o stack assentar:
// medir a rampa seguinte enquanto a anterior ainda está se desconectando mistura as duas.

import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const CENARIOS = {
  conexoes: { script: "cenario-conexoes.mjs", variavel: "USUARIOS", rotulo: "usuários simultâneos" },
  sala: { script: "cenario-sala.mjs", variavel: "PARTICIPANTES", rotulo: "participantes na sala" },
  sessoes: { script: "cenario-sessoes.mjs", variavel: "CONCURRENCY", rotulo: "sessões simultâneas" },
  login: { script: "cenario-login.mjs", variavel: "CONCURRENCY", rotulo: "logins simultâneos" },
  ranking: { script: "cenario-ranking.mjs", variavel: "CONCURRENCY", rotulo: "consultas simultâneas ao ranking" },
  volumetria: { script: "cenario-volumetria.mjs", variavel: "REGISTROS", rotulo: "registros armazenados" },
};

const [nome, ...tamanhos] = process.argv.slice(2);
const cenario = CENARIOS[nome];
if (!cenario || tamanhos.length === 0) {
  console.error(`Uso: node scripts/load/runner.mjs <${Object.keys(CENARIOS).join("|")}> <tamanho> [tamanho...]`);
  process.exit(1);
}
const PAUSA_MS = Number(process.env.PAUSA_MS ?? 15000);

const rodar = (tamanho) =>
  new Promise((resolve, reject) => {
    const filho = spawn(process.execPath, [new URL(cenario.script, import.meta.url).pathname], {
      env: { ...process.env, [cenario.variavel]: String(tamanho), SAIDA_JSON: "1" },
      stdio: ["ignore", "pipe", "inherit"],
    });
    let saida = "";
    filho.stdout.on("data", (d) => {
      saida += d;
      process.stdout.write(d);
    });
    filho.on("close", (codigo) => {
      const linha = saida.split("\n").find((l) => l.startsWith("__JSON__"));
      if (!linha) return reject(new Error(`o cenário terminou (código ${codigo}) sem publicar resultado`));
      resolve(JSON.parse(linha.slice("__JSON__".length)));
    });
  });

const ms = (e) => (e && e.n ? `${Math.round(e.p50)} / ${Math.round(e.p95)}` : "—");
const pct = (v) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);

const resultados = [];
for (const tamanho of tamanhos) {
  console.log(`\n${"=".repeat(70)}\n### ${cenario.rotulo}: ${tamanho}\n${"=".repeat(70)}`);
  resultados.push(await rodar(tamanho));
  if (tamanho !== tamanhos.at(-1)) await new Promise((r) => setTimeout(r, PAUSA_MS));
}

const linhas = [];
if (nome === "conexoes") {
  linhas.push("| Usuários simultâneos | WebSockets | Canais | Conectaram | SUBSCRIBED p50/p95 (ms) | Entrega p50/p95 (ms) |");
  linhas.push("| ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const r of resultados) {
    linhas.push(`| ${r.usuarios} | ${r.usuarios} | ${r.canais} | ${pct(r.taxaSucesso)} | ${ms(r.subscribeMs)} | ${ms(r.entregaMs)} |`);
  }
} else if (nome === "sala") {
  linhas.push("| Participantes | Entraram | Assinar canais p50/p95 (ms) | Entrar p50/p95 (ms) | Pausa→ver p50/p95 (ms) | Eventos entregues |");
  linhas.push("| ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const r of resultados) {
    linhas.push(`| ${r.participantes} | ${r.dentro} | ${ms(r.assinaturaMs)} | ${ms(r.entradaMs)} | ${ms(r.participacaoMs)} | ${pct(r.entregaParticipacao)} |`);
  }
} else if (nome === "sessoes") {
  linhas.push("| Sessões simultâneas | INSERT ok | INSERT p50/p95 (ms) | UPDATE p50/p95 (ms) | Vazão (req/s) |");
  linhas.push("| ---: | ---: | ---: | ---: | ---: |");
  for (const r of resultados) {
    linhas.push(`| ${r.concorrencia} | ${pct(r.taxaInsert)} | ${ms(r.insertMs)} | ${ms(r.updateMs)} | ${r.vazao.toFixed(1)} |`);
  }
} else if (nome === "login") {
  linhas.push("| Logins simultâneos | Sucesso | Login p50/p95 (ms) | Vazão (logins/s) |");
  linhas.push("| ---: | ---: | ---: | ---: |");
  for (const r of resultados) {
    linhas.push(`| ${r.concorrencia} | ${pct(r.taxaSucesso)} | ${ms(r.loginMs)} | ${r.vazao.toFixed(1)} |`);
  }
} else if (nome === "ranking") {
  linhas.push("| Consultas simultâneas | Sucesso | Ranking p50/p95 (ms) | Linhas p50/p95 | Vazão (consultas/s) |");
  linhas.push("| ---: | ---: | ---: | ---: | ---: |");
  for (const r of resultados) {
    linhas.push(`| ${r.concorrencia} | ${pct(r.taxaSucesso)} | ${ms(r.rankingMs)} | ${ms(r.linhas)} | ${r.vazao.toFixed(1)} |`);
  }
} else if (nome === "volumetria") {
  linhas.push("| Registros de carga | Registros totais | Tamanho do banco | Histórico p50/p95 (ms) | Feed p50/p95 (ms) | Ranking p50/p95 (ms) |");
  linhas.push("| ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const r of resultados) {
    linhas.push(`| ${r.registros} | ${r.registrosTotais ?? "?"} | ${r.tamanhoBanco ?? "—"} | ${ms(r.historicoMs)} | ${ms(r.feedMs)} | ${ms(r.rankingMs)} |`);
  }
}

const tabela = linhas.join("\n");
console.log(`\n\n${"=".repeat(70)}\nTabela para a documentação:\n${"=".repeat(70)}\n${tabela}\n`);

const arquivo = new URL(`resultado-${nome}.json`, import.meta.url).pathname;
writeFileSync(arquivo, JSON.stringify({ cenario: nome, rodadoEm: new Date().toISOString(), resultados }, null, 2));
console.log(`Números crus em ${arquivo}`);
