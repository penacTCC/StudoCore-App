import { useState, useEffect } from 'react';
import { observarUsuariosOnline, obterUsuariosOnlineCache } from '@/services/onlineUsers';
import { useAuth } from '@/hooks/useAuth';

// Recebe o roomId, mas vamos ignorar para unificar todos na mesma sala global
export const useOnlineUsers = (ignoredRoomId?: string) => {
  const { userId } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<string[]>(obterUsuariosOnlineCache());

  useEffect(() => {
    // Só prossegue se o usuário estiver logado
    if (!userId) return;

    return observarUsuariosOnline(userId, setOnlineUsers);
  }, [userId]);

  return { onlineUsers };
}
