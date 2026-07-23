import { useEffect, useState } from "react";
import { buscarRankingHorasMembros } from "@/services/ranking";
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
    const [rankingMembros, setRankingMembros] = useState<RankingMembroComPerfil[]>([]);
    const [carregando, setCarregando] = useState(true);

    useEffect(() => {
        const carregarRankingHoras = async () => {
            if (!grupoId) {
                setRankingMembros([]);
                setCarregando(false);
                return;
            }

            setCarregando(true);

            const ranking = await buscarRankingHorasMembros(grupoId, periodo);

            const rankingComMembros = ranking.map((item) => {
                const membro = membros.find((m) => m.user_id === item.user_id);
                return { ...item, membro };
            });

            const membrosSemRanking = membros
                .filter((membro) => !ranking.some((item) => item.user_id === membro.user_id))
                .map((membro) => ({
                    user_id: membro.user_id,
                    total_minutos: 0,
                    membro,
                }));

            setRankingMembros([...rankingComMembros, ...membrosSemRanking]);
            setCarregando(false);
        };

        carregarRankingHoras();
    }, [grupoId, periodo, membros]);

    return { rankingMembros, carregando };
}
