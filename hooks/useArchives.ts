import { buscarArquivosVisiveis } from "@/services/archives";
import { toast } from "@/services/toast";
import { useDadosCache } from "@/hooks/useDadosCache";
import type { ArquivoDetalhe } from "@/types/archives";

const SEM_ARQUIVOS: ArquivoDetalhe[] = [];

/**
 * Hook para buscar e gerenciar os arquivos do usuário.
 *
 * @param userId - ID do usuário para filtrar os arquivos.
 * @returns Um objeto contendo a lista de arquivos, o estado de carregamento e uma função para atualizar os dados.
 */
export const useArchives = (userId: string | undefined) => {
    const { dados, carregando, erro, recarregar } = useDadosCache<ArquivoDetalhe[]>(
        userId ? `arquivos:${userId}` : null,
        async () => {
            try {
                return await buscarArquivosVisiveis(userId!);
            } catch (err) {
                console.error(err);
                toast.error("Não foi possível carregar seus arquivos.");
                throw err;
            }
        },
        // Um upload feito em outra tela precisa aparecer assim que o Vault volta ao foco.
        { tempoFresco: 0 }
    );

    return {
        archives: dados ?? SEM_ARQUIVOS,
        isLoading: carregando,
        erro: dados ? null : erro,
        refresh: recarregar,
    };
};
