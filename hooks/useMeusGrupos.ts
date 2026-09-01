import { useEffect, useState } from "react";
import { carregarMeusGruposLocalmente, salvarMeusGruposLocalmente } from "@/services/armazenamentoOffline";
import { buscarMeusGrupos } from "@/services/grupos";
import { toast } from "@/services/toast";
import { useDadosCache } from "@/hooks/useDadosCache";
import type { Grupo } from "@/types/grupos";

const SEM_GRUPOS: Grupo[] = [];

/**
 * Grupos dos quais o usuário participa.
 *
 * O cache em disco continua sendo a rede de segurança offline; o cache em memória é o
 * que evita a lista sumir da tela toda vez que ela volta ao foco. A chave é global (não
 * leva o id do usuário) porque `buscarMeusGrupos` já resolve pela sessão — e o cache
 * inteiro é descartado na troca de conta.
 */
export function useMeusGrupos() {
  const [atualizando, setAtualizando] = useState(false);

  const { dados, carregando, erro, recarregar, semear } = useDadosCache<Grupo[]>(
    "meus-grupos",
    async () => {
      try {
        const grupos = await buscarMeusGrupos();
        salvarMeusGruposLocalmente(grupos);
        return grupos;
      } catch (erro) {
        console.error("Erro ao buscar grupos:", erro);
        toast.error("Não foi possível carregar seus grupos.");
        throw erro;
      }
    },
    // Entrar ou sair de grupo passa por aqui via `atualizar`; o resto é navegação.
    { tempoFresco: 60_000 }
  );

  // Semente offline: mostra o último estado conhecido enquanto a rede não responde.
  useEffect(() => {
    if (dados) return;

    let ativo = true;
    carregarMeusGruposLocalmente().then((local) => {
      if (ativo && local) semear(local);
    });

    return () => { ativo = false; };
  }, [dados, semear]);

  const atualizar = async () => {
    setAtualizando(true);
    try {
      await recarregar();
    } finally {
      setAtualizando(false);
    }
  };

  // Só é "erro de verdade" pra tela quando não há nem dado em cache nem semente offline
  // pra mostrar no lugar — com qualquer um dos dois, a falha vira revalidação silenciosa.
  return { grupos: dados ?? SEM_GRUPOS, carregando, erro: dados ? null : erro, atualizando, atualizar };
}
