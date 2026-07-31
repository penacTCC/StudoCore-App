import { buscarMembrosDosGrupos } from "@/services/grupos";
import { toast } from "@/services/toast";
import type { Grupo, MembroGrupoComPerfil } from "@/types/grupos";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

export function useMembrosGrupos(grupos: Grupo[]) {
  const [membrosPorGrupo, setMembrosPorGrupo] = useState<Record<string, MembroGrupoComPerfil[]>>({});
  const [carregando, setCarregando] = useState(true);

  const gruposIds = grupos.map((g) => g.id).join(",");

  const buscarMembros = async () => {
    try {
      setCarregando(true);

      if (!gruposIds) {
        setMembrosPorGrupo({});
        return;
      }

      const membros = await buscarMembrosDosGrupos(gruposIds.split(","));
      setMembrosPorGrupo(membros);
    } catch (erro) {
      console.error("Erro inesperado:", erro);
      toast.error("Não foi possível carregar os membros dos grupos.");
    } finally {
      setCarregando(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      buscarMembros();
    }, [gruposIds])
  );

  return { membrosPorGrupo, carregando, recarregar: buscarMembros };
}
