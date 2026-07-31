import { buscarPlanos } from "@/services/planos";
import type { Plano } from "@/types/cronograma";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

/**
 * Hook para buscar os planos do usuário, recarregando toda vez que a tela
 * volta a ficar em foco (ex.: usuário volta do plano-editor após salvar).
 */
export const usePlanos = (userId: string | null | undefined) => {
    const [planos, setPlanos] = useState<Plano[]>([]);
    const [carregando, setCarregando] = useState(false);

    const buscar = useCallback(async () => {
        if (!userId) return;
        setCarregando(true);
        const resultado = await buscarPlanos(userId);
        setPlanos(resultado);
        setCarregando(false);
    }, [userId]);

    useFocusEffect(
        useCallback(() => {
            buscar();
        }, [buscar])
    );

    return { planos, carregando, recarregarPlanos: buscar };
};
