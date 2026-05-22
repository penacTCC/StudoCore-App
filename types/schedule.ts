export type ScheduleBlockData = {
    id: string;
    disciplina: string;
    topico: string;
    duracao: number; // em horas: 1 | 2 | 3 | 4
    cor: string;
};

export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type ScheduleState = {
    [day: number]: ScheduleBlockData[];
};