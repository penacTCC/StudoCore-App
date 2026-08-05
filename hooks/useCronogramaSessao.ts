import { useCallback, useEffect, useState } from "react";
import { fetchFocusSession, observarSessao } from "@/services/sessions";
import { paraTimestampMs } from "@/utils/tempo";
import type { ItemFila } from "@/types/foco";
import type { SessaoFocoRow } from "@/types/sessions";

export type CronogramaSessao = {
    fila: ItemFila[];
    inicioMs: number;
    /** `true` quando a sessão que dita o ritmo já foi encerrada. */
    encerrada: boolean;
};

/**
 * Lê e mantém atualizado o cronograma publicado de uma sessão de foco — a fila de focos e
 * descansos e o instante em que ela começou.
 *
 * É o que faz o pomodoro em grupo existir: quem entra numa sessão alheia não recebe ordens
 * de troca de fase, recebe o cronograma inteiro e calcula sozinho onde a sessão está agora
 * (ver utils/pomodoroSequence.ts -> posicaoNaFila). O realtime aqui só cobre as MUDANÇAS do
 * combinado — o anfitrião esticando o foco, pulando um descanso ou encerrando a sessão. Se
 * esse aviso se perder, a sincronia continua de pé, porque a fila que já está na mão
 * continua valendo.
 *
 * Devolve `null` enquanto não há sessão para seguir ou quando ela não é um pomodoro.
 */
/**
 * Extrai o cronograma de uma linha de sessão já em mãos.
 *
 * Existe separado do hook porque quem entra numa sessão pública recebe a linha inteira
 * junto do toque em "entrar" (ela viaja nos parâmetros da rota). Sem isto haveria uma
 * corrida: começar antes de o hook terminar a busca faria a pessoa montar um pomodoro
 * próprio em vez de adotar o do grupo — de novo fora de sincronia, que é o que se está
 * corrigindo.
 */
export const cronogramaDaLinha = (
    linha?: { fila?: ItemFila[] | null; fila_inicio_em?: string | null; concluido_em?: string | null } | null
): CronogramaSessao | null => {
    if (!linha) return null;

    const fila = (linha.fila || []) as ItemFila[];
    const inicioMs = paraTimestampMs(linha.fila_inicio_em);

    // Sessão de cronômetro, ou antiga (anterior à coluna): não há cronograma a seguir.
    if (fila.length === 0 || inicioMs === null) return null;

    return { fila, inicioMs, encerrada: !!linha.concluido_em };
};

export const useCronogramaSessao = (sessaoId?: string | null) => {
    const [cronograma, setCronograma] = useState<CronogramaSessao | null>(null);

    const aplicar = useCallback((linha: SessaoFocoRow | null) => {
        setCronograma(cronogramaDaLinha(linha));
    }, []);

    useEffect(() => {
        let cancelado = false;

        if (!sessaoId) {
            setCronograma(null);
            return;
        }

        fetchFocusSession(sessaoId).then(({ data }) => {
            if (!cancelado) aplicar((data?.[0] as SessaoFocoRow) ?? null);
        });

        const cancelarInscricao = observarSessao(sessaoId, (linha) => aplicar(linha));

        return () => {
            cancelado = true;
            cancelarInscricao();
        };
    }, [sessaoId, aplicar]);

    return cronograma;
};
