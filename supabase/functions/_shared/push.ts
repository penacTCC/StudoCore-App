// Envio de push (Expo) compartilhado pelas Edge Functions.
//
// Existe porque duas funções mandam push — `mandar-forca` e `avisar-sala-aberta` — e as duas
// precisam da MESMA regra de silêncio. Duplicar isso significaria, mais cedo ou mais tarde,
// uma das duas ignorar o "não perturbar" de quem recebe.
//
// Nada aqui lança: push é sempre acessório, o fato principal (a força, a sala) já está
// gravado quando estas funções rodam.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Admin = ReturnType<typeof createClient>;

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// Precisam bater com os canais em services/pushTokens.ts: são os que o app cria no Android
// ao registrar o token. Canal inexistente no aparelho = notificação silenciosa.
export const CANAL_FORCAS = "forcas";
export const CANAL_COMUNIDADE = "comunidade";

export type MensagemPush = {
  destinatarioId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** Canal Android. Só as forças são urgentes; o resto do app pede o canal explicitamente. */
  canal?: string;
};

/** Uma linha de `push_tokens` com o fuso de quem vai receber. */
type Destino = { user_id: string; expo_push_token: string; fuso_offset_min: number };

function paraMinutosDoDia(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Está dentro da janela de silêncio, no horário LOCAL de quem recebe?
 *
 * `fusoOffsetMin` segue a convenção do getTimezoneOffset() do JS (minutos que faltam pro
 * UTC, positivo a oeste), então o horário local é `agora - offset`.
 *
 * A janela pode virar a meia-noite (ex.: 22:00–07:00) — quando o início é maior que o fim,
 * o teste passa a ser "fora do intervalo". Mesma regra de services/lembretes.ts; se um dia
 * mudar lá, tem que mudar aqui.
 */
function dentroDoNaoPerturbar(fusoOffsetMin: number, inicio: string, fim: string): boolean {
  const agoraUtc = new Date();
  const localMin =
    ((agoraUtc.getUTCHours() * 60 + agoraUtc.getUTCMinutes() - fusoOffsetMin) % 1440 + 1440) % 1440;

  const inicioMin = paraMinutosDoDia(inicio);
  const fimMin = paraMinutosDoDia(fim);

  return inicioMin <= fimMin
    ? localMin >= inicioMin && localMin < fimMin
    : localMin >= inicioMin || localMin < fimMin;
}

/**
 * Filtra, de uma lista de destinatários, quem topa receber push agora.
 *
 * Descarta quem desligou as notificações e quem está na janela de "não perturbar". Quem
 * nunca abriu a tela de preferências não tem linha em `preferencias_cronograma` — esse
 * recebe, que é o padrão do app (PADRAO_PREFERENCIAS tem notificacoesAtivas: true).
 */
async function destinatariosDisponiveis(admin: Admin, ids: string[]): Promise<Destino[]> {
  if (ids.length === 0) return [];

  const [{ data: tokens }, { data: prefs }] = await Promise.all([
    admin
      .from("push_tokens")
      .select("user_id, expo_push_token, fuso_offset_min")
      .in("user_id", ids),
    admin
      .from("preferencias_cronograma")
      .select("usuario_id, notificacoes_ativas, nao_perturbar, nao_perturbar_inicio, nao_perturbar_fim")
      .in("usuario_id", ids),
  ]);

  const prefsPorUsuario = new Map(
    ((prefs ?? []) as Array<{
      usuario_id: string;
      notificacoes_ativas: boolean;
      nao_perturbar: boolean;
      nao_perturbar_inicio: string;
      nao_perturbar_fim: string;
    }>).map((p) => [p.usuario_id, p])
  );

  return ((tokens ?? []) as Destino[]).filter((destino) => {
    const pref = prefsPorUsuario.get(destino.user_id);
    if (!pref) return true; // sem linha salva = padrões do app, que notificam.
    if (!pref.notificacoes_ativas) return false;
    if (!pref.nao_perturbar) return true;
    return !dentroDoNaoPerturbar(
      destino.fuso_offset_min ?? 180,
      pref.nao_perturbar_inicio,
      pref.nao_perturbar_fim
    );
  });
}

/**
 * Manda as mensagens que sobrarem depois do filtro de preferências.
 *
 * A API do Expo aceita até 100 mensagens por POST, então um grupo inteiro sai numa chamada
 * só. Tokens mortos são apagados: sem isso toda notificação futura pra essa pessoa gastaria
 * uma chamada que nunca entrega.
 */
export async function enviarPush(admin: Admin, mensagens: MensagemPush[]): Promise<void> {
  if (mensagens.length === 0) return;

  const disponiveis = await destinatariosDisponiveis(
    admin,
    mensagens.map((m) => m.destinatarioId)
  );
  if (disponiveis.length === 0) return;

  const tokenPorUsuario = new Map(disponiveis.map((d) => [d.user_id, d.expo_push_token]));

  // `enviaveis` e `payload` andam juntos, mesmo índice: é assim que o ticket de erro que o
  // Expo devolve na posição i volta a ser o usuário que não recebeu.
  const enviaveis = mensagens.filter((m) => tokenPorUsuario.has(m.destinatarioId));
  if (enviaveis.length === 0) return;

  const payload = enviaveis.map((m) => ({
    to: tokenPorUsuario.get(m.destinatarioId),
    title: m.title,
    body: m.body,
    data: m.data ?? {},
    sound: "default",
    channelId: m.canal ?? CANAL_FORCAS,
    priority: "high",
  }));

  const resposta = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });

  const resultado = await resposta.json().catch(() => null);
  // Com array na entrada, o Expo devolve `data` como array de tickets, na mesma ordem.
  const tickets = Array.isArray(resultado?.data) ? resultado.data : [];

  const tokensMortos: string[] = [];
  tickets.forEach((ticket: any, i: number) => {
    if (ticket?.status !== "error") return;

    if (ticket?.details?.error === "DeviceNotRegistered") {
      const destinatario = enviaveis[i]?.destinatarioId;
      if (destinatario) tokensMortos.push(destinatario);
      return;
    }

    console.error("Push recusado pelo Expo:", ticket?.message, ticket?.details);
  });

  if (tokensMortos.length > 0) {
    await admin.from("push_tokens").delete().in("user_id", tokensMortos);
  }
}
