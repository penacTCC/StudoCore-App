import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/repositories/supabase";

type PresencePayload = {
  user_id: string;
  online_at: string;
};

type OnlineUsersListener = (users: string[]) => void;

/*
  Um registro de sala de Presence POR GRUPO, em vez de uma sala global única.

  Antes havia UMA sala (`room:studo_core_global`) para o app inteiro: o Presence reenvia o
  estado completo a cada entrada/saída/heartbeat para TODOS os clientes conectados no
  canal — O(N²) de tráfego, sendo N o total de usuários do app. Era o principal motivo do
  app degradar perto de 200 usuários simultâneos, mesmo quando cada tela só usava essa
  lista para filtrar "quem do MEU grupo está online" (ver hooks/useMembrosOnline.ts).

  Chaveando por grupo, o estado replicado passa a ter o tamanho do GRUPO — estruturalmente
  pequeno — e não o do app inteiro. O mesmo padrão de contagem de referências (fecha o
  canal quando o último listener sai) continua valendo, só que por chave.
*/
type SalaDePresenca = {
  canal: RealtimeChannel;
  usuariosOnline: string[];
  listeners: OnlineUsersListener[];
};

const salas = new Map<string, SalaDePresenca>();

const mapearUsuariosOnline = (presenceState: Record<string, PresencePayload[]>) => {
  const users = Object.values(presenceState)
    .flatMap((presenceStore) => presenceStore.map((presence) => presence.user_id))
    .filter(Boolean);

  return [...new Set(users)];
};

export const obterUsuariosOnlineCache = (grupoId: string) => salas.get(grupoId)?.usuariosOnline ?? [];

/**
 * Assina a lista de quem está online NO GRUPO `grupoId`.
 *
 * `anunciarPresenca` desligado deixa o usuário só observando: ele continua vendo os
 * colegas, mas não entra na lista dos outros. É o que a preferência de privacidade faz —
 * ver quem está estudando não obriga a ser visto.
 */
export const observarUsuariosOnline = (
  grupoId: string,
  userId: string,
  listener: OnlineUsersListener,
  anunciarPresenca = true
) => {
  let sala = salas.get(grupoId);

  if (!sala) {
    const canal = supabase.channel(`presence:grupo:${grupoId}`);
    sala = { canal, usuariosOnline: [], listeners: [] };
    salas.set(grupoId, sala);

    canal.on("presence", { event: "sync" }, () => {
      const currentState = canal.presenceState() as Record<string, PresencePayload[]>;
      const deduplicated = mapearUsuariosOnline(currentState);
      sala!.usuariosOnline = deduplicated;

      sala!.listeners.forEach((item) => item(deduplicated));
    });

    canal.subscribe(async (status: string) => {
      if (status === "SUBSCRIBED" && anunciarPresenca) {
        await canal.track({ user_id: userId, online_at: new Date().toISOString() });
      }
    });
  } else if (!anunciarPresenca) {
    /*
      Sala já existente: o `track` do bloco acima só roda uma vez, na criação, então
      quem desliga a preferência com o canal no ar precisa ser retirado aqui — senão a
      mudança só valeria no próximo boot do app.
    */
    sala.canal.untrack().catch((erro) =>
      console.error("Erro ao sair da lista de quem está online:", erro)
    );
  }

  sala.listeners.push(listener);
  listener(sala.usuariosOnline);

  return () => {
    const salaAtual = salas.get(grupoId);
    if (!salaAtual) return;

    salaAtual.listeners = salaAtual.listeners.filter((item) => item !== listener);

    if (salaAtual.listeners.length === 0) {
      supabase.removeChannel(salaAtual.canal);
      salas.delete(grupoId);
    }
  };
};

/**
 * Contagem de quem está estudando agora NO APP INTEIRO — usada só pelo card de
 * `browse-groups.tsx`, que precisa de um número global e não de uma lista.
 *
 * Antes esse número vinha da mesma sala de Presence global (`onlineUsers.length`), que é
 * exatamente o padrão O(N²) que este arquivo deixou de usar. Uma contagem agregada no
 * banco (ver migration `20260826010000_contar_estudando_agora.sql`) resolve com uma
 * consulta indexada, sem canal de Realtime nenhum — o custo não cresce com o número de
 * gente conectada.
 */
export const contarEstudandoAgora = async () => {
  const { data, error } = await supabase.rpc("contar_estudando_agora");

  if (error) {
    console.warn("Erro ao contar quem está estudando agora:", error);
    return 0;
  }

  return (data as number | null) ?? 0;
};
