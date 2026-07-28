import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/repositories/supabase";
import type { Incentivo, IncentivoInsert } from "@/types/incentivos";

/**
 * 23505 é o código do Postgres para violação de UNIQUE. Aqui ele significa apenas que a
 * pessoa já tinha mandado força nessa sessão — o resultado desejado já está no banco.
 * Tratamos como sucesso porque, se devolvêssemos erro, a tela desfaria a atualização
 * otimista e o botão voltaria a dizer "não mandei" mesmo tendo mandado.
 */
const ehIncentivoDuplicado = (error: any) => error?.code === "23505";

// ───── INSERT ─────
export const enviarIncentivo = async (incentivo: IncentivoInsert) => {
    const { data, error } = await supabase
        .from("incentivos")
        .insert(incentivo)
        .select()
        .maybeSingle();

    if (error && ehIncentivoDuplicado(error)) {
        return { data: null, error: null };
    }

    return { data, error };
};

// ───── DELETE (desfazer o próprio incentivo) ─────
export const removerIncentivo = async (incentivo: IncentivoInsert) => {
    const { error } = await supabase
        .from("incentivos")
        .delete()
        .eq("sessao_id", incentivo.sessao_id)
        .eq("remetente_id", incentivo.remetente_id)
        .eq("destinatario_id", incentivo.destinatario_id);

    return { error };
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
    aoMudar: (novoIncentivo: Incentivo | null) => void
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
        )
        .on(
            "postgres_changes",
            {
                event: "DELETE",
                schema: "public",
                table: "incentivos",
                filter: `sessao_id=eq.${sessaoId}`,
            },
            // No DELETE o Postgres só devolve a chave primária, então a tela recarrega a
            // lista em vez de tentar remover um item com dados incompletos.
            () => aoMudar(null)
        );

    canal.subscribe();

    return () => {
        supabase.removeChannel(canal);
    };
};
