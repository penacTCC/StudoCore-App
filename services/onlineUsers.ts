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

export const observarUsuariosOnline = (userId: string, listener: OnlineUsersListener) => {
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
      if (status === "SUBSCRIBED") {
        await room.track({ user_id: userId, online_at: new Date().toISOString() });
      }
    });
  } else {
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
