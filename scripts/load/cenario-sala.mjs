#!/usr/bin/env node
// CENÁRIO 2 — Quantas pessoas cabem numa mesma sessão de foco.
//
// Uma sala de foco (`salas_foco`) é o caso mais pesado do app por participante: cada pessoa
// dentro dela mantém DOIS canais de `postgres_changes` sobre a mesma sala — as participações
// (`tab_sessao_membros`, que muda toda vez que alguém pausa, volta ou sai) e a torcida
// (`incentivos`). Ou seja, o tráfego não cresce com N: cada evento de UM participante é
// replicado para os N, então cresce com N².
//
// O que este cenário mede, com N participantes REAIS e distintos na mesma sala:
//   1. entrar na sala (INSERT em tab_sessao_membros sob RLS, todos ao mesmo tempo);
//   2. fanout: uma pessoa pausa/retoma — quanto demora para os outros N-1 verem;
//   3. torcida: um incentivo inserido — quanto demora para chegar em quem assiste a sala;
//   4. perda: quantos dos eventos esperados simplesmente não chegaram.
//
// Uso: PARTICIPANTES=12 node scripts/load/cenario-sala.mjs

import {
  carregarAmbiente, criarClienteDoUsuario, criarClienteAdmin,
  estatisticas, formatarEstat, esperar, assinarCanal, emLotes, publicarResultado,
} from "./_comum.mjs";
import { exigirSeed } from "./seed.mjs";

const PARTICIPANTES = Number(process.env.PARTICIPANTES ?? 12);
const PULSOS = Number(process.env.PULSOS ?? 10);
const INTERVALO_PULSO_MS = Number(process.env.INTERVALO_PULSO_MS ?? 500);
const ESPERA_MS = Number(process.env.ESPERA_MS ?? 3000);
const PARALELISMO = Number(process.env.PARALELISMO ?? 4);

async function main() {
  const ambiente = carregarAmbiente();
  const seed = exigirSeed(PARTICIPANTES);
  const admin = criarClienteAdmin(ambiente);

  // Todos do MESMO grupo: é assim que a sala existe no app (sessão pública de grupo), e a
  // RLS de `tab_sessao_membros` cruza com `membros` — participante de fora não entra.
  const grupo = seed.grupos.find((g) => g.membros.length >= PARTICIPANTES);
  if (!grupo) {
    console.error(
      `Nenhum grupo semeado tem ${PARTICIPANTES} membros (o maior tem ` +
        `${Math.max(...seed.grupos.map((g) => g.membros.length))}).\n` +
        `Rode: USUARIOS=${PARTICIPANTES * 2} GRUPOS=2 node scripts/load/seed.mjs`
    );
    process.exit(1);
  }
  const membros = grupo.membros.slice(0, PARTICIPANTES);
  const anfitriaoId = membros[0];

  const { data: sala, error: erroSala } = await admin
    .from("salas_foco")
    .insert({ grupo_id: grupo.id, anfitriao_id: anfitriaoId, is_public: true, modo: "pomodoro" })
    .select("id")
    .single();
  if (erroSala) {
    console.error("Falha criando a sala:", erroSala.message);
    process.exit(1);
  }
  console.log(`Sala ${sala.id} aberta no grupo ${grupo.id}. Entrando com ${PARTICIPANTES} pessoas...`);

  // Cada participante: client próprio, sessão pessoal de estudo, participação na sala e os
  // dois canais. É a sequência exata de app/(tabs)/focus.tsx ao entrar numa sala.
  const participantes = await emLotes(membros, PARALELISMO, async (userId, i) => {
    const client = criarClienteDoUsuario(ambiente, userId);
    const eventosParticipacao = [];
    const eventosIncentivo = [];

    const canalMembros = client
      .channel(`sala_membros:${sala.id}:${i}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tab_sessao_membros", filter: `sala_id=eq.${sala.id}` },
        (payload) => eventosParticipacao.push({ em: Date.now(), linha: payload.new })
      );
    const canalIncentivos = client
      .channel(`incentivos:${sala.id}:${i}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "incentivos", filter: `sala_id=eq.${sala.id}` },
        (payload) => eventosIncentivo.push({ em: Date.now(), linha: payload.new })
      );

    const [a1, a2] = await Promise.all([assinarCanal(canalMembros), assinarCanal(canalIncentivos)]);

    const t0 = Date.now();
    const { data: sessao, error: erroSessao } = await client
      .from("sessoes_foco")
      .insert({ user_id: userId, disciplina: "[carga] sala", tempo_minutos: 0, status: "ativo", grupo_id: grupo.id, sala_id: sala.id })
      .select("id")
      .single();
    if (erroSessao) {
      return { userId, client, erro: `sessoes_foco: ${erroSessao.message}` };
    }
    const { error: erroEntrada } = await client.from("tab_sessao_membros").insert({
      sala_id: sala.id,
      sessao_id: sessao.id,
      membro_id: userId,
      funcao: i === 0 ? "anfitriao" : "membro",
      status: "ativo",
      ultimo_inicio: new Date().toISOString(),
      tempo_segundos: 0,
    });
    const msEntrada = Date.now() - t0;

    return {
      userId, client, canalMembros, canalIncentivos, sessaoId: sessao.id,
      eventosParticipacao, eventosIncentivo,
      assinou: a1.ok && a2.ok,
      msAssinatura: Math.max(a1.ms, a2.ms),
      msEntrada,
      erro: erroEntrada ? `tab_sessao_membros: ${erroEntrada.message}` : null,
    };
  });

  const dentro = participantes.filter((p) => !p.erro && p.assinou);
  const comErro = participantes.filter((p) => p.erro);
  console.log(`Dentro da sala: ${dentro.length}/${PARTICIPANTES}` + (comErro.length ? ` (erros: ${comErro.length})` : ""));
  if (comErro.length) console.log("  Primeiro erro:", comErro[0].erro);

  await esperar(ESPERA_MS);

  // ── Fanout de participação: o anfitrião pausa/retoma; todo mundo deveria ver.
  const anfitriao = dentro[0];
  const marcosParticipacao = new Map();
  console.log(`Disparando ${PULSOS} pausas/retomadas do anfitrião...`);
  for (let p = 1; p <= PULSOS; p++) {
    const { error } = await anfitriao.client
      .from("tab_sessao_membros")
      .update({ tempo_segundos: p, status: p % 2 ? "pausado" : "ativo" })
      .eq("sala_id", sala.id)
      .eq("membro_id", anfitriao.userId);
    marcosParticipacao.set(p, Date.now());
    if (error) console.warn(`  pulso ${p} falhou:`, error.message);
    await esperar(INTERVALO_PULSO_MS);
  }

  // ── Fanout de torcida: metade da sala manda força para o anfitrião.
  const marcosIncentivo = new Map();
  const torcedores = dentro.slice(1, Math.max(2, Math.ceil(dentro.length / 2)));
  console.log(`Disparando ${torcedores.length} incentivos para o anfitrião...`);
  for (const torcedor of torcedores) {
    const { data, error } = await admin
      .from("incentivos")
      .insert({ sala_id: sala.id, sessao_id: anfitriao.sessaoId, remetente_id: torcedor.userId, destinatario_id: anfitriao.userId })
      .select("id")
      .single();
    if (error) {
      console.warn("  incentivo falhou:", error.message);
      continue;
    }
    marcosIncentivo.set(data.id, Date.now());
    await esperar(150);
  }

  await esperar(ESPERA_MS);

  const brutosParticipacao = dentro.reduce((a, p) => a + p.eventosParticipacao.length, 0);
  const brutosIncentivo = dentro.reduce((a, p) => a + p.eventosIncentivo.length, 0);
  if (process.env.DEBUG_CARGA === "1") {
    console.log(`  [debug] eventos crus recebidos: participacao=${brutosParticipacao} incentivo=${brutosIncentivo}`);
    console.log("  [debug] amostra:", JSON.stringify(dentro[0]?.eventosParticipacao.slice(0, 2)));
  }

  const latenciasParticipacao = [];
  let recebidosParticipacao = 0;
  for (const p of dentro) {
    for (const evento of p.eventosParticipacao) {
      const enviado = marcosParticipacao.get(evento.linha?.tempo_segundos);
      if (enviado != null) {
        latenciasParticipacao.push(evento.em - enviado);
        recebidosParticipacao += 1;
      }
    }
  }
  const latenciasIncentivo = [];
  for (const p of dentro) {
    for (const evento of p.eventosIncentivo) {
      const enviado = marcosIncentivo.get(evento.linha?.id);
      if (enviado != null) latenciasIncentivo.push(evento.em - enviado);
    }
  }

  const esperadosParticipacao = PULSOS * dentro.length;
  const esperadosIncentivo = marcosIncentivo.size * dentro.length;
  const latEntrada = estatisticas(dentro.map((p) => p.msEntrada));
  const latAssinatura = estatisticas(dentro.map((p) => p.msAssinatura));
  const latParticipacao = estatisticas(latenciasParticipacao);
  const latIncentivo = estatisticas(latenciasIncentivo);

  console.log("\n=== Resultado ===");
  console.log(`Participantes na sala: ${dentro.length}/${PARTICIPANTES}`);
  console.log(`Assinar os 2 canais da sala (ms): ${formatarEstat(latAssinatura)}`);
  console.log(`Entrar na sala — sessão + participação (ms): ${formatarEstat(latEntrada)}`);
  console.log(
    `Pausa/retomada -> visto pelos outros (ms): ${formatarEstat(latParticipacao)}  ` +
      `[${recebidosParticipacao}/${esperadosParticipacao} eventos, ` +
      `${((recebidosParticipacao / esperadosParticipacao) * 100).toFixed(1)}% entregues]`
  );
  console.log(
    `Incentivo -> visto pela sala (ms): ${formatarEstat(latIncentivo)}  ` +
      `[${latenciasIncentivo.length}/${esperadosIncentivo} eventos]`
  );

  publicarResultado({
    cenario: "sala",
    participantes: PARTICIPANTES,
    dentro: dentro.length,
    assinaturaMs: latAssinatura,
    entradaMs: latEntrada,
    participacaoMs: latParticipacao,
    incentivoMs: latIncentivo,
    entregaParticipacao: recebidosParticipacao / (esperadosParticipacao || 1),
    entregaIncentivo: latenciasIncentivo.length / (esperadosIncentivo || 1),
    eventosReplicados: recebidosParticipacao + latenciasIncentivo.length,
  });

  // Limpeza: encerra a sala pela RPC de produção e apaga as linhas do teste.
  await admin.rpc("encerrar_sala", { p_sala_id: sala.id });
  await admin.from("incentivos").delete().eq("sala_id", sala.id);
  await admin.from("tab_sessao_membros").delete().eq("sala_id", sala.id);
  await admin.from("sessoes_foco").delete().like("disciplina", "[carga]%");
  await admin.from("salas_foco").delete().eq("id", sala.id);
  for (const p of participantes) await p.client?.realtime.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error("Erro fatal:", e);
  process.exit(1);
});
