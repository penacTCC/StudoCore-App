import { useState, useEffect } from 'react';
import { supabase } from '@/supabase';
import { useAuth } from './useAuth';

export const useOnlineUsers = (roomId = "studo_core_global") => {
  const { userId } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  useEffect(() => {
    // Se o userId ainda não carregou, não tentamos conectar. 
    // Assim que ele estiver disponível, o useEffect roda novamente.
    if (!userId) return;

    //aqui estamos criando um canal em tempo real, com ID dinâmico, para que o app saiba quem está online e em qual tela
    const room = supabase.channel(`room:${roomId}`);

    //Escuta quem entra e quem sai do canal
    room.on("presence", { event: "sync" }, () => {
      // Passamos a tipagem do que foi enviado no `track`
      const currentState = room.presenceState<{ user_id: string; online_at: string }>();

      // As chaves principais não são os user_ids, mas sim identificadores de conexão. 
      // Por isso pegamos os valores para extrair o user_id real.
      const users = Object.values(currentState).flatMap(presenceStore =>
        presenceStore.map(presence => presence.user_id)
      ).filter(Boolean); // Filtra possíveis falsos/indefinidos

      // Removendo duplicações (caso o usuário esteja logado em dois lugares)
      setOnlineUsers([...new Set(users)]);
    })

    //Quem entrar no canal avisa que tá online
    room.subscribe(async (status) => {
      //subscribed = conectado
      if (status === 'SUBSCRIBED') {
        //Pega a data atual e transforma em string
        await room.track({ user_id: userId, online_at: new Date().toISOString() });
      }
    })
    // Limpeza: Sai da sala quando a tela for fechada ou o roomId mudar
    return () => {
      supabase.removeChannel(room);
    };
  }, [roomId, userId]);

  return { onlineUsers };
}