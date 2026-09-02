#!/usr/bin/env node
// CENÁRIO 1 — Usuários simultâneos com o app aberto.
//
// Reproduz o que todo aparelho faz assim que o app abre (app/_layout.tsx): um client do
// supabase-js, um WebSocket, e duas assinaturas de Realtime que ficam de pé o tempo todo —
// `observarNotificacoes` (services/notificacoes.ts) e `observarForcasRecebidas`
// (services/incentivos.ts). É por isso que "usuário simultâneo" e "conexão de Realtime" são
// a mesma unidade neste app: quem está com o app aberto está com um socket aberto.
//
// Mede três coisas, nesta ordem de importância:
//   1. quantos conseguem conectar (a taxa de sucesso é o número que define o teto);
//   2. quanto demora do `subscribe()` até o SUBSCRIBED;
//   3. depois de tudo conectado, quanto demora uma notificação real chegar em quem é o dono
//      dela — porque conectar e continuar entregando são coisas diferentes sob carga.
//
// Uso: USUARIOS=200 node scripts/load/cenario-conexoes.mjs

import {
  carregarAmbiente, criarClienteDoUsuario, criarClienteAdmin,
  estatisticas, formatarEstat, esperar, assinarCanal, publicarResultado,
} from "./_comum.mjs";
import { exigirSeed } from "./seed.mjs";

const USUARIOS = Number(process.env.USUARIOS ?? 100);
const ESCALONAMENTO_MS = Number(process.env.ESCALONAMENTO_MS ?? 10);
const ESPERA_MS = Number(process.env.ESPERA_MS ?? 4000);
const AMOSTRA_ENTREGA = Number(process.env.AMOSTRA_ENTREGA ?? 20);

async function main() {
  const ambiente = carregarAmbiente();
  const seed = exigirSeed(USUARIOS);
  const admin = criarClienteAdmin(ambiente);
  const usuarios = seed.usuarios.slice(0, USUARIOS);

  console.log(`Abrindo ${USUARIOS} clients (1 WebSocket + 2 canais cada), escalonados a cada ${ESCALONAMENTO_MS}ms...`);

  const conexoes = [];
  for (const usuario of usuarios) {
    const client = criarClienteDoUsuario(ambiente, usuario.id);
    const recebidos = [];

    // Mesmos filtros que o app monta no _layout — o custo do fanout depende do filtro.
    const canalNotificacoes = client.channel(`notificacoes:${usuario.id}`).on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notificacoes", filter: `destinatario_id=eq.${usuario.id}` },
      (payload) => recebidos.push({ em: Date.now(), linha: payload.new })
    );
    const canalForcas = client.channel(`forcas-recebidas:${usuario.id}`).on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "incentivos", filter: `destinatario_id=eq.${usuario.id}` },
      (payload) => recebidos.push({ em: Date.now(), linha: payload.new })
    );

    conexoes.push({ usuario, client, canalNotificacoes, canalForcas, recebidos, resultados: [] });
    await esperar(ESCALONAMENTO_MS);
  }

  // Só depois de todos criados é que esperamos os SUBSCRIBED: assim o escalonamento acima
  // define o ritmo de chegada, e não o tempo de resposta do servidor.
  const assinaturas = await Promise.all(
    conexoes.flatMap((c) => [assinarCanal(c.canalNotificacoes), assinarCanal(c.canalForcas)])
  );
  const ok = assinaturas.filter((a) => a.ok);
  const falhas = assinaturas.filter((a) => !a.ok);

  console.log(`Canais assinados: ${ok.length}/${assinaturas.length} (falhas: ${falhas.length})`);
  await esperar(ESPERA_MS);

  // Entrega ponta a ponta: escreve notificações para uma amostra e cronometra a chegada.
  const amostra = conexoes.filter((c, i) => i % Math.max(1, Math.floor(conexoes.length / AMOSTRA_ENTREGA)) === 0);
  console.log(`Medindo entrega ponta a ponta em ${amostra.length} usuários com tudo conectado...`);

  const latenciasEntrega = [];
  for (const alvo of amostra) {
    const marcadorUuid = crypto.randomUUID();
    const antes = alvo.recebidos.length;
    const tEnvio = Date.now();
    // Uma notificação de "força recebida" — a categoria `foco`, que é a que nasce durante
    // uma sessão e portanto a que compete com a carga do teste. O ator é outro usuário
    // semeado porque a tabela proíbe notificar a si mesmo.
    const ator = conexoes[(conexoes.indexOf(alvo) + 1) % conexoes.length].usuario;
    const { error } = await admin.from("notificacoes").insert({
      destinatario_id: alvo.usuario.id,
      ator_id: ator.id,
      tipo: "forca",
      categoria: "foco",
      referencia_id: marcadorUuid,
    });
    if (error) {
      console.warn("  falha inserindo notificação:", error.message);
      continue;
    }
    for (let tentativa = 0; tentativa < 100; tentativa++) {
      if (alvo.recebidos.length > antes) {
        latenciasEntrega.push(alvo.recebidos.at(-1).em - tEnvio);
        break;
      }
      await esperar(50);
    }
  }

  const latSubscribe = estatisticas(ok.map((a) => a.ms));
  const latEntrega = estatisticas(latenciasEntrega);

  console.log("\n=== Resultado ===");
  console.log(`Usuários simulados: ${USUARIOS} (${assinaturas.length} canais, ${USUARIOS} WebSockets)`);
  console.log(`Canais que assinaram: ${ok.length}/${assinaturas.length} (${((ok.length / assinaturas.length) * 100).toFixed(1)}%)`);
  if (falhas.length) {
    const porTipo = falhas.reduce((acc, f) => ({ ...acc, [f.erro]: (acc[f.erro] ?? 0) + 1 }), {});
    console.log("  Falhas por tipo:", porTipo);
  }
  console.log(`Latência até SUBSCRIBED (ms): ${formatarEstat(latSubscribe)}`);
  console.log(
    `Entrega de notificação com ${USUARIOS} conectados (ms): ${formatarEstat(latEntrega)} ` +
      `— ${latenciasEntrega.length}/${amostra.length} chegaram`
  );

  publicarResultado({
    cenario: "conexoes",
    usuarios: USUARIOS,
    canais: assinaturas.length,
    canaisOk: ok.length,
    taxaSucesso: ok.length / assinaturas.length,
    subscribeMs: latSubscribe,
    entregaMs: latEntrega,
    entreguesDeAmostra: `${latenciasEntrega.length}/${amostra.length}`,
  });

  for (const c of conexoes) {
    c.client.removeChannel(c.canalNotificacoes);
    c.client.removeChannel(c.canalForcas);
    await c.client.realtime.disconnect();
  }
  await admin.from("notificacoes").delete().eq("tipo", "forca").eq("categoria", "foco");
  process.exit(0);
}

main().catch((e) => {
  console.error("Erro fatal:", e);
  process.exit(1);
});
