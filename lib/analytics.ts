import { SessaoFocoRow } from "@/types/sessions";

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

export type ComecoSemana = "domingo" | "segunda";

export type MateriaDistribuicao = {
    subject: string;
    hours: number;
    color: string;
}

export interface AnalisePessoal {
    // Esta semana
    horasEstaSemana: string; // "12h30"
    horasEstaSemanaMinutos: number;
    questoesEstaSemana: number;
    diasEstaSemana: number;
    // Ofensiva (vem da gamificação, não é calculada aqui)
    sequencia: number;
    melhorSequencia: number;
    // Semana passada (para comparativos)
    horasSemanaPasada: string;
    horasSemanaPasadaMinutos: number;
    questoesSemanaPasada: number;
    diasSemanaPasada: number;
    // Distribuição por matéria (esta semana, ordenada por horas desc)
    distribuicao: MateriaDistribuicao[];
    maxHours: number;
    // Variação de horas vs. semana passada. `null` quando não há base de
    // comparação (semana passada zerada) — evita exibir "+Infinity%".
    variacaoHorasPct: number | null;
}

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

function formatarHoras(minutos: number): string {
    const horas = Math.floor(minutos / 60);
    const resto = minutos % 60;
    return `${horas}h${String(resto).padStart(2, "0")}`;
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
