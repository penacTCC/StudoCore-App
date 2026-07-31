/** Item mínimo com horário, usado pra detectar conflitos entre blocos de um mesmo dia/fonte. */
export type ItemComHorario = {
    id: string;
    horaInicio: string; // "HH:MM"
    duracaoMin: number;
};

export type Conflito = { comId: string; minutos: number };

function paraMinutos(horaInicio: string): number {
    const [h, m] = horaInicio.split(":").map(Number);
    return h * 60 + m;
}

/**
 * Recebe blocos de UM mesmo dia/fonte (um dia da rotina, ou os blocos de um
 * único plano) e retorna, pra cada id que participa de ao menos uma
 * sobreposição, com quais outros ids ele conflita e quantos minutos. Blocos
 * apenas encostados (fim de um == início do outro) não contam como conflito.
 */
export function encontrarConflitos(itens: ItemComHorario[]): Map<string, Conflito[]> {
    const resultado = new Map<string, Conflito[]>();
    const comIntervalo = itens.map((item) => {
        const inicio = paraMinutos(item.horaInicio);
        return { ...item, inicio, fim: inicio + item.duracaoMin };
    });

    for (let i = 0; i < comIntervalo.length; i++) {
        for (let j = i + 1; j < comIntervalo.length; j++) {
            const a = comIntervalo[i];
            const b = comIntervalo[j];
            const sobreposicao = Math.min(a.fim, b.fim) - Math.max(a.inicio, b.inicio);
            if (sobreposicao > 0) {
                resultado.set(a.id, [...(resultado.get(a.id) ?? []), { comId: b.id, minutos: sobreposicao }]);
                resultado.set(b.id, [...(resultado.get(b.id) ?? []), { comId: a.id, minutos: sobreposicao }]);
            }
        }
    }
    return resultado;
}

/**
 * Soma a duração de blocos de um mesmo dia como união de intervalos (cada
 * minuto conta uma vez), em vez de soma bruta — evita contar 2x o tempo
 * "planejado" quando dois blocos se sobrepõem.
 */
export function somarMinutosSemSobreposicao(itens: { inicioMin: number; duracaoMin: number }[]): number {
    if (itens.length === 0) return 0;
    const intervalos = itens
        .map((i) => ({ inicio: i.inicioMin, fim: i.inicioMin + i.duracaoMin }))
        .sort((a, b) => a.inicio - b.inicio);

    let total = 0;
    let { inicio: inicioAtual, fim: fimAtual } = intervalos[0];
    for (let i = 1; i < intervalos.length; i++) {
        const prox = intervalos[i];
        if (prox.inicio <= fimAtual) {
            fimAtual = Math.max(fimAtual, prox.fim);
        } else {
            total += fimAtual - inicioAtual;
            inicioAtual = prox.inicio;
            fimAtual = prox.fim;
        }
    }
    total += fimAtual - inicioAtual;
    return total;
}
