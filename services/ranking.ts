import { supabase } from "@/repositories/supabase";
import { RankingHorasMembro } from "@/types/ranking";

export const buscarRankingHorasMembros = async (groupId?: string, periodo?: string): Promise<RankingHorasMembro[]> => {
    if (!groupId) return [];

    //aqui chamamos a função do supabase, passando o id do grupo
    //e o periodo (total, semanal, mensal etc)
    const {data, error} = await supabase.rpc("ranking_horas_membros_grupo", {
        p_grupo_id: groupId,
        p_periodo: periodo,
    });

    if (error) {
    console.log("Erro ao buscar ranking de horas:", error);
      return [];
    }

    return data ?? [];
}