/** Um "Mandar força" enviado por alguém para o dono de uma sessão de foco. */
export type Incentivo = {
    id: string;
    sessao_id: string;
    remetente_id: string;
    destinatario_id: string;
    created_at: string;
    // Vem do JOIN com profiles, para montar os avatares da Torcida.
    profiles?: {
        nome_real: string | null;
        nome_usuario: string | null;
        foto_usuario: string | null;
    };
};

export type IncentivoInsert = {
    sessao_id: string;
    remetente_id: string;
    destinatario_id: string;
};
