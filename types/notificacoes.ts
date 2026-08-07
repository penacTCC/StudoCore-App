/**
 * Tipos da caixa de notificações do feed público.
 *
 * Só existem duas: curtida e comentário. Elas sempre apontam para uma publicação de
 * QUEM RECEBE — a caixa não é um histórico do que os outros fazem, é "o que aconteceu
 * com as minhas coisas".
 */

import type { TipoPublicacao } from "@/types/comunidade";

export type TipoNotificacao = "curtida" | "comentario";

export type Notificacao = {
    id: string;
    tipo: TipoNotificacao;
    /** Publicação alvo — é o par (origem, referenciaId) que o resto da Comunidade usa. */
    origem: TipoPublicacao;
    referenciaId: string;
    autor: {
        id: string;
        nome: string;
        foto: string | null;
    };
    /** Texto do comentário; `null` nas curtidas. */
    texto: string | null;
    /** Como a publicação se chama na linha: a matéria da foto, o nome do arquivo/plano. */
    resumo: string | null;
    /** Miniatura da foto de sessão, já assinada. `null` nas outras origens. */
    fotoUrl: string | null;
    lida: boolean;
    /** ISO 8601. */
    criadoEm: string;
};

export type PaginaDeNotificacoes = {
    itens: Notificacao[];
    /** Cursor opaco da próxima página; `null` quando acabou. */
    proximoCursor: string | null;
};
