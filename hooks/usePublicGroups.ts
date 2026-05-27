import { useEffect, useState } from "react";
import { loadPublicGroupsLocally, savePublicGroupsLocally } from "@/services/offlineStorage";
import { buscarGruposPublicosDisponiveis } from "@/services/groups";
import type { PublicGroup } from "@/types/groups";
/**
 * Hook para buscar os grupos públicos do banco de dados, contar seus membros e salvar no estado.
 */
export function usePublicGroups() {
  const [isLoading, setIsLoading] = useState(true);
  const [publicGroups, setPublicGroups] = useState<PublicGroup[]>([]);

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

      // 4. Salva no Estado e no cache
      const finalGroups = await buscarGruposPublicosDisponiveis();
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


