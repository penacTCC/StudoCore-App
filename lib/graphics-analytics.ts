import { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";

import {
    agregarDistribuicaoPorMateria,
    agregarMinutosPorDiaSemana,
    agregarParesPorDiaSemana,
    amostrarPontosOfensiva,
    construirHistoricoOfensiva,
} from "@/lib/analytics";
import { SessaoFocoRow } from "@/types/sessions";
import { ComecoSemana } from "@/types/analytics";
import { PeriodoAnalise } from "@/components/analytics/GraficosAnalise";
import { buscarSessoesPorUsuario } from "@/services/sessions";

export function useGraficosAnalytics(
    userId: string | null | undefined,
    comecoSemana: ComecoSemana,
    periodoAnalise: PeriodoAnalise
) {
    const [sessoesUsuario, setSessoesUsuario] = useState<SessaoFocoRow[]>([])

    //------Cálculos e funções para os gráficos dessa tela------

    //Busca sessões do usuário
    useFocusEffect(
        useCallback(() => {
            const buscarSessoesUsuario = async () => {
                if(!userId) return
                const {data, error} = await buscarSessoesPorUsuario(userId)
                if(error) {
                    console.error(error)
                    return
                }
                setSessoesUsuario(data ?? [])
            }
            buscarSessoesUsuario()
        }, [userId])
    )

    //-------Filtros de Data limite-------

    //Formata a data para formato aaaa-mm-dd
    const formatarData = (data: Date) =>
        `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;

    //Cria uma função helper para filtrar as sessões com base na data limite
    const filtrarSessoesEntre = (diasInicio: number, diasFim: number = 0) => {
        const dataLimiteInicio = new Date();
        dataLimiteInicio.setDate(dataLimiteInicio.getDate() - diasInicio);
        const dataInicioFormatada = formatarData(dataLimiteInicio);

        const dataLimiteFim = new Date();
        dataLimiteFim.setDate(dataLimiteFim.getDate() - diasFim);
        const dataFimFormatada = formatarData(dataLimiteFim);

        return sessoesUsuario.filter(
            (sessao) =>
                sessao.data_sessao >= dataInicioFormatada &&
                sessao.data_sessao <= dataFimFormatada
        );
    };

    //Sessoes do Período Atual
    const sessoesDaSemana = filtrarSessoesEntre(7);
    const sessoesDoMes = filtrarSessoesEntre(30);
    const sessoesDoAno = filtrarSessoesEntre(365);

    //Sessoes de um Período Anterior (necessário para ver a taxa de porcentagem vs x período anterior)
    const sessoesDaSemanaAnterior = filtrarSessoesEntre(14, 7);
    const sessoesDoMesAnterior = filtrarSessoesEntre(60, 30);
    const sessoesDoAnoAnterior = filtrarSessoesEntre(730, 365);

    //Soma o total de minutos das sessões filtradas (usado no cálculo)
    const totalMinutosSessoes = (sessaoFiltrada: SessaoFocoRow[]) =>
        sessaoFiltrada?.reduce((acumulador, sessao) => acumulador + (sessao.tempo_minutos ?? 0), 0) ?? 0;

    //Formata minutos totais em "Xh Ym" (usado só para exibição)
    const formatarMinutosParaHoras = (totalMinutos: number) => {
        const horas = Math.floor(totalMinutos / 60);
        const minutos = Math.round(totalMinutos % 60);
        return `${horas}h ${minutos}m`;
    };

    //Escolhe o conjunto de sessões de acordo com o período selecionado no SeletorPeriodo
    const sessoesDoPeriodoAtual =
        periodoAnalise === "7d" ? sessoesDaSemana
        : periodoAnalise === "30d" ? sessoesDoMes
        : sessoesDoAno;

    //Escolhe o conjunto de sessões de acordo com o período anterior selecionado
    const sessoesDoPeriodoAnterior =
        periodoAnalise === "7d" ? sessoesDaSemanaAnterior
        : periodoAnalise === "30d" ? sessoesDoMesAnterior
        : sessoesDoAnoAnterior;

    //Totais em minutos (números, usados no cálculo de variação)
    const minutosAtuais = totalMinutosSessoes(sessoesDoPeriodoAtual);
    const minutosAnteriores = totalMinutosSessoes(sessoesDoPeriodoAnterior);

    //Totais formatados (strings, usados só na exibição)
    const horasFormatadasAtuais = formatarMinutosParaHoras(minutosAtuais);

    //Cálculo da porcentagem entre os dois períodos
    const calcularVariacaoPercentual = (valorAntigo: number, valorNovo: number) => {
        if (valorAntigo === 0) return valorNovo === 0 ? '0.0%' : '+100.0%';
        const variacao = ((valorNovo - valorAntigo) / valorAntigo) * 100;
        const sinal = variacao > 0 ? '+' : '';
        return `${sinal}${variacao.toFixed(1)}%`;
    };

    const variacaoPercentual = calcularVariacaoPercentual(minutosAnteriores, minutosAtuais);

    //Rótulo do período usado no texto "vs X passado(a)" do GraficoArea
    const rotuloPeriodo =
        periodoAnalise === "7d" ? "semana"
        : periodoAnalise === "30d" ? "mês"
        : "ano";

    //Quantidade
    const qtdSessoes = sessoesDoPeriodoAtual.length;

    //Média de horas das sessões
    //Média de minutos por sessão
    const mediaMinutosPorSessao = qtdSessoes !== 0 ? minutosAtuais / qtdSessoes : 0;
    const mediaDasHoras = qtdSessoes !== 0 ? formatarMinutosParaHoras(mediaMinutosPorSessao) : "0";

    //Pontos do gráfico de área: minutos estudados por dia da semana, dentro do período selecionado
    const pontosGraficoArea = agregarMinutosPorDiaSemana(sessoesDoPeriodoAtual, comecoSemana);

    //Título do comparativo (concordância: "Esta semana" / "Este mês" / "Este ano")
    const tituloComparativo =
        periodoAnalise === "7d" ? "Esta semana vs. anterior"
        : periodoAnalise === "30d" ? "Este mês vs. anterior"
        : "Este ano vs. anterior";

    //Pares atual/anterior por dia da semana, para o gráfico de barras
    const paresGraficoComparativo = agregarParesPorDiaSemana(sessoesDoPeriodoAtual, sessoesDoPeriodoAnterior, comecoSemana);

    //Conta quantas e quais matérias o usuário estudou no período escolhido
    const materiasSet = new Set(sessoesDoPeriodoAtual.map((s) => s.disciplina));
    const qtdMateriasEstudadas = materiasSet.size;

    //Distribuição de horas por matéria no período escolhido
    const distribuicaoMaterias = agregarDistribuicaoPorMateria(sessoesDoPeriodoAtual);
    const totalHorasMaterias = distribuicaoMaterias.reduce((acumulador, materia) => acumulador + materia.hours, 0);
    const materiasParaDonut = distribuicaoMaterias.map((materia) => ({
        rotulo: materia.subject,
        pct: totalHorasMaterias > 0 ? Math.round((materia.hours / totalHorasMaterias) * 100) : 0,
        cor: materia.color,
    }));

    //Quantidade de questões respondidas no período selecionado, para cálculo percentual
    const qtdQuestoesTotais = sessoesDoPeriodoAtual.reduce((acumulador, item) => acumulador + (item.questoes_respondidas ?? 0), 0);
    const qtdQuestoesCorretas = sessoesDoPeriodoAtual.reduce((acumulador, item) => acumulador + (item.questoes_acertadas ?? 0), 0);
    const qtdQuestoesErradas = qtdQuestoesTotais - qtdQuestoesCorretas
    const pctAcerto = qtdQuestoesTotais > 0 ? Math.round((qtdQuestoesCorretas / qtdQuestoesTotais) * 100): 0

    //Cálculo de qual dia o usuário estuda mais — usa TODAS as sessões (não só
    //o período filtrado no seletor), já que é um padrão de hábito e precisa
    //de repetição em várias semanas pra fazer sentido estatisticamente.
    const pontosDiaSemana = agregarMinutosPorDiaSemana(sessoesUsuario, comecoSemana);

    //Evolução da ofensiva: reconstrói o histórico diário (não existe no banco,
    //só o valor atual) e amostra 1 ponto por semana pro gráfico. O valor de
    //hoje/recorde exibidos vêm de `analise` (fonte real, vinda de gamificações),
    //não da reconstrução — evita divergência por qualquer caso de borda.
    const historicoOfensiva = construirHistoricoOfensiva(sessoesUsuario);
    const pontosOfensiva = amostrarPontosOfensiva(historicoOfensiva);

    return {
        sessoesUsuario,
        sessoesDoPeriodoAtual,
        sessoesDoPeriodoAnterior,
        minutosAtuais,
        minutosAnteriores,
        horasFormatadasAtuais,
        variacaoPercentual,
        rotuloPeriodo,
        qtdSessoes,
        mediaDasHoras,
        pontosGraficoArea,
        tituloComparativo,
        paresGraficoComparativo,
        qtdMateriasEstudadas,
        materiasParaDonut,
        qtdQuestoesTotais,
        qtdQuestoesCorretas,
        qtdQuestoesErradas,
        pctAcerto,
        pontosDiaSemana,
        pontosOfensiva,
    };
}
