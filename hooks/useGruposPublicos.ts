import { useEffect } from "react";
import { carregarGruposPublicosLocalmente, salvarGruposPublicosLocalmente } from "@/services/armazenamentoOffline";
import { buscarGruposPublicosDisponiveis } from "@/services/grupos";
import { toast } from "@/services/toast";
import { useDadosCache } from "@/hooks/useDadosCache";
import type { GrupoPublico } from "@/types/grupos";

const SEM_GRUPOS: GrupoPublico[] = [];

/** Vitrine de grupos públicos disponíveis para entrar. */
export function useGruposPublicos() {
  const { dados, carregando, erro, recarregar, semear } = useDadosCache<GrupoPublico[]>(
    "grupos-publicos",
    async () => {
      try {
        const grupos = await buscarGruposPublicosDisponiveis();
        salvarGruposPublicosLocalmente(grupos);
        return grupos;
      } catch (erro) {
        console.error("Erro inesperado:", erro);
        toast.error("Não foi possível carregar os grupos públicos.");
        throw erro;
      }
    },
    // Vitrine de descoberta: uma lista de alguns minutos atrás serve.
    { tempoFresco: 2 * 60_000 }
  );

  useEffect(() => {
    if (dados) return;

    let ativo = true;
    carregarGruposPublicosLocalmente().then((local) => {
      if (ativo && local) semear(local);
    });

    return () => { ativo = false; };
  }, [dados, semear]);

  return {
    gruposPublicos: dados ?? SEM_GRUPOS,
    carregando,
    erro: dados ? null : erro,
    recarregarGrupos: recarregar,
  };
}
