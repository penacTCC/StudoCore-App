import { useEffect, useState } from "react";
import { carregarGruposPublicosLocalmente, salvarGruposPublicosLocalmente } from "@/services/armazenamentoOffline";
import { buscarGruposPublicosDisponiveis } from "@/services/grupos";
import type { GrupoPublico } from "@/types/grupos";

export function useGruposPublicos() {
  const [carregando, setCarregando] = useState(true);
  const [gruposPublicos, setGruposPublicos] = useState<GrupoPublico[]>([]);

  const buscarGruposPublicos = async () => {
    try {
      const gruposEmCache = await carregarGruposPublicosLocalmente();
      if (gruposEmCache) {
        setGruposPublicos(gruposEmCache);
        setCarregando(false);
      } else {
        setCarregando(true);
      }

      const gruposAtualizados = await buscarGruposPublicosDisponiveis();
      setGruposPublicos(gruposAtualizados);
      await salvarGruposPublicosLocalmente(gruposAtualizados);
    } catch (erro) {
      console.error("Erro inesperado:", erro);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    buscarGruposPublicos();
  }, []);

  return { gruposPublicos, carregando, recarregarGrupos: buscarGruposPublicos };
}
