import { supabase } from "@/supabase";

// ───── TIPOS ─────
export interface SessaoFocoInsert {
    user_id: string;
    disciplina: string;
    conteudo_especifico: string;
    tempo_minutos: number;
    questoes_respondidas: number;
    questoes_acertadas: number;
    is_public: boolean;
    status: string;
}

export interface SessaoFocoRow {
    id: string;
    user_id: string;
    disciplina: string;
    conteudo_especifico: string | null;
    tempo_minutos: number;
    questoes_respondidas: number;
    questoes_acertadas: number;
    is_public: boolean;
    status: string;
    data_sessao: string;
    created_at: string;
    // Vem do JOIN com profiles
    profiles?: {
        nome_real: string | null;
        nome_usuario: string | null;
        foto_usuario: string | null;
    };
}

// ───── INSERT ─────
export const salvarSessaoFoco = async (sessao: SessaoFocoInsert) => {
    return await supabase.from("sessoes_foco").insert(sessao);
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
