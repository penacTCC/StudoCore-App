import { supabase } from "@/supabase";
import { useEffect, useState } from "react";
/**
 * Hook para buscar os grupos públicos do banco de dados, contar seus membros e salvar no estado.
 */
export function usePublicGroups() {
  const [isLoading, setIsLoading] = useState(true);
  const [publicGroups, setPublicGroups] = useState<any[]>([]);

  const fetchPublicGroups = async () => {
    try {
      setIsLoading(true);

      const { data: grupoPublico, error } = await supabase
        .from('grupos') //pega tudo da tabela grupos se estiver publico=true
        .select('*, membros(count)') // Busca o grupo e os dados do perfil do criador
        .eq('publico', true);

      if (error) {
        console.error("Erro ao buscar grupos:", error);
        return;
      }

      //console.log("Grupos encontrados:", grupoPublico);

      // Promise.all() aguarda TODAS as promises terminarem antes de continuar
      // .map() transforma cada grupo da lista em uma promise (porque tem "async")
      // Para cada grupo, chama qtdGroupMembers para contar os membros
      // " || [] " é um fallback: se grupoPublico for null/undefined, usa array vazio
      const formattedPublicGroups = grupoPublico?.map((grupo) => ({
        ...grupo,
        members: grupo.membros[0]?.count || 0
      }));

      // 3. Salva no Estado
      setPublicGroups(formattedPublicGroups || []);

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



