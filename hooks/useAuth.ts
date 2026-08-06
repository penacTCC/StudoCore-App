import { useState, useEffect } from 'react';
import { obterSessaoAtual, observarMudancasAuth } from '@/services/auth';
import { limparCache } from '@/lib/cache';
import type { AuthUser } from '@/types/auth';

/**
 * Última sessão conhecida, guardada fora do React.
 *
 * Sem isto, toda tela que monta espera o `getSession()` assíncrono para só então ter o
 * `userId` — e todo fetch que depende dele só começava no segundo render. Como a sessão
 * é a mesma para o app inteiro e já está em memória depois da primeira leitura, ela vira
 * o valor inicial do estado e o `userId` fica disponível já no primeiro render.
 */
let sessaoConhecida: AuthUser | null = null;
let jaResolveuUmaVez = false;

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(sessaoConhecida);
  const [isLoading, setIsLoading] = useState(!jaResolveuUmaVez);

  useEffect(() => {
    // 1. Pega o status do usuário assim que o hook é chamado
    obterSessaoAtual().then(({ data: { session } }) => {
      sessaoConhecida = session?.user || null;
      jaResolveuUmaVez = true;
      setUser(sessaoConhecida);
      setIsLoading(false);
    });

    // 2. Fica "escutando" mudanças na autenticação (login, logout, token atualizado)
    const { data: { subscription } } = observarMudancasAuth((_event, session) => {
      const novoUsuario = session?.user || null;

      // Troca de conta (ou logout) no mesmo aparelho: o cache guarda dado do usuário
      // anterior e precisa ser descartado, senão vaza entre contas.
      if (sessaoConhecida?.id !== novoUsuario?.id) limparCache();

      sessaoConhecida = novoUsuario;
      jaResolveuUmaVez = true;
      setUser(novoUsuario);
    });

    // 3. Limpa a escuta quando a tela for fechada (boa prática de performance)
    return () => subscription.unsubscribe();
  }, []);

  // Retorna o usuário completo, o ID e o status de carregamento para a tela usar
  return { user, userId: user?.id ?? null, isLoading };
}
