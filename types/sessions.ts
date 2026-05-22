export type SessaoFocoInsert = {
    user_id: string;
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
};

// Interface compatível com a linha do Supabase + JOIN profiles
export type SessionCardItem  = {
    id: string;
    user_id: string;
    disciplina: string;
    conteudo_especifico: string | null;
    tempo_minutos: number;
    questoes_respondidas: number;
    questoes_acertadas: number;
    is_public: boolean;
    data_sessao: string;
    created_at: string;
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