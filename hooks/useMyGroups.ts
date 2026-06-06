import { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router"; // ou @react-navigation/native, dependendo da sua importação
import { loadMyGroupsLocally, saveMyGroupsLocally } from "@/services/offlineStorage";
import { buscarMeusGrupos as buscarMeusGrupos } from "@/services/groups";
import type { Group } from "@/types/groups";

export function useMyGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMyGroups = async () => {
    try {
      //Busca primeiro os grupos localmente
      const cachedGroups = await loadMyGroupsLocally();
      if (cachedGroups) {
        setGroups(cachedGroups);
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }

      const finalGroups = await buscarMeusGrupos();
      setGroups(finalGroups);
      await saveMyGroupsLocally(finalGroups);
    } catch (error) {
      console.error("Error fetching groups:", error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Atualiza sempre que a tela ganha foco
  useFocusEffect(
    useCallback(() => {
      fetchMyGroups();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchMyGroups();
  };

  // Retorna tudo que a tela precisa para desenhar a interface
  return { groups, isLoading, refreshing, onRefresh };
}
