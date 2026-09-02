import type { ItemFila } from "@/types/foco";

/** Um pomodoro ou descanso dentro de uma sequência gerada. */
export type ItemSequenciaPomodoro = {
    tipo: "estudo" | "descanso";
    duracaoMin: number;
    ehLongo?: boolean;
};

export type ParametrosSequenciaPomodoro = {
    qtdPomodoros: number;
    duracaoPomodoroMin: number;
    inserirDescansos: boolean;
    descansoCurtoMin: number;
    descansoLongoMin: number;
    ciclosAteLongo: number;
};

/**
 * Gera a sequência de pomodoros + descansos de uma sessão, alternando foco e descanso
 * (descanso longo a cada `ciclosAteLongo` pomodoros). Nunca insere descanso depois do
 * último pomodoro — a sessão termina assim que o último foco acaba.
 *
 * Usado pelo pomodoro solo (`app/(tabs)/focus.tsx`), que precisa saber quando a sessão acaba.
 */
export function gerarSequenciaPomodoro({
    qtdPomodoros,
    duracaoPomodoroMin,
    inserirDescansos,
    descansoCurtoMin,
    descansoLongoMin,
    ciclosAteLongo,
}: ParametrosSequenciaPomodoro): ItemSequenciaPomodoro[] {
    const itens: ItemSequenciaPomodoro[] = [];

    for (let i = 0; i < qtdPomodoros; i++) {
        itens.push({ tipo: "estudo", duracaoMin: duracaoPomodoroMin });

        if (inserirDescansos && i < qtdPomodoros - 1) {
            const ehLongo = (i + 1) % ciclosAteLongo === 0;
            itens.push({
                tipo: "descanso",
                duracaoMin: ehLongo ? descansoLongoMin : descansoCurtoMin,
                ehLongo,
            });
        }
    }

    return itens;
}

/** Onde uma fila está agora, calculado só a partir do relógio. */
export type PosicaoNaFila = {
    /** Índice do item em andamento. No fim da fila, aponta para o último item. */
    indice: number;
    /** Segundos que faltam no item atual (negativo quando a fila já acabou). */
    restanteSeg: number;
    /** `true` quando o tempo total da fila já passou. */
    terminou: boolean;
};

/**
 * Descobre em que item de uma fila a sessão está, dado o instante em que o primeiro item
 * começou. Só depende do relógio: a mesma fila e o mesmo início dão a mesma resposta em
 * qualquer aparelho, a qualquer momento.
 *
 * É isso que sustenta o pomodoro em grupo (ver a migration
 * `20260805220000_cronograma_compartilhado_sessao.sql`): em vez de o anfitrião avisar cada
 * troca de fase — e a sincronia quebrar quando ele sai, fecha o app ou perde a internet —,
 * cada participante recalcula a posição a partir do cronograma publicado no começo.
 *
 * Também é o que permite reabrir o app depois de horas e cair no ponto certo da sessão.
 */
export function posicaoNaFila(
    fila: ItemFila[],
    inicioMs: number,
    agoraMs: number = Date.now()
): PosicaoNaFila {
    if (fila.length === 0) {
        return { indice: 0, restanteSeg: 0, terminou: true };
    }

    let restante = Math.floor((agoraMs - inicioMs) / 1000);

    for (let indice = 0; indice < fila.length; indice++) {
        const duracaoSeg = Math.round(fila[indice].duracaoMin * 60);

        if (restante < duracaoSeg) {
            return { indice, restanteSeg: duracaoSeg - restante, terminou: false };
        }

        restante -= duracaoSeg;
    }

    // Passou do fim: o excedente volta negativo, para quem chama saber há quanto acabou.
    return { indice: fila.length - 1, restanteSeg: -restante, terminou: true };
}

/**
 * Instante (em ms) em que um item da fila começa, contado a partir do início da fila.
 *
 * Quem segue um cronograma compartilhado precisa disso para creditar o tempo pela hora em
 * que a fase REALMENTE começou, e não pela hora em que o aparelho percebeu a troca — senão
 * cada participante gravaria uma duração um pouco diferente para a mesma fase.
 */
export function inicioDoItemMs(fila: ItemFila[], inicioMs: number, indice: number): number {
    let deslocamentoSeg = 0;

    for (let i = 0; i < indice && i < fila.length; i++) {
        deslocamentoSeg += Math.round(fila[i].duracaoMin * 60);
    }

    return inicioMs + deslocamentoSeg * 1000;
}
