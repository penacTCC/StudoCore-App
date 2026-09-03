#!/usr/bin/env node
// CENÁRIO 1 — Login simultâneo real pelo GoTrue local.
//
// Diferente dos outros cenários, este NÃO assina JWT manualmente: ele chama
// `signInWithPassword` de verdade para medir o endpoint de autenticação. Por isso o
// `supabase/config.toml` local aumenta `auth.rate_limit.sign_in_sign_ups`; sem isso o
// GoTrue local limita a 30 tentativas por 5 minutos por IP e o teste mede só rate limit.
//
// Uso: CONCURRENCY=100 node scripts/load/cenario-login.mjs

import { createClient } from "@supabase/supabase-js";
import { carregarAmbiente, estatisticas, formatarEstat, publicarResultado } from "./_comum.mjs";
import { exigirSeed } from "./seed.mjs";

const CONCURRENCY = Number(process.env.CONCURRENCY ?? 30);

async function main() {
  const ambiente = carregarAmbiente();
  const seed = exigirSeed(CONCURRENCY);
  const usuarios = seed.usuarios.slice(0, CONCURRENCY);

  console.log(`Disparando ${CONCURRENCY} logins reais simultâneos contra ${ambiente.url}...`);
  const t0 = Date.now();
  const resultados = await Promise.all(
    usuarios.map(async (u) => {
      const client = createClient(ambiente.url, ambiente.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const ini = Date.now();
      const { error } = await client.auth.signInWithPassword({
        email: u.email,
        password: `carga-${u.indice}-senha`,
      });
      const ms = Date.now() - ini;
      await client.auth.signOut().catch(() => {});
      return { ok: !error, erro: error?.message, ms };
    })
  );
  const duracao = Date.now() - t0;
  const ok = resultados.filter((r) => r.ok);
  const falhas = resultados.filter((r) => !r.ok);
  const lat = estatisticas(ok.map((r) => r.ms));
  const vazao = (ok.length / duracao) * 1000;

  if (falhas.length) {
    console.log("  Falhas:", [...new Set(falhas.map((r) => r.erro))]);
  }

  console.log("\n=== Resultado ===");
  console.log(`Logins: ${ok.length}/${CONCURRENCY} ok em ${duracao}ms`);
  console.log(`Latência de login (ms): ${formatarEstat(lat)}`);
  console.log(`Vazão: ${vazao.toFixed(1)} logins/s`);

  publicarResultado({
    cenario: "login",
    concorrencia: CONCURRENCY,
    taxaSucesso: ok.length / CONCURRENCY,
    loginMs: lat,
    vazao,
  });

  process.exit(0);
}

main().catch((e) => {
  console.error("Erro fatal:", e);
  process.exit(1);
});
