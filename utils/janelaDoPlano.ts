/**
 * Janela de leitura do plano — quanto do próprio histórico o usuário enxerga.
 *
 * Funções puras, fora do hook de propósito: assim dá para testá-las sem instanciar o
 * cliente do Supabase, e telas que só precisam do corte não carregam o resto.
 */

/**
 * Data mais antiga que o plano deixa VER, no formato `aaaa-mm-dd`. `null` = sem corte.
 *
 * Usa o fuso local do app (o mesmo `paraDataISO` do resto do projeto) porque "últimos 30
 * dias" para o usuário são dias do calendário dele, não janelas de 24h em UTC.
 */
export function dataMinimaVisivel(dias: number | null | undefined): string | null {
    if (dias === null || dias === undefined) return null;
    const limite = new Date();
    limite.setDate(limite.getDate() - dias);
    return `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, "0")}-${String(limite.getDate()).padStart(2, "0")}`;
}

/**
 * Filtra uma lista datada pela janela do plano. Sem janela, devolve a lista intacta (a
 * mesma referência, para não invalidar `useMemo` de quem chama).
 *
 * `dataDe` é explícito porque as tabelas não concordam num nome só: sessão de foco tem
 * `data_sessao` (o dia de estudo), arquivo tem `created_at`.
 */
export function dentroDaJanela<T>(
    itens: T[],
    dias: number | null | undefined,
    dataDe: (item: T) => string | null | undefined
): T[] {
    const minima = dataMinimaVisivel(dias);
    if (!minima) return itens;
    return itens.filter((item) => (dataDe(item) ?? "").slice(0, 10) >= minima);
}
