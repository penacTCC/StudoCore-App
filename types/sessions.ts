export type SessaoFocoInsert = {
    user_id: string;
    grupo_id?: string | null;
    disciplina: string;
    conteudo_especifico: string;
    tempo_minutos: number;
    questoes_respondidas: number;
    questoes_acertadas: number;
    is_public: boolean;
    status: string;
};


export type SessaoFocoRow = {
    id: string;
    user_id: string;
    grupo_id?: string | null;
    disciplina: string;
    conteudo_especifico: string | null;
    tempo_minutos: number;
    questoes_respondidas: number;
    questoes_acertadas: number;
    is_public: boolean;
    status: string;
    data_sessao: string;
    created_at: string;
    concluido_em: string | null;
    // Vem do JOIN com profiles
    profiles?: {
        nome_real: string | null;
        nome_usuario: string | null;
        foto_usuario: string | null;
    };
};

// Interface compatível com a linha do Supabase + JOIN profiles
export type SessionCardItem  = {
    id: string;
    user_id: string;
    grupo_id?: string | null;
    disciplina: string;
    conteudo_especifico: string | null;
    tempo_minutos: number;
    questoes_respondidas: number;
    questoes_acertadas: number;
    is_public: boolean;
    data_sessao: string;
    created_at: string;
    concluido_em: string | null;
    profiles?: {
        nome_real: string | null;
        nome_usuario: string | null;
        foto_usuario: string | null;
    };
}

export type SessionCardProps = {
    session: SessionCardItem;
    colorIndex: number;
}

export type MemberSession = {
    sessao_id: string;
    membro_id: string;
    funcao: "anfitriao" | "membro";
    ultimo_inicio: string | null;
    tempo_segundos: number;
    status: "ativo" | "pausado" | "concluido";
    profiles?: { nome_usuario?: string }
}

// Tipo para inserção de membro na sessão (sem os campos auto-gerados)
export type MemberSessionInsert = Omit<MemberSession, 'ultimo_inicio' | 'status'>;
