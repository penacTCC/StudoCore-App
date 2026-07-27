import { buscarSessoesPorGrupo } from "@/services/sessions";
import { SessaoFocoRow } from "@/types/sessions";
import { useCallback, useEffect, useState } from "react";

export const useSessoesGrupo = (groupId?: string | null) => {
    const [sessions, setSessions] = useState<SessaoFocoRow[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchSessions = useCallback(async () => {
        if(!groupId) {
            setSessions([]);
            setLoading(false);
            return
        }
        setLoading(true);
        const { data, error } = await buscarSessoesPorGrupo(groupId);
        if (error) {
            console.error("Erro ao buscar sessões de foco:", error);
        } else {
            setSessions((data as SessaoFocoRow[]) || []);
        }
        setLoading(false);
    }, [groupId]);

    useEffect(() => {
        fetchSessions();
    }, [fetchSessions]);

    return { sessions, loading };
};