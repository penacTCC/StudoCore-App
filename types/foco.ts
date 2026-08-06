export type ModoFoco = "cronometro" | "pomodoro";

/** Fase do pomodoro. O cronômetro usa sempre "foco". */
export type FaseFoco = "foco" | "descansoCurto" | "descansoLongo";

export type FocusState = "config" | "active";

export type PresetPomodoro = {
    id: string;
    nome: string;
    focoMin: number;
    descansoMin: number;
};

export type ConfigPomodoro = {
    focoMin: number;
    descansoCurtoMin: number;
    descansoLongoMin: number;
    ciclosAteLongo: number;
    /** Quantos pomodoros de foco a sessão faz antes de encerrar sozinha. */
    qtdPomodoros: number;
};

/** Contexto de um bloco do cronograma que originou a sessão. */
export type ContextoBloco = {
    blocoId: string;
    origem: "rotina" | "plano";
    materia: string;
    topico: string;
    fimEm: string; // "10h"
    /** Presente quando origem === "plano" — usado pra buscar os demais blocos do dia
     *  desse plano e encadear a sessão por eles (ver ItemFila). */
    planoId?: string;
};

/**
 * Um item da fila de execução de uma sessão pomodoro: pode ser um pomodoro solo
 * (sequência gerada por `utils/pomodoroSequence.ts`) ou um bloco de plano/rotina
 * (vindo de `resolverAgendaDoDia`). `focus.tsx` avança pela fila sozinho, item a item,
 * e só encerra a sessão quando ela se esgota.
 */
export type ItemFila = {
    tipo: "estudo" | "descanso";
    duracaoMin: number;
    materiaId?: string;
    materiaNome?: string;
    topico?: string;
    blocoPlanoId?: string;
    ehLongo?: boolean;
};

/**
 * Retrato completo de uma sessão de foco em andamento, gravado no aparelho a cada mudança
 * relevante (ver services/armazenamentoOffline.ts). É o que permite reconstruir a sessão
 * exatamente como estava depois do app ser fechado — inclusive no meio de um pomodoro ou
 * de um plano com várias matérias.
 */
export type SnapshotSessaoFoco = {
    subject: string;
    content: string;
    isPublic: boolean;
    groupId: string | null;
    modo: ModoFoco;
    /** Início do cronômetro (relógio de parede), em ms. */
    inicioMs: number;
    /** Linha em `sessoes_foco` que esta sessão está preenchendo. */
    sessaoId: string | null;
    /** Sala do encontro (`salas_foco`) — separada da linha de estudo acima. */
    salaId: string | null;
    /** `true` quando entramos na sala aberta por outra pessoa. */
    ehConvidado: boolean;
    fila: ItemFila[];
    indiceFila: number;
    fase: FaseFoco;
    /** Início da fase atual, em ms — é dele que sai o tempo restante ao reabrir. */
    faseInicioMs: number | null;
    faseDuracaoSeg: number;
    /** Foco já contabilizado nos itens anteriores da fila. */
    focoAcumuladoSeg: number;
    execucaoId: string | null;
    contexto: ContextoBloco | null;
    pausado: boolean;
    /** Cronômetro: segundos decorridos na pausa. Pomodoro: restante da fase. */
    pausadoSeg: number;
    /** Instante em que a pausa começou — o tempo parado não pode virar tempo estudado
     *  quando a sessão é retomada depois de o app passar horas fechado. */
    pausadaEmMs: number | null;
};
