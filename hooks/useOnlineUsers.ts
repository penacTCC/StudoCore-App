import { useState, useEffect } from 'react';
import { observarUsuariosOnline, obterUsuariosOnlineCache } from '@/services/onlineUsers';
import { preferenciasDoUsuarioAtual } from '@/services/preferencias';
import { useAuth } from '@/hooks/useAuth';

// Recebe o roomId, mas vamos ignorar para unificar todos na mesma sala global
export const useOnlineUsers = (ignoredRoomId?: string) => {
  const { userId } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<string[]>(obterUsuariosOnlineCache());
  /*
    `null` enquanto a preferência não chegou. A assinatura espera esse valor em vez de
    assumir "sim": entrar na lista e sair meio segundo depois faria o usuário que pediu
    privacidade piscar na tela dos colegas.
  */
  const [anunciarPresenca, setAnunciarPresenca] = useState<boolean | null>(null);

  useEffect(() => {
    if (!userId) return;
    let ativo = true;
    preferenciasDoUsuarioAtual().then((prefs) => {
      if (ativo) setAnunciarPresenca(prefs.aparecerNoRanking);
    });
    return () => {
      ativo = false;
    };
  }, [userId]);

  useEffect(() => {
    // Só prossegue se o usuário estiver logado
    if (!userId || anunciarPresenca === null) return;

    return observarUsuariosOnline(userId, setOnlineUsers, anunciarPresenca);
  }, [userId, anunciarPresenca]);

  return { onlineUsers };
}
