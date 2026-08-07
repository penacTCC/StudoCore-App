import { useMemo } from "react";
import { buscarRankingHorasMembros } from "@/services/ranking";
import { useDadosCache } from "@/hooks/useDadosCache";
import type { LeaderboardFilter } from "@/constants/ranking";
import type { MembroGrupoComPerfil } from "@/types/grupos";
import type { RankingMembroComPerfil } from "@/types/ranking";

// Junta o ranking de horas (só traz quem tem minutos no período) com a lista
// completa de membros do grupo, zerando quem ficou de fora — assim a UI sempre
// tem uma linha por membro, com os inativos no fim.
export function useRankingHorasGrupo(
    grupoId: string | null | undefined,
    periodo: LeaderboardFilter,
    membros: MembroGrupoComPerfil[]
) {
    /*
      Só a RPC entra no cache; o cruzamento com os membros é cálculo local.

      Antes as duas coisas viviam no mesmo efeito, com `membros` nas dependências — e como
      aquele array é recriado a cada busca de membros, a RPC era refeita sem necessidade.
      Trocar de filtro (semanal/mensal/geral) e voltar também refazia tudo; agora cada
      filtro tem a própria chave e a volta é instantânea.
    */
    const { dados, carregando } = useDadosCache(
        grupoId ? `ranking-horas:${grupoId}:${periodo}` : null,
        () => buscarRankingHorasMembros(grupoId!, periodo),
        { tempoFresco: 15_000 }
    );

    const rankingMembros: RankingMembroComPerfil[] = useMemo(() => {
        const ranking = dados ?? [];

        const rankingComMembros = ranking.map((item) => ({
            ...item,
            membro: membros.find((m) => m.user_id === item.user_id),
        }));

        const membrosSemRanking = membros
            .filter((membro) => !ranking.some((item) => item.user_id === membro.user_id))
            .map((membro) => ({
                user_id: membro.user_id,
                total_minutos: 0,
                membro,
            }));

        return [...rankingComMembros, ...membrosSemRanking];
    }, [dados, membros]);

    return { rankingMembros, carregando };
}
