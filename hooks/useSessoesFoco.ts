import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useFocusEffect } from "expo-router";
import {
    buscarSessoesAoVivo,
    buscarSessoesPorUsuario,
    buscarSessoesRecentes,
    observarSessoesDoGrupo,
} from "@/services/sessions";
import { toast } from "@/services/toast";
import { definirFormulariosPendentes } from "@/services/formulariosPendentes";
import { SessaoFocoRow } from "@/types/sessions";
import { useDadosCache } from "@/hooks/useDadosCache";

const SEM_SESSOES: SessaoFocoRow[] = [];

// O feed é dado vivo, e o realtime já empurra as mudanças do grupo. A janela curta só
// cobre a volta à tela depois de um tempo fora dela.
const FEED_FRESCO = 15_000;

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
    // O cache já mantém o feed anterior na tela durante a rebusca, então o skeleton não
    // pisca mais a cada pausa de um colega nem a cada volta para a home — antes isso
    // dependia de passar `silencioso` na mão em cada chamada.
    const { dados, carregando, recarregar } = useDadosCache<SessaoFocoRow[]>(
        `sessoes-recentes:${groupId ?? "todas"}:${limit}`,
        async () => {
            const { data, error } = await buscarSessoesRecentes(limit, groupId);
            if (error) {
                console.error("Erro ao buscar sessões de foco:", error);
                toast.error("Não foi possível carregar as sessões de foco.");
                throw error;
            }
            return (data as SessaoFocoRow[]) || [];
        },
        { tempoFresco: FEED_FRESCO }
    );

    // Uma sessão que acabou de ser encerrada por um colega já entra aqui como destaque.
    useRealtimeSessoesGrupo(groupId, recarregar);

    return { sessions: dados ?? SEM_SESSOES, loading: carregando, refresh: recarregar };
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
    const { dados, carregando, recarregar } = useDadosCache<SessaoFocoRow[]>(
        `sessoes-ao-vivo:${groupId ?? "todas"}:${limit}`,
        async () => {
            const { data, error } = await buscarSessoesAoVivo(limit, groupId);
            if (error) {
                console.error("Erro ao buscar sessões ao vivo:", error);
                throw error;
            }
            return (data as SessaoFocoRow[]) || [];
        },
        { tempoFresco: FEED_FRESCO }
    );

    useRealtimeSessoesGrupo(groupId, recarregar);

    return { sessoes: dados ?? SEM_SESSOES, loading: carregando, refresh: recarregar };
};

/**
 * Hook que busca as sessões exclusivas do Usuário para o Brain Hub e divide em Salvas e Pendentes.
 *
 * `sincronizarBadge` só pode ser ligado quando `userId` é o da conta logada: é ele que
 * alimenta o badge de formulários pendentes da tab bar. O perfil de um colega usa o mesmo
 * hook e não pode escrever a contagem dele no badge de quem está usando o app.
 */
export const useSessoesUsuario = (userId: string | null | undefined, sincronizarBadge = false) => {
    const { dados, carregando, recarregar } = useDadosCache<SessaoFocoRow[]>(
        userId ? `sessoes-usuario:${userId}` : null,
        async () => {
            const { data, error } = await buscarSessoesPorUsuario(userId!, 100);
            if (error) {
                console.error("Erro ao buscar sessões do usuário:", error);
                toast.error("Não foi possível carregar suas sessões.");
                throw error;
            }
            return (data as SessaoFocoRow[]) || [];
        },
        // Uma sessão recém-encerrada tem que aparecer assim que a tela volta ao foco.
        { tempoFresco: 0 }
    );

    const linhas = dados ?? SEM_SESSOES;

    const savedSessions = useMemo(() => linhas.filter(s => s.status === 'salvo'), [linhas]);
    const pendingSessions = useMemo(() => linhas.filter(s => s.status === 'pendente'), [linhas]);

    // Mantém o badge da tab bar em dia sem uma busca extra: quem abriu o Foco ou o
    // Análise já pagou por esta query.
    useEffect(() => {
        if (sincronizarBadge && dados) definirFormulariosPendentes(pendingSessions.length);
    }, [sincronizarBadge, dados, pendingSessions.length]);

    return { savedSessions, pendingSessions, loading: carregando, refresh: recarregar };
};

