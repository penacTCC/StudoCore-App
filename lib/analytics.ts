import { SessaoFocoRow } from "@/types/sessions";
import {MateriaDistribuicao, AnalisePessoal, ComecoSemana, PontoSerieDia, ParDiaSemana} from "@/types/analytics"

// Paleta usada para colorir as fatias de "distribuição por matéria".
// As cores são atribuídas por rank (matéria mais estudada primeiro), então
// ficam estáveis entre renders independente da ordem de inserção.
const PALETA_MATERIAS = [
    "#8b5cf6",
    "#10b981",
    "#fbbf24",
    "#f43f5e",
    "#3b82f6",
    "#ec4899",
    "#14b8a6",
    "#f97316",
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
    return `${horas}h${String(resto).padStart(2, "0")}`;
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
            questoesEstaSemana += sessao.questoes_respondidas || 0;
            diasEstaSemana.add(chaveDiaLocal(data));

            const materia = sessao.disciplina || "Outros";
            distMap[materia] = (distMap[materia] || 0) + (sessao.tempo_minutos || 0);
        }

        // Semana passada
        if (tempo >= comecoSemanaAnterior && tempo <= fimSemanaAnterior) {
            minutosSemanaPasada += sessao.tempo_minutos || 0;
            questoesSemanaPasada += sessao.questoes_respondidas || 0;
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
