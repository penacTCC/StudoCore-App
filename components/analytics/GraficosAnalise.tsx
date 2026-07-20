import { Fragment } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Svg, { Path, Line, Rect, Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { Flame, Swords, ChevronRight, User } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

// Paleta exata do mockup "HADES Analytics" — propositalmente diferente da navy
// padrão do app, pra manter fidelidade visual ao design aprovado.
// Cores que não existem na paleta tailwind do projeto entram via classes
// arbitrárias (ex.: "text-[#8a8d96]"); SVG não aceita className, então ali o
// valor precisa ir mesmo como prop/cor.
export const CORES = {
    cartao: "#0d0e12",
    bordaCartao: "rgba(255,255,255,0.06)",
    pillAtivo: "#1a1b20",
    branco: "#ffffff",
    textoSecundario: "#8a8d96",
    textoMuted: "#6b6e76",
    textoFraco: "#5f636c",
    textoClaro: "#c9ccd2",
    verde: "#30d158",
    vermelho: "#f0556b",
    chama: "#f2b03d",
    linhaGrade: "rgba(255,255,255,0.04)",
    divisor: "rgba(255,255,255,0.06)",
    barraInativa: "#2a2c33",
    barraAnterior: "#3a3d45",
    trilhaDonut: "#1a1b20",
    violeta: "#7c5cfc",
};

export type EscopoAnalise = "pessoal" | "grupo";
export type PeriodoAnalise = "7d" | "30d" | "ano";

// ── Seletor Pessoal / Grupo ──────────────────────────────────────────────
export function SeletorEscopo({
    valor,
    aoAlterar,
}: {
    valor: EscopoAnalise;
    aoAlterar: (v: EscopoAnalise) => void;
}) {
    return (
        <View className="relative flex-row rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0d0e12] p-1">
            <View
                className={`absolute bottom-1 top-1 w-1/2 rounded-[9px] bg-[#1a1b20] ${valor === "pessoal" ? "left-1" : "left-1/2"}`}
            />
            <TouchableOpacity onPress={() => aoAlterar("pessoal")} className="flex-1 items-center py-2.5">
                <Text className={`text-sm font-semibold ${valor === "pessoal" ? "text-white" : "text-[#6b6e76]"}`}>
                    Pessoal
                </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => aoAlterar("grupo")} className="flex-1 items-center py-2.5">
                <Text className={`text-sm font-semibold ${valor === "grupo" ? "text-white" : "text-[#6b6e76]"}`}>
                    Grupo
                </Text>
            </TouchableOpacity>
        </View>
    );
}

// ── Pills de período: 7 dias / 30 dias / Ano ────────────────────────────
const OPCOES_PERIODO: { chave: PeriodoAnalise; rotulo: string }[] = [
    { chave: "7d", rotulo: "7 dias" },
    { chave: "30d", rotulo: "30 dias" },
    { chave: "ano", rotulo: "Ano" },
];

export function SeletorPeriodo({
    valor,
    aoAlterar,
}: {
    valor: PeriodoAnalise;
    aoAlterar: (v: PeriodoAnalise) => void;
}) {
    return (
        <View className="flex-row gap-1.5">
            {OPCOES_PERIODO.map((opcao) => {
                const ativo = valor === opcao.chave;
                return (
                    <TouchableOpacity
                        key={opcao.chave}
                        onPress={() => aoAlterar(opcao.chave)}
                        className={`mt-3 rounded-lg px-3.5 py-1.5 ${ativo ? "bg-[#1a1b20]" : "bg-transparent"}`}
                    >
                        <Text className={`text-[13px] font-semibold ${ativo ? "text-white" : "text-[#6b6e76]"}`}>
                            {opcao.rotulo}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

// Ícone de tendência simples (evita depender de mais um import só pra um glifo).
function IconeTendenciaAlta({ cor }: { cor: string }) {
    return (
        <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
            <Path d="M23 6l-9.5 9.5-5-5L1 18" stroke={cor} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M17 6h6v6" stroke={cor} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
    );
}

// Avatar circular usado nas listas de membros (ranking e questões por membro).
function AvatarMembro({ inicial, cor }: { inicial: string | null; cor: string }) {
    return (
        <View className="h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: cor }}>
            {inicial ? (
                <Text className="text-[11px] font-semibold text-white">{inicial}</Text>
            ) : (
                <User size={13} color={CORES.textoSecundario} />
            )}
        </View>
    );
}

// ════════════════════════════════════════════════════════════════════════
// ABA PESSOAL
// ════════════════════════════════════════════════════════════════════════

// ── 1. Horas estudadas — gráfico de área ─────────────────────────────────
const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

 export function GraficoArea({ cor }: { cor: string }) {
    return (
        <View>
            <View className="mb-3.5 flex-row items-end justify-between">
                <View>
                    <Text className="text-[13px] font-medium text-[#8a8d96]">Horas estudadas</Text>
                    <View className="mt-1 flex-row items-baseline gap-1.5">
                        <Text className="text-[30px] font-bold tracking-[-0.7px] text-white">28h 42m</Text>
                    </View>
                    <View className="mt-1 flex-row items-center gap-1.5">
                        <IconeTendenciaAlta cor={CORES.verde} />
                        <Text className="text-xs font-semibold text-[#30d158]">+12%</Text>
                        <Text className="text-xs text-[#6b6e76]">vs semana passada</Text>
                    </View>
                </View>
            </View>

            <Svg width="100%" height={130} viewBox="0 0 320 130">
                <Defs>
                    <LinearGradient id="gradienteAreaPessoal" x1="0" x2="0" y1="0" y2="1">
                        <Stop offset="0%" stopColor={cor} stopOpacity={0.35} />
                        <Stop offset="100%" stopColor={cor} stopOpacity={0} />
                    </LinearGradient>
                </Defs>
                <Line x1="0" y1="40" x2="320" y2="40" stroke={CORES.linhaGrade} strokeDasharray="2 4" />
                <Line x1="0" y1="80" x2="320" y2="80" stroke={CORES.linhaGrade} strokeDasharray="2 4" />
                <Path d="M 0 95 L 53 78 L 107 86 L 160 55 L 213 62 L 267 38 L 320 25 L 320 130 L 0 130 Z" fill="url(#gradienteAreaPessoal)" />
                <Path
                    d="M 0 95 L 53 78 L 107 86 L 160 55 L 213 62 L 267 38 L 320 25"
                    fill="none"
                    stroke={cor}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <Circle cx={320} cy={25} r={4} fill="#000" stroke={cor} strokeWidth={2.5} />
            </Svg>
            <View className="mt-2 flex-row justify-between px-0.5">
                {DIAS_SEMANA.map((dia, i) => (
                    <Text
                        key={dia}
                        className={i === DIAS_SEMANA.length - 1 ? "text-[11px] font-semibold text-white" : "text-[11px] text-[#5f636c]"}
                    >
                        {dia}
                    </Text>
                ))}
            </View>
        </View>
    );
}

// ── 2. Cards pequenos: sessão média / nº sessões ─────────────────────────
export function CartaoMetrica({
    icone: Icone,
    rotulo,
    valor,
    legenda,
}: {
    icone: LucideIcon;
    rotulo: string;
    valor: string;
    legenda: string;
}) {
    return (
        <View className="flex-1 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#0d0e12] p-3.5">
            <View className="flex-row items-center gap-1.5">
                <Icone size={13} color={CORES.textoSecundario} />
                <Text className="text-[11px] font-semibold tracking-[0.5px] text-[#8a8d96]">{rotulo}</Text>
            </View>
            <Text className="mt-2 text-2xl font-bold tracking-[-0.5px] text-white">{valor}</Text>
            <Text className="mt-0.5 text-[11px] text-[#5f636c]">{legenda}</Text>
        </View>
    );
}

// ── 3. Esta semana vs. anterior — barras pareadas ────────────────────────
const PARES_SEMANA = [
    { atual: 65, anterior: 47 },
    { atual: 77, anterior: 57 },
    { atual: 53, anterior: 70 },
    { atual: 95, anterior: 65 },
    { atual: 75, anterior: 40 },
    { atual: 103, anterior: 77 },
    { atual: 113, anterior: 85 },
];
const INICIAIS_DIAS = ["D", "S", "T", "Q", "Q", "S", "S"];

export function GraficoComparativoSemanal({ cor }: { cor: string }) {
    return (
        <View>
            <Text className="mb-3.5 text-base font-bold tracking-[-0.2px] text-white">Esta semana vs. anterior</Text>
            <View className="mb-3 flex-row items-center gap-4">
                <View className="flex-row items-center gap-1.5">
                    <View className="h-2 w-2 rounded-sm" style={{ backgroundColor: cor }} />
                    <Text className="text-xs text-[#c9ccd2]">Atual</Text>
                </View>
                <View className="flex-row items-center gap-1.5">
                    <View className="h-2 w-2 rounded-sm bg-[#3a3d45]" />
                    <Text className="text-xs text-[#8a8d96]">Anterior</Text>
                </View>
            </View>
            <Svg width="100%" height={130} viewBox="0 0 320 130">
                <Line x1="0" y1="125" x2="320" y2="125" stroke={CORES.divisor} />
                {PARES_SEMANA.map((par, i) => {
                    const baseX = 11 + i * 45;
                    return (
                        <Fragment key={i}>
                            <Rect x={baseX} y={125 - par.atual} width={9} height={par.atual} rx={2} fill={cor} />
                            <Rect x={baseX + 12} y={125 - par.anterior} width={9} height={par.anterior} rx={2} fill={CORES.barraAnterior} />
                        </Fragment>
                    );
                })}
            </Svg>
            <View className="mt-1.5 flex-row justify-between px-3">
                {INICIAIS_DIAS.map((d, i) => (
                    <Text key={i} className="text-[11px] text-[#5f636c]">{d}</Text>
                ))}
            </View>
        </View>
    );
}

// ── 4. Distribuição por matéria — donut + legenda ────────────────────────
type Materia = { rotulo: string; pct: number; cor: string };
const MATERIAS: Materia[] = [
    { rotulo: "Matemática", pct: 38, cor: "#3b82f6" },
    { rotulo: "Física", pct: 24, cor: CORES.violeta },
    { rotulo: "Química", pct: 20, cor: CORES.vermelho },
    { rotulo: "Biologia", pct: 18, cor: CORES.verde },
];

function segmentosDonut(materias: Materia[], raio: number) {
    const circunferencia = 2 * Math.PI * raio;
    let acumulado = 0;
    return materias.map((m) => {
        const dash = (m.pct / 100) * circunferencia;
        const offset = -acumulado;
        acumulado += dash;
        return { ...m, dash, offset, circunferencia };
    });
}

export function GraficoDonutMaterias() {
    const raio = 45;
    const segmentos = segmentosDonut(MATERIAS, raio);
    return (
        <View>
            <Text className="mb-3.5 text-base font-bold tracking-[-0.2px] text-white">Distribuição por matéria</Text>
            <View className="flex-row items-center gap-[18px]">
                <View className="h-[120px] w-[120px]">
                    <Svg width={120} height={120} viewBox="0 0 120 120">
                        <Circle cx={60} cy={60} r={raio} fill="none" stroke={CORES.trilhaDonut} strokeWidth={16} />
                        {segmentos.map((s) => (
                            <Circle
                                key={s.rotulo}
                                cx={60}
                                cy={60}
                                r={raio}
                                fill="none"
                                stroke={s.cor}
                                strokeWidth={16}
                                strokeDasharray={`${s.dash} ${s.circunferencia}`}
                                strokeDashoffset={s.offset}
                                rotation={-90}
                                origin="60, 60"
                            />
                        ))}
                    </Svg>
                    <View className="absolute left-0 top-0 h-[120px] w-[120px] items-center justify-center">
                        <Text className="text-lg font-bold text-white">{MATERIAS.length}</Text>
                        <Text className="mt-0.5 text-[9px] font-semibold tracking-[0.5px] text-[#6b6e76]">MATÉRIAS</Text>
                    </View>
                </View>
                <View className="flex-1 gap-2.5">
                    {MATERIAS.map((m) => (
                        <View key={m.rotulo} className="flex-row items-center justify-between">
                            <View className="flex-row items-center gap-2">
                                <View className="h-2 w-2 rounded-sm" style={{ backgroundColor: m.cor }} />
                                <Text className="text-[13px] font-medium text-[#c9ccd2]">{m.rotulo}</Text>
                            </View>
                            <Text className="text-[13px] font-semibold text-white">{m.pct}%</Text>
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
}

// ── 5. Taxa de acerto — barra dividida ───────────────────────────────────
export function BarraTaxaAcerto() {
    const acerto = 73;
    const erro = 27;
    return (
        <View>
            <View className="mb-2.5 flex-row items-center justify-between">
                <Text className="text-base font-bold tracking-[-0.2px] text-white">Taxa de acerto</Text>
                <Text className="text-[13px] text-[#6b6e76]">1.842 questões</Text>
            </View>
            <View className="mb-3 flex-row items-baseline gap-2">
                <Text className="text-[30px] font-bold tracking-[-0.7px] text-white">{acerto}%</Text>
                <Text className="text-[13px] text-[#6b6e76]">de acerto</Text>
            </View>
            <View className="h-2.5 flex-row gap-[3px] overflow-hidden rounded-[5px]">
                <View className="h-full rounded-[5px] bg-[#30d158]" style={{ width: `${acerto}%` }} />
                <View className="h-full rounded-[5px] bg-[#f0556b] opacity-70" style={{ width: `${erro}%` }} />
            </View>
            <View className="mt-2.5 flex-row justify-between">
                <View className="flex-row items-center gap-1.5">
                    <View className="h-2 w-2 rounded-sm bg-[#30d158]" />
                    <Text className="text-xs text-[#c9ccd2]">Acertos</Text>
                    <Text className="text-xs text-[#6b6e76]">1.345</Text>
                </View>
                <View className="flex-row items-center gap-1.5">
                    <Text className="text-xs text-[#6b6e76]">497</Text>
                    <Text className="text-xs text-[#c9ccd2]">Erros</Text>
                    <View className="h-2 w-2 rounded-sm bg-[#f0556b]" />
                </View>
            </View>
        </View>
    );
}

// ── 6. Quando você mais estuda — barras por dia da semana ────────────────
const BARRAS_DIA_SEMANA = [
    { rotulo: "Dom", altura: 50 },
    { rotulo: "Seg", altura: 70 },
    { rotulo: "Ter", altura: 78 },
    { rotulo: "Qua", altura: 62 },
    { rotulo: "Qui", altura: 85 },
    { rotulo: "Sex", altura: 102 },
    { rotulo: "Sáb", altura: 55 },
];
const INDICE_MELHOR_DIA = 5;

export function GraficoDiaSemana({ cor }: { cor: string }) {
    return (
        <View>
            <Text className="mb-1.5 text-base font-bold tracking-[-0.2px] text-white">Quando você mais estuda</Text>
            <Text className="mb-3.5 text-[13px] text-[#6b6e76]">
                <Text className="font-semibold" style={{ color: cor }}>Sexta</Text> é seu melhor dia
            </Text>
            <Svg width="100%" height={110} viewBox="0 0 320 110">
                {BARRAS_DIA_SEMANA.map((dia, i) => (
                    <Rect
                        key={dia.rotulo}
                        x={6 + i * 44}
                        y={110 - dia.altura}
                        width={28}
                        height={dia.altura}
                        rx={4}
                        fill={i === INDICE_MELHOR_DIA ? cor : CORES.barraInativa}
                    />
                ))}
            </Svg>
            <View className="mt-1.5 flex-row justify-between">
                {BARRAS_DIA_SEMANA.map((dia, i) => (
                    <Text
                        key={dia.rotulo}
                        className={`w-[34px] text-center text-[11px] ${i === INDICE_MELHOR_DIA ? "font-semibold text-white" : "text-[#6b6e76]"}`}
                    >
                        {dia.rotulo}
                    </Text>
                ))}
            </View>
        </View>
    );
}

// ── 7. Evolução da ofensiva ───────────────────────────────────────────────
export function GraficoOfensiva() {
    return (
        <View>
            <Text className="mb-2.5 text-base font-bold tracking-[-0.2px] text-white">Evolução da ofensiva</Text>
            <View className="mb-3.5 flex-row items-baseline gap-2">
                <Flame size={20} color={CORES.chama} />
                <Text className="text-[30px] font-bold tracking-[-0.7px] text-white">12</Text>
                <Text className="text-[13px] text-[#6b6e76]">dias seguidos</Text>
                <Text className="ml-auto text-[13px] text-[#6b6e76]">
                    recorde: <Text className="font-semibold text-white">47</Text>
                </Text>
            </View>
            <Svg width="100%" height={90} viewBox="0 0 320 90">
                <Line x1="0" y1="30" x2="320" y2="30" stroke={CORES.linhaGrade} strokeDasharray="2 4" />
                <Line x1="0" y1="60" x2="320" y2="60" stroke={CORES.linhaGrade} strokeDasharray="2 4" />
                <Path
                    d="M 0 78 L 27 72 L 53 75 L 80 60 L 107 65 L 133 50 L 160 55 L 187 40 L 213 45 L 240 30 L 267 22 L 293 18 L 320 12"
                    fill="none"
                    stroke={CORES.chama}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <Circle cx={320} cy={12} r={4} fill="#000" stroke={CORES.chama} strokeWidth={2.5} />
            </Svg>
            <View className="mt-2 flex-row justify-between">
                <Text className="text-[11px] text-[#5f636c]">12 sem atrás</Text>
                <Text className="text-[11px] text-[#5f636c]">Hoje</Text>
            </View>
        </View>
    );
}

// ════════════════════════════════════════════════════════════════════════
// ABA GRUPO
// ════════════════════════════════════════════════════════════════════════

// ── G1. Cabeçalho do grupo ─────────────────────────────────────────────
export function CabecalhoGrupo({ cor }: { cor: string }) {
    return (
        <View className="flex-row items-center gap-3 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#0d0e12] p-3.5">
            <View className="h-[42px] w-[42px] items-center justify-center rounded-xl bg-[#13192c]">
                <Swords size={22} color={cor} />
            </View>
            <View className="flex-1">
                <Text className="text-[15px] font-bold text-white">HADES</Text>
                <Text className="mt-0.5 text-xs text-[#6b6e76]">5 membros · criado há 3 meses</Text>
            </View>
            <ChevronRight size={18} color={CORES.textoMuted} />
        </View>
    );
}

// ── G2. Meta semanal do grupo ──────────────────────────────────────────
export function MetaSemanalGrupo() {
    return (
        <View>
            <View className="mb-1.5 flex-row items-baseline justify-between">
                <Text className="text-base font-bold tracking-[-0.2px] text-white">Meta semanal</Text>
                <Text className="text-[13px] font-semibold text-[#30d158]">100%</Text>
            </View>
            <View className="mb-3 flex-row items-baseline gap-2">
                <Text className="text-[30px] font-bold tracking-[-0.7px] text-white">142h</Text>
                <Text className="text-[13px] text-[#6b6e76]">/ 120h</Text>
           </View>
            <View className="h-2 overflow-hidden rounded-full bg-[#1a1b20]">
                <View className="h-full w-full rounded-full bg-[#30d158]" />
            </View>
            <View className="mt-1.5 flex-row justify-between">
                <Text className="text-[11px] text-[#5f636c]"></Text>
                <Text className="text-[11px] text-[#5f636c]">120</Text>
            </View>
        </View>
    );
}

// ── G3. Ranking de horas do grupo ──────────────────────────────────────
type MembroRanking = { nome: string; horas: string; inicial: string | null; corAvatar: string; pctBarra: number; destaque?: boolean };
const RANKING_HORAS: MembroRanking[] = [
    { nome: "penac", horas: "62h 14m", inicial: "P", corAvatar: "#1f9aa8", pctBarra: 100, destaque: true },
    { nome: "NatVM", horas: "38h 02m", inicial: "N", corAvatar: "#1f9d63", pctBarra: 61 },
    { nome: "natDefault", horas: "24h 48m", inicial: null, corAvatar: "#2a2c33", pctBarra: 40 },
    { nome: "toulhe", horas: "12h 21m", inicial: "T", corAvatar: CORES.violeta, pctBarra: 20 },
    { nome: "h", horas: "4h 35m", inicial: "H", corAvatar: "#e08a1e", pctBarra: 7 },
];

export function RankingHorasGrupo({ cor }: { cor: string }) {
    return (
        <View>
            <View className="mb-3.5 flex-row items-center justify-between">
                <Text className="text-base font-bold tracking-[-0.2px] text-white">Ranking de horas</Text>
                <Text className="text-[13px] text-[#6b6e76]">esta semana</Text>
            </View>
            <View className="gap-3.5 mb-6">
                {RANKING_HORAS.map((membro) => (
                    <View key={membro.nome}>
                        <View className="mb-1.5 flex-row items-center justify-between">
                            <View className="flex-row items-center gap-2.5">
                                <AvatarMembro inicial={membro.inicial} cor={membro.corAvatar} />
                                <Text className="text-[13px] font-semibold text-white">{membro.nome}</Text>
                            </View>
                            <Text className={`text-[13px] font-semibold ${membro.destaque ? "text-white" : "text-[#c9ccd2]"}`}>
                                {membro.horas}
                            </Text>
                        </View>
                        <View className="h-1.5 rounded-sm bg-[#1a1b20]">
                            <View
                                className="h-full rounded-sm"
                                style={{ width: `${membro.pctBarra}%`, backgroundColor: membro.destaque ? cor : CORES.barraAnterior }}
                            />
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
}

// ── G4 (esquerda). Matéria mais estudada pelo grupo ────────────────────
const MATERIAS_GRUPO: Materia[] = [
    { rotulo: "Matemática", pct: 42, cor: "#3b82f6" },
    { rotulo: "Física", pct: 22, cor: CORES.violeta },
    { rotulo: "Química", pct: 20, cor: CORES.vermelho },
    { rotulo: "Biologia", pct: 16, cor: CORES.verde },
];

export function MateriaMaisEstudadaGrupo() {
    const raio = 36;
    const segmentos = segmentosDonut(MATERIAS_GRUPO, raio);
    return (
        <View className="flex-1 justify-between rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#0d0e12] p-3.5">
            <Text className="text-[11px] font-semibold tracking-[0.5px] text-[#8a8d96]">MAIS ESTUDADA</Text>
            <View className="my-2.5 h-[84px] w-[84px] self-start">
                <Svg width={84} height={84} viewBox="0 0 100 100">
                    <Circle cx={50} cy={50} r={raio} fill="none" stroke={CORES.trilhaDonut} strokeWidth={14} />
                    {segmentos.map((s) => (
                        <Circle
                            key={s.rotulo}
                            cx={50}
                            cy={50}
                            r={raio}
                            fill="none"
                            stroke={s.cor}
                            strokeWidth={14}
                            strokeDasharray={`${s.dash} ${s.circunferencia}`}
                            strokeDashoffset={s.offset}
                            rotation={-90}
                            origin="50, 50"
                        />
                    ))}
                </Svg>
            </View>
            <View>
                <Text className="text-[15px] font-bold text-white">Matemática</Text>
                <Text className="mt-0.5 text-xs text-[#6b6e76]">42% das horas</Text>
            </View>
        </View>
    );
}

// ── G4 (direita). Membros ativos ───────────────────────────────────────
export function MembrosAtivosGrupo({ cor }: { cor: string }) {
    const raio = 24;
    const circunferencia = 2 * Math.PI * raio;
    const pct = 0.8;
    return (
        <View className="flex-1 justify-between rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#0d0e12] p-3.5">
            <Text className="text-[11px] font-semibold tracking-[0.5px] text-[#8a8d96]">MEMBROS ATIVOS</Text>
            <View className="my-2.5 flex-row items-center gap-3">
                <View className="h-14 w-14">
                    <Svg width={56} height={56} viewBox="0 0 60 60">
                        <Circle cx={30} cy={30} r={raio} fill="none" stroke={CORES.trilhaDonut} strokeWidth={8} />
                        <Circle
                            cx={30}
                            cy={30}
                            r={raio}
                            fill="none"
                            stroke={cor}
                            strokeWidth={8}
                            strokeDasharray={`${circunferencia * pct} ${circunferencia}`}
                            strokeLinecap="round"
                            rotation={-90}
                            origin="30, 30"
                        />
                    </Svg>
                </View>
                <View>
                    <Text className="text-2xl font-bold tracking-[-0.5px] text-white">4/5</Text>
                    <Text className="mt-1 text-[11px] text-[#6b6e76]">80% ativos</Text>
                </View>
            </View>
            <Text className="text-xs text-[#6b6e76]">1 sem atividade</Text>
        </View>
    );
}

// ── G5. Evolução de horas do grupo ──────────────────────────────────────
export function EvolucaoGrupo({ cor }: { cor: string }) {
    return (
        <View>
            <Text className="mb-1.5 text-base font-bold tracking-[-0.2px] text-white">Evolução do grupo</Text>
            <View className="mb-3.5 flex-row items-baseline gap-2">
                <Text className="text-[30px] font-bold tracking-[-0.7px] text-white">142h</Text>
                <Text className="text-[13px] text-[#6b6e76]">esta semana</Text>
                <View className="ml-auto flex-row items-center gap-1">
                    <IconeTendenciaAlta cor={CORES.verde} />
                    <Text className="text-xs font-semibold text-[#30d158]">+18%</Text>
                </View>
            </View>
            <Svg width="100%" height={110} viewBox="0 0 320 110">
                <Defs>
                    <LinearGradient id="gradienteAreaGrupo" x1="0" x2="0" y1="0" y2="1">
                        <Stop offset="0%" stopColor={cor} stopOpacity={0.3} />
                        <Stop offset="100%" stopColor={cor} stopOpacity={0} />
                    </LinearGradient>
                </Defs>
                <Line x1="0" y1="35" x2="320" y2="35" stroke={CORES.linhaGrade} strokeDasharray="2 4" />
                <Line x1="0" y1="70" x2="320" y2="70" stroke={CORES.linhaGrade} strokeDasharray="2 4" />
                <Path d="M 0 78 L 53 70 L 107 82 L 160 55 L 213 48 L 267 35 L 320 18 L 320 110 L 0 110 Z" fill="url(#gradienteAreaGrupo)" />
                <Path
                    d="M 0 78 L 53 70 L 107 82 L 160 55 L 213 48 L 267 35 L 320 18"
                    fill="none"
                    stroke={cor}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <Circle cx={320} cy={18} r={4} fill="#000" stroke={cor} strokeWidth={2.5} />
            </Svg>
            <View className="mt-1.5 flex-row justify-between">
                <Text className="text-[11px] text-[#5f636c]">7 sem atrás</Text>
                <Text className="text-[11px] text-[#5f636c]">esta sem</Text>
            </View>
        </View>
    );
}

// ── G6. Questões por membro ──────────────────────────────────────────────
type MembroQuestoes = { nome: string; inicial: string | null; corAvatar: string; total: string; pctAcerto: number };
const QUESTOES_POR_MEMBRO: MembroQuestoes[] = [
    { nome: "penac", inicial: "P", corAvatar: "#1f9aa8", total: "1.842", pctAcerto: 73 },
    { nome: "NatVM", inicial: "N", corAvatar: "#1f9d63", total: "1.204", pctAcerto: 81 },
    { nome: "natDefault", inicial: null, corAvatar: "#2a2c33", total: "782", pctAcerto: 64 },
    { nome: "toulhe", inicial: "T", corAvatar: CORES.violeta, total: "418", pctAcerto: 58 },
    { nome: "h", inicial: "H", corAvatar: "#e08a1e", total: "96", pctAcerto: 51 },
];

export function QuestoesPorMembroGrupo() {
    return (
        <View className="mb-3 mt-5">
            <Text className="mb-1.5 text-base font-bold tracking-[-0.2px] text-white">Questões por membro</Text>
            <View className="mb-3.5 flex-row items-center gap-4">
                <View className="flex-row items-center gap-1.5">
                    <View className="h-2 w-2 rounded-sm bg-[#30d158]" />
                    <Text className="text-xs text-[#c9ccd2]">Acertos</Text>
                </View>
                <View className="flex-row items-center gap-1.5">
                    <View className="h-2 w-2 rounded-sm bg-[#f0556b] opacity-75" />
                    <Text className="text-xs text-[#c9ccd2]">Erros</Text>
                </View>
            </View>
            <View className="gap-3">
                {QUESTOES_POR_MEMBRO.map((membro) => (
                    <View key={membro.nome}>
                        <View className="mb-1.5 flex-row items-center justify-between">
                            <View className="flex-row items-center gap-2.5">
                                <AvatarMembro inicial={membro.inicial} cor={membro.corAvatar} />
                                <Text className="text-[13px] font-semibold text-white">{membro.nome}</Text>
                            </View>
                            <View className="flex-row items-baseline gap-1">
                                <Text className="text-[13px] font-semibold text-white">{membro.total}</Text>
                                <Text className="text-[11px] text-[#6b6e76]">· {membro.pctAcerto}%</Text>
                            </View>
                        </View>
                        <View className="h-2 flex-row gap-0.5 overflow-hidden rounded-sm bg-[#1a1b20]">
                            <View className="h-full bg-[#30d158]" style={{ width: `${membro.pctAcerto}%` }} />
                            <View className="h-full bg-[#f0556b] opacity-75" style={{ width: `${100 - membro.pctAcerto}%` }} />
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
}
