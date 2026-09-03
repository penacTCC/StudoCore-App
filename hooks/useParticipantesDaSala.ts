import { useCallback, useEffect, useState } from "react";
import {
    buscarParticipantesDaSala,
    buscarPerfilResumidoParaSala,
    observarParticipantesDaSala,
    type EventoParticipanteDaSala,
} from "@/services/salas";
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
    /*
      `true` sem sala (nada de realtime para esperar) e enquanto o canal ainda não confirmou
      a inscrição (status "SUBSCRIBED"). Ver o comentário em `observarParticipantesDaSala`
      (services/salas.ts) sobre por que isso importa: numa sala com muita gente entrando ao
      mesmo tempo, pausar/retomar antes da inscrição se firmar faz a entrega do evento para
      os outros cair bastante.
    */
    const [pronto, setPronto] = useState(!salaId);

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

    /*
      Funde a linha do evento na lista local em vez de refazer o fetch da sala inteira.
      Antes, qualquer pausa/retomada de 1 pessoa disparava um refetch com JOIN em `profiles`
      em CADA cliente da sala — numa sala de N pessoas isso é N consultas cheias por mudança
      de 1. O payload do realtime não traz o JOIN, então só busca perfil quando é gente
      realmente nova entrando (uma consulta de 1 linha, não da sala inteira).
    */
    const aplicarEvento = useCallback(
        async (evento: EventoParticipanteDaSala) => {
            const membroId = evento.linha.membro_id;
            if (!membroId) return;

            if (evento.tipo === "DELETE") {
                setParticipantes((atuais) => atuais.filter((p) => p.membro_id !== membroId));
                return;
            }

            let jaTinhaPerfil = false;
            setParticipantes((atuais) => {
                const existente = atuais.find((p) => p.membro_id === membroId);
                if (!existente) return atuais;
                jaTinhaPerfil = true;
                return atuais.map((p) => (p.membro_id === membroId ? { ...p, ...evento.linha } : p));
            });

            if (jaTinhaPerfil) return;

            const perfil = await buscarPerfilResumidoParaSala(membroId);
            setParticipantes((atuais) => {
                if (atuais.some((p) => p.membro_id === membroId)) return atuais;
                return [...atuais, { ...(evento.linha as ParticipanteDaSala), profiles: perfil ?? undefined }];
            });
        },
        []
    );

    useEffect(() => {
        setPronto(!salaId);
        if (!salaId) return;

        return observarParticipantesDaSala(salaId, aplicarEvento, (status) => {
            if (status === "SUBSCRIBED") setPronto(true);
        });
    }, [salaId, aplicarEvento]);

    /*
      Rede de segurança para o realtime.

      O cronômetro de cada colega é repintado a cada segundo a partir de `ultimo_inicio` (ver
      utils/tempo.ts -> tempoAoVivoDoMembro). Se o evento de pausa não chegar — canal caído,
      app voltando do background, tabela fora da publicação `supabase_realtime` —, a cópia
      local continua dizendo "ativo" e o tempo segue correndo. Com o merge incremental já
      cobrindo o caminho normal, a rebusca só precisa existir para esse cenário de exceção —
      por isso o intervalo é mais espaçado do que antes.
    */
    useEffect(() => {
        if (!salaId) return;

        const id = setInterval(recarregar, 30000);
        return () => clearInterval(id);
    }, [salaId, recarregar]);

    return { participantes, carregando, pronto, recarregar };
};
