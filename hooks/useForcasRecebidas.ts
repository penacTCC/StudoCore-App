import { useEffect } from "react";
import { observarForcasRecebidas } from "@/services/incentivos";
import { notificarForcaRecebida } from "@/services/notificacoesForca";

/**
 * Mantém, o app inteiro, um canal de Realtime escutando as forças que chegam pro usuário
 * logado — e dispara uma notificação local em cada uma.
 *
 * Substitui o push remoto (Expo Push), que no Android só funciona com credenciais do
 * Firebase/FCM. Fica no _layout de propósito: precisa estar de pé em qualquer tela, não só
 * na de foco (a graça do "mandar força" é justamente chamar quem NÃO está estudando).
 */
export function useForcasRecebidas(userId: string | null | undefined) {
    useEffect(() => {
        if (!userId) return;

        return observarForcasRecebidas(userId, ({ nomeRemetente }) => {
            notificarForcaRecebida(nomeRemetente);
        });
    }, [userId]);
}
