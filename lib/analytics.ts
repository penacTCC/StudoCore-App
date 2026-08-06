import { SessaoFocoRow } from "@/types/sessions";
import { totalAcertos, totalQuestoes } from "@/utils/estatisticasSessao";
import {MateriaDistribuicao, AnalisePessoal, ComecoSemana, PontoSerieDia, ParDiaSemana, ParPlanejadoRealizado, ResumoAderencia, AderenciaMateria, DesempenhoMateria} from "@/types/analytics"

// Paleta usada para colorir as fatias de "distribuição por matéria".
// As cores são atribuídas por rank (matéria mais estudada primeiro), então
// ficam estáveis entre renders independente da ordem de inserção.
//
// Os valores saem do mockup "HADES Analytics" (Claude Design), não da paleta
// tailwind: numa tela cheia de gráficos, os tons -500 do tailwind (#10b981,
// #fbbf24, #f43f5e...) saturam demais lado a lado. Estes são os mesmos tons
// dessaturados que o design usa no donut e nos avatares.
const PALETA_MATERIAS = [
    "#3b82f6", // azul
    "#7c5cfc", // violeta
    "#1f9d63", // verde
    "#e08a1e", // laranja
    "#f0556b", // rosa
    "#1f9aa8", // teal
    "#f2b03d", // âmbar
];
// Abreviações indexadas como Date.getDay() (0 = domingo .. 6 = sábado).
export const DIAS_SEMANA_ABREV = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// ── Helpers puros ────────────────────────────────────────────────────────

// Chave de dia no fuso LOCAL do dispositivo. Usar toISOString() aqui contaria
// o dia em UTC, jogando sessões noturnas (ex.: 22h em UTC-3) para o dia
// seguinte e corrompendo a contagem de dias estudados.

function chaveDiaLocal(d: Date): string {
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
}

// Timestamp (ms) da meia-noite local do início da semana que contém `d`.
function comecoSemanaMs(d: Date, comeco: ComecoSemana): number {
    const date = new Date(d);
    const dia = date.getDay(); // 0 = domingo
    let diff = date.getDate() - dia;
    if (comeco === "segunda") {
        const offset = dia === 0 ? -6 : 1;
        diff = date.getDate() - dia + offset;
    }
    return new Date(date.setDate(diff)).setHours(0, 0, 0, 0);
}

// Nome completo indexado pela abreviação usada em DIAS_SEMANA_ABREV — usado
// no texto "Sexta é seu melhor dia" do gráfico "Quando você mais estuda".
export const NOME_COMPLETO_DIA: Record<string, string> = {
    Dom: "Domingo",
    Seg: "Segunda",
    Ter: "Terça",
    Qua: "Quarta",
    Qui: "Quinta",
    Sex: "Sexta",
    Sáb: "Sábado",
};

export function formatarHoras(minutos: number): string {
    const horas = Math.floor(minutos / 60);
    const resto = minutos % 60;
    return resto === 0 ? `${horas}h` : `${horas}h${String(resto).padStart(2, "0")}`;
}

/**
 * Soma os minutos estudados por dia da semana (Dom..Sáb), na ordem que
 * respeita a preferência de início de semana do usuário. Usada pelo
 * gráfico de área da aba Análise — recebe o recorte de sessões do período
 * já selecionado (7d/30d/ano) e devolve 7 pontos prontos pro eixo X.
 */
export function agregarMinutosPorDiaSemana(
    sessoes: SessaoFocoRow[],
    comecoSemana: ComecoSemana
): PontoSerieDia[] {
    const minutosPorDia = [0, 0, 0, 0, 0, 0, 0]; // índice = Date.getDay()

    for (const sessao of sessoes) {
        const data = new Date(sessao.created_at || sessao.data_sessao);
        minutosPorDia[data.getDay()] += sessao.tempo_minutos || 0;
    }

    const ordem = comecoSemana === "segunda" ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];

    return ordem.map((indiceDia) => ({
        dia: DIAS_SEMANA_ABREV[indiceDia],
        minutos: minutosPorDia[indiceDia],
    }));
}

/**
 * Agrupa as sessões por matéria e soma as horas de cada uma, ordenadas da
 * mais estudada pra menos — mesma lógica de `distribuicao` em
 * `calcularAnalisePessoal`, mas reutilizável pra qualquer recorte de
 * sessões (não só "esta semana"), como o período escolhido no SeletorPeriodo.
 */
export function agregarDistribuicaoPorMateria(sessoes: SessaoFocoRow[]): MateriaDistribuicao[] {
    const distMap: Record<string, number> = {};

    for (const sessao of sessoes) {
        const materia = sessao.disciplina || "Outros";
        distMap[materia] = (distMap[materia] || 0) + (sessao.tempo_minutos || 0);
    }

    return Object.entries(distMap)
        .map(([subject, minutos]) => ({
            subject,
            hours: Math.round((minutos / 60) * 10) / 10,
        }))
        .sort((a, b) => b.hours - a.hours)
        .map((materia, i) => ({ ...materia, color: PALETA_MATERIAS[i % PALETA_MATERIAS.length] }));
}

/**
 * Mesma agregação por dia da semana, mas casando o período atual com o
 * período anterior (mesma janela de tamanho, deslocada pra trás) — usada
 * pelo gráfico de barras pareadas "período atual vs. anterior".
 */
export function agregarParesPorDiaSemana(
    sessoesAtual: SessaoFocoRow[],
    sessoesAnterior: SessaoFocoRow[],
    comecoSemana: ComecoSemana
): ParDiaSemana[] {
    const atual = agregarMinutosPorDiaSemana(sessoesAtual, comecoSemana);
    const anterior = agregarMinutosPorDiaSemana(sessoesAnterior, comecoSemana);

    return atual.map((ponto, i) => ({
        dia: ponto.dia,
        atual: ponto.minutos,
        anterior: anterior[i]?.minutos ?? 0,
    }));
}

export type PeriodoAgregacao = "7d" | "30d" | "ano";

/**
 * Divide os últimos `dias` dias em `numBuckets` intervalos de tamanho igual,
 * terminando em `agora`, e soma os minutos de cada sessão no intervalo em que
 * ela cai. Diferente de `agregarMinutosPorDiaSemana`, a ordem aqui é sempre
 * do intervalo mais antigo pro mais recente (não depende de comecoSemana),
 * já que representa uma linha do tempo, não um padrão semanal recorrente.
 */
function agregarMinutosPorIntervalosIguais(
    sessoes: SessaoFocoRow[],
    dias: number,
    numBuckets: number,
    rotulos: string[],
    agora: Date
): PontoSerieDia[] {
    const fimMs = new Date(agora).setHours(23, 59, 59, 999);
    const inicioMs = fimMs - dias * 24 * 60 * 60 * 1000;
    const duracaoBucket = (fimMs - inicioMs) / numBuckets;

    const minutosPorBucket = new Array(numBuckets).fill(0);

    for (const sessao of sessoes) {
        const dataMs = new Date(sessao.created_at || sessao.data_sessao).getTime();
        if (dataMs < inicioMs || dataMs > fimMs) continue;
        const indice = Math.min(numBuckets - 1, Math.floor((dataMs - inicioMs) / duracaoBucket));
        minutosPorBucket[indice] += sessao.tempo_minutos || 0;
    }

    return minutosPorBucket.map((minutos, i) => ({ dia: rotulos[i], minutos }));
}

const ROTULOS_SEMANAS = ["Sem 1", "Sem 2", "Sem 3", "Sem 4"];
const ROTULOS_TRIMESTRES = ["Trim 1", "Trim 2", "Trim 3", "Trim 4"];

/**
 * Ponto de entrada usado pelo gráfico de área e pelo comparativo: escolhe o
 * tipo de bucket certo pro período selecionado no SeletorPeriodo — dias da
 * semana pro filtro "7 dias", 4 semanas pro "30 dias" e 4 trimestres pro
 * "Ano", em vez de sempre colapsar tudo em 7 dias da semana.
 */
export function agregarMinutosPorPeriodo(
    sessoes: SessaoFocoRow[],
    periodo: PeriodoAgregacao,
    comecoSemana: ComecoSemana,
    agora: Date = new Date()
): PontoSerieDia[] {
    if (periodo === "7d") return agregarMinutosPorDiaSemana(sessoes, comecoSemana);
    if (periodo === "30d") return agregarMinutosPorIntervalosIguais(sessoes, 30, 4, ROTULOS_SEMANAS, agora);
    return agregarMinutosPorIntervalosIguais(sessoes, 365, 4, ROTULOS_TRIMESTRES, agora);
}

/**
 * Versão pareada (atual vs. anterior) de `agregarMinutosPorPeriodo` — usada
 * pelo `GraficoComparativoSemanal`. Pro período anterior, os buckets são
 * recalculados com `agora` deslocado pra trás pela duração do período, pra
 * casar com a janela que `filtrarSessoesEntre` já usou pra separar
 * `sessoesAnterior`.
 */
export function agregarParesPorPeriodo(
    sessoesAtual: SessaoFocoRow[],
    sessoesAnterior: SessaoFocoRow[],
    periodo: PeriodoAgregacao,
    comecoSemana: ComecoSemana,
    agora: Date = new Date()
): ParDiaSemana[] {
    if (periodo === "7d") {
        return agregarParesPorDiaSemana(sessoesAtual, sessoesAnterior, comecoSemana);
    }

    const dias = periodo === "30d" ? 30 : 365;
    const agoraAnterior = new Date(agora.getTime() - dias * 24 * 60 * 60 * 1000);

    const atual = agregarMinutosPorPeriodo(sessoesAtual, periodo, comecoSemana, agora);
    const anterior = agregarMinutosPorPeriodo(sessoesAnterior, periodo, comecoSemana, agoraAnterior);

    return atual.map((ponto, i) => ({
        dia: ponto.dia,
        atual: ponto.minutos,
        anterior: anterior[i]?.minutos ?? 0,
    }));
}

/**
 * Separa um array de sessões (de um usuário ou de um grupo) em duas janelas
 * de mesmo tamanho: o período selecionado no SeletorPeriodo e o período
 * imediatamente anterior a ele — base pro cálculo de "vs. período anterior"
 * (%). Reaproveitável tanto pela aba Pessoal quanto pela aba Grupo, já que
 * ambas recebem um array plano de `SessaoFocoRow` e o mesmo `PeriodoAnalise`.
 */
export function separarSessoesPorPeriodo(
    sessoes: SessaoFocoRow[],
    periodo: PeriodoAgregacao,
    agora: Date = new Date()
): { atual: SessaoFocoRow[]; anterior: SessaoFocoRow[] } {
    const dias = periodo === "7d" ? 7 : periodo === "30d" ? 30 : 365;

    const formatarData = (data: Date) =>
        `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;

    const filtrarEntre = (diasInicio: number, diasFim: number) => {
        const dataInicio = new Date(agora);
        dataInicio.setDate(dataInicio.getDate() - diasInicio);
        const dataFim = new Date(agora);
        dataFim.setDate(dataFim.getDate() - diasFim);

        const inicioFormatado = formatarData(dataInicio);
        const fimFormatado = formatarData(dataFim);

        return sessoes.filter(
            (sessao) => sessao.data_sessao >= inicioFormatado && sessao.data_sessao <= fimFormatado
        );
    };

    return {
        atual: filtrarEntre(dias, 0),
        anterior: filtrarEntre(dias * 2, dias),
    };
}

// Soma os minutos totais de um recorte de sessões (usada no cálculo da
// variação percentual "vs. período anterior").
export function totalMinutosSessoes(sessoes: SessaoFocoRow[]): number {
    return sessoes.reduce((acumulador, sessao) => acumulador + (sessao.tempo_minutos ?? 0), 0);
}

/**
 * Compara dois totais de minutos (atual vs. anterior) e devolve o texto já
 * formatado ("+18.0%", "-5.0%", "+100.0%" quando não havia base de
 * comparação). Mesma regra usada hoje inline em `useGraficosAnalytics`.
 */
export function calcularVariacaoPercentual(minutosAnteriores: number, minutosAtuais: number): string {
    if (minutosAnteriores === 0) return minutosAtuais === 0 ? "0.0%" : "+100.0%";
    const variacao = ((minutosAtuais - minutosAnteriores) / minutosAnteriores) * 100;
    const sinal = variacao > 0 ? "+" : "";
    return `${sinal}${variacao.toFixed(1)}%`;
}

const JANELA_DIAS_OFENSIVA = 84; // 12 semanas
const PASSO_AMOSTRAGEM_OFENSIVA = 7; // 1 ponto por semana

/**
 * Reconstrói, dia a dia, qual era a ofensiva (streak) do usuário em cada um
 * dos últimos `JANELA_DIAS_OFENSIVA` dias — não existe histórico salvo no
 * banco (`gamificacoes` só guarda o valor atual), então a única forma de ter
 * uma série temporal é recalcular a partir dos dias em que houve sessão,
 * usando a mesma regra do Duolingo aplicada em `registrarSessaoConcluida`
 * (services/gamificacao.ts): estudou e estudou ontem -> +1; estudou mas não
 * ontem -> reinicia pra 1; não estudou -> zera.
 *
 * `hoje` é injetável (como em `calcularAnalisePessoal`) pra permitir testar
 * com uma data fixa em vez de depender do relógio real da máquina.
 */
export function construirHistoricoOfensiva(sessoes: SessaoFocoRow[], hoje: Date = new Date()): number[] {
    const diasEstudados = new Set(sessoes.map((s) => s.data_sessao));
    const historico: number[] = [];
    let ofensiva = 0;

    for (let i = JANELA_DIAS_OFENSIVA - 1; i >= 0; i--) {
        const data = new Date(hoje);
        data.setDate(hoje.getDate() - i);
        const dataFormatada = data.toLocaleDateString("en-CA");

        if (diasEstudados.has(dataFormatada)) {
            const ontem = new Date(data);
            ontem.setDate(data.getDate() - 1);
            const ontemFormatada = ontem.toLocaleDateString("en-CA");
            ofensiva = diasEstudados.has(ontemFormatada) ? ofensiva + 1 : 1;
        } else {
            ofensiva = 0;
        }

        historico.push(ofensiva);
    }

    return historico; // 84 valores, do mais antigo (índice 0) pro mais recente (último índice = hoje)
}

/**
 * Reduz o histórico diário a 1 ponto por semana, sempre terminando em hoje —
 * são os pontos que o gráfico de "Evolução da ofensiva" desenha no eixo X.
 */
export function amostrarPontosOfensiva(
    historico: number[],
    passo: number = PASSO_AMOSTRAGEM_OFENSIVA
): number[] {
    const pontos: number[] = [];
    for (let i = historico.length - 1; i >= 0; i -= passo) {
        pontos.unshift(historico[i]);
    }
    return pontos;
}

// ── Cronograma: planejado × realizado ────────────────────────────────────

// Cinza usado para matéria que aparece no plano mas não teve nenhuma sessão —
// não gasta uma cor da paleta com uma barra vazia.
const COR_SEM_ESTUDO = "#3a3d45";

/**
 * Normaliza o nome de uma matéria para servir de chave de junção. Espelha
 * `normalizarNomeMateria` (services/materias.ts) de propósito: este arquivo é puro
 * e não pode importar um service que carrega o cliente do Supabase junto. Se a regra
 * de normalização mudar lá, tem que mudar aqui.
 *
 * A junção é por nome porque `sessoes_foco.disciplina` guarda o texto da matéria, não
 * uma FK para `materias_usuario` — que é o que o bloco do cronograma referencia.
 */
function chaveMateria(nome: string): string {
    return nome
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "");
}

/** Minutos estudados por data ("YYYY-MM-DD"), na mesma chave que o cronograma usa. */
export function agregarMinutosPorDia(sessoes: SessaoFocoRow[]): Record<string, number> {
    const porDia: Record<string, number> = {};
    for (const sessao of sessoes) {
        // `data_sessao` (DATE) e não `created_at`: o planejado é por data de calendário,
        // então as duas séries precisam ser fatiadas pelo mesmo critério.
        const dia = sessao.data_sessao;
        if (!dia) continue;
        porDia[dia] = (porDia[dia] ?? 0) + (sessao.tempo_minutos || 0);
    }
    return porDia;
}

/**
 * Distribui um mapa "YYYY-MM-DD" -> minutos nos mesmos buckets que o resto da aba usa
 * (dias da semana no 7d, 4 semanas no 30d, 4 trimestres no ano), sempre terminando hoje.
 */
function bucketizarMapaPorDia(
    porDia: Record<string, number>,
    periodo: PeriodoAgregacao,
    comecoSemana: ComecoSemana,
    agora: Date
): PontoSerieDia[] {
    const dias = periodo === "7d" ? 7 : periodo === "30d" ? 30 : 365;

    // Datas da janela, da mais antiga para a mais recente.
    const chaves: string[] = [];
    for (let i = dias - 1; i >= 0; i--) {
        const data = new Date(agora);
        data.setDate(agora.getDate() - i);
        chaves.push(chaveDiaLocal(data));
    }

    if (periodo === "7d") {
        const minutosPorDiaSemana = [0, 0, 0, 0, 0, 0, 0]; // índice = Date.getDay()
        for (const chave of chaves) {
            const [ano, mes, dia] = chave.split("-").map(Number);
            minutosPorDiaSemana[new Date(ano, mes - 1, dia).getDay()] += porDia[chave] ?? 0;
        }
        const ordem = comecoSemana === "segunda" ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
        return ordem.map((indice) => ({
            dia: DIAS_SEMANA_ABREV[indice],
            minutos: minutosPorDiaSemana[indice],
        }));
    }

    const rotulos = periodo === "30d" ? ROTULOS_SEMANAS : ROTULOS_TRIMESTRES;
    const tamanhoBucket = chaves.length / rotulos.length;
    const buckets = new Array(rotulos.length).fill(0);

    chaves.forEach((chave, i) => {
        const indice = Math.min(rotulos.length - 1, Math.floor(i / tamanhoBucket));
        buckets[indice] += porDia[chave] ?? 0;
    });

    return buckets.map((minutos, i) => ({ dia: rotulos[i], minutos }));
}

/**
 * Casa o que o cronograma previa com o que as sessões registraram, bucket a bucket.
 *
 * `planejadoPorDia` vem de `resolverAgendaDoIntervalo` (services/agenda.ts) já somado por
 * data e restrito aos blocos de estudo — descanso não entra, senão a aderência cairia por
 * pausa não cumprida, que não é o que o gráfico quer medir.
 */
export function agregarPlanejadoVsRealizado(
    planejadoPorDia: Record<string, number>,
    sessoes: SessaoFocoRow[],
    periodo: PeriodoAgregacao,
    comecoSemana: ComecoSemana,
    agora: Date = new Date()
): ParPlanejadoRealizado[] {
    const planejado = bucketizarMapaPorDia(planejadoPorDia, periodo, comecoSemana, agora);
    const realizado = bucketizarMapaPorDia(agregarMinutosPorDia(sessoes), periodo, comecoSemana, agora);

    return planejado.map((ponto, i) => ({
        rotulo: ponto.dia,
        planejado: ponto.minutos,
        realizado: realizado[i]?.minutos ?? 0,
    }));
}

/** Totais e % de aderência do período, a partir dos buckets já pareados. */
export function resumirAderencia(pares: ParPlanejadoRealizado[]): ResumoAderencia {
    const minutosPlanejados = pares.reduce((total, par) => total + par.planejado, 0);
    const minutosRealizados = pares.reduce((total, par) => total + par.realizado, 0);

    return {
        // Sem nada planejado não existe aderência a medir — 0 e a UI mostra o estado vazio.
        pct: minutosPlanejados > 0 ? Math.round((minutosRealizados / minutosPlanejados) * 100) : 0,
        minutosPlanejados,
        minutosRealizados,
    };
}

/**
 * Aderência matéria a matéria: quanto foi planejado, quanto foi estudado e a razão entre
 * os dois. Entram tanto as matérias do plano (mesmo com 0 minutos estudados, que são
 * justamente as furadas) quanto as estudadas fora do plano — nestas `planejado` é 0 e o
 * `pct` fica em 0, cabendo à UI rotulá-las como extra em vez de mostrar porcentagem.
 */
export function agregarAderenciaPorMateria(
    planejadoPorMateria: Record<string, number>,
    sessoes: SessaoFocoRow[]
): AderenciaMateria[] {
    const linhas = new Map<string, { materia: string; planejado: number; realizado: number }>();

    for (const [materia, minutos] of Object.entries(planejadoPorMateria)) {
        const chave = chaveMateria(materia);
        const atual = linhas.get(chave) ?? { materia, planejado: 0, realizado: 0 };
        atual.planejado += minutos;
        linhas.set(chave, atual);
    }

    for (const sessao of sessoes) {
        const materia = sessao.disciplina || "Outros";
        const chave = chaveMateria(materia);
        // O nome do plano ganha do da sessão quando os dois existem: é o cadastrado
        // em materias_usuario, com acentuação e caixa corretas.
        const atual = linhas.get(chave) ?? { materia, planejado: 0, realizado: 0 };
        atual.realizado += sessao.tempo_minutos || 0;
        linhas.set(chave, atual);
    }

    // Cor pela mesma regra do donut (rank de horas estudadas), pra matéria não trocar
    // de cor entre um gráfico e outro na mesma tela.
    const cores = new Map(
        agregarDistribuicaoPorMateria(sessoes).map((m) => [chaveMateria(m.subject), m.color])
    );

    return Array.from(linhas.entries())
        .map(([chave, linha]) => ({
            materia: linha.materia,
            cor: cores.get(chave) ?? COR_SEM_ESTUDO,
            planejado: linha.planejado,
            realizado: linha.realizado,
            pct: linha.planejado > 0 ? Math.round((linha.realizado / linha.planejado) * 100) : 0,
        }))
        .sort((a, b) => b.planejado - a.planejado || b.realizado - a.realizado);
}

// ── Desempenho por matéria ───────────────────────────────────────────────

/**
 * Junta tempo e acerto por matéria numa linha só — é a base do gráfico "Taxa de acerto
 * por matéria" e do de quadrantes "Tempo × desempenho", que leem os mesmos números por
 * eixos diferentes.
 *
 * Ordenado por horas desc, igual a `agregarDistribuicaoPorMateria`, pra as cores por rank
 * baterem com as do donut.
 */
export function agregarDesempenhoPorMateria(sessoes: SessaoFocoRow[]): DesempenhoMateria[] {
    const porMateria = new Map<string, { materia: string; minutos: number; questoes: number; acertos: number }>();

    for (const sessao of sessoes) {
        const materia = sessao.disciplina || "Outros";
        const chave = chaveMateria(materia);
        const atual = porMateria.get(chave) ?? { materia, minutos: 0, questoes: 0, acertos: 0 };
        atual.minutos += sessao.tempo_minutos || 0;
        atual.questoes += totalQuestoes(sessao);
        atual.acertos += totalAcertos(sessao);
        porMateria.set(chave, atual);
    }

    return Array.from(porMateria.values())
        .map((linha) => ({
            materia: linha.materia,
            minutos: linha.minutos,
            hours: Math.round((linha.minutos / 60) * 10) / 10,
            questoes: linha.questoes,
            acertos: linha.acertos,
        }))
        .sort((a, b) => b.hours - a.hours)
        .map((linha, i) => ({
            materia: linha.materia,
            cor: PALETA_MATERIAS[i % PALETA_MATERIAS.length],
            minutos: linha.minutos,
            horas: linha.hours,
            questoes: linha.questoes,
            acertos: linha.acertos,
            pctAcerto: linha.questoes > 0 ? Math.round((linha.acertos / linha.questoes) * 100) : 0,
        }));
}

// ── Cálculo principal ────────────────────────────────────────────────────

/**
 * Agrega as sessões de foco de UM usuário nos números da aba "Análise" (escopo
 * pessoal). Função pura e sem dependência de React/Supabase — é só entra array,
 * sai objeto, o que a torna trivial de testar.
 *
 * @param agora injetável para testes; default é o momento atual.
 */
export function calcularAnalisePessoal(
    sessoes: SessaoFocoRow[],
    opts: {
        comecoSemana: ComecoSemana;
        ofensiva: number;
        melhorOfensiva?: number;
        agora?: Date;
    }
): AnalisePessoal {
    const { comecoSemana, ofensiva, melhorOfensiva = 0 } = opts;
    const agora = opts.agora ?? new Date();

    const comecoDessaSemana = comecoSemanaMs(agora, comecoSemana);
    const comecoSemanaAnterior = comecoDessaSemana - 7 * 24 * 60 * 60 * 1000;
    const fimSemanaAnterior = comecoDessaSemana - 1;

    let minutosEstaSemana = 0;
    let questoesEstaSemana = 0;
    let minutosSemanaPasada = 0;
    let questoesSemanaPasada = 0;
    const diasEstaSemana = new Set<string>();
    const diasSemanaPasada = new Set<string>();
    const distMap: Record<string, number> = {};

    for (const sessao of sessoes) {
        // created_at (timestamptz) é mais preciso que data_sessao (DATE, sem hora);
        // caímos em data_sessao só se created_at faltar.
        const data = new Date(sessao.created_at || sessao.data_sessao);
        const tempo = data.getTime();

        // Esta semana
        if (comecoSemanaMs(data, comecoSemana) === comecoDessaSemana) {
            minutosEstaSemana += sessao.tempo_minutos || 0;
            questoesEstaSemana += totalQuestoes(sessao);
            diasEstaSemana.add(chaveDiaLocal(data));

            const materia = sessao.disciplina || "Outros";
            distMap[materia] = (distMap[materia] || 0) + (sessao.tempo_minutos || 0);
        }

        // Semana passada
        if (tempo >= comecoSemanaAnterior && tempo <= fimSemanaAnterior) {
            minutosSemanaPasada += sessao.tempo_minutos || 0;
            questoesSemanaPasada += totalQuestoes(sessao);
            diasSemanaPasada.add(chaveDiaLocal(data));
        }
    }

    const distribuicao: MateriaDistribuicao[] = Object.entries(distMap)
        .map(([subject, minutos]) => ({
            subject,
            hours: Math.round((minutos / 60) * 10) / 10,
        }))
        .sort((a, b) => b.hours - a.hours)
        // Cor atribuída só depois de ordenar, pra ser estável por rank.
        .map((materia, i) => ({ ...materia, color: PALETA_MATERIAS[i % PALETA_MATERIAS.length] }));

    const variacaoHorasPct =
        minutosSemanaPasada > 0
            ? Math.round(((minutosEstaSemana - minutosSemanaPasada) / minutosSemanaPasada) * 100)
            : null;

    return {
        horasEstaSemana: formatarHoras(minutosEstaSemana),
        horasEstaSemanaMinutos: minutosEstaSemana,
        questoesEstaSemana,
        diasEstaSemana: diasEstaSemana.size,
        sequencia: ofensiva,
        melhorSequencia: melhorOfensiva,
        horasSemanaPasada: formatarHoras(minutosSemanaPasada),
        horasSemanaPasadaMinutos: minutosSemanaPasada,
        questoesSemanaPasada,
        diasSemanaPasada: diasSemanaPasada.size,
        distribuicao,
        maxHours: distribuicao.length > 0 ? Math.max(...distribuicao.map((d) => d.hours)) : 1,
        variacaoHorasPct,
    };
}
