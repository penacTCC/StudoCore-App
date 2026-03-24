import { supabase } from "@/supabase";
import { useEffect, useState } from "react";
import { loadPublicGroupsLocally, savePublicGroupsLocally } from "@/services/offlineStorage";
/**
 * Hook para buscar os grupos públicos do banco de dados, contar seus membros e salvar no estado.
 */
export function usePublicGroups() {
  const [isLoading, setIsLoading] = useState(true);
  const [publicGroups, setPublicGroups] = useState<any[]>([]);

  const fetchPublicGroups = async () => {
    try {
      //Busca primeiro os grupos localmente
      const cachedGroups = await loadPublicGroupsLocally();
      if (cachedGroups) {
        setPublicGroups(cachedGroups);
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }

      // Pega o usuário logado atualmente
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Busca todos os grupos públicos e a contagem de membros
      const { data: grupoPublico, error } = await supabase
        .from('grupos')
        .select('*, membros(count)')
        .eq('publico', true);

      if (error) {
        console.error("Erro ao buscar grupos:", error);
        return;
      }

      // 2. Busca os IDs dos grupos em que o usuário JÁ está
      const { data: meusMembros } = await supabase
        .from('membros')
        .select('grupo_id')
        .eq('user_id', user.id);

      // Cria um array só com os IDs (ex: [1, 5, 8])
      const myGroupIds = meusMembros?.map(m => m.grupo_id) || [];

      // 3. Filtra a lista de grupos públicos, removendo os que o usuário já faz parte
      const filteredGroups = grupoPublico?.filter(grupo => !myGroupIds.includes(grupo.id));

      // 4. Formata os dados para incluir a contagem de membros
      const formattedPublicGroups = filteredGroups?.map((grupo) => ({
        ...grupo,
        members: grupo.membros[0]?.count || 0
      }));

      // 4. Salva no Estado e no cache
      const finalGroups = formattedPublicGroups || [];
      setPublicGroups(finalGroups);
      await savePublicGroupsLocally(finalGroups);

    } catch (err) {
      console.error("Erro inesperado:", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchPublicGroups();
  }, []);

  return { publicGroups, isLoading, refetchGroups: fetchPublicGroups };

};



