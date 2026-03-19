import { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router"; // ou @react-navigation/native, dependendo da sua importação
import { supabase } from "@/supabase"; // Ajuste o caminho

export function useMyGroups() {
  const [groups, setGroups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMyGroups = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Busca por grupos onde o usuário é membro
      const { data: memberData, error } = await supabase
        .from("membros")
        .select(`
                    grupo_id,
                    grupos (
                        id,
                        nome_grupo,
                        descricao,
                        foto_grupo,
                        meta_horas,
                        publico
                    )
                `)
        .eq("user_id", user.id);

      if (error) {
        console.error("Erro ao buscar grupos:", error);
        return;
      }

      // Mapeia e garante que está extraindo os dados corretamente
      const myGroups = memberData
        ?.filter(m => m.grupos)
        .map(m => m.grupos);

      setGroups(myGroups || []);
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