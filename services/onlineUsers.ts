import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/repositories/supabase";

type PresencePayload = {
  user_id: string;
  online_at: string;
};

type OnlineUsersListener = (users: string[]) => void;

let globalRoom: RealtimeChannel | null = null;
let globalOnlineUsers: string[] = [];
let listeners: OnlineUsersListener[] = [];

const mapearUsuariosOnline = (presenceState: Record<string, PresencePayload[]>) => {
  const users = Object.values(presenceState)
    .flatMap((presenceStore) => presenceStore.map((presence) => presence.user_id))
    .filter(Boolean);

  return [...new Set(users)];
};

export const obterUsuariosOnlineCache = () => globalOnlineUsers;

/**
 * Assina a lista de quem está online.
 *
 * `anunciarPresenca` desligado deixa o usuário só observando: ele continua vendo os
 * colegas, mas não entra na lista dos outros. É o que a preferência de privacidade faz —
 * ver quem está estudando não obriga a ser visto.
 */
export const observarUsuariosOnline = (
  userId: string,
  listener: OnlineUsersListener,
  anunciarPresenca = true
) => {
  listeners.push(listener);

  if (!globalRoom) {
    const room = supabase.channel("room:studo_core_global");
    globalRoom = room;

    room.on("presence", { event: "sync" }, () => {
      const currentState = room.presenceState() as Record<string, PresencePayload[]>;
      const deduplicated = mapearUsuariosOnline(currentState);
      globalOnlineUsers = deduplicated;

      listeners.forEach((item) => item(deduplicated));
    });

    room.subscribe(async (status: string) => {
      if (status === "SUBSCRIBED" && anunciarPresenca) {
        await room.track({ user_id: userId, online_at: new Date().toISOString() });
      }
    });
  } else {
    /*
      Sala já existente: o `track` do bloco acima só roda uma vez, na criação, então
      quem desliga a preferência com o canal no ar precisa ser retirado aqui — senão a
      mudança só valeria no próximo boot do app.
    */
    if (!anunciarPresenca) {
      globalRoom.untrack().catch((erro) =>
        console.error("Erro ao sair da lista de quem está online:", erro)
      );
    }
    listener(globalOnlineUsers);
  }

  return () => {
    listeners = listeners.filter((item) => item !== listener);

    if (listeners.length === 0 && globalRoom) {
      supabase.removeChannel(globalRoom);
      globalRoom = null;
      globalOnlineUsers = [];
    }
  };
};
