import type { ItemFila } from "@/types/foco";

/**
 * Sala de foco em grupo — o ponto de encontro.
 *
 * Existe separada de `sessoes_foco` porque a linha de lá é o REGISTRO PESSOAL de estudo de
 * cada participante, e as duas coisas têm ciclos de vida diferentes: encerrar o próprio
 * estudo não fecha a sala, e a sala pode trocar de anfitrião sem que nada aconteça com o
 * registro de quem saiu (ver a migration `20260806140000_salas_foco.sql`).
 */
export type SalaFoco = {
    id: string;
    grupo_id: string | null;
    /** Quem manda na sala agora — muda quando o anfitrião sai e alguém assume. */
    anfitriao_id: string | null;
    is_public: boolean;
    /** "cronometro" | "pomodoro" — o ritmo combinado da sala. */
    modo: string | null;
    /** Cronograma publicado: todo participante calcula a fase atual a partir dele. */
    fila: ItemFila[] | null;
    fila_inicio_em: string | null;
    criada_em: string;
    /** `null` enquanto a sala está aberta. Preenchido quando o último participante sai. */
    encerrada_em: string | null;
};

/** Participação de uma pessoa numa sala, com o cronômetro individual dela. */
export type ParticipanteDaSala = {
    sala_id: string;
    membro_id: string;
    funcao: "anfitriao" | "membro";
    ultimo_inicio: string | null;
    tempo_segundos: number;
    status: "ativo" | "pausado" | "concluido";
    profiles?: {
        nome_usuario?: string | null;
        nome_real?: string | null;
        foto_usuario?: string | null;
    };
};

/**
 * Forma reduzida usada pela pilha de avatares do feed — só o necessário para desenhar o
 * círculo e ordenar o anfitrião na frente.
 */
export type ParticipanteResumido = {
    membroId: string;
    funcao: "anfitriao" | "membro";
    nome: string;
    foto: string | null;
};
