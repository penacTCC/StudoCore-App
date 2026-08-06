import { useState, useCallback, useEffect, useMemo } from "react";
import { useFocusEffect } from "expo-router";

import {
    agregarAderenciaPorMateria,
    agregarDesempenhoPorMateria,
    agregarDistribuicaoPorMateria,
    agregarMinutosPorDiaSemana,
    agregarMinutosPorPeriodo,
    agregarParesPorPeriodo,
    agregarPlanejadoVsRealizado,
    amostrarPontosOfensiva,
    construirHistoricoOfensiva,
    formatarHoras,
    resumirAderencia,
    separarSessoesPorPeriodo,
} from "@/lib/analytics";
import { resolverAgendaDoIntervalo, type DiaResolvido } from "@/services/agenda";
import { buscarMateriasUsuario } from "@/services/materias";
import type { Materia } from "@/types/materias";
import { SessaoFocoRow } from "@/types/sessions";
import { ComecoSemana, membrosRankingAnalytics, PontoSerieDia } from "@/types/analytics";
import { PeriodoAnalise, QuestoesMembroGrupo } from "@/components/analytics/GraficosAnalise";
import { buscarSessoesPorUsuario } from "@/services/sessions";
import { toast } from "@/services/toast";
import { totalAcertos, totalQuestoes } from "@/utils/estatisticasSessao";
import { useMeusGrupos } from "@/hooks/useMeusGrupos";
import { useMembrosGrupos } from "@/hooks/useMembrosGrupos";
import { buscarMembrosGrupo, horasSemanaisGrupo } from "@/services/grupos";
import { useRankingHorasGrupo } from "@/hooks/useRankingHorasGrupo";
import { LeaderboardFilter } from "@/constants/ranking";
import { useSessoesGrupo } from "@/hooks/useSessoesGrupo";
import { MateriaMaisEstudada } from "@/types/materias";
import { MembroGrupoComPerfil } from "@/types/grupos";

export function useGraficosAnalytics(
    userId: string | null | undefined,
    comecoSemana: ComecoSemana,
    periodoAnalise: PeriodoAnalise
) {
    const [sessoesUsuario, setSessoesUsuario] = useState<SessaoFocoRow[]>([])

    //------Cálculos e funções para os gráficos dessa tela------
    //========PESSOAL========

    //Busca sessões do usuário
    const buscarSessoesUsuario = useCallback(async () => {
        if(!userId) return
        const {data, error} = await buscarSessoesPorUsuario(userId)
        if(error) {
            console.error(error)
            toast.error("Não foi possível carregar suas sessões de estudo.")
            return
        }
        setSessoesUsuario(data ?? [])
    }, [userId])

    useFocusEffect(
        useCallback(() => {
            buscarSessoesUsuario()
        }, [buscarSessoesUsuario])
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

    //Pontos do gráfico de área: dias da semana no filtro 7d, 4 semanas no 30d, 4 trimestres no ano
    const pontosGraficoArea = agregarMinutosPorPeriodo(sessoesDoPeriodoAtual, periodoAnalise, comecoSemana);

    //Título do comparativo (concordância: "Esta semana" / "Este mês" / "Este ano")
    const tituloComparativo =
        periodoAnalise === "7d" ? "Esta semana vs. anterior"
        : periodoAnalise === "30d" ? "Este mês vs. anterior"
        : "Este ano vs. anterior";

    //Pares atual/anterior, no mesmo agrupamento de pontosGraficoArea, para o gráfico de barras
    const paresGraficoComparativo = agregarParesPorPeriodo(sessoesDoPeriodoAtual, sessoesDoPeriodoAnterior, periodoAnalise, comecoSemana);

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
    //Soma quiz + formulários externos já corrigidos (ver utils/estatisticasSessao.ts).
    const qtdQuestoesTotais = sessoesDoPeriodoAtual.reduce((acumulador, item) => acumulador + totalQuestoes(item), 0);
    const qtdQuestoesCorretas = sessoesDoPeriodoAtual.reduce((acumulador, item) => acumulador + totalAcertos(item), 0);
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

    //-------Cronograma: planejado × realizado-------

    //Dias do cronograma já resolvidos (plano por data > plano fixado > rotina) na mesma
    //janela do SeletorPeriodo, e as matérias do usuário — os blocos guardam materia_id,
    //enquanto a sessão guarda o nome da disciplina, então a junção precisa do de-para.
    const [diasCronograma, setDiasCronograma] = useState<DiaResolvido[]>([])
    const [materiasUsuario, setMateriasUsuario] = useState<Materia[]>([])

    const carregarCronograma = useCallback(async () => {
        if (!userId) return

        const dias = periodoAnalise === "7d" ? 7 : periodoAnalise === "30d" ? 30 : 365
        const fim = new Date()
        const inicio = new Date()
        inicio.setDate(inicio.getDate() - (dias - 1))

        const [resolvidos, materias] = await Promise.all([
            resolverAgendaDoIntervalo(userId, formatarData(inicio), formatarData(fim)),
            buscarMateriasUsuario(userId),
        ])

        setDiasCronograma(resolvidos)
        setMateriasUsuario(materias)
    }, [userId, periodoAnalise])

    useEffect(() => {
        carregarCronograma()
    }, [carregarCronograma])

    //Minutos planejados por data e por matéria. Só blocos de estudo entram: descanso
    //previsto e não cumprido não deveria derrubar a aderência (ver lib/analytics.ts).
    const { planejadoPorDia, planejadoPorMateria, temCronograma } = useMemo(() => {
        const nomePorId = new Map(
            materiasUsuario.filter((m) => m.id).map((m) => [m.id as string, m.nomeExibicao])
        )

        const porDia: Record<string, number> = {}
        const porMateria: Record<string, number> = {}

        for (const dia of diasCronograma) {
            for (const bloco of dia.blocos) {
                if (bloco.tipo !== "estudo") continue
                porDia[dia.dataISO] = (porDia[dia.dataISO] ?? 0) + bloco.duracaoMin

                //Bloco de estudo sem matéria definida existe (o campo é opcional no cronograma);
                //vai pro balde "Sem matéria" em vez de sumir da conta por matéria.
                const nome = (bloco.materiaId ? nomePorId.get(bloco.materiaId) : null) ?? "Sem matéria"
                porMateria[nome] = (porMateria[nome] ?? 0) + bloco.duracaoMin
            }
        }

        return {
            planejadoPorDia: porDia,
            planejadoPorMateria: porMateria,
            temCronograma: Object.keys(porDia).length > 0,
        }
    }, [diasCronograma, materiasUsuario])

    const paresPlanejadoRealizado = agregarPlanejadoVsRealizado(
        planejadoPorDia,
        sessoesDoPeriodoAtual,
        periodoAnalise,
        comecoSemana
    )
    const resumoAderencia = resumirAderencia(paresPlanejadoRealizado)
    const aderenciaPorMateria = agregarAderenciaPorMateria(planejadoPorMateria, sessoesDoPeriodoAtual)

    //-------Desempenho por matéria-------

    //Uma agregação só alimenta os dois gráficos: a lista de taxa de acerto por matéria
    //e o de quadrantes (tempo × acerto).
    const desempenhoPorMateria = agregarDesempenhoPorMateria(sessoesDoPeriodoAtual)

    //========Aba Grupo========

    //Busca os grupos do usuário, para a tela de grupos
    const {grupos, atualizar: atualizarGrupos} = useMeusGrupos()

    //Busca os membros dos grupos
    const {membrosPorGrupo, recarregar: recarregarMembrosGrupos} = useMembrosGrupos(grupos)

    // Grupo escolhido no seletor da aba Análise > Grupo (null = usa o primeiro da lista)
    const [grupoSelecionadoId, setGrupoSelecionadoId] = useState<string | null>(null)

    //useState para as horas semanais do grupo
    const [horasSemanaGrupo, setHorasSemanaGrupo] = useState(0)

    //Grupo selecionado, para ser passado (como prop) para outras telas
    const grupoSelecionado = grupos.find((g) => g.id === grupoSelecionadoId) ?? grupos[0] ?? null;

    //useEffect para o grupoSelecionadoId não começar nulo
    useEffect(() => {
    if (grupoSelecionadoId === null && grupos.length > 0) {
            setGrupoSelecionadoId(grupos[0].id)
        }
    }, [grupos, grupoSelecionadoId])

    //Horas semanais do grupo
    //Faz useEffect para pegar as horas semanais do grupo
    const carregarHorasSemanaGrupo = useCallback(async () => {
        if(!grupoSelecionadoId) return
        const horas = await horasSemanaisGrupo(grupoSelecionadoId as string)
        setHorasSemanaGrupo(horas)
    }, [grupoSelecionadoId])

    useEffect(() => {
        carregarHorasSemanaGrupo()
    }, [carregarHorasSemanaGrupo])

    //Quantidade de membros em cada grupo
    const qtdMembrosGrupoSelecionado = grupoSelecionadoId
    ? (membrosPorGrupo[grupoSelecionadoId]?.length ?? 0)
    : 0

    //Transforma o período da aba Análise (PeriodoAnalise) no formato que o
    //ranking de grupo espera (LeaderboardFilter)
    const mapaPeriodo: Record<PeriodoAnalise, LeaderboardFilter> = {
        "7d": "semanal",
        "30d": "mensal",
        "ano": "anual",
    }
    const filtroRankingGrupo = mapaPeriodo[periodoAnalise]

    //Pega as horas e membros do grupo selecionado
    const horasMembros = useRankingHorasGrupo(
        grupoSelecionadoId,
        filtroRankingGrupo,
        grupoSelecionadoId ? membrosPorGrupo[grupoSelecionadoId] ?? [] : []
    )

    //Filtramos os membros para que o membro não fique undefined numa renderização de transição entre telas
    const membrosRanking: membrosRankingAnalytics[] = useMemo(
        () =>
            horasMembros.rankingMembros.filter((item) => item.membro)
                .map((item) => ({
                    userId: item.user_id,
                    nome: item.membro!.userData?.nome_usuario || "Sem nome",
                    foto: item.membro!.userData?.foto_usuario,
                    minutos: item.total_minutos,
                    ofensiva: item.membro!.ofensiva ?? 0,
                    ehVoce: item.user_id === userId,
            })),
        [horasMembros, userId]
    )

    //Lógica para pegar as matérias mais estudadas do grupo
    //1. Chamamos o hook SessoesGrupo, que pega as sessões e retorna-as pra gente
    const sessoesGrupo = useSessoesGrupo(grupoSelecionadoId)

    //Recorte das sessões do grupo dentro do período escolhido no SeletorPeriodo —
    //sem isso, matéria mais estudada e membros ativos ficavam sempre calculados
    //em cima de TODAS as sessões (useSessoesGrupo não filtra por data), ignorando o filtro.
    const sessoesGrupoNoPeriodo = useMemo(
        () => separarSessoesPorPeriodo(sessoesGrupo.sessions, periodoAnalise).atual,
        [sessoesGrupo.sessions, periodoAnalise]
    )

    const materiasGrupo: MateriaMaisEstudada[] = useMemo(() => {

        //2. Reaproveitamos a função que já soma os minutos de cada matéria
        const distribuicao = agregarDistribuicaoPorMateria(sessoesGrupoNoPeriodo)

        //3. Transformamos o tipo da distribuicao MateriaDistribuicao[] para Materia[] (tipo que o grafico aceita)
        //Reduzimos todos os valores do array a somente um
        const totalHorasMaterias = distribuicao.reduce((s, d) => s + d.hours, 0) || 1

        //transformamos o array distribuicao no tipo Materia[]
        return distribuicao.map((d) => ({
            rotulo: d.subject,
            pct: Math.round((d.hours / totalHorasMaterias) * 100),
            cor: d.color
        }))
    }, [sessoesGrupoNoPeriodo])

    //Criamos um novo set com as disciplinas das sessões do grupo, a quantidade de disciplinas é o tamanho do set.
    const setSessoesGrupo = new Set(sessoesGrupoNoPeriodo.map((s) => s.disciplina))
    const qtdDisciplinasGrupo = setSessoesGrupo.size

    //cria um array state que guarda os membros inativos
    const [membrosInativos, setMembrosInativos] = useState<MembroGrupoComPerfil[]>([])
    const [membrosTotais, setMembrosTotais] = useState<MembroGrupoComPerfil[]>([])

    //Cria um array com os usuários do grupo que não têm sessões de foco no período selecionado
    const filtraUsuariosInativos = useCallback(async () => {
        //1. Busca os membros do grupo atual
        if(!grupoSelecionadoId) return
        const membrosDoGrupo = await buscarMembrosGrupo(grupoSelecionadoId)
        setMembrosTotais(membrosDoGrupo)

        //2. Vê se no array de sessões de foco do período, tem os membros
        const idsComSessao = new Set(sessoesGrupoNoPeriodo.map((s) => s.user_id))
        const inativos = membrosDoGrupo.filter(m => !idsComSessao.has(m.user_id))
        setMembrosInativos(inativos)
    }, [grupoSelecionadoId, sessoesGrupoNoPeriodo])

    useEffect(() => {
        filtraUsuariosInativos()
    }, [filtraUsuariosInativos])

    //Questões por membro: soma respondidas/acertadas de cada membro (a partir das
    //sessões do grupo no período) e junta com membrosTotais pra pegar nome/foto —
    //mesmo padrão de join usado em useRankingHorasGrupo (ranking de horas x membros).
    const questoesPorMembroGrupo: QuestoesMembroGrupo[] = useMemo(() => {
        const porUsuario = new Map<string, { total: number; acertadas: number }>()

        for (const sessao of sessoesGrupoNoPeriodo) {
            const atual = porUsuario.get(sessao.user_id) ?? { total: 0, acertadas: 0 }
            atual.total += totalQuestoes(sessao)
            atual.acertadas += totalAcertos(sessao)
            porUsuario.set(sessao.user_id, atual)
        }

        return Array.from(porUsuario.entries())
            .map(([userId, { total, acertadas }]) => {
                const membro = membrosTotais.find((m) => m.user_id === userId)
                return {
                    userId,
                    nome: membro?.userData?.nome_usuario || "Sem nome",
                    foto: membro?.userData?.foto_usuario,
                    total,
                    pctAcerto: total > 0 ? Math.round((acertadas / total) * 100) : 0,
                }
            })
            .sort((a, b) => b.total - a.total)
    }, [sessoesGrupoNoPeriodo, membrosTotais])

    //Evolução do grupo: pontos do gráfico (distribuídos conforme periodoAnalise) e
    //variação % vs. período anterior, mesma lógica usada na aba Pessoal (useGraficosAnalytics)
    const pontosEvolucaoGrupo: PontoSerieDia[] = useMemo(
        () => agregarMinutosPorPeriodo(sessoesGrupo.sessions, periodoAnalise, comecoSemana),
        [sessoesGrupo.sessions, periodoAnalise, comecoSemana]
    )

    const { horasEvolucaoGrupo, percentualEvolucaoGrupo } = useMemo(() => {
        const { atual, anterior } = separarSessoesPorPeriodo(sessoesGrupo.sessions, periodoAnalise)
        const minutosAtuais = totalMinutosSessoes(atual)
        const minutosAnteriores = totalMinutosSessoes(anterior)
        return {
            horasEvolucaoGrupo: formatarHoras(minutosAtuais),
            percentualEvolucaoGrupo: calcularVariacaoPercentual(minutosAnteriores, minutosAtuais),
        }
    }, [sessoesGrupo.sessions, periodoAnalise])

    //Atualiza todos os dados (pessoal + grupo) num só disparo, usado pelo pull-to-refresh.
    const refresh = useCallback(async () => {
        await Promise.all([
            buscarSessoesUsuario(),
            carregarCronograma(),
            atualizarGrupos(),
            recarregarMembrosGrupos(),
            sessoesGrupo.refresh(),
            carregarHorasSemanaGrupo(),
            filtraUsuariosInativos(),
        ])
    }, [
        buscarSessoesUsuario,
        carregarCronograma,
        atualizarGrupos,
        recarregarMembrosGrupos,
        sessoesGrupo.refresh,
        carregarHorasSemanaGrupo,
        filtraUsuariosInativos,
    ])

    //Ofensiva coletiva: número atual/recorde vêm de `grupos.ofensiva`/`melhor_ofensiva`
    //(fonte real, atualizada por registrarOfensivaGrupo a cada sessão salva com
    //grupo_id — regra da cota diária, não "qualquer sessão"). Os pontos do gráfico
    //continuam reconstruídos a partir das sessões (não existe histórico diário salvo),
    //igual a ofensiva pessoal faz — é só uma aproximação visual da tendência.
    const ofensivaGrupo = useMemo(() => {
        const historico = construirHistoricoOfensiva(sessoesGrupo.sessions)
        return {
            atual: grupoSelecionado?.ofensiva ?? 0,
            melhor: grupoSelecionado?.melhor_ofensiva ?? 0,
            pontos: amostrarPontosOfensiva(historico),
        }
    }, [sessoesGrupo.sessions, grupoSelecionado?.ofensiva, grupoSelecionado?.melhor_ofensiva])

    //Função para calcular acertos x erros dos membros

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
        temCronograma,
        paresPlanejadoRealizado,
        resumoAderencia,
        aderenciaPorMateria,
        desempenhoPorMateria,
        //=======GRUPO=======
        grupos,
        membrosPorGrupo,
        grupoSelecionadoId,
        setGrupoSelecionadoId,
        horasSemanaGrupo,
        grupoSelecionado,
        qtdMembrosGrupoSelecionado,
        membrosRanking,
        sessoesGrupo,
        sessoesGrupoNoPeriodo,
        materiasGrupo,
        qtdDisciplinasGrupo,
        membrosInativos,
        membrosTotais,
        questoesPorMembroGrupo,
        pontosEvolucaoGrupo,
        horasEvolucaoGrupo,
        percentualEvolucaoGrupo,
        ofensivaGrupo,
        refresh,
    };
}
