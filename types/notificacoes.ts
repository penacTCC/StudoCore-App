/**
 * Tipos da caixa de notificações.
 *
 * A caixa guarda o que sobrevive a você não estar olhando: alguém fez algo que te diz
 * respeito e ainda vai fazer sentido ler daqui a duas horas. Lembrete do cronograma,
 * ofensiva em risco e cronômetro parado NÃO entram — são avisos locais, valem por minutos
 * e viram ruído depois (ver services/lembretePausa.ts).
 *
 * `categoria` é o que decide para onde a linha aponta e como ela se descreve; ver a
 * migration 20260807240000.
 */

import type { TipoPublicacao } from "@/types/comunidade";

export type CategoriaNotificacao = "comunidade" | "grupo" | "foco";

export type TipoNotificacao =
    | "curtida"
    | "comentario"
    | "novo_membro"
    | "sala_aberta"
    | "roadmap_novo"
    | "forca";

export type Notificacao = {
    id: string;
    categoria: CategoriaNotificacao;
    tipo: TipoNotificacao;
    /**
     * O que a notificação aponta:
     *   comunidade -> a publicação, pelo par (origem, referenciaId)
     *   grupo      -> o grupo
     *   foco       -> a sessão em que a força chegou
     *
     * `origem` só existe na Comunidade.
     */
    origem: TipoPublicacao | null;
    referenciaId: string;
    autor: {
        id: string;
        nome: string;
        foto: string | null;
    };
    /** Texto do comentário; `null` em todo o resto. */
    texto: string | null;
    /** Como o alvo se chama na linha: a matéria da foto, o arquivo, o plano, o grupo. */
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
