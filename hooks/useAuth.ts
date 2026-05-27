import { useState, useEffect } from 'react';
import { obterSessaoAtual, observarMudancasAuth } from '@/services/auth';
import type { AuthUser } from '@/types/auth';

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. Pega o status do usuário assim que o hook é chamado
    obterSessaoAtual().then(({ data: { session } }) => {
      setUser(session?.user || null);
      setUserId(session?.user?.id || null);
      setIsLoading(false);
    });

    // 2. Fica "escutando" mudanças na autenticação (login, logout, token atualizado)
    const { data: { subscription } } = observarMudancasAuth((_event, session) => {
      setUser(session?.user || null);
      setUserId(session?.user?.id || null);
    });

    // 3. Limpa a escuta quando a tela for fechada (boa prática de performance)
    return () => subscription.unsubscribe();
  }, []);

  // Retorna o usuário completo, o ID e o status de carregamento para a tela usar
  return { user, userId, isLoading };
}
