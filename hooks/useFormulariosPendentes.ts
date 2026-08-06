import { useEffect, useState } from "react";
import {
    assinarFormulariosPendentes,
    carregarFormulariosPendentes,
    definirFormulariosPendentes,
    obterFormulariosPendentes,
} from "@/services/formulariosPendentes";

/**
 * Quantos formulários de sessão o usuário tem em aberto — alimenta o badge da tab bar.
 *
 * Faz uma busca só na entrada (ou quando troca de conta); daí em diante o número vem das
 * telas que já leem as sessões do usuário (ver services/formulariosPendentes.ts).
 */
export function useFormulariosPendentes(userId: string | null | undefined) {
    const [contagem, setContagem] = useState(obterFormulariosPendentes);

    useEffect(() => assinarFormulariosPendentes(setContagem), []);

    useEffect(() => {
        if (!userId) {
            // Trocar de conta (ou sair) não pode deixar o badge da conta anterior na tela.
            definirFormulariosPendentes(0);
            return;
        }
        carregarFormulariosPendentes(userId);
    }, [userId]);

    return contagem;
}
