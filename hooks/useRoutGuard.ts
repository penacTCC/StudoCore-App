import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Session } from '@supabase/supabase-js';

type GuardProps = {
  isInitialized: boolean;
  session: Session | null;
  profileComplete: boolean | null;
  isMember: boolean | null;
  lastGroupParams: any;
};

export function useRouteGuard({ isInitialized, session, profileComplete, isMember, lastGroupParams }: GuardProps) {
  const segments = useSegments();
  const router = useRouter();

  //O Guarda 
  useEffect(() => {
    // Log para depuração de onde o app está travando
    console.log("RootLayout Guard Check:", {
      isInitialized,
      profileComplete,
      isMember,
      hasLastGroupParams: lastGroupParams !== undefined,
      isMemberTrue: isMember === true
    });

    // O app só faz algo se já inicializou e se já checou o perfil e grupo. Além disso, ele precisa obrigatoriamente verificar os grupos salvos localmente no asyncStorage
    if (!isInitialized || profileComplete === null || isMember === null || (isMember === true && lastGroupParams === undefined)) {
      console.log("RootLayout: Aguardando inicialização completa...");
      return;
    }

    let destinationHandled = false;
    const inAuthGroup = segments[0] === '(auth)';
    const isProfileScreen = segments.includes('onboarding-profile');
    const isVerifyEmailScreen = segments.includes('verify-email');

    const isEmailVerified = !!session?.user?.email_confirmed_at;

    if (!session) {
      // Sem sessão → Welcome
      if (!inAuthGroup) {
        router.replace('/(auth)/onboarding-welcome');
      }
      destinationHandled = true;
    } else if (!isEmailVerified) {
      // Com sessão, mas sem e-mail confirmado → Verify Email (MUDANÇA 4)
      if (!isVerifyEmailScreen) {
        router.replace('/(auth)/verify-email');
      }
      destinationHandled = true;
    } else if (!profileComplete) {
      // E-mail OK, mas sem perfil → Onboarding Profile
      if (!isProfileScreen) {
        router.replace('/(auth)/onboarding-profile');
      }
      destinationHandled = true;
    } else if (!isMember) {
      // Se não tem grupo → No Group
      if (inAuthGroup) {
        router.replace('/(groups)/no-group');
      }
      destinationHandled = true;
    } else {
      // Cuida do caso de o usuário não entrar em alguma tela do grupo (auth)
      const inIndex = segments[0] === 'index' || !segments.length;

      if (inAuthGroup || inIndex) {
        if (lastGroupParams) {
          router.replace({ pathname: '/(tabs)', params: lastGroupParams });
        } else {
          router.replace('/(groups)');
        }
      }
      destinationHandled = true;
    }

    if (destinationHandled) {
      // Dá um tempo bem pequeno para o router fazer o replace das telas antes de sumir o splash
      setTimeout(() => {
        SplashScreen.hideAsync().catch(() => { });
      }, 200);
    }

  }, [session, isInitialized, profileComplete, segments, isMember, lastGroupParams]);
}