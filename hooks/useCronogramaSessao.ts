import { useCallback, useEffect, useState } from "react";
import { buscarSala, observarSala } from "@/services/salas";
import { paraTimestampMs } from "@/utils/tempo";
import type { ItemFila } from "@/types/foco";
import type { SalaFoco } from "@/types/sala";

export type CronogramaSessao = {
    fila: ItemFila[];
    inicioMs: number;
    /** `true` quando a sala que dita o ritmo já foi fechada. */
    encerrada: boolean;
};

/**
 * Extrai o cronograma de uma linha de sala já em mãos.
 *
 * Existe separado do hook porque quem entra numa sala recebe a linha inteira junto do toque
 * em "entrar". Sem isto haveria uma corrida: começar antes de o hook terminar a busca faria
 * a pessoa montar um pomodoro próprio em vez de adotar o do grupo — de novo fora de
 * sincronia, que é o que se está corrigindo.
 *
 * Aceita também o formato antigo (`concluido_em`), porque a mesma função é usada com a
 * linha de sessão que ainda viaja nos parâmetros da rota ao entrar numa sessão pública.
 */
export const cronogramaDaLinha = (
    linha?: {
        fila?: ItemFila[] | null;
        fila_inicio_em?: string | null;
        encerrada_em?: string | null;
        concluido_em?: string | null;
    } | null
): CronogramaSessao | null => {
    if (!linha) return null;

    const fila = (linha.fila || []) as ItemFila[];
    const inicioMs = paraTimestampMs(linha.fila_inicio_em);

    // Sala de cronômetro, ou antiga (anterior à coluna): não há cronograma a seguir.
    if (fila.length === 0 || inicioMs === null) return null;

    return { fila, inicioMs, encerrada: Boolean(linha.encerrada_em ?? linha.concluido_em) };
};

/**
 * Lê e mantém atualizado o cronograma publicado de uma SALA — a fila de focos e descansos e
 * o instante em que ela começou.
 *
 * É o que faz o pomodoro em grupo existir: quem entra numa sala não recebe ordens de troca
 * de fase, recebe o cronograma inteiro e calcula sozinho onde a sala está agora (ver
 * utils/pomodoroSequence.ts -> posicaoNaFila). O realtime aqui só cobre as MUDANÇAS do
 * combinado — o anfitrião esticando o foco, pulando um descanso, ou a sala fechando. Se esse
 * aviso se perder, a sincronia continua de pé, porque a fila que já está na mão continua
 * valendo.
 *
 * O cronograma passou a morar na sala, e não mais na linha de `sessoes_foco` do anfitrião:
 * naquele lugar, encadear as matérias de um plano criava uma linha nova a cada matéria e o
 * ritmo do grupo se partia no meio do estudo.
 *
 * Devolve `null` enquanto não há sala para seguir ou quando ela não é um pomodoro.
 */
export const useCronogramaSessao = (salaId?: string | null) => {
    const [cronograma, setCronograma] = useState<CronogramaSessao | null>(null);

    const aplicar = useCallback((sala: SalaFoco | null) => {
        setCronograma(cronogramaDaLinha(sala));
    }, []);

    useEffect(() => {
        let cancelado = false;

        if (!salaId) {
            setCronograma(null);
            return;
        }

        buscarSala(salaId).then(({ sala }) => {
            if (!cancelado) aplicar(sala);
        });

        const cancelarInscricao = observarSala(salaId, (sala) => aplicar(sala));

        return () => {
            cancelado = true;
            cancelarInscricao();
        };
    }, [salaId, aplicar]);

    return cronograma;
};
