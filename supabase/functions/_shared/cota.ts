// Cota de IA — o único lugar onde as Edge Functions decidem se a requisição pode custar
// dinheiro.
//
// A verificação e o incremento acontecem dentro da RPC `consumir_cota_ia` (ver
// 20260902120000_planos_e_limites.sql), num único INSERT ... ON CONFLICT: duas requisições
// simultâneas do mesmo usuário não conseguem furar o limite. Aqui só repassamos o JWT que o
// app mandou, então a função consome a cota de quem está chamando e de mais ninguém.
//
// Não usar o service role para isso: com service role `auth.uid()` é nulo e a RPC recusa.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type TipoDeCota = "quiz" | "anexo" | "roadmap" | "chat";

export type ResultadoDeCota = {
  permitido: boolean;
  usado: number;
  limite: number | null;
  plano: string;
  janela: string;
  motivo?: "cota_esgotada" | "bloqueado_no_plano";
};

/**
 * Consome uma unidade de cota. Devolve `permitido: false` quando o plano não cobre o
 * recurso ou a cota do período acabou.
 *
 * Falha de infraestrutura (banco fora, RPC ausente) NÃO bloqueia o usuário: a chamada segue
 * e o custo é absorvido. Barrar o aluno no meio de uma sessão de foco por causa de um erro
 * nosso é pior do que pagar por algumas requisições de Gemini.
 */
export async function consumirCota(
  req: Request,
  tipo: TipoDeCota
): Promise<ResultadoDeCota | null> {
  const authorization = req.headers.get("Authorization");
  if (!authorization) return null;

  try {
    const cliente = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authorization } } }
    );

    const { data, error } = await cliente.rpc("consumir_cota_ia", { p_tipo: tipo });
    if (error) {
      console.warn(`[cota] falha ao consumir cota '${tipo}', liberando:`, error.message);
      return null;
    }
    return data as ResultadoDeCota;
  } catch (erro) {
    console.warn(`[cota] erro inesperado na cota '${tipo}', liberando:`, erro);
    return null;
  }
}

/**
 * Resposta 429 padronizada. O app usa `recurso` + `motivo` para abrir o paywall certo
 * (ver `services/assinatura.ts`), e `detalhe` é o texto que já é lido pelo tratamento de
 * erro existente do `functions.invoke`.
 */
export function respostaDeCotaEsgotada(
  tipo: TipoDeCota,
  resultado: ResultadoDeCota,
  corsHeaders: Record<string, string>
): Response {
  const bloqueado = resultado.motivo === "bloqueado_no_plano";
  return new Response(
    JSON.stringify({
      error: "LIMITE_PLANO",
      recurso: tipo,
      motivo: resultado.motivo ?? "cota_esgotada",
      plano: resultado.plano,
      usado: resultado.usado,
      limite: resultado.limite,
      detalhe: bloqueado
        ? `Recurso não disponível no plano ${resultado.plano}.`
        : `Cota de ${tipo} esgotada (${resultado.usado}/${resultado.limite}).`,
    }),
    { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/**
 * Versão que só consulta, sem consumir. Usada em etapas que custam mas não são a unidade
 * cobrada — o `upload` do chat de anexo, por exemplo.
 */
export async function cotaDisponivel(
  req: Request,
  tipo: TipoDeCota
): Promise<ResultadoDeCota | null> {
  const authorization = req.headers.get("Authorization");
  if (!authorization) return null;

  try {
    const cliente = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authorization } } }
    );

    const { data, error } = await cliente.rpc("cota_disponivel", { p_tipo: tipo });
    if (error) {
      console.warn(`[cota] falha ao consultar cota '${tipo}', liberando:`, error.message);
      return null;
    }
    return data as ResultadoDeCota;
  } catch (erro) {
    console.warn(`[cota] erro inesperado ao consultar cota '${tipo}', liberando:`, erro);
    return null;
  }
}
