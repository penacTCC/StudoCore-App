import { useCallback, useEffect, useMemo, useState } from "react";
import { HADES } from "@/constants/hades";
import { GRADE_INICIO_HORA, minParaPx } from "@/constants/cronograma";
import { useMaterias } from "@/hooks/useMaterias";
import { resolverAgendaDaSemana, type DiaResolvido } from "@/services/agenda";
import { excluirBlocoRotina, moverBlocoRotina } from "@/services/schedule";
import { buscarSessoesPeriodo } from "@/services/sessions";
import { normalizarNomeMateria } from "@/services/materias";
import { toast } from "@/services/toast";
import {
    formatarDuracao,
    pegarDatasDaSemana,
    pegarDiasDaSemana,
    paraDataISO,
} from "@/utils/tempo";
import { encontrarConflitos, somarMinutosSemSobreposicao } from "@/utils/conflitos";
import type { BlocoListaDia, BlocoSemana } from "@/types/cronograma";
import type { SessaoFocoRow } from "@/types/sessions";

const DURACAO_GRADE_PADRAO_MIN = 720; // 12h, usado quando não há blocos ainda
const PASSO_EIXO_MIN = 180; // marcação a cada 3h

function paraMinutos(horaInicio: string) {
    const [h, m] = horaInicio.split(":").map(Number);
    return h * 60 + m;
}

/**
 * Toda a leitura e o cálculo da aba Semana num lugar só.
 *
 * A semana vem de `resolverAgendaDaSemana`, com a mesma prioridade que a aba
 * Hoje usa (plano da data > plano fixado > rotina) — antes daqui a grade lia
 * `rotina_semanal_blocos` direto e por isso ignorava planos, mostrando uma
 * semana diferente da que o usuário via em Hoje.
 */
export function useSemanaCronograma(userId: string | null | undefined, inicioDaSemana: Date) {
    const { materiasComCores } = useMaterias(userId ?? null);
    const [dias, setDias] = useState<DiaResolvido[]>([]);
    const [sessoes, setSessoes] = useState<SessaoFocoRow[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [atualizando, setAtualizando] = useState(false);

    const chaveSemana = paraDataISO(inicioDaSemana);
    const datasDaSemana = useMemo(() => pegarDatasDaSemana(inicioDaSemana), [chaveSemana]);

    const carregar = useCallback(async () => {
        if (!userId) {
            setCarregando(false);
            return;
        }
        setCarregando(true);
        const [agenda, { data: sessoesDaSemana }] = await Promise.all([
            resolverAgendaDaSemana(userId, datasDaSemana),
            buscarSessoesPeriodo(userId, datasDaSemana[0], datasDaSemana[6]),
        ]);
        setDias(agenda);
        setSessoes(sessoesDaSemana ?? []);
        setCarregando(false);
    }, [userId, datasDaSemana]);

    useEffect(() => {
        carregar();
    }, [carregar]);

    const recarregar = useCallback(async () => {
        setAtualizando(true);
        try {
            await carregar();
        } finally {
            setAtualizando(false);
        }
    }, [carregar]);

    const materiaPorId = useMemo(
        () => new Map(materiasComCores.map((m) => [m.id, m])),
        [materiasComCores]
    );

    // Janela de horas exibida na grade: começa na hora cheia do bloco mais cedo
    // e cobre até o fim do bloco mais tarde (com o mínimo de 12h).
    const janela = useMemo(() => {
        const todos = dias.flatMap((d) => d.blocos);
        if (todos.length === 0) {
            return { inicioMin: GRADE_INICIO_HORA * 60, duracaoMin: DURACAO_GRADE_PADRAO_MIN };
        }

        const inicios = todos.map((b) => paraMinutos(b.horaInicio));
        const fins = todos.map((b, i) => inicios[i] + b.duracaoMin);

        const inicioMin = Math.floor(Math.min(...inicios) / 60) * 60;
        const fimMin = Math.ceil(Math.max(...fins) / 60) * 60;

        return { inicioMin, duracaoMin: Math.max(fimMin - inicioMin, DURACAO_GRADE_PADRAO_MIN) };
    }, [dias]);

    const horasEixo = useMemo(() => {
        const marcacoes = [];
        for (let min = 0; min <= janela.duracaoMin; min += PASSO_EIXO_MIN) {
            const horaAbs = Math.floor((janela.inicioMin + min) / 60) % 24;
            marcacoes.push({ rotulo: `${horaAbs}h`, topo: minParaPx(min) });
        }
        return marcacoes;
    }, [janela]);

    const blocosSemana = useMemo<BlocoSemana[]>(
        () =>
            dias.flatMap((dia, coluna) =>
                dia.blocos.map((bloco) => {
                    const materia = bloco.materiaId ? materiaPorId.get(bloco.materiaId) : undefined;
                    const descanso = bloco.tipo === "descanso";

                    return {
                        id: `${dia.dataISO}:${bloco.id}`,
                        dia: coluna,
                        inicioMin: paraMinutos(bloco.horaInicio) - janela.inicioMin,
                        duracaoMin: bloco.duracaoMin,
                        rotulo: descanso ? "Zzz" : materia?.nomeExibicao.slice(0, 3) ?? "—",
                        cor: descanso ? HADES.green : materia?.cor ?? HADES.textFaint,
                        tipo: bloco.tipo,
                        origem: bloco.origem,
                    };
                })
            ),
        [dias, materiaPorId, janela]
    );

    const blocosLista = useMemo<BlocoListaDia[]>(
        () =>
            dias.flatMap((dia, coluna) =>
                dia.blocos.map((bloco) => {
                    const materia = bloco.materiaId ? materiaPorId.get(bloco.materiaId) : undefined;
                    const descanso = bloco.tipo === "descanso";

                    return {
                        // O mesmo bloco de plano fixado aparece em vários dias, então o id
                        // da lista precisa do dia junto pra continuar único entre as colunas.
                        id: `${dia.dataISO}:${bloco.id}`,
                        dia: coluna,
                        materia: descanso ? "Descanso" : materia?.nomeExibicao ?? "—",
                        topico: bloco.topico ?? "",
                        horaInicio: bloco.horaInicio,
                        duracaoRotulo: formatarDuracao(bloco.duracaoMin),
                        cor: descanso ? HADES.green : materia?.cor ?? HADES.textFaint,
                        tipo: bloco.tipo,
                        origem: bloco.origem,
                        nomePlano: bloco.planoNome,
                    };
                })
            ).sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)),
        [dias, materiaPorId]
    );

    // Conflitos calculados dentro de cada dia — a fonte já é única por dia.
    const conflitosPorId = useMemo(() => {
        const mapa = new Map<string, string>();

        for (const dia of dias) {
            const porId = new Map(dia.blocos.map((b) => [b.id, b]));
            const conflitos = encontrarConflitos(
                dia.blocos.map((b) => ({ id: b.id, horaInicio: b.horaInicio, duracaoMin: b.duracaoMin }))
            );
            for (const [id, lista] of conflitos) {
                const outro = porId.get(lista[0].comId);
                if (!outro) continue;
                const rotulo =
                    outro.tipo === "descanso"
                        ? "Descanso"
                        : outro.materiaId
                            ? materiaPorId.get(outro.materiaId)?.nomeExibicao ?? "outro bloco"
                            : "outro bloco";
                mapa.set(`${dia.dataISO}:${id}`, rotulo);
            }
        }
        return mapa;
    }, [dias, materiaPorId]);

    const totalPorMateria = useMemo(() => {
        const minutosPorMateria = new Map<string, number>();
        for (const dia of dias) {
            for (const bloco of dia.blocos) {
                if (!bloco.materiaId) continue;
                minutosPorMateria.set(
                    bloco.materiaId,
                    (minutosPorMateria.get(bloco.materiaId) ?? 0) + bloco.duracaoMin
                );
            }
        }

        return Array.from(minutosPorMateria.entries()).map(([materiaId, minutos]) => {
            const materia = materiaPorId.get(materiaId);
            return {
                materia: materia?.nomeExibicao ?? "—",
                cor: materia?.cor ?? HADES.textFaint,
                total: formatarDuracao(minutos),
            };
        });
    }, [dias, materiaPorId]);

    // Soma por união de intervalos, dia a dia — não conta 2x minuto sobreposto.
    const totalSemanal = useMemo(() => {
        let total = 0;
        for (const dia of dias) {
            total += somarMinutosSemSobreposicao(
                dia.blocos.map((b) => ({ inicioMin: paraMinutos(b.horaInicio), duracaoMin: b.duracaoMin }))
            );
        }
        return formatarDuracao(total);
    }, [dias]);

    /*
      "Realizado" = tempo das sessões que caíram em cima do que estava planejado.

      Casa primeiro pelo id do bloco (é exato, e é o que a sessão grava quando
      nasce de um "Iniciar foco"); só cai no par dia-matéria para sessões avulsas,
      que não têm bloco nenhum gravado. Antes daqui existia só o segundo caminho,
      e ele ignorava tudo que vinha de plano.
    */
    const minutosRealizados = useMemo(() => {
        const idsPlanejados = new Set<string>();
        const paresDiaMateria = new Set<string>();

        for (const dia of dias) {
            for (const bloco of dia.blocos) {
                idsPlanejados.add(bloco.id);
                if (bloco.tipo !== "estudo" || !bloco.materiaId) continue;
                const materia = materiaPorId.get(bloco.materiaId);
                if (materia) {
                    paresDiaMateria.add(`${dia.diaSemana}-${normalizarNomeMateria(materia.nomeExibicao)}`);
                }
            }
        }

        const diaSemanaPorData = new Map(dias.map((d) => [d.dataISO, d.diaSemana]));

        return sessoes.reduce((total, sessao) => {
            const idBloco = sessao.bloco_rotina_id ?? sessao.bloco_plano_id ?? null;

            if (idBloco) {
                return idsPlanejados.has(idBloco) ? total + sessao.tempo_minutos : total;
            }

            const diaSemana = diaSemanaPorData.get(sessao.data_sessao);
            if (diaSemana === undefined) return total;
            const chave = `${diaSemana}-${normalizarNomeMateria(sessao.disciplina)}`;
            return paresDiaMateria.has(chave) ? total + sessao.tempo_minutos : total;
        }, 0);
    }, [sessoes, dias, materiaPorId]);

    /** Remove o bloco da lista local pelo id composto `data:blocoId`. */
    const esquecerBloco = useCallback((idComposto: string) => {
        const blocoId = idComposto.split(":")[1];
        setDias((atual) =>
            atual.map((dia) => ({ ...dia, blocos: dia.blocos.filter((b) => b.id !== blocoId) }))
        );
    }, []);

    const excluirBloco = useCallback(
        async (idComposto: string) => {
            const blocoId = idComposto.split(":")[1];
            const { error } = await excluirBlocoRotina(blocoId);
            if (error) {
                console.error(error);
                toast.error("Não foi possível remover o bloco.");
                return;
            }
            esquecerBloco(idComposto);
        },
        [esquecerBloco]
    );

    // Move (otimista) um bloco de rotina pra outro dia. Se o salvamento falhar,
    // recarrega a semana pra desfazer.
    const moverBloco = useCallback(
        async (idComposto: string, colunaDestino: number) => {
            const blocoId = idComposto.split(":")[1];
            const destino = dias[colunaDestino];
            const origem = dias.find((d) => d.blocos.some((b) => b.id === blocoId));
            if (!destino || !origem || destino.dataISO === origem.dataISO) return;

            const bloco = origem.blocos.find((b) => b.id === blocoId);
            if (!bloco || bloco.origem !== "rotina") return;

            setDias((atual) =>
                atual.map((dia) => {
                    if (dia.dataISO === origem.dataISO) {
                        return { ...dia, blocos: dia.blocos.filter((b) => b.id !== blocoId) };
                    }
                    if (dia.dataISO === destino.dataISO) {
                        return { ...dia, blocos: [...dia.blocos, bloco] };
                    }
                    return dia;
                })
            );

            const { error } = await moverBlocoRotina(blocoId, destino.diaSemana);
            if (error) {
                console.error(error);
                toast.error("Não foi possível mover o bloco.");
                carregar();
            }
        },
        [dias, carregar]
    );

    const hojeISO = paraDataISO(new Date());
    const semanaAtual = datasDaSemana.includes(hojeISO);

    return {
        carregando,
        atualizando,
        vazia: dias.every((d) => d.blocos.length === 0),
        blocosSemana,
        blocosLista,
        conflitosPorId,
        horasEixo,
        alturaGrade: minParaPx(janela.duracaoMin),
        totalPorMateria,
        totalSemanal,
        realizado: formatarDuracao(minutosRealizados),
        recarregar,
        excluirBloco,
        moverBloco,
        /** Cabeçalho da grade: letra + dia do mês de cada coluna. */
        diasDaSemana: pegarDiasDaSemana(inicioDaSemana),
        ehSemanaAtual: semanaAtual,
        /** Índice do dia de hoje na grade, ou -1 quando a semana exibida não é a atual. */
        indiceDeHoje: datasDaSemana.indexOf(hojeISO),
    };
}
