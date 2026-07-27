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
};

/** Contexto de um bloco do cronograma que originou a sessão. */
export type ContextoBloco = {
    blocoId: string;
    materia: string;
    topico: string;
    fimEm: string; // "10h"
};
