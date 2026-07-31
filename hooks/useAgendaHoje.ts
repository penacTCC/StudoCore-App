import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { resolverAgendaDoDia } from "@/services/agenda";
import { buscarSessoesDoDia } from "@/services/sessions";
import { useMaterias } from "@/hooks/useMaterias";
import { formatarDuracao, paraDataISO } from "@/utils/tempo";
import { encontrarConflitos, somarMinutosSemSobreposicao } from "@/utils/conflitos";
import type { BlocoDoDia, StatusBloco } from "@/types/cronograma";

/** Bloco de estudo com pelo menos 90% do tempo registrado conta como "cumprido". */
const LIMIAR_CUMPRIDO = 0.9;

function agoraEmMinutos() {
    const agora = new Date();
    return agora.getHours() * 60 + agora.getMinutes();
}

function paraMinutos(horaInicio: string) {
    const [h, m] = horaInicio.split(":").map(Number);
    return h * 60 + m;
}

function formatarHoraCurta(horaInicio: string) {
    const [h, m] = horaInicio.split(":").map(Number);
    return m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, "0")}`;
}

export type ResumoHoje = {
    planejado: string;
    concluido: string;
    proximo: { materia: string; hora: string } | null;
};

/**
 * Resolve a agenda de hoje (dia específico > plano fixado > rotina, via
 * `resolverAgendaDoDia`) e calcula o status de cada bloco comparando com a
 * hora atual e com as sessões de foco já registradas hoje contra aquele
 * bloco específico (bloco_rotina_id/bloco_plano_id).
 */
export function useAgendaHoje(userId: string | null | undefined) {
    const { materiasComCores } = useMaterias(userId ?? null);
    const [blocos, setBlocos] = useState<BlocoDoDia[]>([]);
    const [resumo, setResumo] = useState<ResumoHoje>({ planejado: "0m", concluido: "0m", proximo: null });
    const [carregando, setCarregando] = useState(true);

    const carregar = useCallback(async () => {
        if (!userId) {
            setBlocos([]);
            setCarregando(false);
            return;
        }
        setCarregando(true);

        const hojeISO = paraDataISO(new Date());
        const [agenda, { data: sessoesHoje }] = await Promise.all([
            resolverAgendaDoDia(userId, hojeISO),
            buscarSessoesDoDia(userId, hojeISO),
        ]);

        const materiaPorId = new Map(materiasComCores.map((m) => [m.id, m]));
        const nowMin = agoraEmMinutos();

        // Conflitos só fazem sentido dentro da mesma fonte do dia (rotina OU
        // um único plano — resolverAgendaDoDia já garante que só uma vale).
        const conflitos = encontrarConflitos(
            agenda.map((b) => ({ id: b.id, horaInicio: b.horaInicio, duracaoMin: b.duracaoMin }))
        );
        const agendaPorId = new Map(agenda.map((b) => [b.id, b]));
        const rotuloConflito = (outroId: string) => {
            const outro = agendaPorId.get(outroId);
            if (!outro) return "outro bloco";
            if (outro.tipo === "descanso") return "Descanso";
            return outro.materiaId ? materiaPorId.get(outro.materiaId)?.nomeExibicao ?? "outro bloco" : "outro bloco";
        };

        let concluidoMin = 0;
        let proximo: ResumoHoje["proximo"] = null;
        const itensEstudo: { inicioMin: number; duracaoMin: number }[] = [];

        const resolvidos: BlocoDoDia[] = agenda.map((bloco) => {
            const materia = bloco.materiaId ? materiaPorId.get(bloco.materiaId) : undefined;
            const inicioMin = paraMinutos(bloco.horaInicio);
            const fimMin = inicioMin + bloco.duracaoMin;
            const ehEstudo = bloco.tipo === "estudo";

            if (ehEstudo) itensEstudo.push({ inicioMin, duracaoMin: bloco.duracaoMin });

            const conflito = conflitos.get(bloco.id)?.[0];

            // Minutos de fato estudados nesse bloco — sempre a partir das sessões de
            // foco registradas contra ele, nunca do relógio. Vale tanto pro bloco em
            // andamento (barrinha "agora") quanto pro que já passou (selo cumprido/
            // parcial/furado): só conta o que o usuário efetivamente estudou.
            const minutosFeitos = ehEstudo
                ? (sessoesHoje ?? []).reduce((soma, s) => {
                    const pertence =
                        (bloco.origem === "rotina" && s.bloco_rotina_id === bloco.id) ||
                        (bloco.origem === "plano" && s.bloco_plano_id === bloco.id);
                    return pertence ? soma + s.tempo_minutos : soma;
                }, 0)
                : 0;

            let status: StatusBloco;
            let progresso: number | undefined;
            let restanteMin: number | undefined;

            if (!ehEstudo) {
                status = nowMin >= fimMin ? "cumprido" : nowMin >= inicioMin ? "agora" : "futuro";
            } else if (nowMin < inicioMin) {
                status = "futuro";
            } else if (nowMin < fimMin) {
                status = "agora";
                progresso = Math.min(100, Math.max(0, Math.round((minutosFeitos / bloco.duracaoMin) * 100)));
                restanteMin = Math.max(0, fimMin - nowMin);
            } else {
                const proporcao = minutosFeitos / bloco.duracaoMin;
                status = proporcao >= LIMIAR_CUMPRIDO ? "cumprido" : proporcao > 0 ? "parcial" : "furado";
            }

            if (ehEstudo) concluidoMin += Math.min(minutosFeitos, bloco.duracaoMin);
            if (ehEstudo && status === "futuro" && !proximo) {
                proximo = { materia: materia?.nomeExibicao ?? "—", hora: formatarHoraCurta(bloco.horaInicio) };
            }

            return {
                id: bloco.id,
                horaInicio: bloco.horaInicio,
                duracaoMin: bloco.duracaoMin,
                tipo: bloco.tipo,
                materia: materia?.nomeExibicao,
                topico: bloco.topico ?? undefined,
                cor: materia?.cor,
                notificar: bloco.notificar,
                origem: bloco.origem,
                status,
                progresso,
                restanteMin,
                sobrepoeMin: conflito?.minutos,
                conflitaCom: conflito ? rotuloConflito(conflito.comId) : undefined,
            };
        });

        setBlocos(resolvidos);
        setResumo({
            planejado: formatarDuracao(somarMinutosSemSobreposicao(itensEstudo)),
            concluido: formatarDuracao(concluidoMin),
            proximo,
        });
        setCarregando(false);
    }, [userId, materiasComCores]);

    useFocusEffect(
        useCallback(() => {
            carregar();
        }, [carregar])
    );

    return { blocos, resumo, carregando, recarregar: carregar };
}
