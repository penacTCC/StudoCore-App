import { useState, useEffect } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { supabase } from '../supabase';
import { Session } from '@supabase/supabase-js';

export function useAuthState() {
  const [session, setSession] = useState<Session | null>(null);
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // ── 1. Inicializa a Sessão 
  useEffect(() => {
    console.log("RootLayout: Iniciando busca de sessão...");
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("RootLayout: Sessão obtida:", session ? "Sim" : "Não");
      setSession(session);
      setIsInitialized(true); //só inicia o app se pegar a sessão
    }).catch(err => {
      console.error("RootLayout: Erro ao obter sessão:", err);
      setIsInitialized(true); // tenta prosseguir mesmo com erro para não travar infinitamente
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("RootLayout: AuthState changed:", _event);
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
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('nome_usuario')
        .eq('id', session.user.id) // Certifique-se de que é 'id' e não 'user_id' aqui
        .single();

      console.log("RootLayout: Perfil encontrado:", profile ? profile.nome_usuario : "Nenhum");
      setProfileComplete(!!profile?.nome_usuario);
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
