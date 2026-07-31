/** Formata minutos como "1h30" ou "45m". */
export function formatarDuracao(min: number) {
    if (min < 60) return `${min}m`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, "0")}`;
}

/** Formata uma data no fuso local como "YYYY-MM-DD" (evita o bug de toISOString() cruzar pro dia seguinte em UTC). */
export function paraDataISO(data: Date) {
    const ano = data.getFullYear();
    const mes = (data.getMonth() + 1).toString().padStart(2, "0");
    const dia = data.getDate().toString().padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
}

/** Segunda-feira da semana atual — base de todo o resto dos cálculos de semana aqui. */
function pegarSegundaDaSemanaAtual() {
    const hoje = new Date();
    const diaSemanaJS = hoje.getDay(); // 0 = domingo ... 6 = sábado
    const diasDesdeSegunda = (diaSemanaJS + 6) % 7; // 0 = segunda ... 6 = domingo
    return new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - diasDesdeSegunda);
}

/** 0 = segunda ... 6 = domingo — mesma convenção de dia_semana da rotina. */
export function pegarDiaDaSemanaAtual() {
    return (new Date().getDay() + 6) % 7;
}

/**
 * Intervalo (segunda a domingo) da semana atual — mesma convenção de início de
 * semana usada em rotina_semanal_blocos (dia_semana 0 = segunda).
 */
export function pegarIntervaloSemanaAtual() {
    const segunda = pegarSegundaDaSemanaAtual();
    const domingo = new Date(segunda.getFullYear(), segunda.getMonth(), segunda.getDate() + 6);

    return { inicio: paraDataISO(segunda), fim: paraDataISO(domingo) };
}

const LETRAS_DIA_SEMANA = ["S", "T", "Q", "Q", "S", "S", "D"]; // seg, ter, qua, qui, sex, sáb, dom
const MESES_ABREV = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Letra + dia do mês de cada dia (segunda a domingo) da semana atual, pro cabeçalho da grade. */
export function pegarDiasDaSemanaAtual() {
    const segunda = pegarSegundaDaSemanaAtual();
    return Array.from({ length: 7 }, (_, i) => {
        const dia = new Date(segunda.getFullYear(), segunda.getMonth(), segunda.getDate() + i);
        return { letra: LETRAS_DIA_SEMANA[i], numero: dia.getDate() };
    });
}

const DIAS_SEMANA_EXTENSO = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

/** Próximos `qtd` dias a partir de hoje (incluindo hoje), pra escolher uma data de aplicação de plano. */
export function pegarProximosDias(qtd: number) {
    const hoje = new Date();
    return Array.from({ length: qtd }, (_, i) => {
        const data = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i);
        const diaSemana = DIAS_SEMANA_EXTENSO[(data.getDay() + 6) % 7];
        return {
            data: paraDataISO(data),
            rotulo: i === 0 ? "Hoje" : i === 1 ? "Amanhã" : diaSemana,
            diaMes: `${data.getDate()} de ${MESES_ABREV[data.getMonth()]}`,
        };
    });
}

/** Ex.: "28–31 de julho" (mesmo mês) ou "28 de julho – 3 de agosto" (virando o mês). */
export function pegarIntervaloSemanaFormatado() {
    const segunda = pegarSegundaDaSemanaAtual();
    const domingo = new Date(segunda.getFullYear(), segunda.getMonth(), segunda.getDate() + 6);

    if (segunda.getMonth() === domingo.getMonth()) {
        return `${segunda.getDate()}–${domingo.getDate()} de ${MESES_ABREV[domingo.getMonth()]}`;
    }
    return `${segunda.getDate()} de ${MESES_ABREV[segunda.getMonth()]} – ${domingo.getDate()} de ${MESES_ABREV[domingo.getMonth()]}`;
}
