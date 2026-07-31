import { useState, useEffect, useMemo, useCallback } from "react";

import { useSessoesUsuario } from "@/hooks/useSessoesFoco";
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
    const { savedSessions, pendingSessions, loading, refresh: refreshSessoes } = useSessoesUsuario(userId);

    const [ofensiva, setOfensiva] = useState(0);
    const [melhorOfensiva, setMelhorOfensiva] = useState(0);

    // A ofensiva é persistida no backend ao concluir uma sessão, então aqui só
    // buscamos o valor pronto em vez de recalcular a partir do histórico.
    const buscarOfensiva = useCallback(async () => {
        if (!userId) return;
        const gamificacao = await buscarGamificacao(userId);
        setOfensiva(gamificacao?.ofensiva ?? 0);
        setMelhorOfensiva(gamificacao?.melhor_ofensiva ?? 0);
    }, [userId]);

    useEffect(() => {
        buscarOfensiva();
    }, [buscarOfensiva]);

    const refresh = useCallback(async () => {
        await Promise.all([refreshSessoes(), buscarOfensiva()]);
    }, [refreshSessoes, buscarOfensiva]);

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
