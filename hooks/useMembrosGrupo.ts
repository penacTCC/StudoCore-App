import { buscarMembrosGrupo } from "@/services/grupos";
import { toast } from "@/services/toast";
import type { MembroGrupoComPerfil } from "@/types/grupos";
import { useDadosCache } from "@/hooks/useDadosCache";

const SEM_MEMBROS: MembroGrupoComPerfil[] = [];

/**
 * Lista de membros do grupo, vinda do cache compartilhado.
 *
 * Cinco telas usam este hook (home, detalhes do grupo, ranking, membros online...) e
 * antes cada uma refazia a mesma busca ao ganhar foco. Com a chave compartilhada, a
 * primeira paga a requisição e as outras leem o resultado direto da memória.
 */
export function useMembrosGrupo({ grupoId }: { grupoId: string }) {
  const { dados, carregando, erro, recarregar } = useDadosCache<MembroGrupoComPerfil[]>(
    grupoId ? `membros-grupo:${grupoId}` : null,
    async () => {
      try {
        return await buscarMembrosGrupo(grupoId);
      } catch (erro) {
        console.error("Erro inesperado:", erro);
        toast.error("Não foi possível carregar os membros do grupo.");
        throw erro;
      }
    },
    // Entrar e sair de grupo é raro comparado à frequência de navegação entre as telas.
    { tempoFresco: 60_000 }
  );

  return { membros: dados ?? SEM_MEMBROS, carregando, erro: dados ? null : erro, recarregar };
}
