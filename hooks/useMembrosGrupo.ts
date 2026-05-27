import { buscarMembrosGrupo } from "@/services/grupos";
import type { MembroGrupoComPerfil } from "@/types/grupos";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

export function useMembrosGrupo({ grupoId }: { grupoId: string }) {
  const [membros, setMembros] = useState<MembroGrupoComPerfil[]>([]);
  const [carregando, setCarregando] = useState(true);

  const buscarMembros = async () => {
    try {
      setCarregando(true);

      if (!grupoId) return;

      const membrosGrupo = await buscarMembrosGrupo(grupoId);
      setMembros(membrosGrupo);
    } catch (erro) {
      console.error("Erro inesperado:", erro);
    } finally {
      setCarregando(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      buscarMembros();
    }, [grupoId])
  );

  return { membros, carregando };
}
