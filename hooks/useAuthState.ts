import { useState, useEffect, useRef } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { obterSessaoAtual, observarMudancasAuth, perfilEstaCompleto } from '@/services/auth';
import { toast } from '@/services/toast';
import { limparCache } from '@/lib/cache';
import type { AuthSession } from '@/types/auth';

export function useAuthState() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Só existe porque este hook roda no layout raiz, que fica montado o app inteiro — é o
  // único lugar garantido de estar vivo durante a troca de conta. `useAuth` também limpa o
  // cache, mas seus consumidores ficam dentro de (tabs)/(groups), que o guard de rota
  // desmonta bem na hora da troca: o listener deles nem existe para pegar o evento, e o
  // cache de navegação (grupos, ranking, etc.) fica com dado da conta anterior até o app
  // reiniciar.
  const idUsuarioConhecido = useRef<string | null>(null);

  // ── 1. Inicializa a Sessão
  useEffect(() => {
    console.log("RootLayout: Iniciando busca de sessão...");
    obterSessaoAtual().then(({ data: { session } }) => {
      console.log("RootLayout: Sessão obtida:", session ? "Sim" : "Não");
      idUsuarioConhecido.current = session?.user?.id ?? null;
      setProfileComplete(session ? null : false);
      setSession(session);
      setIsInitialized(true); //só inicia o app se pegar a sessão
    }).catch(err => {
      console.error("RootLayout: Erro ao obter sessão:", err);
      toast.error("Não foi possível verificar sua sessão. Tente reabrir o app.");
      setIsInitialized(true); // tenta prosseguir mesmo com erro para não travar infinitamente
    });

    const { data: { subscription } } = observarMudancasAuth((_event, session) => {
      console.log("RootLayout: AuthState changed:", _event);

      const novoUsuarioId = session?.user?.id ?? null;
      if (idUsuarioConhecido.current !== novoUsuarioId) limparCache();
      idUsuarioConhecido.current = novoUsuarioId;

      setProfileComplete(session ? null : false);
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── 2. Verifica o Perfil e Liga o DeviceEventEmitter 
  useEffect(() => {
    if (!isInitialized) return; // Aguarda a checagem da sessão terminar

    if (!session) {
      setProfileComplete(false);
      return;
    }

    const checkProfileComplete = async () => {
      console.log("RootLayout: Verificando perfil para usuário:", session.user.id);
      const { profile, completo } = await perfilEstaCompleto(session.user.id);
      console.log("RootLayout: Perfil encontrado:", profile ? profile.nome_usuario : "Nenhum");
      setProfileComplete(completo);
    };

    checkProfileComplete();

    // O Passe Livre instantâneo sem ir no banco de novo!
    const subscription = DeviceEventEmitter.addListener('profileReady', () => {
      setProfileComplete(true);
    });

    return () => subscription.remove();
  }, [session, isInitialized]);

  return { isInitialized, session, profileComplete };
}
