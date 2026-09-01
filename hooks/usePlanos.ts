import { buscarPlanos } from "@/services/planos";
import type { Plano } from "@/types/cronograma";
import { useDadosCache } from "@/hooks/useDadosCache";

const SEM_PLANOS: Plano[] = [];

/**
 * Hook para buscar os planos do usuário.
 *
 * A lista fica no cache compartilhado: voltar do plano-editor mostra os planos que já
 * estavam na tela e revalida por trás, em vez de esvaziar a aba durante a busca.
 */
export const usePlanos = (userId: string | null | undefined) => {
    const { dados, carregando, erro, recarregar } = useDadosCache<Plano[]>(
        userId ? `planos:${userId}` : null,
        () => buscarPlanos(userId!),
        // Plano só muda quando o próprio usuário edita — e aí o editor chama o recarregar.
        { tempoFresco: 2 * 60_000 }
    );

    return {
        planos: dados ?? SEM_PLANOS,
        carregando,
        erro: dados ? null : erro,
        recarregarPlanos: recarregar,
    };
};
