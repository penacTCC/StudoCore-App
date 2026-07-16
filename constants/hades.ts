/**
 * Tokens do redesign HADES.
 *
 * Convivem com `COLORS` (paleta navy) enquanto as telas migram uma a uma.
 * Só as telas de cronograma usam estes valores hoje.
 */
export const HADES = {
    // Superfícies
    bg: "#000000",
    surface: "#0d0e12",
    surfaceRaised: "#131418",
    surfaceOverlay: "#1a1b20",

    // Superfícies da tela de configurações (o design usa um azulado próprio aqui)
    settingsBg: "#0a0d16",
    settingsCard: "#121726",
    settingsInset: "#0a0d16",
    settingsSwitchOff: "#232a3d",
    settingsTextMuted: "#6b7488",
    settingsTextSecondary: "#8a94a8",
    settingsChevron: "#4a5266",

    // Bordas
    border: "rgba(255,255,255,0.06)",
    borderStrong: "rgba(255,255,255,0.09)",
    borderDashed: "rgba(255,255,255,0.12)",
    borderSettings: "rgba(255,255,255,0.05)",

    // Texto
    text: "#ffffff",
    textSecondary: "#c9ccd2",
    textMuted: "#8a8d96",
    textFaint: "#6b6e76",
    textDim: "#5f636c",
    grip: "#4a4d55",
    trackOff: "#2a2c33",
    dot: "#3a3d45",

    // Marca
    accent: "#ff7a2f",
    accentSolid: "#FF9A00",
    accentText: "#e8b58a",
    accentTint: "rgba(255,122,47,0.10)",
    accentTintBorder: "rgba(255,122,47,0.22)",
    accentGlow: "rgba(255,122,47,0.20)",

    // Semântico
    green: "#30d158",
    greenTint: "rgba(48,209,88,0.12)",
    amber: "#f2b03d",
    amberTint: "rgba(242,176,61,0.10)",
    amberBorder: "rgba(242,176,61,0.45)",
    red: "#f0556b",

    // Cores de matéria usadas no design
    blue: "#3b82f6",
    violet: "#7c5cfc",

    // Perfil
    modalBg: "#141519",
    tintAccent: "#261700", // accent a 15% sobre preto
    subjectBlue: "#4d94ff",
    groupViolet: "#a274ff",
    groupVioletTint: "rgba(124,92,252,0.14)",
} as const;

/**
 * Escala do heatmap, do dia vazio ao mais intenso.
 * O design usa `color-mix()` sobre a cor de marca; como o React Native não
 * suporta essa função, os valores já vêm resolvidos aqui.
 */
export const HEATMAP_ESCALA = [
    "#16171c", // 0h
    "#54360a", // até 2h   (accent 30%)
    "#a26405", // 2h–5h    (accent 62%)
    "#ff9a00", // +5h
] as const;

/** Paleta de cores atribuíveis a um plano ou matéria. */
export const CORES_PLANO = [
    HADES.blue,
    HADES.green,
    HADES.amber,
    HADES.violet,
    HADES.red,
] as const;
