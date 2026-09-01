import { useEffect } from "react";
import { sincronizarLembreteWrapped } from "@/services/notificacoesWrapped";

/**
 * Garante que o push do Wrapped mensal (dia 1, 9h) está agendado a cada abertura do app.
 *
 * Diferente do lembrete de ofensiva, este não depende de nenhum dado do usuário — só
 * reagenda pra pegar mudanças na preferência de notificações ou na permissão do sistema
 * desde a última abertura.
 */
export function useLembreteWrapped(userId: string | null | undefined) {
    useEffect(() => {
        if (!userId) return;

        sincronizarLembreteWrapped();
    }, [userId]);
}
