import { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { carregarMeusGruposLocalmente, salvarMeusGruposLocalmente } from "@/services/armazenamentoOffline";
import { buscarMeusGrupos } from "@/services/grupos";
import type { Grupo } from "@/types/grupos";

export function useMeusGrupos() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);

  const buscarGrupos = async () => {
    try {
      const gruposEmCache = await carregarMeusGruposLocalmente();
      if (gruposEmCache) {
        setGrupos(gruposEmCache);
        setCarregando(false);
      } else {
        setCarregando(true);
      }

      const gruposAtualizados = await buscarMeusGrupos();
      setGrupos(gruposAtualizados);
      await salvarMeusGruposLocalmente(gruposAtualizados);
    } catch (erro) {
      console.error("Erro ao buscar grupos:", erro);
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      buscarGrupos();
    }, [])
  );

  const atualizar = () => {
    setAtualizando(true);
    buscarGrupos();
  };

  return { grupos, carregando, atualizando, atualizar };
}
