import { useCallback, useEffect, useState } from "react";
import { buscarParticipantesDaSala, observarParticipantesDaSala } from "@/services/salas";
import type { ParticipanteDaSala } from "@/types/sala";

/**
 * Mantém a lista de participantes de uma sala de foco sincronizada em tempo real.
 *
 * Sucessor de `useSessionMembers`, que era chaveado pela sessão do anfitrião — e por isso
 * perdia a lista quando ele encerrava o estudo dele. Agora a chave é a sala, que sobrevive
 * à saída de qualquer participante.
 *
 * As três telas que precisam disso (foco ativo, colegas focando, prévia da sessão)
 * compartilham este hook em vez de duplicar fetch + assinatura de realtime.
 */
export const useParticipantesDaSala = (salaId?: string | null) => {
    const [participantes, setParticipantes] = useState<ParticipanteDaSala[]>([]);
    const [carregando, setCarregando] = useState(true);

    const recarregar = useCallback(async () => {
        if (!salaId) {
            setParticipantes([]);
            setCarregando(false);
            return;
        }

        const { data, error } = await buscarParticipantesDaSala(salaId);
        if (error) {
            console.error("Erro ao carregar participantes da sala:", error);
        } else {
            setParticipantes(data);
        }
        setCarregando(false);
    }, [salaId]);

    useEffect(() => {
        setCarregando(true);
        recarregar();
    }, [recarregar]);

    useEffect(() => {
        if (!salaId) return;

        // O payload do realtime não traz o JOIN com profiles, então recarrega a lista
        // inteira para ter nome/foto de quem entrou ou mudou de status.
        return observarParticipantesDaSala(salaId, recarregar);
    }, [salaId, recarregar]);

    /*
      Rede de segurança para o realtime.

      O cronômetro de cada colega é repintado a cada segundo a partir de `ultimo_inicio` (ver
      utils/tempo.ts -> tempoAoVivoDoMembro). Se o evento de pausa não chegar — canal caído,
      app voltando do background, tabela fora da publicação `supabase_realtime` —, a cópia
      local continua dizendo "ativo" e o tempo segue correndo. A rebusca periódica limita
      esse erro a alguns segundos mesmo com o realtime fora do ar.
    */
    useEffect(() => {
        if (!salaId) return;

        const id = setInterval(recarregar, 10000);
        return () => clearInterval(id);
    }, [salaId, recarregar]);

    return { participantes, carregando, recarregar };
};
