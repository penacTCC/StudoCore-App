import { supabase } from "@/repositories/supabase";
import { SessaoFocoInsert } from "@/types/sessions";

// ───── INSERT ─────
export const salvarSessaoFoco = async (sessao: SessaoFocoInsert) => {
    return await supabase.from("sessoes_foco").insert(sessao).select();
};

// ───── UPDATE (refazer ou revisar formulário pendente) ─────
export const atualizarSessaoFoco = async (id: string, updates: Partial<SessaoFocoInsert>) => {
    return await supabase.from("sessoes_foco").update(updates).eq("id", id);
};

// ───── SELECT (feed público, só sessões públicas, status salvo e score > 7) ─────
export const buscarSessoesRecentes = async (limit: number = 20) => {
    return await supabase
        .from("sessoes_foco")
        .select(`
            *,
            profiles:user_id (
                nome_real,
                nome_usuario,
                foto_usuario
            )
        `)
        .eq("is_public", true)
        .eq("status", "salvo")
        .gt("questoes_acertadas", 7)
        .order("created_at", { ascending: false })
        .limit(limit);
};

// ───── SELECT (sessões de um usuário específico) ─────
export const buscarSessoesPorUsuario = async (userId: string, limit: number = 20) => {
    return await supabase
        .from("sessoes_foco")
        .select(`
            *,
            profiles:user_id (
                nome_real,
                nome_usuario,
                foto_usuario
            )
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);
};
