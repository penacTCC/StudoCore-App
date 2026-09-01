#!/usr/bin/env node
// Teste de carga do Realtime de salas (services/salas.ts / observarParticipantesDaSala).
//
// Mecanismo diferente do presence-load.mjs: salas usam `postgres_changes` (Supabase escuta a
// replicação lógica do Postgres e reenvia pra quem tem RLS de SELECT liberada), não presence
// broadcast. A pergunta que este script responde é outra: quando uma sala tem N pessoas com a
// tela aberta escutando `tab_sessao_membros`, um UPDATE de UMA pessoa (pausar/retomar) demora
// mais pra chegar em todo mundo conforme N cresce?
//
// Por que só 1 identidade real participa: RLS exige auth.uid() = membro_id pra inserir/
// atualizar a PRÓPRIA linha em tab_sessao_membros, então não dá pra simular 50 "membros"
// distintos sem 50 contas de verdade. Mas a leitura via Realtime só exige
// `auth.role() = 'authenticated'` — qualquer sessão logada pode assistir. Então o teste é:
// 1 conta cria a sala e fica como anfitriã, N conexões (todas autenticadas com a MESMA sessão,
// como N abas/aparelhos diferentes do mesmo usuário) assistem o canal, e a anfitriã dá uma
// sequência de updates na própria linha — exatamente o que "pausar/retomar" faz na prática.
//
// Uso:
//   node --env-file=.env scripts/load/salas-load.mjs
//   NUM_SUBSCRIBERS=40 node --env-file=.env scripts/load/salas-load.mjs
//
// Credenciais da conta de teste (não usa .env — passe na hora, não deixe salva em arquivo):
//   TEST_EMAIL=teste@gmail.com TEST_SENHA=123456 node --env-file=.env scripts/load/salas-load.mjs
//
// Variáveis:
//   NUM_SUBSCRIBERS   quantas conexões assistem a sala        (default 10)
//   NUM_WRITES        quantos updates a anfitriã dispara       (default 15)
//   WRITE_INTERVAL_MS espaço entre um update e outro            (default 400)
//   SUBSCRIBE_TIMEOUT_MS tempo máximo esperando SUBSCRIBED      (default 15000)
//   SETTLE_MS         tempo extra no fim pra deixar tudo chegar (default 3000)

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_SENHA = process.env.TEST_SENHA;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Faltam EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY (use --env-file=.env).");
  process.exit(1);
}
if (!TEST_EMAIL || !TEST_SENHA) {
  console.error(
    "Faltam TEST_EMAIL e TEST_SENHA (a conta de teste descartável).\n" +
      "Ex.: TEST_EMAIL=teste@gmail.com TEST_SENHA=123456 node --env-file=.env scripts/load/salas-load.mjs"
  );
  process.exit(1);
}

const NUM_SUBSCRIBERS = Number(process.env.NUM_SUBSCRIBERS ?? 10);
const NUM_WRITES = Number(process.env.NUM_WRITES ?? 15);
const WRITE_INTERVAL_MS = Number(process.env.WRITE_INTERVAL_MS ?? 400);
const SUBSCRIBE_TIMEOUT_MS = Number(process.env.SUBSCRIBE_TIMEOUT_MS ?? 15000);
const SETTLE_MS = Number(process.env.SETTLE_MS ?? 3000);

function criarCliente() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function estatisticas(valores) {
  if (valores.length === 0) return { min: 0, media: 0, p95: 0, max: 0 };
  const ordenado = [...valores].sort((a, b) => a - b);
  const soma = ordenado.reduce((a, b) => a + b, 0);
  const p95 = ordenado[Math.floor(ordenado.length * 0.95)] ?? ordenado[ordenado.length - 1];
  return { min: ordenado[0], media: soma / ordenado.length, p95, max: ordenado[ordenado.length - 1] };
}

async function subscreverParticipante(salaId, sessionTokens, indice) {
  const client = criarCliente();
  await client.auth.setSession(sessionTokens);

  const recebidos = new Map(); // marcador (tempo_segundos) -> timestamp de recebimento

  const canal = client
    .channel(`sala_membros:${salaId}:${indice}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "tab_sessao_membros", filter: `sala_id=eq.${salaId}` },
      (payload) => {
        recebidos.set(payload.new.tempo_segundos, Date.now());
      }
    );

  const subscribed = await new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), SUBSCRIBE_TIMEOUT_MS);
    canal.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timeout);
        resolve(true);
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        clearTimeout(timeout);
        resolve(false);
      }
    });
  });

  return { client, canal, indice, subscribed, recebidos };
}

async function main() {
  console.log(`Autenticando como ${TEST_EMAIL}...`);
  const anfitria = criarCliente();
  const { data: authData, error: authError } = await anfitria.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_SENHA,
  });
  if (authError || !authData.session) {
    console.error("Falha no login:", authError?.message ?? "sem sessão retornada");
    process.exit(1);
  }
  const userId = authData.user.id;
  const sessionTokens = {
    access_token: authData.session.access_token,
    refresh_token: authData.session.refresh_token,
  };

  console.log("Criando registro de estudo, sala e participação da anfitriã...");
  const { data: sessaoFoco, error: erroSessao } = await anfitria
    .from("sessoes_foco")
    .insert({ user_id: userId, disciplina: "[teste de carga] salas-load", tempo_minutos: 25 })
    .select("id")
    .single();
  if (erroSessao) {
    console.error("Falha criando sessoes_foco:", erroSessao.message);
    process.exit(1);
  }

  const { data: sala, error: erroSala } = await anfitria
    .from("salas_foco")
    .insert({ grupo_id: null, anfitriao_id: userId, is_public: false })
    .select("id")
    .single();
  if (erroSala) {
    console.error("Falha criando salas_foco:", erroSala.message);
    process.exit(1);
  }
  const salaId = sala.id;

  const { error: erroMembro } = await anfitria.from("tab_sessao_membros").insert({
    sala_id: salaId,
    sessao_id: sessaoFoco.id,
    membro_id: userId,
    funcao: "anfitriao",
    status: "ativo",
    ultimo_inicio: new Date().toISOString(),
    tempo_segundos: 0,
  });
  if (erroMembro) {
    console.error("Falha criando tab_sessao_membros:", erroMembro.message);
    process.exit(1);
  }

  console.log(
    `Sala ${salaId} criada. Conectando ${NUM_SUBSCRIBERS} assinantes (stagger implícito pela criação sequencial)...`
  );

  const assinantes = [];
  for (let i = 0; i < NUM_SUBSCRIBERS; i++) {
    assinantes.push(await subscreverParticipante(salaId, sessionTokens, i));
  }

  const semFalha = assinantes.filter((a) => a.subscribed);
  const comFalha = assinantes.filter((a) => !a.subscribed);
  console.log(`Assinantes conectados: ${semFalha.length}/${NUM_SUBSCRIBERS} (falhas: ${comFalha.length})`);

  console.log(`Disparando ${NUM_WRITES} updates na linha da anfitriã (intervalo ${WRITE_INTERVAL_MS}ms)...`);
  const tEnvio = new Map(); // marcador -> timestamp do commit do update
  for (let w = 1; w <= NUM_WRITES; w++) {
    const { error: erroUpdate } = await anfitria
      .from("tab_sessao_membros")
      .update({ tempo_segundos: w })
      .eq("sala_id", salaId)
      .eq("membro_id", userId);
    tEnvio.set(w, Date.now());
    if (erroUpdate) console.warn(`  update #${w} falhou:`, erroUpdate.message);
    if (WRITE_INTERVAL_MS > 0) await new Promise((r) => setTimeout(r, WRITE_INTERVAL_MS));
  }

  console.log(`Aguardando ${SETTLE_MS}ms pros eventos assentarem...`);
  await new Promise((r) => setTimeout(r, SETTLE_MS));

  // Latência: recebimento de cada assinante menos o instante do commit do update correspondente.
  const todasLatencias = [];
  const recebidosPorAssinante = [];
  for (const a of semFalha) {
    let recebidos = 0;
    for (const [marcador, tRecebido] of a.recebidos.entries()) {
      const tCommit = tEnvio.get(marcador);
      if (tCommit != null) {
        todasLatencias.push(tRecebido - tCommit);
        recebidos += 1;
      }
    }
    recebidosPorAssinante.push(recebidos);
  }

  const latStats = estatisticas(todasLatencias);
  const recStats = estatisticas(recebidosPorAssinante);

  console.log("\n=== Resultado ===");
  console.log(`Assinantes conectados: ${semFalha.length}/${NUM_SUBSCRIBERS}`);
  console.log(`Updates disparados: ${NUM_WRITES}`);
  console.log(
    `Eventos recebidos por assinante: min=${recStats.min} media=${recStats.media.toFixed(1)} ` +
      `max=${recStats.max}  (ideal = ${NUM_WRITES} pra todo mundo)`
  );
  console.log(
    `Latência update -> recebido (ms): min=${latStats.min} media=${latStats.media.toFixed(0)} ` +
      `p95=${latStats.p95} max=${latStats.max}`
  );
  const perdidos = NUM_WRITES * semFalha.length - todasLatencias.length;
  if (perdidos > 0) {
    console.log(`Eventos perdidos (nunca chegaram): ${perdidos}`);
  }
  console.log(
    "\nCheck de escala: rode este script com NUM_SUBSCRIBERS diferentes (ex.: 5, 20, 50) e compare\n" +
      "a média/p95 de latência entre as rodadas. Se ela crescer proporcionalmente ao número de\n" +
      "assinantes, o fanout do Realtime é o gargalo pra salas grandes. Se ficar estável, não é."
  );

  console.log("\nEncerrando a sala de teste...");
  const { error: erroEncerrar } = await anfitria.rpc("encerrar_sala", { p_sala_id: salaId });
  if (erroEncerrar) console.warn("Não consegui encerrar a sala de teste:", erroEncerrar.message);

  for (const a of assinantes) {
    a.client.removeChannel(a.canal);
  }
  process.exit(comFalha.length > 0 || perdidos > 0 ? 1 : 0);
}

main().catch((erro) => {
  console.error("Erro fatal no teste de carga:", erro);
  process.exit(1);
});
