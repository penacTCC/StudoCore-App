import { supabase } from "@/repositories/supabase";
import { toast } from "@/services/toast";
import type { Gamificacao } from "@/types/gamificacao";
/*
  O helper daqui era `toISOString()`, ou seja, UTC: depois das 21h (horário de Brasília) a
  ofensiva já marcava o dia seguinte, e um estudo da noite podia contar duas vezes ou pular
  um dia. O de utils/tempo lê o dia no fuso do aparelho, igual ao `data_sessao` das sessões.
*/
import { paraDataISO } from "@/utils/tempo";
import { sincronizarLembreteDeOfensiva } from "@/services/notificacoesOfensiva";

const SELECT_GAMIFICACAO = "user_id, ofensiva, melhor_ofensiva, ultima_data_estudo";

/**
 * Quanto vale a ofensiva HOJE — que não é o mesmo que o número gravado em `gamificacoes`.
 *
 * A coluna `ofensiva` só é escrita quando alguém conclui uma sessão; ninguém passa à
 * meia-noite zerando quem faltou. Sem esta conta, quem parou de estudar continuava vendo
 * os mesmos foguinhos para sempre (inclusive depois de receber o aviso de que a ofensiva
 * ia acabar), e só descobria a perda ao estudar de novo e cair para 1.
 *
 * A regra é a mesma de `registrarSessaoConcluida`: vale se o último dia estudado foi hoje
 * ou ontem; qualquer buraco maior já quebrou a sequência. A comparação é por data local
 * (`paraDataISO`), igual ao que foi gravado.
 */
export const ofensivaVigente = (gamificacao: {
  ofensiva?: number | null;
  ultima_data_estudo?: string | null;
} | null | undefined): number => {
  const ofensiva = gamificacao?.ofensiva ?? 0;
  const ultima = gamificacao?.ultima_data_estudo;
  if (ofensiva < 1 || !ultima) return 0;

  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);

  return ultima === paraDataISO(hoje) || ultima === paraDataISO(ontem) ? ofensiva : 0;
};

/**
 * Busca o estado de gamificação (ofensiva atual, melhor ofensiva, último dia estudado) de um usuário.
 */
export const buscarGamificacao = async (userId: string): Promise<Gamificacao | null> => {
  const { data, error } = await supabase
    .from("gamificacoes")
    .select(SELECT_GAMIFICACAO)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar gamificação:", error);
    toast.error("Não foi possível carregar sua ofensiva.");
    return null;
  }

  // O valor gravado pode estar vencido (ver `ofensivaVigente`); quem lê daqui recebe o de hoje.
  return data && { ...data, ofensiva: ofensivaVigente(data) };
};

/**
 * Registra a conclusão de uma sessão de foco no dia de hoje e recalcula a ofensiva,
 * seguindo a mesma regra do Duolingo: estudou ontem -> +1; pulou um dia -> reseta pra 1.
 * É idempotente por dia: chamar de novo no mesmo dia (ex: ao refazer o quiz) não soma ofensiva extra.
 */
export const registrarSessaoConcluida = async (userId: string): Promise<Gamificacao | null> => {
  const atual = await buscarGamificacao(userId);

  const hoje = new Date();
  const hojeStr = paraDataISO(hoje);

  // Já contabilizou hoje, não há o que recalcular.
  if (atual?.ultima_data_estudo === hojeStr) {
    // Ainda assim reagenda: o lembrete de hoje tem que sair da fila (a pessoa já estudou),
    // e o caminho normal de quem faz duas sessões no mesmo dia passa por aqui.
    await sincronizarLembreteDeOfensiva(atual);
    return atual;
  }

  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);
  const ontemStr = paraDataISO(ontem);

  const estudouOntem = atual?.ultima_data_estudo === ontemStr;
  const novaOfensiva = estudouOntem ? (atual?.ofensiva ?? 0) + 1 : 1;
  const novaMelhorOfensiva = Math.max(atual?.melhor_ofensiva ?? 0, novaOfensiva);

  const { data, error } = await supabase
    .from("gamificacoes")
    .upsert({
      user_id: userId,
      ofensiva: novaOfensiva,
      melhor_ofensiva: novaMelhorOfensiva,
      ultima_data_estudo: hojeStr,
    })
    .select(SELECT_GAMIFICACAO)
    .single();

  if (error) {
    console.error("Erro ao registrar ofensiva:", error);
    return null;
  }

  // Estudou hoje: joga o lembrete de "ofensiva em risco" pra amanhã, já com o número novo.
  await sincronizarLembreteDeOfensiva(data);

  return data;
};
