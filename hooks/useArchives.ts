import { buscarArquivosVisiveis } from "@/services/archives";
import type { ArquivoDetalhe } from "@/types/archives";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

/**
 * Hook para buscar e gerenciar os arquivos do usuário.
 * 
 * @param userId - ID do usuário para filtrar os arquivos.
 * @returns Um objeto contendo a lista de arquivos, o estado de carregamento e uma função para atualizar os dados.
 */
export const useArchives = (userId: string | undefined) => {
    const [archives, setArchives] = useState<ArquivoDetalhe[]>([]); // Estado para armazenar a lista de arquivos vinda do banco de dados
    const [isLoading, setIsLoading] = useState(false); // Estado para controlar se os dados estão sendo buscados

    /** Função que busca os arquivos na tabela 'arquivos' do Supabase */
    const fetchArchives = useCallback(async () => {
        if (!userId) return; // Se não houver usuário logado, interrompe a busca
        setIsLoading(true);
        try {
            const uniqueFiles = await buscarArquivosVisiveis(userId);
            setArchives(uniqueFiles); // Salva os dados no estado
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false); // Finaliza o estado de carregamento
        }
    }, [userId]);

    // Executa a busca toda vez que a tela ganha foco (ex: usuário volta para a aba Vault)
    useFocusEffect(
        useCallback(() => {
            fetchArchives();
        }, [fetchArchives])
    );
    // Retorna as informações para serem usadas no componente vault.tsx
    return { archives, isLoading, refresh: fetchArchives };
};
