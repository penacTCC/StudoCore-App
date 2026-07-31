import { useCallback, useEffect, useRef, useState } from "react";
import { buscarPreferencias, salvarPreferencias, PADRAO_PREFERENCIAS } from "@/services/preferencias";
import { toast } from "@/services/toast";
import type { PreferenciasCronograma } from "@/types/cronograma";

const ATRASO_AUTOSAVE_MS = 600;

/**
 * Hook para ler/gravar as preferências de cronograma. Cada mudança via `setPrefs`
 * atualiza a tela na hora e agenda um autosave (debounced) pra não bater no banco
 * a cada toque nos steppers.
 */
export const usePreferencias = (userId: string | null | undefined) => {
    const [prefs, setPrefs] = useState<PreferenciasCronograma>(PADRAO_PREFERENCIAS);
    const [carregando, setCarregando] = useState(true);
    const carregado = useRef(false);

    useEffect(() => {
        carregado.current = false;
        if (!userId) {
            setCarregando(false);
            return;
        }
        setCarregando(true);
        buscarPreferencias(userId).then((resultado) => {
            setPrefs(resultado);
            setCarregando(false);
            carregado.current = true;
        });
    }, [userId]);

    useEffect(() => {
        if (!userId || !carregado.current) return;
        const timeout = setTimeout(() => {
            salvarPreferencias(userId, prefs).then(({ sucesso, erro }) => {
                if (!sucesso) toast.error(erro || "Não foi possível salvar suas preferências.");
            });
        }, ATRASO_AUTOSAVE_MS);
        return () => clearTimeout(timeout);
    }, [prefs, userId]);

    const ajustar = useCallback(
        <C extends keyof PreferenciasCronograma>(chave: C, valor: PreferenciasCronograma[C]) =>
            setPrefs((atual) => ({ ...atual, [chave]: valor })),
        []
    );

    const alternar = useCallback(
        (chave: keyof PreferenciasCronograma) =>
            setPrefs((atual) => ({ ...atual, [chave]: !atual[chave] })),
        []
    );

    return { prefs, ajustar, alternar, carregando };
};
