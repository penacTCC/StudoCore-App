/** Um "Mandar força" enviado por alguém para o dono de uma sessão de foco. */
export type Incentivo = {
    id: string;
    /** LEGADO: chave de quando sala e registro pessoal eram a mesma linha. */
    sessao_id: string | null;
    /** Sala em que a força foi mandada. */
    sala_id: string | null;
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
    /** LEGADO: chave de quando sala e registro pessoal eram a mesma linha. */
    sessao_id: string | null;
    /** Sala em que a força foi mandada. */
    sala_id: string | null;
    remetente_id: string;
    destinatario_id: string;
};
