import { useEffect } from "react";
import { buscarGamificacao } from "@/services/gamificacao";
import { sincronizarLembreteDeOfensiva } from "@/services/notificacoesOfensiva";

/**
 * Reagenda o lembrete de "ofensiva em risco" a cada abertura do app.
 *
 * Precisa rodar aqui, e não só ao concluir uma sessão, por dois motivos: quem NÃO estudou
 * ontem chega hoje com um lembrete agendado pra uma ofensiva que já morreu, e o disparo é
 * pontual (um dia por vez), então sem esta passada a fila secaria depois do primeiro dia
 * sem estudar.
 */
export function useLembreteDeOfensiva(userId: string | null | undefined) {
    useEffect(() => {
        if (!userId) return;

        buscarGamificacao(userId).then(sincronizarLembreteDeOfensiva);
    }, [userId]);
}
