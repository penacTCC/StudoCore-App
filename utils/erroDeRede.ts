/**
 * Reconhece se um erro capturado veio de falha de conectividade (offline, DNS caiu no meio
 * da requisição, etc.) em vez de uma falha de verdade da API (400, RLS, etc).
 *
 * Cobre os dois formatos que aparecem no app: o `Error` que o `fetch` do RN rejeita
 * ("Network request failed") e o `AbortError` do timeout de `lib/supabase.ts` — que na
 * prática também é sinal de rede ruim, já que 20s é tempo de sobra pra qualquer resposta
 * num link funcionando.
 */
export function ehErroDeRede(erro: unknown): boolean {
    if (!erro) return false;

    const nome = (erro as { name?: string })?.name;
    if (nome === 'AbortError') return true;

    const mensagem = (erro as { message?: string })?.message ?? String(erro);
    return /network request failed|failed to fetch|network error|fetch failed/i.test(mensagem);
}
