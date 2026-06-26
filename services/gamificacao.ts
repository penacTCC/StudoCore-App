import { supabase } from "@/repositories/supabase";
import type { Gamificacao } from "@/types/gamificacao";

const SELECT_GAMIFICACAO = "user_id, ofensiva, melhor_ofensiva, ultima_data_estudo";

const paraDataISO = (data: Date) => data.toISOString().split("T")[0];

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
    return null;
  }

  return data;
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

  return data;
};
