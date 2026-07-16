/**
 * Dados de exemplo das telas de cronograma.
 *
 * Provisório: existe só para as telas renderizarem antes do backend
 * (`services/cronograma.ts` + tabelas `planos`/`planos_blocos`/`planos_agenda`).
 */
import { HADES } from "@/constants/hades";
import type { BlocoDoDia, BlocoSemana, Plano } from "@/types/cronograma";

export const blocosDeHoje: BlocoDoDia[] = [
    {
        id: "1",
        horaInicio: "08:00",
        duracaoMin: 60,
        tipo: "estudo",
        materia: "Matemática",
        topico: "Funções",
        notificar: true,
        status: "cumprido",
    },
    {
        id: "2",
        horaInicio: "09:15",
        duracaoMin: 45,
        tipo: "estudo",
        materia: "Química",
        topico: "Estequiometria",
        notificar: true,
        status: "parcial",
    },
    {
        id: "3",
        horaInicio: "10:00",
        duracaoMin: 15,
        tipo: "descanso",
        notificar: false,
        status: "cumprido",
    },
    {
        id: "4",
        horaInicio: "10:15",
        duracaoMin: 60,
        tipo: "estudo",
        materia: "Biologia",
        topico: "Genética",
        notificar: true,
        status: "agora",
        progresso: 63,
        restanteMin: 22,
    },
    {
        id: "5",
        horaInicio: "11:00",
        duracaoMin: 80,
        tipo: "estudo",
        materia: "Física",
        topico: "Cinemática",
        notificar: true,
        status: "futuro",
    },
    {
        id: "6",
        horaInicio: "14:30",
        duracaoMin: 40,
        tipo: "estudo",
        materia: "Redação",
        topico: "Dissertação",
        notificar: false,
        status: "futuro",
    },
];

export const resumoHoje = {
    planejado: "5h20",
    concluido: "2h10",
    proximo: { materia: "Física", hora: "11h" },
};

export const planosSalvos: Plano[] = [
    {
        id: "p1",
        nome: "Reta final ENEM",
        cor: HADES.blue,
        qtdBlocos: 6,
        duracaoTotal: "5h20",
        agenda: { tipo: "fixado", dias: ["Seg", "Qua", "Sex"] },
    },
    {
        id: "p2",
        nome: "Exatas pesado",
        cor: HADES.green,
        qtdBlocos: 8,
        duracaoTotal: "6h40",
        agenda: { tipo: "data", data: "22 jul" },
    },
    {
        id: "p3",
        nome: "Revisão leve",
        cor: HADES.amber,
        qtdBlocos: 4,
        duracaoTotal: "2h30",
        agenda: { tipo: "nenhuma" },
    },
    {
        id: "p4",
        nome: "Humanas foco",
        cor: HADES.violet,
        qtdBlocos: 5,
        duracaoTotal: "4h00",
        agenda: { tipo: "fixado", dias: ["Ter", "Qui"] },
    },
];

/** A grade da semana começa às 8h; `inicioMin` é o offset a partir daí. */
export const GRADE_INICIO_HORA = 8;
export const GRADE_MIN_POR_PX = 3; // 140px = 3h

export const blocosDaSemana: BlocoSemana[] = [
    { id: "s1", dia: 0, inicioMin: 0, duracaoMin: 264, rotulo: "Mat", cor: HADES.blue },
    { id: "s2", dia: 0, inicioMin: 570, duracaoMin: 180, rotulo: "Fís", cor: HADES.violet },
    { id: "s3", dia: 1, inicioMin: 141, duracaoMin: 210, rotulo: "Bio", cor: HADES.green },
    { id: "s4", dia: 2, inicioMin: 0, duracaoMin: 141, rotulo: "Mat", cor: HADES.blue },
    { id: "s5", dia: 2, inicioMin: 315, duracaoMin: 141, rotulo: "Bio", cor: HADES.green },
    { id: "s6", dia: 2, inicioMin: 420, duracaoMin: 186, rotulo: "Fís", cor: HADES.violet },
    { id: "s7", dia: 3, inicioMin: 60, duracaoMin: 240, rotulo: "Quí", cor: HADES.red },
    { id: "s8", dia: 4, inicioMin: 0, duracaoMin: 180, rotulo: "Mat", cor: HADES.blue },
    { id: "s9", dia: 4, inicioMin: 840, duracaoMin: 210, rotulo: "Bio", cor: HADES.green },
    { id: "s10", dia: 5, inicioMin: 420, duracaoMin: 360, rotulo: "Simulado", cor: HADES.violet },
];

export const diasDaSemanaGrade = [
    { letra: "S", numero: 14 },
    { letra: "T", numero: 15 },
    { letra: "Q", numero: 16 },
    { letra: "Q", numero: 17 },
    { letra: "S", numero: 18 },
    { letra: "S", numero: 19 },
    { letra: "D", numero: 20 },
];

export const resumoSemana = { planejado: "18h", realizado: "11h30", intervalo: "14–20 de julho" };

/** Blocos abertos no editor de plano. */
export const blocosDoEditor = [
    {
        id: "e1",
        horaInicio: "08:00",
        duracaoMin: 60,
        tipo: "estudo" as const,
        materia: "Matemática",
        topico: "Funções",
        notificar: true,
    },
    {
        id: "e2",
        horaInicio: "08:45",
        duracaoMin: 45,
        tipo: "estudo" as const,
        materia: "Química",
        topico: "Estequiometria",
        notificar: false,
        sobrepoeMin: 15,
    },
    {
        id: "e3",
        horaInicio: "09:30",
        duracaoMin: 15,
        tipo: "descanso" as const,
        notificar: false,
    },
    {
        id: "e4",
        horaInicio: "09:45",
        duracaoMin: 60,
        tipo: "estudo" as const,
        materia: "Biologia",
        topico: "Genética",
        notificar: true,
    },
];
