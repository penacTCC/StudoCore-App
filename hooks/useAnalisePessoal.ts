import { useMemo, useCallback } from "react";

import { useSessoesUsuario } from "@/hooks/useSessoesFoco";
import { useDadosCache } from "@/hooks/useDadosCache";
import { buscarGamificacao } from "@/services/gamificacao";
import { calcularAnalisePessoal} from "@/lib/analytics";
import {ComecoSemana, AnalisePessoal} from "@/types/analytics"

/**
 * Junta as duas fontes de dados da aba "Análise" pessoal — sessões de foco do
 * usuário + estado de gamificação (ofensiva) — e devolve os números já
 * agregados por `calcularAnalisePessoal`.
 *
 * Também expõe as sessões cruas (savedSessions/pendingSessions) para a aba
 * "Banco de dados", evitando um segundo fetch: uma única leitura alimenta as
 * duas abas da tela.
 */
export function useAnalisePessoal(
    userId: string | null | undefined,
    comecoSemana: ComecoSemana
) {
    const { savedSessions, pendingSessions, loading, refresh: refreshSessoes } = useSessoesUsuario(userId, true);

    // A ofensiva é persistida no backend ao concluir uma sessão, então aqui só
    // buscamos o valor pronto em vez de recalcular a partir do histórico.
    const { dados: gamificacao, recarregar: recarregarOfensiva } = useDadosCache(
        userId ? `gamificacao:${userId}` : null,
        () => buscarGamificacao(userId!)
    );

    const ofensiva = gamificacao?.ofensiva ?? 0;
    const melhorOfensiva = gamificacao?.melhor_ofensiva ?? 0;

    const refresh = useCallback(async () => {
        await Promise.all([refreshSessoes(), recarregarOfensiva()]);
    }, [refreshSessoes, recarregarOfensiva]);

    const analise = useMemo<AnalisePessoal>(
        () =>
            calcularAnalisePessoal([...savedSessions, ...pendingSessions], {
                comecoSemana,
                ofensiva,
                melhorOfensiva,
            }),
        [savedSessions, pendingSessions, comecoSemana, ofensiva, melhorOfensiva]
    );

    return { analise, savedSessions, pendingSessions, loading, refresh };
}
