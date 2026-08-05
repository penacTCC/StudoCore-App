import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { buscarPreferencias, salvarPreferencias, PADRAO_PREFERENCIAS } from "@/services/preferencias";
import { ressincronizarTodosLembretes } from "@/services/lembretes";
import { toast } from "@/services/toast";
import type { PreferenciasCronograma } from "@/types/cronograma";

const ATRASO_AUTOSAVE_MS = 600;

/** Preferências que mudam a fila de lembretes já agendada, não só a próxima edição. */
const CHAVES_DE_LEMBRETE = [
    "notificacoesAtivas",
    "antecedenciaMin",
    "naoPerturbar",
    "naoPerturbarInicio",
    "naoPerturbarFim",
] as const satisfies readonly (keyof PreferenciasCronograma)[];

function mudouAlgoDeLembrete(antes: PreferenciasCronograma, depois: PreferenciasCronograma) {
    return CHAVES_DE_LEMBRETE.some((chave) => antes[chave] !== depois[chave]);
}

/**
 * Hook para ler/gravar as preferências de cronograma. Cada mudança via `setPrefs`
 * atualiza a tela na hora e agenda um autosave (debounced) pra não bater no banco
 * a cada toque nos steppers.
 */
export const usePreferencias = (userId: string | null | undefined) => {
    const [prefs, setPrefs] = useState<PreferenciasCronograma>(PADRAO_PREFERENCIAS);
    const [carregando, setCarregando] = useState(true);
    const carregado = useRef(false);

    // Última versão gravada, pra saber o que mudou na hora de salvar.
    const salvo = useRef<PreferenciasCronograma>(PADRAO_PREFERENCIAS);

    const carregar = useCallback(() => {
        carregado.current = false;
        if (!userId) {
            setCarregando(false);
            return;
        }
        setCarregando(true);
        buscarPreferencias(userId).then((resultado) => {
            setPrefs(resultado);
            salvo.current = resultado;
            setCarregando(false);
            carregado.current = true;
        });
    }, [userId]);

    /*
      Relê ao ganhar foco, não só ao montar.
      As telas em abas ficam montadas o tempo todo: quem mudasse uma preferência
      no modal de configurações e voltasse continuava vendo o valor antigo até
      reiniciar o app — a preferência parecia não fazer nada.
    */
    useFocusEffect(carregar);

    useEffect(() => {
        if (!userId || !carregado.current) return;
        const timeout = setTimeout(() => {
            const anterior = salvo.current;
            salvarPreferencias(userId, prefs).then(({ sucesso, erro }) => {
                if (!sucesso) {
                    toast.error(erro || "Não foi possível salvar suas preferências.");
                    return;
                }
                salvo.current = prefs;

                // Mexeu em algo que vale pra fila inteira: reagenda tudo agora,
                // em vez de esperar o próximo bloco ser editado.
                if (mudouAlgoDeLembrete(anterior, prefs)) {
                    ressincronizarTodosLembretes(userId).catch((erroSync) =>
                        console.error("Erro ao reagendar lembretes:", erroSync)
                    );
                }
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
