import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GuardProps } from '@/types/routing';

export function useRouteGuard({ inicializado, session, perfilCompleto, membro, parametrosUltimoGrupo }: GuardProps) {
  const segmentos = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!inicializado || perfilCompleto === null || membro === null || (membro === true && parametrosUltimoGrupo === undefined)) {
      return;
    }

    let destinoTratado = false;
    const estaNoGrupoAuth = segmentos[0] === '(auth)';
    const estaNaTelaPerfil = segmentos.includes('onboarding-profile');
    const estaNaTelaVerificarEmail = segmentos.includes('verify-email');
    const estaNaTelaRecuperarSenha = segmentos.includes('forgot-password');
    const emailVerificado = !!session?.user?.email_confirmed_at;

    if (estaNaTelaRecuperarSenha) {
      destinoTratado = true;
      setTimeout(() => {
        SplashScreen.hideAsync().catch(() => { });
      }, 200);
      return;
    }

    if (!session) {
      if (!estaNoGrupoAuth) {
        router.replace('/(auth)/onboarding-welcome');
      }
      destinoTratado = true;
    } else if (!emailVerificado) {
      if (!estaNaTelaVerificarEmail) {
        router.replace('/(auth)/verify-email');
      }
      destinoTratado = true;
    } else if (!perfilCompleto) {
      if (!estaNaTelaPerfil) {
        router.replace('/(auth)/onboarding-profile');
      }
      destinoTratado = true;
    } else if (!membro) {
      const estaEmTelaDeGrupoSemGrupo =
        segmentos[0] === '(groups)' &&
        ['no-group', 'browse-groups', 'group-details'].includes(String(segmentos[1]));
      const estaEmModalSemGrupo =
        segmentos[0] === '(modals)' &&
        ['create-group', 'join-by-code'].includes(String(segmentos[1]));

      if (!estaEmTelaDeGrupoSemGrupo && !estaEmModalSemGrupo) {
        router.replace('/(groups)/no-group');
      }
      destinoTratado = true;
    } else {
      const estaNoIndex = segmentos[0] === 'index' || !segmentos.length;

      if (estaNoGrupoAuth || estaNoIndex) {
        if (parametrosUltimoGrupo) {
          router.replace({ pathname: '/(tabs)', params: parametrosUltimoGrupo });
        } else {
          router.replace('/(groups)');
        }
      }
      destinoTratado = true;
    }

    if (destinoTratado) {
      setTimeout(() => {
        SplashScreen.hideAsync().catch(() => { });
      }, 200);
    }
  }, [session, inicializado, perfilCompleto, segmentos, membro, parametrosUltimoGrupo]);
}
