import { useState, useEffect } from 'react';
import { supabase } from '@/supabase';
import { useAuth } from './useAuth';

// Singleton variables que mantêm o estado global fora do componente React
let globalRoom: any = null;
let globalOnlineUsers: string[] = [];
let listeners: React.Dispatch<React.SetStateAction<string[]>>[] = [];

// Recebe o roomId, mas vamos ignorar para unificar todos na mesma sala global
export const useOnlineUsers = (ignoredRoomId?: string) => {
  const { userId } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<string[]>(globalOnlineUsers);

  useEffect(() => {
    // Só prossegue se o usuário estiver logado
    if (!userId) return;

    // Registra o setState dessa tela na nossa lista de ouvintes
    listeners.push(setOnlineUsers);

    // Se a sala global ainda não existir, cria!
    if (!globalRoom) {
      globalRoom = supabase.channel('room:studo_core_global');

      // Escuta mudanças em tempo real na sala global
      globalRoom.on("presence", { event: "sync" }, () => {
        const currentState = globalRoom.presenceState() as Record<string, { user_id: string; online_at: string }[]>;
        const users = Object.values(currentState).flatMap((presenceStore: any) =>
          presenceStore.map((presence: any) => presence.user_id)
        ).filter(Boolean);

        // Remove duplicadas
        const deduplicated = [...new Set(users)] as string[];
        globalOnlineUsers = deduplicated;

        // Avisa todas as telas do app simultaneamente
        listeners.forEach(listener => listener(deduplicated));
      });

      // Se junta à sala e avisa que está online
      globalRoom.subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await globalRoom.track({ user_id: userId, online_at: new Date().toISOString() });
        }
      });
    } else {
      // Se já estava conectado, apenas garante que esta tela receba a lista mais nova
      setOnlineUsers(globalOnlineUsers);
    }

    // Cleanup: quando a tela for fechada
    return () => {
      listeners = listeners.filter(l => l !== setOnlineUsers);

      // Se for a última tela fechada, derruba o canal para economizar recursos
      if (listeners.length === 0 && globalRoom) {
        supabase.removeChannel(globalRoom);
        globalRoom = null;
        globalOnlineUsers = [];
      }
    };
  }, [userId]);

  return { onlineUsers };
}