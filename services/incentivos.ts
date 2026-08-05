import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/repositories/supabase";
import type { Incentivo } from "@/types/incentivos";

/**
 * Manda uma força de verdade: registra o incentivo via Edge Function (que é quem decide o
 * cooldown de 20min por par remetente/destinatário — não é o cliente que decide isso, só
 * reflete o que a função responder).
 *
 * A notificação de quem recebe não sai daqui: ela é disparada no aparelho do destinatário,
 * que escuta o INSERT por Realtime (ver `observarForcasRecebidas` abaixo).
 */
export const mandarForca = async (sessaoId: string, destinatarioId: string) => {
    const { data, error } = await supabase.functions.invoke("mandar-forca", {
        body: { sessaoId, destinatarioId },
    });

    if (error) {
        // O supabase-js não expõe o corpo JSON de respostas não-2xx diretamente em `error`;
        // o `context` da FunctionsHttpError guarda a Response original.
        const contexto = (error as any)?.context;
        const corpo = contexto ? await contexto.json().catch(() => null) : null;
        return { data: null, error: corpo?.error ?? error.message, retryAfterSeconds: corpo?.retryAfterSeconds };
    }

    return { data, error: null, retryAfterSeconds: undefined };
};

// ───── SELECT (torcida de uma sessão) ─────
export const buscarIncentivosDaSessao = async (sessaoId: string) => {
    const { data, error } = await supabase
        .from("incentivos")
        .select(`
            *,
            profiles:remetente_id (
                nome_real,
                nome_usuario,
                foto_usuario
            )
        `)
        .eq("sessao_id", sessaoId)
        .order("created_at", { ascending: true });

    return { data: (data || []) as Incentivo[], error };
};

/*
  Contador que dá um nome único a cada canal. O supabase-js reaproveita canais pelo nome,
  e adicionar callbacks a um canal que já passou pelo `subscribe()` estoura. Como a mesma
  sessão pode ser observada por duas telas ao mesmo tempo (a de foco ativo e a de colegas
  focando, aberta por cima dela), cada assinatura precisa do seu próprio canal.
*/
let contadorDeCanais = 0;

/**
 * Escuta em tempo real os incentivos de uma sessão específica.
 * Diferente de `observarUsuariosOnline`, que usa presence numa sala global, aqui o canal
 * é por sessão e escuta mudanças de linha (postgres_changes), porque o que interessa é o
 * histórico persistido da torcida e não quem está conectado agora.
 * @returns função de cleanup que remove o canal.
 */
export const observarIncentivosDaSessao = (
    sessaoId: string,
    aoMudar: (novoIncentivo: Incentivo) => void
) => {
    contadorDeCanais += 1;

    const canal: RealtimeChannel = supabase
        .channel(`incentivos:${sessaoId}:${contadorDeCanais}`)
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "incentivos",
                filter: `sessao_id=eq.${sessaoId}`,
            },
            (payload) => aoMudar(payload.new as Incentivo)
        );

    canal.subscribe();

    return () => {
        supabase.removeChannel(canal);
    };
};

/**
 * Escuta as forças que chegam PRA MIM, em qualquer sessão, enquanto o app estiver aberto.
 * É o substituto do push remoto: o INSERT chega por Realtime e o próprio aparelho mostra a
 * notificação local (ver services/notificacoesForca.ts) — sem Firebase/FCM no meio.
 *
 * Diferente de `observarIncentivosDaSessao`, aqui o filtro é por destinatário e o canal
 * é global (fica de pé o app inteiro, montado no _layout).
 *
 * @returns função de cleanup que remove o canal.
 */
export const observarForcasRecebidas = (
    userId: string,
    aoReceber: (info: { nomeRemetente: string; sessaoId: string }) => void
) => {
    const canal: RealtimeChannel = supabase
        .channel(`forcas-recebidas:${userId}`)
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "incentivos",
                filter: `destinatario_id=eq.${userId}`,
            },
            async (payload) => {
                const incentivo = payload.new as Incentivo;

                // O payload do realtime não traz o JOIN com profiles — busca o nome de quem
                // mandou pra montar o texto da notificação.
                const { data: perfil } = await supabase
                    .from("profiles")
                    .select("nome_usuario, nome_real")
                    .eq("id", incentivo.remetente_id)
                    .maybeSingle();

                aoReceber({
                    nomeRemetente: perfil?.nome_usuario || perfil?.nome_real || "Alguém",
                    sessaoId: incentivo.sessao_id,
                });
            }
        );

    canal.subscribe();

    return () => {
        supabase.removeChannel(canal);
    };
};
