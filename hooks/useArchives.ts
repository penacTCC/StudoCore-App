import { supabase } from "@/supabase";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";


/**
 * Hook para buscar e gerenciar os arquivos do usuário.
 * 
 * @param userId - ID do usuário para filtrar os arquivos.
 * @returns Um objeto contendo a lista de arquivos, o estado de carregamento e uma função para atualizar os dados.
 */
export const useArchives = (userId: string | undefined) => {

    const [archives, setArchives] = useState<any[]>([]); // Estado para armazenar a lista de arquivos vinda do banco de dados

    const [isLoading, setIsLoading] = useState(false); // Estado para controlar se os dados estão sendo buscados


    /** Função que busca os arquivos na tabela 'arquivos' do Supabase */
    const fetchArchives = useCallback(async () => {
        if (!userId) return; // Se não houver usuário logado, interrompe a busca
        setIsLoading(true);
        try {
            // Busca os IDs dos grupos que o usuário pertence
            const { data: userGroups } = await supabase
                .from("membros")
                .select("grupo_id")
                .eq("user_id", userId);

            const groupIds = userGroups?.map(g => g.grupo_id) || [];

            // Busca arquivos entregues por mim
            const { data: myFiles } = await supabase
                .from("arquivos")
                .select("*, profiles(nome_usuario), arquivos_grupos(grupo_id)")
                .eq("user_id", userId);

            // Busca arquivos enviados para meus grupos por outras pessoas (ou por mim também)
            let groupFiles: any[] = [];
            if (groupIds.length > 0) {
                const { data: groupLinks } = await supabase
                    .from("arquivos_grupos")
                    .select("grupo_id, arquivos(*, profiles(nome_usuario), arquivos_grupos(grupo_id))")
                    .in("grupo_id", groupIds);

                groupFiles = groupLinks?.map(link => link.arquivos).filter(Boolean) || [];
            }

            // Consolida e remove duplicatas (um arquivo pode ter sido enviado por mim E estar no meu grupo)
            const allFiles = [...(myFiles || []), ...groupFiles];

            // Mapa para deduplicação baseado no id do arquivo
            const uniqueMap = new Map();
            allFiles.forEach(f => {
                if (!uniqueMap.has(f.id)) {
                    uniqueMap.set(f.id, f);
                }
            });
            const uniqueFiles = Array.from(uniqueMap.values());

            // Ordena por data de criação decrescente
            uniqueFiles.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

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
