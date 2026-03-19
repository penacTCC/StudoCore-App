import { useState, useEffect } from 'react';
import { supabase } from '../supabase'; // Ajuste o caminho conforme sua estrutura

export function useAuth() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. Pega o status do usuário assim que o hook é chamado
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id || null);
      setIsLoading(false);
    });

    // 2. Fica "escutando" mudanças na autenticação (login, logout, token atualizado)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null);
    });

    // 3. Limpa a escuta quando a tela for fechada (boa prática de performance)
    return () => subscription.unsubscribe();
  }, []);

  // Retorna o ID e o status de carregamento para a tela usar
  return { userId, isLoading };
}