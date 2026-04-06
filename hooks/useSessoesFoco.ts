import { useState, useEffect, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { buscarSessoesPorUsuario, buscarSessoesRecentes, SessaoFocoRow } from "@/services/sessions";

/**
 * Hook que busca sessões de foco públicas para o Feed.
 */
export const useSessoesFoco = (limit: number = 20) => {
    const [sessions, setSessions] = useState<SessaoFocoRow[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchSessions = useCallback(async () => {
        setLoading(true);
        const { data, error } = await buscarSessoesRecentes(limit);
        if (error) {
            console.error("Erro ao buscar sessões de foco:", error);
        } else {
            setSessions((data as SessaoFocoRow[]) || []);
        }
        setLoading(false);
    }, [limit]);

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

