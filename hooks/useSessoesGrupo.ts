import { buscarSessoesPorGrupo } from "@/services/sessions";
import { toast } from "@/services/toast";
import { useDadosCache } from "@/hooks/useDadosCache";
import { SessaoFocoRow } from "@/types/sessions";

const SEM_SESSOES: SessaoFocoRow[] = [];

export const useSessoesGrupo = (groupId?: string | null) => {
    const { dados, carregando, recarregar } = useDadosCache<SessaoFocoRow[]>(
        groupId ? `sessoes-grupo:${groupId}` : null,
        async () => {
            const { data, error } = await buscarSessoesPorGrupo(groupId!);
            if (error) {
                console.error("Erro ao buscar sessões de foco:", error);
                toast.error("Não foi possível carregar as sessões do grupo.");
                throw error;
            }
            return (data as SessaoFocoRow[]) || [];
        },
        { tempoFresco: 15_000 }
    );

    return { sessions: dados ?? SEM_SESSOES, loading: carregando, refresh: recarregar };
};
