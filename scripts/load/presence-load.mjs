#!/usr/bin/env node
// Teste de carga do Presence de grupo (services/onlineUsers.ts).
//
// Por que um script Node com o supabase-js de verdade, e não k6/Artillery: o Realtime da
// Supabase fala o protocolo Phoenix sobre WebSocket. Reimplementar isso numa ferramenta de
// carga genérica seria trabalho extra e ainda arriscaria testar um protocolo levemente
// diferente do client real. Abrindo N instâncias reais do client e chamando
// channel()/track() do jeito exato que onlineUsers.ts chama, testamos o código de produção.
//
// O que valida: onlineUsers.ts documenta que a sala de presença já foi UMA sala global
// (`room:studo_core_global`) e virou O(N²) — todo entra/sai/heartbeat reenviava o estado
// inteiro pra todo mundo conectado no app, e isso degradava perto de 200 usuários
// simultâneos. A correção particiona por grupo (`presence:grupo:${grupoId}`). Este script
// simula vários grupos com vários membros cada e mede se o tráfego de sync que cada
// cliente recebe escala com o TAMANHO DO GRUPO DELE, não com o total de clientes do teste.
//
// Uso:
//   node --env-file=.env scripts/load/presence-load.mjs
//   GROUPS=20 MEMBERS_PER_GROUP=15 node --env-file=.env scripts/load/presence-load.mjs
//
// Variáveis (todas opcionais, com default pequeno de propósito — suba aos poucos):
//   NUM_GROUPS        número de grupos simulados                  (default 5)
//                      (não use "GROUPS" — é variável somente-leitura do bash)
//   MEMBERS_PER_GROUP membros por grupo                            (default 20)
//   STAGGER_MS        atraso entre cada cliente entrando            (default 15)
//   HOLD_MS           quanto tempo manter tudo conectado após o
//                     último entrar, pra deixar o sync assentar     (default 5000)
//   SUBSCRIBE_TIMEOUT_MS tempo máximo esperando SUBSCRIBED          (default 15000)

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "Faltam EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY.\n" +
      "Rode com: node --env-file=.env scripts/load/presence-load.mjs"
  );
  process.exit(1);
}

const GROUPS = Number(process.env.NUM_GROUPS ?? 5);
const MEMBERS_PER_GROUP = Number(process.env.MEMBERS_PER_GROUP ?? 20);
const STAGGER_MS = Number(process.env.STAGGER_MS ?? 15);
const HOLD_MS = Number(process.env.HOLD_MS ?? 5000);
const SUBSCRIBE_TIMEOUT_MS = Number(process.env.SUBSCRIBE_TIMEOUT_MS ?? 15000);

// Prefixo que não colide com UUID nenhum de grupo real, pra não vazar pra usuário de verdade.
const grupoId = (g) => `loadtest-${g}`;

function criarCliente() {
  // Um client por "usuário" simulado — é o que o app faz de verdade (um client por device).
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    realtime: { params: { eventsPerSecond: 10 } },
  });
}

function conectarUmMembro(g, m) {
  const userId = `loadtest-user-${g}-${m}`;
  const client = criarCliente();
  const canal = client.channel(`presence:grupo:${grupoId(g)}`);

  const metrica = {
    grupo: g,
    membro: m,
    tCriado: Date.now(),
    tSubscribed: null,
    syncCount: 0,
    ultimoTamanhoEstado: 0,
    erro: null,
  };

  return new Promise((resolve) => {
    let resolvido = false;
    const timeout = setTimeout(() => {
      if (resolvido) return;
      resolvido = true;
      metrica.erro = "timeout esperando SUBSCRIBED";
      resolve({ client, canal, metrica });
    }, SUBSCRIBE_TIMEOUT_MS);

    canal.on("presence", { event: "sync" }, () => {
      metrica.syncCount += 1;
      metrica.ultimoTamanhoEstado = Object.keys(canal.presenceState()).length;
    });

    canal.subscribe(async (status) => {
      if (status === "SUBSCRIBED" && !metrica.tSubscribed) {
        metrica.tSubscribed = Date.now();
        await canal.track({ user_id: userId, online_at: new Date().toISOString() });
        if (!resolvido) {
          resolvido = true;
          clearTimeout(timeout);
          resolve({ client, canal, metrica });
        }
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        if (!resolvido) {
          resolvido = true;
          clearTimeout(timeout);
          metrica.erro = status;
          resolve({ client, canal, metrica });
        }
      }
    });
  });
}

function estatisticas(valores) {
  if (valores.length === 0) return { min: 0, media: 0, p95: 0, max: 0 };
  const ordenado = [...valores].sort((a, b) => a - b);
  const soma = ordenado.reduce((a, b) => a + b, 0);
  const p95 = ordenado[Math.floor(ordenado.length * 0.95)] ?? ordenado[ordenado.length - 1];
  return {
    min: ordenado[0],
    media: soma / ordenado.length,
    p95,
    max: ordenado[ordenado.length - 1],
  };
}

async function main() {
  const total = GROUPS * MEMBERS_PER_GROUP;
  console.log(
    `Simulando ${GROUPS} grupos x ${MEMBERS_PER_GROUP} membros = ${total} clientes ` +
      `(stagger ${STAGGER_MS}ms, hold ${HOLD_MS}ms)\n`
  );

  const conexoes = [];
  for (let g = 0; g < GROUPS; g++) {
    for (let m = 0; m < MEMBERS_PER_GROUP; m++) {
      conexoes.push(conectarUmMembro(g, m));
      if (STAGGER_MS > 0) await new Promise((r) => setTimeout(r, STAGGER_MS));
    }
  }

  const resultados = await Promise.all(conexoes);

  console.log(`Todos conectados (ou expirados). Segurando por ${HOLD_MS}ms pro sync assentar...`);
  await new Promise((r) => setTimeout(r, HOLD_MS));

  const metricas = resultados.map((r) => r.metrica);
  const comErro = metricas.filter((m) => m.erro);
  const ok = metricas.filter((m) => !m.erro);

  const latenciaSubscribe = estatisticas(ok.map((m) => m.tSubscribed - m.tCriado));
  const syncsPorCliente = estatisticas(ok.map((m) => m.syncCount));
  const tamanhoEstadoPorCliente = estatisticas(ok.map((m) => m.ultimoTamanhoEstado));

  console.log("\n=== Resultado ===");
  console.log(`Conectados com sucesso: ${ok.length}/${total}  |  falhas: ${comErro.length}`);
  if (comErro.length > 0) {
    const porTipo = comErro.reduce((acc, m) => {
      acc[m.erro] = (acc[m.erro] ?? 0) + 1;
      return acc;
    }, {});
    console.log("  Falhas por tipo:", porTipo);
  }
  console.log(
    `Latência até SUBSCRIBED (ms): min=${latenciaSubscribe.min} media=${latenciaSubscribe.media.toFixed(0)} ` +
      `p95=${latenciaSubscribe.p95} max=${latenciaSubscribe.max}`
  );
  console.log(
    `Eventos de "sync" recebidos por cliente: min=${syncsPorCliente.min} media=${syncsPorCliente.media.toFixed(1)} ` +
      `p95=${syncsPorCliente.p95} max=${syncsPorCliente.max}`
  );
  console.log(
    `Tamanho do presenceState visto por cliente (nº de presenças): min=${tamanhoEstadoPorCliente.min} ` +
      `media=${tamanhoEstadoPorCliente.media.toFixed(1)} max=${tamanhoEstadoPorCliente.max}`
  );
  console.log(
    `\nCheck de escala: se o particionamento por grupo estiver funcionando, o tamanho médio\n` +
      `do presenceState deve ficar perto de ${MEMBERS_PER_GROUP} (o tamanho de UM grupo), não\n` +
      `perto de ${total} (o total de clientes do teste). Se estiver perto do total, o app\n` +
      `voltou a ter uma sala compartilhada em vez de uma por grupo.`
  );

  for (const { canal, client } of resultados) {
    client.removeChannel(canal);
  }
  process.exit(comErro.length > 0 ? 1 : 0);
}

main().catch((erro) => {
  console.error("Erro fatal no teste de carga:", erro);
  process.exit(1);
});
