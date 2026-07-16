import type { ConfigPomodoro, PresetPomodoro } from "@/types/foco";

export const PRESETS_POMODORO: PresetPomodoro[] = [
    { id: "classico", nome: "Clássico", focoMin: 25, descansoMin: 5 },
    { id: "longo", nome: "Longo", focoMin: 50, descansoMin: 10 },
    { id: "ultra", nome: "Ultra", focoMin: 90, descansoMin: 20 },
];

export const CONFIG_POMODORO_PADRAO: ConfigPomodoro = {
    focoMin: 25,
    descansoCurtoMin: 5,
    descansoLongoMin: 15,
    ciclosAteLongo: 4,
};

/** Cores dos avatares de colegas na sessão pública. */
export const CORES_AVATAR = ["#1f9d63", "#7c5cfc", "#e08a1e", "#3b82f6", "#f0556b"];
