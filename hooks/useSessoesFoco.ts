import { useState, useEffect, useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";
import {
    buscarSessoesAoVivo,
    buscarSessoesPorUsuario,
    buscarSessoesRecentes,
    observarSessoesDoGrupo,
} from "@/services/sessions";
import { toast } from "@/services/toast";
import { SessaoFocoRow } from "@/types/sessions";

/**
 * Assina o realtime de `sessoes_foco` do grupo e chama `recarregar` a cada mudança,
 * agrupando eventos próximos numa única busca.
 *
 * O agrupamento importa porque uma só ação do usuário dispara vários UPDATEs em sequência
 * (encerrar grava tempo, `concluido_em` e status; um encadeamento de plano ainda insere a
 * linha da matéria seguinte) — sem ele, cada tela do grupo refaria a query do feed 3 ou 4
 * vezes por evento.
 */
const useRealtimeSessoesGrupo = (groupId: string | null | undefined, recarregar: () => void) => {
    // Mantém o callback atual sem re-assinar o canal a cada render.
    const recarregarRef = useRef(recarregar);
    recarregarRef.current = recarregar;

    useEffect(() => {
        if (!groupId) return;

        let agendado: ReturnType<typeof setTimeout> | null = null;

        const cancelarCanal = observarSessoesDoGrupo(groupId, () => {
            if (agendado) clearTimeout(agendado);
            agendado = setTimeout(() => {
                agendado = null;
                recarregarRef.current();
            }, 400);
        });

        return () => {
            if (agendado) clearTimeout(agendado);
            cancelarCanal();
        };
    }, [groupId]);
};

/**
 * Hook que busca sessões de foco públicas para o Feed.
 */
export const useSessoesFoco = (limit: number = 20, groupId?: string | null) => {
    const [sessions, setSessions] = useState<SessaoFocoRow[]>([]);
    const [loading, setLoading] = useState(true);

    // `silencioso` evita o skeleton nas rebuscas do realtime: o feed já está na tela e
    // piscar o placeholder a cada pausa de um colega é pior do que trocar o card direto.
    const fetchSessions = useCallback(async (silencioso = false) => {
        if (!silencioso) setLoading(true);
        const { data, error } = await buscarSessoesRecentes(limit, groupId);
        if (error) {
            console.error("Erro ao buscar sessões de foco:", error);
            if (!silencioso) toast.error("Não foi possível carregar as sessões de foco.");
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
            fetchSessions(true);
        }, [fetchSessions])
    );

    // Uma sessão que acabou de ser encerrada por um colega já entra aqui como destaque.
    useRealtimeSessoesGrupo(groupId, useCallback(() => fetchSessions(true), [fetchSessions]));

    return { sessions, loading, refresh: fetchSessions };
};

/**
 * Hook que busca as sessões que estão acontecendo agora, para o feed "ao vivo".
 *
 * Aqui o realtime é o ponto: o `useFocusEffect` sozinho só atualizava quando a tela voltava
 * ao foco, e quem já estava na home nunca via a sessão pública do colega surgir — o feed
 * "ao vivo" mostrava um estado de minutos atrás. Com `useRealtimeSessoesGrupo`, começar,
 * pausar, retomar e encerrar aparecem no mesmo instante para todo o grupo.
 */
export const useSessoesAoVivo = (limit: number = 20, groupId?: string | null) => {
    const [sessoes, setSessoes] = useState<SessaoFocoRow[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchSessoes = useCallback(async (silencioso = false) => {
        if (!silencioso) setLoading(true);
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
            fetchSessoes(true);
        }, [fetchSessoes])
    );

    useRealtimeSessoesGrupo(groupId, useCallback(() => fetchSessoes(true), [fetchSessoes]));

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
            toast.error("Não foi possível carregar suas sessões.");
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

