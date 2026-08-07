import { buscarMembrosDosGrupos } from "@/services/grupos";
import { toast } from "@/services/toast";
import { useDadosCache } from "@/hooks/useDadosCache";
import type { Grupo, MembroGrupoComPerfil } from "@/types/grupos";

type MembrosPorGrupo = Record<string, MembroGrupoComPerfil[]>;

const SEM_MEMBROS: MembrosPorGrupo = {};

/**
 * Membros de vários grupos de uma vez, para as listas que mostram os avatares empilhados.
 *
 * A chave é a lista de ids concatenada: entrar num grupo novo muda a chave e força uma
 * busca, mas navegar de ida e volta com os mesmos grupos lê da memória.
 */
export function useMembrosGrupos(grupos: Grupo[]) {
  const gruposIds = grupos.map((g) => g.id).join(",");

  const { dados, carregando, recarregar } = useDadosCache<MembrosPorGrupo>(
    gruposIds ? `membros-dos-grupos:${gruposIds}` : null,
    async () => {
      try {
        return await buscarMembrosDosGrupos(gruposIds.split(","));
      } catch (erro) {
        console.error("Erro inesperado:", erro);
        toast.error("Não foi possível carregar os membros dos grupos.");
        throw erro;
      }
    },
    { tempoFresco: 60_000 }
  );

  return { membrosPorGrupo: dados ?? SEM_MEMBROS, carregando, recarregar };
}
