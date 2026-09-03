#!/usr/bin/env node
// CENÁRIO — Várias salas públicas simultâneas, uma por grupo.
//
// Exemplo do plano do produto:
//   GRUPOS=10 MEMBROS_POR_GRUPO=50 PARTICIPANTES_POR_SALA=15 node scripts/load/cenario-multisalas.mjs
//
// O teste exige grupos semeados com membros suficientes, mas só coloca
// `PARTICIPANTES_POR_SALA` dentro da sala. Os demais membros existem no banco para representar
// o tamanho real do grupo, sem abrir WebSocket se não estão na sala ao vivo.

import {
  carregarAmbiente, criarClienteDoUsuario, criarClienteAdmin,
  estatisticas, formatarEstat, esperar, assinarCanal, emLotes, publicarResultado,
} from "./_comum.mjs";
import { exigirSeed } from "./seed.mjs";

const GRUPOS = Number(process.env.GRUPOS ?? 10);
const MEMBROS_POR_GRUPO = Number(process.env.MEMBROS_POR_GRUPO ?? 50);
const PARTICIPANTES_POR_SALA = Number(process.env.PARTICIPANTES_POR_SALA ?? 15);
const PULSOS = Number(process.env.PULSOS ?? 10);
const INTERVALO_PULSO_MS = Number(process.env.INTERVALO_PULSO_MS ?? 500);
const ESPERA_MS = Number(process.env.ESPERA_MS ?? 3000);
const PARALELISMO = Number(process.env.PARALELISMO ?? 20);

const chavePulso = (salaId, pulso) => `${salaId}:${pulso}`;

async function main() {
  const ambiente = carregarAmbiente();
  const seed = exigirSeed(GRUPOS * MEMBROS_POR_GRUPO);
  const admin = criarClienteAdmin(ambiente);
  const grupos = seed.grupos.filter((g) => g.membros.length >= MEMBROS_POR_GRUPO).slice(0, GRUPOS);

  if (grupos.length < GRUPOS) {
    console.error(
      `Preciso de ${GRUPOS} grupos com ${MEMBROS_POR_GRUPO} membros cada; encontrei ${grupos.length}.\n` +
        `Rode: RECRIAR=1 USUARIOS=${GRUPOS * MEMBROS_POR_GRUPO} GRUPOS=${GRUPOS} node scripts/load/seed.mjs`
    );
    process.exit(1);
  }

  console.log(
    `Abrindo ${GRUPOS} salas simultâneas: ${MEMBROS_POR_GRUPO} membros/grupo, ` +
      `${PARTICIPANTES_POR_SALA} participantes/sala (${GRUPOS * PARTICIPANTES_POR_SALA} participantes ao vivo)...`
  );

  const salas = [];
  for (let i = 0; i < grupos.length; i++) {
    const grupo = grupos[i];
    const anfitriaoId = grupo.membros[0];
    const { data, error } = await admin
      .from("salas_foco")
      .insert({ grupo_id: grupo.id, anfitriao_id: anfitriaoId, is_public: true, modo: "pomodoro" })
      .select("id")
      .single();
    if (error) {
      console.error(`Falha criando sala do grupo ${i}:`, error.message);
      process.exit(1);
    }
    salas.push({ id: data.id, grupo, participantesIds: grupo.membros.slice(0, PARTICIPANTES_POR_SALA) });
  }

  const entradas = salas.flatMap((sala, salaIndice) =>
    sala.participantesIds.map((userId, participanteIndice) => ({ sala, salaIndice, userId, participanteIndice }))
  );

  const participantes = await emLotes(entradas, PARALELISMO, async ({ sala, salaIndice, userId, participanteIndice }) => {
    const client = criarClienteDoUsuario(ambiente, userId);
    const eventosParticipacao = [];
    const eventosIncentivo = [];

    const canalMembros = client
      .channel(`multisalas:membros:${sala.id}:${participanteIndice}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tab_sessao_membros", filter: `sala_id=eq.${sala.id}` },
        (payload) => eventosParticipacao.push({ em: Date.now(), linha: payload.new })
      );
    const canalIncentivos = client
      .channel(`multisalas:incentivos:${sala.id}:${participanteIndice}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "incentivos", filter: `sala_id=eq.${sala.id}` },
        (payload) => eventosIncentivo.push({ em: Date.now(), linha: payload.new })
      );

    const [a1, a2] = await Promise.all([assinarCanal(canalMembros), assinarCanal(canalIncentivos)]);

    const t0 = Date.now();
    const { data: sessao, error: erroSessao } = await client
      .from("sessoes_foco")
      .insert({
        user_id: userId,
        disciplina: `[carga-multisalas] grupo ${salaIndice}`,
        tempo_minutos: 0,
        status: "ativo",
        grupo_id: sala.grupo.id,
        sala_id: sala.id,
        is_public: true,
      })
      .select("id")
      .single();
    if (erroSessao) return { sala, userId, client, erro: `sessoes_foco: ${erroSessao.message}` };

    const { error: erroEntrada } = await client.from("tab_sessao_membros").insert({
      sala_id: sala.id,
      sessao_id: sessao.id,
      membro_id: userId,
      funcao: participanteIndice === 0 ? "anfitriao" : "membro",
      status: "ativo",
      ultimo_inicio: new Date().toISOString(),
      tempo_segundos: 0,
    });

    return {
      sala,
      userId,
      client,
      sessaoId: sessao.id,
      anfitriao: participanteIndice === 0,
      eventosParticipacao,
      eventosIncentivo,
      assinou: a1.ok && a2.ok,
      msAssinatura: Math.max(a1.ms, a2.ms),
      msEntrada: Date.now() - t0,
      erro: erroEntrada ? `tab_sessao_membros: ${erroEntrada.message}` : null,
    };
  });

  const dentro = participantes.filter((p) => !p.erro && p.assinou);
  const comErro = participantes.filter((p) => p.erro || !p.assinou);
  console.log(`Participantes dentro: ${dentro.length}/${entradas.length}` + (comErro.length ? ` (falhas: ${comErro.length})` : ""));
  if (comErro.length) console.log("  Primeiro erro:", comErro[0].erro ?? "assinatura falhou");

  await esperar(ESPERA_MS);

  const anfitrioes = salas.map((sala) => dentro.find((p) => p.sala.id === sala.id && p.anfitriao)).filter(Boolean);
  const marcosParticipacao = new Map();
  console.log(`Disparando ${PULSOS} pausas/retomadas por sala (${PULSOS * anfitrioes.length} updates)...`);
  for (let pulso = 1; pulso <= PULSOS; pulso++) {
    await Promise.all(
      anfitrioes.map(async (anfitriao) => {
        const { error } = await anfitriao.client
          .from("tab_sessao_membros")
          .update({ tempo_segundos: pulso, status: pulso % 2 ? "pausado" : "ativo" })
          .eq("sala_id", anfitriao.sala.id)
          .eq("membro_id", anfitriao.userId);
        marcosParticipacao.set(chavePulso(anfitriao.sala.id, pulso), Date.now());
        if (error) console.warn(`  pulso ${pulso} falhou na sala ${anfitriao.sala.id}:`, error.message);
      })
    );
    await esperar(INTERVALO_PULSO_MS);
  }

  const marcosIncentivo = new Map();
  const torcedoresPorSala = Math.max(1, Math.floor((PARTICIPANTES_POR_SALA - 1) / 2));
  console.log(`Disparando ${torcedoresPorSala} incentivos por sala (${torcedoresPorSala * salas.length} inserts)...`);
  await Promise.all(
    salas.map(async (sala) => {
      const anfitriao = dentro.find((p) => p.sala.id === sala.id && p.anfitriao);
      const torcedores = dentro.filter((p) => p.sala.id === sala.id && !p.anfitriao).slice(0, torcedoresPorSala);
      for (const torcedor of torcedores) {
        const { data, error } = await admin
          .from("incentivos")
          .insert({
            sala_id: sala.id,
            sessao_id: anfitriao?.sessaoId,
            remetente_id: torcedor.userId,
            destinatario_id: anfitriao?.userId,
          })
          .select("id")
          .single();
        if (error) console.warn(`  incentivo falhou na sala ${sala.id}:`, error.message);
        else marcosIncentivo.set(data.id, Date.now());
        await esperar(150);
      }
    })
  );

  await esperar(ESPERA_MS);

  const latenciasParticipacao = [];
  let recebidosParticipacao = 0;
  for (const p of dentro) {
    for (const evento of p.eventosParticipacao) {
      const pulso = evento.linha?.tempo_segundos;
      const enviado = marcosParticipacao.get(chavePulso(p.sala.id, pulso));
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
  const esperadosIncentivo = marcosIncentivo.size * PARTICIPANTES_POR_SALA;
  const latAssinatura = estatisticas(dentro.map((p) => p.msAssinatura));
  const latEntrada = estatisticas(dentro.map((p) => p.msEntrada));
  const latParticipacao = estatisticas(latenciasParticipacao);
  const latIncentivo = estatisticas(latenciasIncentivo);

  console.log("\n=== Resultado ===");
  console.log(`Grupos/salas: ${GRUPOS}`);
  console.log(`Membros por grupo: ${MEMBROS_POR_GRUPO}`);
  console.log(`Participantes por sala: ${PARTICIPANTES_POR_SALA}`);
  console.log(`Participantes ao vivo: ${dentro.length}/${entradas.length}`);
  console.log(`Canais Realtime da sala: ${dentro.length * 2}`);
  console.log(`Assinar canais (ms): ${formatarEstat(latAssinatura)}`);
  console.log(`Entrar na sala (ms): ${formatarEstat(latEntrada)}`);
  console.log(
    `Pausa/retomada -> visto pela sala (ms): ${formatarEstat(latParticipacao)} ` +
      `[${recebidosParticipacao}/${esperadosParticipacao}, ${((recebidosParticipacao / esperadosParticipacao) * 100).toFixed(1)}%]`
  );
  console.log(
    `Incentivo -> visto pela sala (ms): ${formatarEstat(latIncentivo)} ` +
      `[${latenciasIncentivo.length}/${esperadosIncentivo}, ${((latenciasIncentivo.length / esperadosIncentivo) * 100).toFixed(1)}%]`
  );

  publicarResultado({
    cenario: "multisalas",
    grupos: GRUPOS,
    membrosPorGrupo: MEMBROS_POR_GRUPO,
    participantesPorSala: PARTICIPANTES_POR_SALA,
    participantesAoVivo: dentro.length,
    canais: dentro.length * 2,
    taxaEntrada: dentro.length / entradas.length,
    assinaturaMs: latAssinatura,
    entradaMs: latEntrada,
    participacaoMs: latParticipacao,
    incentivoMs: latIncentivo,
    entregaParticipacao: recebidosParticipacao / (esperadosParticipacao || 1),
    entregaIncentivo: latenciasIncentivo.length / (esperadosIncentivo || 1),
    eventosReplicados: recebidosParticipacao + latenciasIncentivo.length,
  });

  for (const anfitriao of anfitrioes) await anfitriao.client.rpc("encerrar_sala", { p_sala_id: anfitriao.sala.id });
  for (const sala of salas) {
    await admin.from("incentivos").delete().eq("sala_id", sala.id);
    await admin.from("tab_sessao_membros").delete().eq("sala_id", sala.id);
    await admin.from("salas_foco").delete().eq("id", sala.id);
  }
  await admin.from("sessoes_foco").delete().like("disciplina", "[carga-multisalas]%");
  for (const p of participantes) await p.client?.realtime.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error("Erro fatal:", e);
  process.exit(1);
});
