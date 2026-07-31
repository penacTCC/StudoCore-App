import { useState, useEffect, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { buscarSessoesAoVivo, buscarSessoesPorUsuario, buscarSessoesRecentes } from "@/services/sessions";
import { SessaoFocoRow } from "@/types/sessions";

/**
 * Hook que busca sessões de foco públicas para o Feed.
 */
export const useSessoesFoco = (limit: number = 20, groupId?: string | null) => {
    const [sessions, setSessions] = useState<SessaoFocoRow[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchSessions = useCallback(async () => {
        setLoading(true);
        const { data, error } = await buscarSessoesRecentes(limit, groupId);
        if (error) {
            console.error("Erro ao buscar sessões de foco:", error);
        } else {
            setSessions((data as SessaoFocoRow[]) || []);
        }
        setLoading(false);
    }, [limit, groupId]);

    useEffect(() => {
        fetchSessions();
    }, [fetchSessions]);

    useFocusEffect(
        useCallback(() => {
            fetchSessions();
        }, [fetchSessions])
    );

    return { sessions, loading, refresh: fetchSessions };
};

/**
 * Hook que busca as sessões que estão acontecendo agora, para o feed "ao vivo".
 *
 * Sem realtime de propósito: o `useFocusEffect` já refaz a busca sempre que a tela volta
 * ao foco, que é quando o usuário de fato olha o feed.
 */
export const useSessoesAoVivo = (limit: number = 20, groupId?: string | null) => {
    const [sessoes, setSessoes] = useState<SessaoFocoRow[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchSessoes = useCallback(async () => {
        setLoading(true);
        const { data, error } = await buscarSessoesAoVivo(limit, groupId);
        if (error) {
            console.error("Erro ao buscar sessões ao vivo:", error);
        } else {
            setSessoes((data as SessaoFocoRow[]) || []);
        }
        setLoading(false);
    }, [limit, groupId]);

    useEffect(() => {
        fetchSessoes();
    }, [fetchSessoes]);

    useFocusEffect(
        useCallback(() => {
            fetchSessoes();
        }, [fetchSessoes])
    );

    return { sessoes, loading, refresh: fetchSessoes };
};

/**
 * Hook que busca as sessões exclusivas do Usuário para o Brain Hub e divide em Salvas e Pendentes.
 */
export const useSessoesUsuario = (userId: string | null | undefined) => {
    const [savedSessions, setSavedSessions] = useState<SessaoFocoRow[]>([]);
    const [pendingSessions, setPendingSessions] = useState<SessaoFocoRow[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchUserSessions = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        const { data, error } = await buscarSessoesPorUsuario(userId, 100);
        if (error) {
            console.error("Erro ao buscar sessões do usuário:", error);
        } else {
            const rows = (data as SessaoFocoRow[]) || [];
            setSavedSessions(rows.filter(s => s.status === 'salvo'));
            setPendingSessions(rows.filter(s => s.status === 'pendente'));
        }
        setLoading(false);
    }, [userId]);

    useFocusEffect(
        useCallback(() => {
            fetchUserSessions();
        }, [fetchUserSessions])
    );

    return { savedSessions, pendingSessions, loading, refresh: fetchUserSessions };
};

