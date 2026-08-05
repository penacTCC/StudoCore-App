import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { resolverAgendaDoDia, type BlocoAgenda } from "@/services/agenda";
import { carregarAgendaLocalmente, salvarAgendaLocalmente } from "@/services/armazenamentoOffline";
import { buscarSessoesDoDia } from "@/services/sessions";
import { useMaterias } from "@/hooks/useMaterias";
import { formatarDuracao, paraDataISO } from "@/utils/tempo";
import { encontrarConflitos, somarMinutosSemSobreposicao } from "@/utils/conflitos";
import type { BlocoDoDia, StatusBloco } from "@/types/cronograma";
import type { SessaoFocoRow } from "@/types/sessions";

/** O que fica guardado no aparelho por dia — a agenda resolvida e as sessões dele. */
type AgendaEmCache = { agenda: BlocoAgenda[]; sessoes: SessaoFocoRow[] };

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
 * Resolve a agenda de um dia (dia específico > plano fixado > rotina, via
 * `resolverAgendaDoDia`) e calcula o status de cada bloco comparando com a
 * hora atual e com as sessões de foco já registradas naquele dia contra aquele
 * bloco específico (bloco_rotina_id/bloco_plano_id).
 *
 * `dataISO` é opcional: sem ela, é hoje. Com ela, dá pra folhear a agenda de
 * qualquer dia — num dia passado tudo já venceu, num dia futuro nada começou.
 */
export function useAgendaHoje(userId: string | null | undefined, dataISO?: string) {
    const { materiasComCores } = useMaterias(userId ?? null);
    const [blocos, setBlocos] = useState<BlocoDoDia[]>([]);
    const [resumo, setResumo] = useState<ResumoHoje>({ planejado: "0m", concluido: "0m", proximo: null });
    const [carregando, setCarregando] = useState(true);

    /** Transforma agenda + sessões nos blocos e no resumo que a tela mostra. */
    const montar = useCallback(
        (agenda: BlocoAgenda[], sessoesDoDia: SessaoFocoRow[], diaAlvo: string, hojeISO: string) => {
        const materiaPorId = new Map(materiasComCores.map((m) => [m.id, m]));
        /*
          O relógio só corre no dia de hoje. Num dia que já passou, todo bloco é
          julgado como vencido (cumprido/parcial/furado conforme o que foi
          estudado); num dia que ainda vem, todo bloco é futuro.
        */
        const nowMin =
            diaAlvo === hojeISO
                ? agoraEmMinutos()
                : diaAlvo < hojeISO
                    ? Number.POSITIVE_INFINITY
                    : Number.NEGATIVE_INFINITY;

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
                ? sessoesDoDia.reduce((soma, s) => {
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
                planoId: bloco.planoId,
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
        },
        [materiasComCores]
    );

    const carregar = useCallback(async () => {
        if (!userId) {
            setBlocos([]);
            setCarregando(false);
            return;
        }
        setCarregando(true);

        const hojeISO = paraDataISO(new Date());
        const diaAlvo = dataISO ?? hojeISO;

        /*
          Sem rede, a tela ficava em branco. O cache local do último carregamento
          desse mesmo dia entra primeiro, só pra ter o que mostrar; a resposta da
          rede chega depois e sobrescreve. O cálculo é o mesmo nos dois caminhos.
        */
        const cache = await carregarAgendaLocalmente<AgendaEmCache>(userId, diaAlvo);
        if (cache) {
            montar(cache.agenda, cache.sessoes, diaAlvo, hojeISO);
            setCarregando(false);
        }

        const [agenda, { data: sessoesHoje }] = await Promise.all([
            resolverAgendaDoDia(userId, diaAlvo),
            buscarSessoesDoDia(userId, diaAlvo),
        ]);

        salvarAgendaLocalmente<AgendaEmCache>(userId, diaAlvo, {
            agenda,
            sessoes: sessoesHoje ?? [],
        });

        montar(agenda, sessoesHoje ?? [], diaAlvo, hojeISO);
        setCarregando(false);
    }, [userId, montar, dataISO]);


    useFocusEffect(
        useCallback(() => {
            carregar();
        }, [carregar])
    );

    return { blocos, resumo, carregando, recarregar: carregar };
}
