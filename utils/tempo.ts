
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

function paraMinutosDoDia(hora: string) {
    const [h, m] = hora.split(":").map(Number);
    return h * 60 + m;
}

/**
 * Um horário local cai dentro da janela de "não perturbar"?
 *
 * A janela costuma virar a meia-noite (22:00–07:00): quando o início é maior que o fim, o
 * teste deixa de ser "entre os dois" e passa a ser "fora do intervalo do meio".
 *
 * Mora aqui, e não em cada serviço de notificação, porque os três que agendam algo
 * (cronograma, ofensiva, pausa) precisam responder exatamente a mesma coisa.
 */
export function dentroDoNaoPerturbar(hora: number, minuto: number, inicio: string, fim: string) {
    const alvo = hora * 60 + minuto;
    const inicioMin = paraMinutosDoDia(inicio);
    const fimMin = paraMinutosDoDia(fim);

    return inicioMin <= fimMin ? alvo >= inicioMin && alvo < fimMin : alvo >= inicioMin || alvo < fimMin;
}

/**
 * Converte um timestamp vindo do Postgres em milissegundos.
 *
 * Colunas `timestamp with time zone` voltam com fuso ("...Z" ou "...+00:00") e o `Date`
 * do JS já as lê certo. Já as colunas `timestamp without time zone` voltam sem marcador
 * nenhum, e aí o JS as interpreta como horário *local* — como o app grava tudo com
 * `toISOString()` (UTC), isso empurrava o início da sessão para o futuro e produzia
 * cronômetro negativo. Quando não há marcador, portanto, assumimos UTC.
 */
export function paraTimestampMs(valor?: string | null): number | null {
    if (!valor) return null;

    const temFuso = /(Z|[+-]\d{2}:?\d{2})$/.test(valor.trim());
    const ms = new Date(temFuso ? valor : `${valor.trim().replace(" ", "T")}Z`).getTime();

    return Number.isFinite(ms) ? ms : null;
}

/**
 * Segundos decorridos desde `timestamp` até agora, nunca negativo — usado pelos cronômetros
 * ao vivo (sessão de foco, membros da sessão em grupo).
 */
export function segundosDesde(timestamp?: string | null): number {
    const inicioMs = paraTimestampMs(timestamp);
    if (inicioMs === null) return 0;

    return Math.max(0, Math.floor((Date.now() - inicioMs) / 1000));
}

/**
 * Depois disso sem nenhuma interação, a sessão foi abandonada (app fechado à força), não
 * é estudo. Mesmo corte que `buscarSessoesAoVivo` aplica para não deixar sessão fantasma
 * no feed do grupo — os dois precisam concordar, senão o feed esconde uma sessão que a
 * prévia ainda mostra correndo.
 */
export const HORAS_ATE_ABANDONO = 12;

/**
 * Tempo ao vivo de um participante de sessão em grupo, em segundos.
 *
 * `tempo_segundos` em `tab_sessao_membros` é um acumulado congelado: só é regravado quando
 * a pessoa pausa ou encerra. Enquanto ela está focando, o que passou desde `ultimo_inicio`
 * ainda não está lá — por isso o valor ao vivo é o acumulado MAIS esse trecho. Somar um
 * contador local que nasce zerado quando a tela abre, como era feito antes, mostrava o
 * tempo desde que você abriu a tela, não o tempo que a pessoa estudou.
 *
 * Sempre em tempo de relógio real: a escala do modo de testes NÃO entra aqui. Este é um
 * cronômetro ao vivo, que precisa bater com o relógio de quem está focando — quando ele era
 * multiplicado, o tempo dos colegas disparava, e um acumulado gravado enquanto o modo estava
 * ligado continuava inflado depois de desligá-lo.
 */
export function tempoAoVivoDoMembro(
    membro: {
        tempo_segundos?: number | null;
        ultimo_inicio?: string | null;
        status?: string | null;
    },
    opcoes?: {
        /** `concluido_em` da sessão a que a participação pertence, quando conhecido. */
        sessaoConcluidaEm?: string | null;
    }
): number {
    const acumulado = Math.max(0, Math.floor(membro.tempo_segundos || 0));

    if (membro.status !== "ativo") return acumulado;

    const inicioMs = paraTimestampMs(membro.ultimo_inicio);
    if (inicioMs === null) return acumulado;

    /*
      Duas travas contra o cronômetro fugitivo. O sintoma era um participante marcando 142
      HORAS e subindo numa sessão já encerrada: a linha dele em `tab_sessao_membros` ficou
      `ativo` (ver a migration `encerrar_participacoes_da_sessao`) e o trecho ao vivo
      passou a ser "agora menos o dia em que ele abandonou".

      1. Se a sala já fechou, o trecho para no instante em que ela fechou. Ninguém continua
         estudando numa sessão concluída.
      2. Acima do corte de abandono, o trecho inteiro é descartado em vez de truncado: um
         intervalo desses não é estudo real, é app fechado à força. É o mesmo limite que
         `buscarSessoesAoVivo` usa para não deixar sessão fantasma no feed.
    */
    const fimDaSalaMs = paraTimestampMs(opcoes?.sessaoConcluidaEm ?? null);
    const ateMs = fimDaSalaMs === null ? Date.now() : Math.min(Date.now(), fimDaSalaMs);

    const decorrido = Math.max(0, Math.floor((ateMs - inicioMs) / 1000));
    if (decorrido > HORAS_ATE_ABANDONO * 3600) return acumulado;

    return acumulado + decorrido;
}

/**
 * Tempo ao vivo de uma sessão de foco, em segundos — mesma ideia de `tempoAoVivoDoMembro`,
 * só que lendo a linha de `sessoes_foco` (é o que o feed do grupo tem em mãos).
 *
 * `tempo_minutos` é o acumulado congelado: começa em 0 e só é regravado quando a sessão
 * pausa, entra em descanso do pomodoro ou encerra. Enquanto o status é "ativo", o trecho
 * decorrido desde `ultimo_inicio` ainda não está lá — mostrar só `tempo_minutos`, como o
 * card fazia, deixava toda sessão em andamento parada em "0m" no feed.
 *
 * Sessão encerrada devolve o valor gravado e para de andar.
 */
export function tempoAoVivoDaSessao(sessao: {
    tempo_minutos?: number | null;
    ultimo_inicio?: string | null;
    status?: string | null;
    concluido_em?: string | null;
}): number {
    const acumulado = Math.max(0, Math.floor(sessao.tempo_minutos || 0)) * 60;

    if (sessao.concluido_em || sessao.status !== "ativo") return acumulado;

    // Mesma trava de abandono do `tempoAoVivoDoMembro`: uma sessão que ficou "ativa" desde
    // anteontem não rendeu 40h de estudo, ela só nunca foi encerrada.
    const decorrido = segundosDesde(sessao.ultimo_inicio);
    if (decorrido > HORAS_ATE_ABANDONO * 3600) return acumulado;

    return acumulado + decorrido;
}

/** Segunda-feira da semana que contém `data` — a semana sempre começa na segunda. */
export function pegarSegundaDaSemana(data: Date) {
    const diaSemanaJS = data.getDay(); // 0 = domingo ... 6 = sábado
    const diasDesdeSegunda = (diaSemanaJS + 6) % 7;
    return new Date(data.getFullYear(), data.getMonth(), data.getDate() - diasDesdeSegunda);
}

function pegarSegundaDaSemanaAtual() {
    return pegarSegundaDaSemana(new Date());
}

/** Soma (ou subtrai) semanas a partir de uma segunda-feira. */
export function somarSemanas(segunda: Date, delta: number) {
    return new Date(segunda.getFullYear(), segunda.getMonth(), segunda.getDate() + delta * 7);
}

/** Soma (ou subtrai) dias, sem cair em UTC. */
export function somarDias(data: Date, delta: number) {
    return new Date(data.getFullYear(), data.getMonth(), data.getDate() + delta);
}

/** As 7 datas ISO (segunda a domingo) da semana que começa em `segunda`. */
export function pegarDatasDaSemana(segunda: Date): string[] {
    return Array.from({ length: 7 }, (_, i) => paraDataISO(somarDias(segunda, i)));
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

const LETRAS_POR_DIA_JS = ["D", "S", "T", "Q", "Q", "S", "S"]; // indexado por getDay(): 0 = domingo
const NOMES_CURTOS_POR_DIA_JS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MESES_ABREV = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/**
 * Os 7 dias da semana que começa em `inicio`, na ordem em que devem ser
 * desenhados. `diaSemana` é a convenção do banco (0 = segunda), pra converter a
 * coluna da tela de volta pro dado ao criar ou mover um bloco.
 */
export function pegarDiasDaSemana(inicio: Date) {
    return Array.from({ length: 7 }, (_, i) => {
        const dia = somarDias(inicio, i);
        return {
            letra: LETRAS_POR_DIA_JS[dia.getDay()],
            nomeCurto: NOMES_CURTOS_POR_DIA_JS[dia.getDay()],
            numero: dia.getDate(),
            dataISO: paraDataISO(dia),
            diaSemana: (dia.getDay() + 6) % 7,
        };
    });
}

/** Os 7 dias da semana atual (começando na segunda), pro cabeçalho da grade. */
export function pegarDiasDaSemanaAtual() {
    return pegarDiasDaSemana(pegarSegundaDaSemanaAtual());
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
export function formatarIntervaloSemana(inicio: Date) {
    const fim = somarDias(inicio, 6);

    if (inicio.getMonth() === fim.getMonth()) {
        return `${inicio.getDate()}–${fim.getDate()} de ${MESES_ABREV[fim.getMonth()]}`;
    }
    return `${inicio.getDate()} de ${MESES_ABREV[inicio.getMonth()]} – ${fim.getDate()} de ${MESES_ABREV[fim.getMonth()]}`;
}

export function pegarIntervaloSemanaFormatado() {
    return formatarIntervaloSemana(pegarSegundaDaSemanaAtual());
}
