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
export const mandarForca = async (salaId: string, destinatarioId: string) => {
    // A torcida é da SALA, não do registro pessoal de estudo de quem a abriu — por isso o
    // parâmetro mudou de `sessaoId` para `salaId` (ver a migration `20260806140000`).
    const { data, error } = await supabase.functions.invoke("mandar-forca", {
        body: { salaId, destinatarioId },
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

// ───── SELECT (torcida de uma sala) ─────
export const buscarIncentivosDaSala = async (salaId: string) => {
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
        .eq("sala_id", salaId)
        .order("created_at", { ascending: true });

    return { data: (data || []) as Incentivo[], error };
};

/*
  Contador que dá um nome único a cada canal. O supabase-js reaproveita canais pelo nome,
  e adicionar callbacks a um canal que já passou pelo `subscribe()` estoura. Como a mesma
  sessão pode ser observada por duas telas ao mesmo tempo (a de foco ativo e a de colegas
  focando, aberta por cima dela), cada assinatura precisa do seu próprio canal.

  Vale também para assinaturas que se sucedem: `removeChannel` só solta o canal depois do
  round-trip com o servidor, então numa remontagem o canal que sai ainda está na lista
  quando o que entra pede o mesmo nome.
*/
let contadorDeCanais = 0;

/**
 * Escuta em tempo real os incentivos de uma sessão específica.
 * Diferente de `observarUsuariosOnline`, que usa presence numa sala global, aqui o canal
 * é por sessão e escuta mudanças de linha (postgres_changes), porque o que interessa é o
 * histórico persistido da torcida e não quem está conectado agora.
 * @returns função de cleanup que remove o canal.
 */
export const observarIncentivosDaSala = (
    salaId: string,
    aoMudar: (novoIncentivo: Incentivo) => void
) => {
    contadorDeCanais += 1;

    const canal: RealtimeChannel = supabase
        .channel(`incentivos:${salaId}:${contadorDeCanais}`)
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "incentivos",
                filter: `sala_id=eq.${salaId}`,
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
 * Diferente de `observarIncentivosDaSala`, aqui o filtro é por destinatário e o canal
 * é global (fica de pé o app inteiro, montado no _layout).
 *
 * @returns função de cleanup que remove o canal.
 */
export const observarForcasRecebidas = (
    userId: string,
    aoReceber: (info: { nomeRemetente: string; salaId: string | null }) => void
) => {
    contadorDeCanais += 1;

    const canal: RealtimeChannel = supabase
        .channel(`forcas-recebidas:${userId}:${contadorDeCanais}`)
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
                // mandou pra montar o texto da notificação. `profiles` só é legível pelo
                // dono agora, então isso passa pela RPC `perfil_nome_publico` em vez de
                // consultar a tabela direto (ver migration 20260814020000).
                const { data: perfis } = await supabase
                    .rpc("perfil_nome_publico", { p_user_id: incentivo.remetente_id });
                const perfil = perfis?.[0];

                aoReceber({
                    nomeRemetente: perfil?.nome_usuario || perfil?.nome_real || "Alguém",
                    salaId: incentivo.sala_id ?? null,
                });
            }
        );

    canal.subscribe();

    return () => {
        supabase.removeChannel(canal);
    };
};
