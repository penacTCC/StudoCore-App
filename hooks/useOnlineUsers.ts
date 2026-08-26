import { useState, useEffect } from 'react';
import { observarUsuariosOnline, obterUsuariosOnlineCache } from '@/services/onlineUsers';
import { preferenciasDoUsuarioAtual } from '@/services/preferencias';
import { useAuth } from '@/hooks/useAuth';

/**
 * Quem do grupo `grupoId` está online agora.
 *
 * A sala de Presence é por grupo (ver services/onlineUsers.ts) — cada tela só paga o
 * custo do tamanho do grupo que está olhando, não do app inteiro.
 */
export const useOnlineUsers = (grupoId?: string | null) => {
  const { userId } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<string[]>(grupoId ? obterUsuariosOnlineCache(grupoId) : []);
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
    // Só prossegue se o usuário estiver logado e soubermos de que grupo é a sala.
    if (!userId || !grupoId || anunciarPresenca === null) return;

    return observarUsuariosOnline(grupoId, userId, setOnlineUsers, anunciarPresenca);
  }, [userId, grupoId, anunciarPresenca]);

  return { onlineUsers };
}
