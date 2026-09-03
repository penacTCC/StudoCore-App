// Infraestrutura compartilhada dos testes de carga.
//
// Regra número um deste arquivo: teste de carga NÃO roda contra produção. Um teste anterior
// abriu ~500 conexões simultâneas de Realtime no projeto hospedado e estourou a cota do plano
// Free (limite de 200 conexões concorrentes), que é um PICO gravado no ciclo de faturamento
// inteiro e não desce quando as conexões caem. Por isso `carregarAmbiente()` recusa qualquer
// URL que não seja local, a não ser que a pessoa escreva `PERMITIR_REMOTO=1` na mão.

import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Defaults do stack local do Supabase CLI — chaves públicas e conhecidas, não são segredo.
const LOCAL = {
  url: "http://127.0.0.1:54321",
  anonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
  serviceRoleKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  jwtSecret: "super-secret-jwt-token-with-at-least-32-characters-long",
};

const ehLocal = (url) => /^https?:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\])(:|\/|$)/.test(url);

export function carregarAmbiente() {
  const url = process.env.SUPABASE_URL ?? LOCAL.url;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? LOCAL.anonKey;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? LOCAL.serviceRoleKey;
  const jwtSecret = process.env.SUPABASE_JWT_SECRET ?? LOCAL.jwtSecret;

  if (!ehLocal(url) && process.env.PERMITIR_REMOTO !== "1") {
    console.error(
      `\nRecusando rodar carga contra ${url}.\n\n` +
        "Estes testes abrem centenas de conexões de Realtime. No plano Free da Supabase o limite\n" +
        "é 200 conexões CONCORRENTES, e o número registrado é o PICO do ciclo de faturamento — ele\n" +
        "não desce quando o teste acaba. Já estouramos a cota assim uma vez.\n\n" +
        "Suba o stack local (`npm run supabase:start`) e rode sem SUPABASE_URL, ou, se você tem\n" +
        "certeza absoluta, repita com PERMITIR_REMOTO=1.\n"
    );
    process.exit(1);
  }

  return { url, anonKey, serviceRoleKey, jwtSecret, local: ehLocal(url) };
}

// ───────────────────────── identidades ─────────────────────────

const base64url = (buf) => Buffer.from(buf).toString("base64url");

/**
 * Assina um access token igual ao que o GoTrue emitiria para `userId`.
 *
 * Por que não fazer login de verdade: o GoTrue local limita sign-in/sign-up a 30 requisições
 * por 5 minutos por IP (`auth.rate_limit.sign_in_sign_ups` no config.toml), então autenticar
 * 300 usuários simulados esbarraria no rate limit antes de a carga começar. O token assinado
 * com o mesmo segredo é aceito por PostgREST e pelo Realtime exatamente como o real, e o
 * `auth.uid()` que a RLS enxerga é o do usuário — que é o que estes testes precisam exercitar.
 *
 * A contrapartida é explícita: estes testes NÃO medem a carga do endpoint de login.
 */
export function assinarToken(userId, jwtSecret, email = `${userId}@carga.local`) {
  const agora = Math.floor(Date.now() / 1000);
  const cabecalho = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const corpo = base64url(
    JSON.stringify({
      aud: "authenticated",
      role: "authenticated",
      sub: userId,
      email,
      iat: agora,
      exp: agora + 60 * 60 * 4,
      app_metadata: { provider: "email" },
      user_metadata: {},
    })
  );
  const assinatura = createHmac("sha256", jwtSecret).update(`${cabecalho}.${corpo}`).digest("base64url");
  return `${cabecalho}.${corpo}.${assinatura}`;
}

/**
 * Um client por usuário simulado — é o que o app faz de verdade (um client por aparelho),
 * e é o que faz cada usuário abrir seu próprio WebSocket de Realtime.
 */
export function criarClienteDoUsuario(ambiente, userId, opcoes = {}) {
  const token = assinarToken(userId, ambiente.jwtSecret);
  const client = createClient(ambiente.url, ambiente.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    accessToken: async () => token,
    realtime: { params: { eventsPerSecond: opcoes.eventsPerSecond ?? 10 } },
  });
  // Evita corrida no subscribe(): o Realtime só envia o JWT no join payload se
  // `accessTokenValue` já estiver preenchido antes de `channel.subscribe()`.
  client.__cargaRealtimeAuth = client.realtime.setAuth(token);
  return client;
}

export function criarClienteAdmin(ambiente) {
  return createClient(ambiente.url, ambiente.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ───────────────────────── métricas ─────────────────────────

export function estatisticas(valores) {
  if (valores.length === 0) return { n: 0, min: 0, media: 0, p50: 0, p95: 0, max: 0 };
  const ordenado = [...valores].sort((a, b) => a - b);
  const pct = (p) => ordenado[Math.min(ordenado.length - 1, Math.floor(ordenado.length * p))];
  return {
    n: ordenado.length,
    min: ordenado[0],
    media: ordenado.reduce((a, b) => a + b, 0) / ordenado.length,
    p50: pct(0.5),
    p95: pct(0.95),
    max: ordenado[ordenado.length - 1],
  };
}

export const formatarEstat = (e) =>
  `min=${Math.round(e.min)} p50=${Math.round(e.p50)} media=${e.media.toFixed(0)} p95=${Math.round(e.p95)} max=${Math.round(e.max)}`;

export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export function dataLocalISO(data = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(data);
}

/** Executa `tarefa` sobre `itens` com no máximo `limite` em voo — evita afogar o Node. */
export async function emLotes(itens, limite, tarefa) {
  const resultados = new Array(itens.length);
  let proximo = 0;
  const trabalhador = async () => {
    while (proximo < itens.length) {
      const i = proximo++;
      resultados[i] = await tarefa(itens[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, trabalhador));
  return resultados;
}

/**
 * Assina um canal e devolve quanto tempo levou até SUBSCRIBED (ou o erro).
 * Todo cenário mede isso do mesmo jeito, então a comparação entre eles é justa.
 */
export async function assinarCanal(canal, timeoutMs = 20000) {
  await canal.socket?._authPromise?.catch(() => {});
  const t0 = Date.now();
  return new Promise((resolve) => {
    let resolvido = false;
    const encerrar = (resultado) => {
      if (resolvido) return;
      resolvido = true;
      clearTimeout(timer);
      resolve(resultado);
    };
    const timer = setTimeout(() => encerrar({ ok: false, erro: "timeout", ms: Date.now() - t0 }), timeoutMs);
    canal.subscribe((status, erro) => {
      if (status === "SUBSCRIBED") encerrar({ ok: true, ms: Date.now() - t0 });
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        encerrar({ ok: false, erro: erro?.message ?? status, ms: Date.now() - t0 });
      }
    });
  });
}

/** Cenários imprimem texto para humano e, com SAIDA_JSON=1, uma linha JSON para o runner. */
export function publicarResultado(resultado) {
  if (process.env.SAIDA_JSON === "1") {
    console.log(`__JSON__${JSON.stringify(resultado)}`);
  }
}
