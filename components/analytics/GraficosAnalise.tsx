import { Fragment, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import Svg, { Path, Line, Rect, Circle, Defs, LinearGradient, Stop, Text as SvgText } from "react-native-svg";
import { Flame, Swords, ChevronRight, ChevronDown, User, Users } from "@/components/ui/icons";
import type { IconeComponente } from "@/components/ui/icons";
import { DIAS_SEMANA_ABREV, NOME_COMPLETO_DIA, formatarHoras } from "@/lib/analytics";
import { AderenciaMateria, DesempenhoMateria, membrosRankingAnalytics, ParDiaSemana, ParPlanejadoRealizado, PontoSerieDia, ResumoAderencia } from "@/types/analytics";
import { Grupo, MembroGrupoComPerfil } from "@/types/grupos";
import { getTimeAgo } from "@/constants/helpers";
import { Avatar } from "../ui";
import { formatarMinutos } from "@/constants/ranking";
import { MateriaMaisEstudada } from "@/types/materias";

// Paleta exata do mockup "HADES Analytics" — propositalmente diferente da navy
// padrão do app, pra manter fidelidade visual ao design aprovado.
// Cores que não existem na paleta tailwind do projeto entram via classes
// arbitrárias (ex.: "text-[#8a8d96]"); SVG não aceita className, então ali o
// valor precisa ir mesmo como prop/cor.
export const CORES = {
    // Laranja de destaque dos gráficos. É o `accentColor` padrão do mockup (#ffa348),
    // um passo mais suave que o HADES.accentSolid (#FF9A00) da marca — em área e barra
    // grandes o tom da marca satura demais. Onde a marca aparece como detalhe (aba ativa,
    // pull-to-refresh) o HADES.accentSolid continua valendo.
    accent: "#ffa348",
    /** Fundo do item selecionado nos controles em ícone (mesmo papel do HADES.accentTint). */
    accentTint: "rgba(255,163,72,0.12)",
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
/**
 * Par de ícones (uma pessoa / várias) no lugar do segmentado com texto, mesma forma do
 * alternador Calendário/Blocos do cronograma (app/(tabs)/schedule.tsx): individual vs.
 * coletivo se lê no desenho, e o controle encolhe o bastante pra dividir a linha com o
 * SeletorPeriodo em vez de ocupar uma faixa própria.
 *
 * Sem rótulo visível, o `accessibilityLabel` passa a ser a única descrição para leitor de
 * tela — por isso ele é obrigatório aqui, não um extra.
 */
export function SeletorEscopo({
    valor,
    aoAlterar,
}: {
    valor: EscopoAnalise;
    aoAlterar: (v: EscopoAnalise) => void;
}) {
    const opcoes: { key: EscopoAnalise; Icone: IconeComponente; rotulo: string }[] = [
        { key: "pessoal", Icone: User, rotulo: "Ver sua análise pessoal" },
        { key: "grupo", Icone: Users, rotulo: "Ver a análise do grupo" },
    ];

    return (
        <View
            className="flex-row self-start rounded-[19px] border border-[rgba(255,255,255,0.06)] bg-[#0d0e12]"
            style={{ padding: 3, gap: 2 }}
        >
            {opcoes.map(({ key, Icone, rotulo }) => {
                const ativo = valor === key;
                return (
                    <TouchableOpacity
                        key={key}
                        onPress={() => aoAlterar(key)}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel={rotulo}
                        accessibilityState={{ selected: ativo }}
                        style={{
                            width: 40,
                            height: 32,
                            borderRadius: 16,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: ativo ? CORES.accentTint : "transparent",
                        }}
                    >
                        <Icone size={16} color={ativo ? CORES.accent : CORES.textoMuted} />
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

// ── Pills de período: 7d / 30d / Ano ────────────────────────────────────
// Rótulos curtos pra caber na mesma linha do SeletorEscopo mesmo em tela de 360dp.
const OPCOES_PERIODO: { key: PeriodoAnalise; label: string }[] = [
    { key: "7d", label: "7d" },
    { key: "30d", label: "30d" },
    { key: "ano", label: "Ano" },
];

export function SeletorPeriodo({
    valor,
    aoAlterar,
}: {
    valor: PeriodoAnalise;
    aoAlterar: (v: PeriodoAnalise) => void;
}) {
    return (
        <View className="flex-row gap-1">
            {OPCOES_PERIODO.map((opcao) => {
                const ativo = valor === opcao.key;
                return (
                    <TouchableOpacity
                        key={opcao.key}
                        onPress={() => aoAlterar(opcao.key)}
                        className={`rounded-lg px-3 py-2 ${ativo ? "bg-[#1a1b20]" : "bg-transparent"}`}
                    >
                        <Text className={`text-[13px] font-semibold ${ativo ? "text-white" : "text-[#6b6e76]"}`}>
                            {opcao.label}
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

// ════════════════════════════════════════════════════════════════════════
// ABA PESSOAL
// ════════════════════════════════════════════════════════════════════════

// ── 1. Horas estudadas — gráfico de área ─────────────────────────────────

 export function GraficoArea({
    cor,
    horas,
    percentual,
    periodo,
    pontos,
}: {
    cor: string;
    horas: string;
    percentual: string;
    periodo: string;
    pontos: PontoSerieDia[];
}) {
    const largura = 320;
    const altura = 130;
    const yTopo = 15;
    const yBase = 110;

    const maxMinutos = Math.max(...pontos.map((p) => p.minutos), 1);
    const passoX = pontos.length > 1 ? largura / (pontos.length - 1) : 0;

    const coordenadas = pontos.map((p, i) => ({
        x: i * passoX,
        y: yBase - (p.minutos / maxMinutos) * (yBase - yTopo),
    }));

    const linhaPath = coordenadas.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
    const areaPath = `${linhaPath} L ${largura} ${altura} L 0 ${altura} Z`;
    // Só no filtro "7 dias" os pontos são dias da semana (Seg, Ter...) — nesse
    // caso destaca o dia de hoje. Nos demais (semanas/trimestres) os buckets já
    // terminam em hoje por construção, então destaca sempre o último ponto.
    const ehSerieSemanal = pontos.every((p) => DIAS_SEMANA_ABREV.includes(p.dia));
    const diaDeHoje = DIAS_SEMANA_ABREV[new Date().getDay()];
    const ultimoPonto = coordenadas[coordenadas.length - 1];

    return (
        <View>
            <View className="mb-3.5 flex-row items-end justify-between">
                <View>
                    <Text className="text-[13px] font-medium text-[#8a8d96]">Horas estudadas</Text>
                    <View className="mt-1 flex-row items-baseline gap-1.5">
                        <Text className="text-[30px] font-bold tracking-[-0.7px] text-white">{horas}</Text>
                    </View>
                    <View className="mt-1 flex-row items-center gap-1.5">
                        <IconeTendenciaAlta cor={CORES.verde}   />
                        <Text className="text-xs font-semibold text-[#30d158]">{percentual}</Text>
                        <Text className="text-xs text-[#6b6e76]">vs. {periodo} passado(a)</Text>
                    </View>
                </View>
            </View>

            <Svg width="100%" height={altura} viewBox={`0 0 ${largura} ${altura}`}>
                <Defs>
                    <LinearGradient id="gradienteAreaPessoal" x1="0" x2="0" y1="0" y2="1">
                        <Stop offset="0%" stopColor={cor} stopOpacity={0.35} />
                        <Stop offset="100%" stopColor={cor} stopOpacity={0} />
                    </LinearGradient>   
                </Defs>
                <Line x1="0" y1="40" x2={largura} y2="40" stroke={CORES.linhaGrade} strokeDasharray="2 4" />
                <Line x1="0" y1="80" x2={largura} y2="80" stroke={CORES.linhaGrade} strokeDasharray="2 4" />
                <Path d={areaPath} fill="url(#gradienteAreaPessoal)" />
                <Path
                    d={linhaPath}
                    fill="none"
                    stroke={cor}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                {ultimoPonto && (
                    <Circle cx={ultimoPonto.x} cy={ultimoPonto.y} r={4} fill="#000" stroke={cor} strokeWidth={2.5} />
                )}
            </Svg>
            <View className="mt-2 flex-row justify-between px-0.5">
                {pontos.map((p, i) => {
                    const destaque = ehSerieSemanal ? p.dia === diaDeHoje : i === pontos.length - 1;
                    return (
                        <Text
                            key={`${p.dia}-${i}`}
                            className={destaque ? "text-[11px] font-semibold text-white" : "text-[11px] text-[#5f636c]"}
                        >
                            {p.dia}
                        </Text>
                    );
                })}
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
    icone: IconeComponente;
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

// ── 3. Período atual vs. anterior — barras pareadas ──────────────────────
export function GraficoComparativoSemanal({
    cor,
    titulo, 
    pares,
}: {
    cor: string;
    titulo: string;
    pares: ParDiaSemana[];
}) {
    const alturaMax = 105; // deixa espaço pro eixo em y=125 dentro da viewBox de 130
    const maxMinutos = Math.max(...pares.flatMap((p) => [p.atual, p.anterior]), 1);

    return (
        <View>
            <Text className="mb-3.5 text-base font-bold tracking-[-0.2px] text-white">{titulo}</Text>
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
                {pares.map((par, i) => {
                    const baseX = 11 + i * 45;
                    const alturaAtual = (par.atual / maxMinutos) * alturaMax;
                    const alturaAnterior = (par.anterior / maxMinutos) * alturaMax;
                    return (
                        <Fragment key={i}>
                            <Rect x={baseX} y={125 - alturaAtual} width={9} height={alturaAtual} rx={2} fill={cor} />
                            <Rect x={baseX + 12} y={125 - alturaAnterior} width={9} height={alturaAnterior} rx={2} fill={CORES.barraAnterior} />
                        </Fragment>
                    );
                })}
            </Svg>
            <View className="mt-1.5 flex-row justify-between px-3">
                {pares.map((p, i) => (
                    // Dias da semana (Seg, Ter...) usam só a inicial pra caber no espaço
                    // apertado de 7 barras; "Sem 1"/"Trim 1" (30d/ano) já são curtos.
                    <Text key={i} className="text-[11px] text-[#5f636c]">
                        {DIAS_SEMANA_ABREV.includes(p.dia) ? p.dia[0] : p.dia}
                    </Text>
                ))}
            </View>
        </View>
    );
}

// ── 4. Distribuição por matéria — donut + legenda ────────────────────────
type Materia = { rotulo: string; pct: number; cor: string };

function segmentosDonut(materias: Materia[], raio: number) {
    const circunferencia = 2 * Math.PI * raio;
    let acumulado = 0;
    // Matérias com % nulo/negativo (arredondamento de horas ~0) não geram fatia
    // visível e, pior, um dash negativo quebra o strokeDasharray inteiro.
    return materias
        .filter((m) => m.pct > 0)
        .map((m) => {
            const dash = (m.pct / 100) * circunferencia;
            const offset = -acumulado;
            acumulado += dash;
            return { ...m, dash, offset, circunferencia };
        });
}

export function GraficoDonutMaterias({ qtdMaterias, materias }: { qtdMaterias: number; materias: Materia[] }) {
    const raio = 45;
    const segmentos = segmentosDonut(materias, raio);
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
                        <Text className="text-lg font-bold text-white">{qtdMaterias}</Text>
                        <Text className="mt-0.5 text-[9px] font-semibold tracking-[0.5px] text-[#6b6e76]">MATÉRIA(s)</Text>
                    </View>
                </View>
                <View className="flex-1 gap-2.5">
                    {materias.map((m) => (
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
export function BarraTaxaAcerto({acerto, erro, total, pct} : {acerto: number, erro: number, total: number, pct: number}) {
    // `acerto`/`erro` são contagens brutas (podem passar de 100) — a largura da
    // barra precisa ser em % do total, não a contagem direto.
    const pctErro = total > 0 ? 100 - pct : 0;

    return (
        <View>
            <View className="mb-2.5 flex-row items-center justify-between">
                <Text className="text-base font-bold tracking-[-0.2px] text-white">Taxa de acerto</Text>
                <Text className="text-[13px] text-[#6b6e76]">{total} respondidas</Text>
            </View>
            <View className="mb-3 flex-row items-baseline gap-2">
                <Text className="text-[30px] font-bold tracking-[-0.7px] text-white">{pct}%</Text>
                <Text className="text-[13px] text-[#6b6e76]">de acerto</Text>
            </View>
            <View className="h-2.5 flex-row gap-[3px] overflow-hidden rounded-[5px]">
                <View className="h-full rounded-[5px] bg-[#30d158]" style={{ width: `${pct}%` }} />
                <View className="h-full rounded-[5px] bg-[#f0556b] opacity-70" style={{ width: `${pctErro}%` }} />
            </View>
            <View className="mt-2.5 flex-row justify-between">
                <View className="flex-row items-center gap-1.5">
                    <View className="h-2 w-2 rounded-sm bg-[#30d158]" />
                    <Text className="text-xs text-[#c9ccd2]">Acertos</Text>
                    <Text className="text-xs text-[#6b6e76]">{acerto}</Text>
                </View>
                <View className="flex-row items-center gap-1.5">
                    <Text className="text-xs text-[#6b6e76]">{erro}</Text>
                    <Text className="text-xs text-[#c9ccd2]">Erros</Text>
                    <View className="h-2 w-2 rounded-sm bg-[#f0556b]" />
                </View>
            </View>
        </View>
    );
}

// ── 6. Quando você mais estuda — barras por dia da semana ────────────────
export function GraficoDiaSemana({ cor, pontos }: { cor: string; pontos: PontoSerieDia[] }) {
    const baseY = 110;
    const alturaMax = 92; // deixa espaço acima pro rótulo de horas do dia em destaque
    const maxMinutos = Math.max(...pontos.map((p) => p.minutos), 1);

    const indiceMelhorDia = pontos.reduce(
        (melhorIndice, p, i, arr) => (p.minutos > arr[melhorIndice].minutos ? i : melhorIndice),
        0
    );
    const melhorDia = pontos[indiceMelhorDia];
    const nomeMelhorDia = melhorDia ? (NOME_COMPLETO_DIA[melhorDia.dia] ?? melhorDia.dia) : "";
    const horasMelhorDia = melhorDia ? formatarHoras(melhorDia.minutos) : "0h";

    return (
        <View>
            <Text className="mb-1.5 text-base font-bold tracking-[-0.2px] text-white">Quando você mais estuda</Text>
            <Text className="mb-3.5 text-[13px] text-[#6b6e76]">
                <Text className="font-semibold" style={{ color: cor }}>{nomeMelhorDia}</Text> é seu melhor dia
            </Text>
            <Svg width="100%" height={130} viewBox="0 0 320 130">
                {pontos.map((p, i) => {
                    const altura = (p.minutos / maxMinutos) * alturaMax;
                    const destaque = i === indiceMelhorDia;
                    const x = 6 + i * 44;
                    return (
                        <Fragment key={`${p.dia}-${i}`}>
                            {destaque && (
                                <SvgText
                                    x={x + 14}
                                    y={baseY - altura - 8}
                                    fontSize={11}
                                    fontWeight="600"
                                    fill={cor}
                                    textAnchor="middle"
                                >
                                    {horasMelhorDia}
                                </SvgText>
                            )}
                            <Rect
                                x={x}
                                y={baseY - altura}
                                width={28}
                                height={altura}
                                rx={4}
                                fill={destaque ? cor : CORES.barraInativa}
                            />
                        </Fragment>
                    );
                })}
            </Svg>
            <View className="mt-1.5 flex-row justify-between">
                {pontos.map((p, i) => (
                    <Text
                        key={`${p.dia}-${i}`}
                        className={`w-[34px] text-center text-[11px] ${i === indiceMelhorDia ? "font-semibold text-white" : "text-[#6b6e76]"}`}
                    >
                        {p.dia}
                    </Text>
                ))}
            </View>
        </View>
    );
}

// ── 7. Evolução da ofensiva ───────────────────────────────────────────────
export function GraficoOfensiva({
    titulo = "Evolução da ofensiva",
    ofensivaAtual,
    melhorOfensiva,
    pontos,
}: {
    titulo?: string;
    ofensivaAtual: number;
    melhorOfensiva: number;
    pontos: number[];
}) {
    const largura = 320;
    const altura = 90;
    const yTopo = 10;
    const yBase = 78;

    const maxValor = Math.max(...pontos, 1);
    const passoX = pontos.length > 1 ? largura / (pontos.length - 1) : 0;

    const coordenadas = pontos.map((valor, i) => ({
        x: i * passoX,
        y: yBase - (valor / maxValor) * (yBase - yTopo),
    }));

    const linhaPath = coordenadas.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
    const ultimoPonto = coordenadas[coordenadas.length - 1];

    return (
        <View>
            <Text className="mb-2.5 text-base font-bold tracking-[-0.2px] text-white">{titulo}</Text>
            <View className="mb-3.5 flex-row items-baseline gap-2">
                <Flame size={20} color={CORES.chama} />
                <Text className="text-[30px] font-bold tracking-[-0.7px] text-white">{ofensivaAtual}</Text>
                <Text className="text-[13px] text-[#6b6e76]">dias seguidos</Text>
                <Text className="ml-auto text-[13px] text-[#6b6e76]">
                    recorde: <Text className="font-semibold text-white">{melhorOfensiva}</Text>
                </Text>
            </View>
            <Svg width="100%" height={altura} viewBox={`0 0 ${largura} ${altura}`}>
                <Line x1="0" y1="30" x2={largura} y2="30" stroke={CORES.linhaGrade} strokeDasharray="2 4" />
                <Line x1="0" y1="60" x2={largura} y2="60" stroke={CORES.linhaGrade} strokeDasharray="2 4" />
                <Path
                    d={linhaPath}
                    fill="none"
                    stroke={CORES.chama}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                {ultimoPonto && (
                    <Circle cx={ultimoPonto.x} cy={ultimoPonto.y} r={4} fill="#000" stroke={CORES.chama} strokeWidth={2.5} />
                )}
            </Svg>
            <View className="mt-2 flex-row justify-between">
                <Text className="text-[11px] text-[#5f636c]">{pontos.length} sem atrás</Text>
                <Text className="text-[11px] text-[#5f636c]">Hoje</Text>
            </View>
        </View>
    );
}

// ── 8. Planejado × Realizado — aderência ao cronograma ───────────────────

/** Verde acima de 90% do plano, âmbar de 60 a 89, vermelho abaixo disso. */
function corDaAderencia(pct: number) {
    if (pct >= 90) return CORES.verde;
    if (pct >= 60) return CORES.chama;
    return CORES.vermelho;
}

export function GraficoPlanejadoRealizado({
    cor,
    titulo,
    pares,
    resumo,
    temCronograma,
    aoAbrirCronograma,
}: {
    cor: string;
    titulo: string;
    pares: ParPlanejadoRealizado[];
    resumo: ResumoAderencia;
    /** false quando não há nenhum bloco de estudo na janela — sem plano não há o que comparar. */
    temCronograma: boolean;
    aoAbrirCronograma: () => void;
}) {
    if (!temCronograma) {
        return (
            <View>
                <Text className="mb-2.5 text-base font-bold tracking-[-0.2px] text-white">{titulo}</Text>
                <View className="items-start rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0d0e12] p-4">
                    <Text className="text-[13px] leading-[19px] text-[#8a8d96]">
                        Você ainda não tem blocos de estudo no cronograma deste período. Monte sua rotina
                        para comparar o que planejou com o que estudou.
                    </Text>
                    <TouchableOpacity
                        onPress={aoAbrirCronograma}
                        className="mt-3 flex-row items-center gap-1 rounded-lg bg-[#1a1b20] px-3 py-2"
                    >
                        <Text className="text-[13px] font-semibold" style={{ color: cor }}>
                            Montar cronograma
                        </Text>
                        <ChevronRight size={14} color={cor} />
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    const largura = 320;
    const altura = 140;
    const yTopo = 12;
    const yBase = 130;

    const maxMinutos = Math.max(...pares.flatMap((p) => [p.planejado, p.realizado]), 1);
    const passoX = pares.length > 1 ? largura / (pares.length - 1) : 0;

    const x = (i: number) => i * passoX;
    const y = (minutos: number) => yBase - (minutos / maxMinutos) * (yBase - yTopo);

    // Realizado: mesma área com gradiente do gráfico de horas, pra leitura contínua.
    const linhaRealizado = pares.map((par, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(par.realizado)}`).join(" ");
    const areaRealizado = `${linhaRealizado} L ${largura} ${altura} L 0 ${altura} Z`;

    // Planejado: linha tracejada em degraus — cada bucket vira um patamar horizontal que vai
    // da metade do caminho até o vizinho da esquerda à metade até o da direita, e o salto
    // vertical entre patamares é a mudança de plano. Degrau (e não linha ligando os pontos)
    // porque o planejado é um valor constante dentro do bucket, não uma curva.
    const linhaPlanejado = pares
        .map((par, i) => {
            const esquerda = i === 0 ? 0 : (x(i - 1) + x(i)) / 2;
            const direita = i === pares.length - 1 ? largura : (x(i) + x(i + 1)) / 2;
            const alturaPatamar = y(par.planejado);
            return `${i === 0 ? "M" : "L"} ${esquerda} ${alturaPatamar} L ${direita} ${alturaPatamar}`;
        })
        .join(" ");

    // Só conta como meta batida/furada o bucket que tinha plano: dia sem bloco no
    // cronograma não é falha, é dia livre.
    const comPlano = pares.filter((par) => par.planejado > 0);
    const vezesBatidas = comPlano.filter((par) => par.realizado >= par.planejado).length;
    const vezesAbaixo = comPlano.length - vezesBatidas;

    // O último bucket é sempre o atual (as janelas terminam hoje, ver lib/analytics.ts);
    // no filtro de 7 dias os rótulos são dias da semana, então o destaque vai pro de hoje.
    const ehSerieSemanal = pares.every((par) => DIAS_SEMANA_ABREV.includes(par.rotulo));
    const rotuloAtual = ehSerieSemanal
        ? DIAS_SEMANA_ABREV[new Date().getDay()]
        : pares[pares.length - 1]?.rotulo;

    return (
        <View>
            <View className="mb-1.5 flex-row items-center justify-between">
                <Text className="text-base font-bold tracking-[-0.2px] text-white">{titulo}</Text>
            </View>

            <View className="mb-3 flex-row items-baseline gap-2">
                <Text className="text-[30px] font-bold leading-none tracking-[-0.7px] text-white">{resumo.pct}%</Text>
                <Text className="text-[13px] text-[#6b6e76]">de aderência</Text>
                <Text className="ml-auto text-[13px] text-[#6b6e76]">
                    <Text className="font-semibold text-white">{formatarHoras(resumo.minutosRealizados)}</Text>
                    {" de "}
                    {formatarHoras(resumo.minutosPlanejados)}
                </Text>
            </View>

            <View className="mb-3 flex-row items-center gap-4">
                <View className="flex-row items-center gap-1.5">
                    <Svg width={18} height={8} viewBox="0 0 18 8">
                        <Line x1="0" y1="4" x2="18" y2="4" stroke={CORES.textoSecundario} strokeWidth={2} strokeDasharray="4 3" />
                    </Svg>
                    <Text className="text-xs text-[#8a8d96]">Planejado</Text>
                </View>
                <View className="flex-row items-center gap-1.5">
                    <View className="h-2 w-3.5 rounded-sm" style={{ backgroundColor: cor }} />
                    <Text className="text-xs text-[#c9ccd2]">Realizado</Text>
                </View>
            </View>

            <Svg width="100%" height={altura} viewBox={`0 0 ${largura} ${altura}`}>
                <Defs>
                    <LinearGradient id="gradienteAreaPlanejado" x1="0" x2="0" y1="0" y2="1">
                        <Stop offset="0%" stopColor={cor} stopOpacity={0.32} />
                        <Stop offset="100%" stopColor={cor} stopOpacity={0} />
                    </LinearGradient>
                </Defs>

                <Line x1="0" y1="45" x2={largura} y2="45" stroke={CORES.linhaGrade} strokeDasharray="2 4" />
                <Line x1="0" y1="90" x2={largura} y2="90" stroke={CORES.linhaGrade} strokeDasharray="2 4" />
                <Line x1="0" y1={yBase} x2={largura} y2={yBase} stroke={CORES.divisor} />

                <Path d={areaRealizado} fill="url(#gradienteAreaPlanejado)" />
                <Path
                    d={linhaPlanejado}
                    fill="none"
                    stroke={CORES.textoSecundario}
                    strokeWidth={1.8}
                    strokeDasharray="5 4"
                    strokeLinejoin="round"
                />
                <Path
                    d={linhaRealizado}
                    fill="none"
                    stroke={cor}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Ponto por bucket: verde bateu o plano, vermelho ficou abaixo, cinza não
                    tinha plano naquele dia. */}
                {pares.map((par, i) => (
                    <Circle
                        key={`${par.rotulo}-${i}`}
                        cx={x(i)}
                        cy={y(par.realizado)}
                        r={3.5}
                        fill={
                            par.planejado === 0
                                ? CORES.barraAnterior
                                : par.realizado >= par.planejado
                                    ? CORES.verde
                                    : CORES.vermelho
                        }
                    />
                ))}
            </Svg>

            <View className="mt-2 flex-row justify-between px-0.5">
                {pares.map((par, i) => (
                    <Text
                        key={`${par.rotulo}-${i}`}
                        className={`text-[11px] ${par.rotulo === rotuloAtual ? "font-semibold text-white" : "text-[#5f636c]"}`}
                    >
                        {par.rotulo}
                    </Text>
                ))}
            </View>
        </View>
    );
}

// ── 9. Aderência por matéria — barras horizontais ────────────────────────
const LIMITE_LINHAS_MATERIA = 6;

export function AderenciaPorMateria({ itens }: { itens: AderenciaMateria[] }) {
    const visiveis = itens.slice(0, LIMITE_LINHAS_MATERIA);
    const restantes = itens.length - visiveis.length;

    if (itens.length === 0) return null;

    return (
        <View>
            <Text className="mb-1.5 text-base font-bold tracking-[-0.2px] text-white">Aderência por matéria</Text>

            <View className="gap-3.5">
                {visiveis.map((item) => {
                    // Matéria estudada sem estar no plano não tem denominador: em vez de uma
                    // porcentagem inventada, a linha vira "extra".
                    const foraDoPlano = item.planejado === 0;
                    const largura = foraDoPlano ? 100 : Math.min(item.pct, 100);

                    return (
                        <View key={item.materia}>
                            <View className="mb-1.5 flex-row items-center justify-between">
                                <View className="flex-1 flex-row items-center gap-2">
                                    <View className="h-2 w-2 rounded-sm" style={{ backgroundColor: item.cor }} />
                                    <Text className="flex-1 text-[13px] font-medium text-[#c9ccd2]" numberOfLines={1}>
                                        {item.materia}
                                    </Text>
                                </View>
                                {foraDoPlano ? (
                                    <Text className="text-[12px] text-[#6b6e76]">
                                        <Text className="font-semibold text-white">{formatarHoras(item.realizado)}</Text>
                                        {" fora do plano"}
                                    </Text>
                                ) : (
                                    <Text className="text-[12px] text-[#6b6e76]">
                                        <Text className="font-semibold" style={{ color: corDaAderencia(item.pct) }}>
                                            {item.pct}%
                                        </Text>
                                        {"  "}
                                        {formatarHoras(item.realizado)} / {formatarHoras(item.planejado)}
                                    </Text>
                                )}
                            </View>
                            <View className="h-2 overflow-hidden rounded-[4px] bg-[#1a1b20]">
                                <View
                                    className="h-full rounded-[4px]"
                                    style={{
                                        width: `${largura}%`,
                                        backgroundColor: item.cor,
                                        opacity: foraDoPlano ? 0.45 : 1,
                                    }}
                                />
                            </View>
                        </View>
                    );
                })}
            </View>

            {restantes > 0 && (
                <Text className="mt-3 text-[11px] text-[#5f636c]">
                    + {restantes} matéria{restantes > 1 ? "s" : ""} com menos tempo planejado
                </Text>
            )}
        </View>
    );
}

// ── 10. Taxa de acerto por matéria ───────────────────────────────────────

/** Mesma escala de leitura do resto da tela: 70% é a linha de "vai bem". */
function corDoAcerto(pct: number) {
    if (pct >= 70) return CORES.verde;
    if (pct >= 50) return CORES.chama;
    return CORES.vermelho;
}

export function TaxaAcertoPorMateria({ itens }: { itens: DesempenhoMateria[] }) {
    // Só matéria com questão respondida tem taxa; as outras viram uma nota no rodapé
    // em vez de barras zeradas que parecem 0% de acerto.
    const comQuestoes = itens.filter((item) => item.questoes > 0);
    const semQuestoes = itens.length - comQuestoes.length;

    return (
        <View>
            <Text className="mb-1.5 text-base font-bold tracking-[-0.2px] text-white">Taxa de acerto por matéria</Text>

            {comQuestoes.length === 0 ? (
                <Text className="text-[13px] leading-[19px] text-[#8a8d96]">
                    Nenhuma questão respondida neste período. Faça os quizzes ao fim das sessões (ou anexe
                    formulários corrigidos) para ver o acerto por matéria.
                </Text>
            ) : (
                <View className="gap-3.5">
                    {/* Pior primeiro: a informação útil aqui é onde melhorar. */}
                    {[...comQuestoes]
                        .sort((a, b) => a.pctAcerto - b.pctAcerto)
                        .map((item) => (
                            <View key={item.materia}>
                                <View className="mb-1.5 flex-row items-center justify-between">
                                    <View className="flex-1 flex-row items-center gap-2">
                                        <View className="h-2 w-2 rounded-sm" style={{ backgroundColor: item.cor }} />
                                        <Text className="flex-1 text-[13px] font-medium text-[#c9ccd2]" numberOfLines={1}>
                                            {item.materia}
                                        </Text>
                                    </View>
                                    <Text className="text-[12px] text-[#6b6e76]">
                                        <Text className="font-semibold" style={{ color: corDoAcerto(item.pctAcerto) }}>
                                            {item.pctAcerto}%
                                        </Text>
                                        {"  "}
                                        {item.acertos}/{item.questoes}
                                    </Text>
                                </View>
                                <View className="h-2 overflow-hidden rounded-[4px] bg-[#1a1b20]">
                                    <View
                                        className="h-full rounded-[4px]"
                                        style={{ width: `${item.pctAcerto}%`, backgroundColor: corDoAcerto(item.pctAcerto) }}
                                    />
                                </View>
                            </View>
                        ))}
                </View>
            )}
        </View>
    );
}

// ── 11. Tempo × desempenho — quadrantes ──────────────────────────────────
const ACERTO_DE_CORTE = 70; // linha horizontal: acima disso, a matéria está indo bem

export function GraficoTempoDesempenho({ itens }: { itens: DesempenhoMateria[] }) {
    const pontos = itens.filter((item) => item.questoes > 0 && item.minutos > 0);

    if (pontos.length < 2) {
        return (
            <View>
                <Text className="mb-1.5 text-base font-bold tracking-[-0.2px] text-white">Tempo × desempenho</Text>
                <Text className="text-[13px] leading-[19px] text-[#8a8d96]">
                    Estude e responda questões em pelo menos duas matérias no período para comparar onde o
                    tempo investido está virando acerto.
                </Text>
            </View>
        );
    }

    const largura = 320;
    const altura = 200;
    const margemEsq = 30;
    const margemDir = 12;
    const margemTopo = 14;
    const margemBase = 24;

    const maxHoras = Math.max(...pontos.map((p) => p.horas));
    const maxQuestoes = Math.max(...pontos.map((p) => p.questoes));

    // Mediana das horas: divide as matérias entre "muito tempo" e "pouco tempo" pelo próprio
    // período do usuário, em vez de um corte fixo que não significaria nada.
    const horasOrdenadas = [...pontos.map((p) => p.horas)].sort((a, b) => a - b);
    const meio = Math.floor(horasOrdenadas.length / 2);
    const medianaHoras =
        horasOrdenadas.length % 2 === 0
            ? (horasOrdenadas[meio - 1] + horasOrdenadas[meio]) / 2
            : horasOrdenadas[meio];

    const x = (horas: number) =>
        margemEsq + (maxHoras > 0 ? horas / (maxHoras * 1.12) : 0) * (largura - margemEsq - margemDir);
    const y = (pct: number) => margemTopo + (1 - pct / 100) * (altura - margemTopo - margemBase);
    const raio = (questoes: number) => 4 + (maxQuestoes > 0 ? questoes / maxQuestoes : 0) * 6;

    return (
        <View>
            <Text className="mb-1.5 text-base font-bold tracking-[-0.2px] text-white">Tempo × desempenho</Text>
            <Text className="mb-3 text-[13px] text-[#6b6e76]">
                Onde o tempo investido está virando acerto — o tamanho do ponto é o volume de questões
            </Text>

            <Svg width="100%" height={altura} viewBox={`0 0 ${largura} ${altura}`}>
                {/* Eixo Y: 0 / 50 / 100% de acerto */}
                {[0, 50, 100].map((tick) => (
                    <Fragment key={tick}>
                        <Line
                            x1={margemEsq}
                            y1={y(tick)}
                            x2={largura - margemDir}
                            y2={y(tick)}
                            stroke={CORES.linhaGrade}
                        />
                        <SvgText x={margemEsq - 6} y={y(tick) + 3.5} fontSize={9} fill={CORES.textoFraco} textAnchor="end">
                            {`${tick}%`}
                        </SvgText>
                    </Fragment>
                ))}

                {/* Divisores dos quadrantes */}
                <Line
                    x1={margemEsq}
                    y1={y(ACERTO_DE_CORTE)}
                    x2={largura - margemDir}
                    y2={y(ACERTO_DE_CORTE)}
                    stroke={CORES.divisor}
                    strokeDasharray="3 4"
                />
                <Line
                    x1={x(medianaHoras)}
                    y1={margemTopo}
                    x2={x(medianaHoras)}
                    y2={altura - margemBase}
                    stroke={CORES.divisor}
                    strokeDasharray="3 4"
                />

                {/* Rótulos dos quadrantes */}
                <SvgText x={margemEsq + 4} y={margemTopo + 10} fontSize={8.5} fill={CORES.textoFraco}>
                    rende rápido
                </SvgText>
                <SvgText x={largura - margemDir - 4} y={margemTopo + 10} fontSize={8.5} fill={CORES.textoFraco} textAnchor="end">
                    consolidado
                </SvgText>
                <SvgText x={margemEsq + 4} y={altura - margemBase - 5} fontSize={8.5} fill={CORES.textoFraco}>
                    pouco explorado
                </SvgText>
                <SvgText x={largura - margemDir - 4} y={altura - margemBase - 5} fontSize={8.5} fill={CORES.textoFraco} textAnchor="end">
                    custa caro
                </SvgText>

                {pontos.map((item) => (
                    <Circle
                        key={item.materia}
                        cx={x(item.horas)}
                        cy={y(item.pctAcerto)}
                        r={raio(item.questoes)}
                        fill={item.cor}
                        fillOpacity={0.75}
                        stroke={item.cor}
                        strokeWidth={1.5}
                    />
                ))}

                <SvgText x={largura - margemDir} y={altura - 6} fontSize={9} fill={CORES.textoFraco} textAnchor="end">
                    horas estudadas →
                </SvgText>
            </Svg>

            <View className="mt-3 gap-2">
                {pontos.map((item) => (
                    <View key={item.materia} className="flex-row items-center justify-between">
                        <View className="flex-1 flex-row items-center gap-2">
                            <View className="h-2 w-2 rounded-full" style={{ backgroundColor: item.cor }} />
                            <Text className="flex-1 text-[13px] text-[#c9ccd2]" numberOfLines={1}>
                                {item.materia}
                            </Text>
                        </View>
                        <Text className="text-[12px] text-[#6b6e76]">
                            {formatarHoras(item.minutos)} · <Text className="font-semibold text-white">{item.pctAcerto}%</Text>
                        </Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

// ════════════════════════════════════════════════════════════════════════
// ABA GRUPO
// ════════════════════════════════════════════════════════════════════════

// ── G1. Cabeçalho do grupo ─────────────────────────────────────────────
export function CabecalhoGrupo({
    cor,
    grupos,
    grupoSelecionadoId,
    aoSelecionarGrupo,
    membros,
}: {
    cor: string;
    grupos: Grupo[];
    grupoSelecionadoId: string | null;
    aoSelecionarGrupo: (grupo: Grupo) => void;
    membros: Record<string, MembroGrupoComPerfil[]>;
}) {
    const [aberto, setAberto] = useState(false);

    const grupoSelecionado = grupos.find((g) => g.id === grupoSelecionadoId) ?? grupos[0] ?? null;
    const outrosGrupos = grupos.filter((g) => g.id !== grupoSelecionado?.id);
    const temEscolha = grupos.length > 1;

    if (!grupoSelecionado) return null;

    return (
        <View>
            <TouchableOpacity
                activeOpacity={temEscolha ? 0.75 : 1}
                onPress={() => temEscolha && setAberto((v) => !v)}
                className="flex-row items-center gap-3 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#0d0e12] p-3.5"
            >
                <View className="h-[42px] w-[42px] items-center justify-center rounded-xl bg-[#13192c]">
                    {grupoSelecionado.foto_grupo ? (
                        <Image
                            source={{ uri: grupoSelecionado.foto_grupo }}
                            className="h-[42px] w-[42px] rounded-xl"
                        />
                    ) : (
                        <Swords size={22} color={cor} />
                    )}
                </View>
                <View className="flex-1">
                    <Text className="text-[15px] font-bold text-white">{grupoSelecionado.nome_grupo}</Text>
                    <Text className="mt-0.5 text-xs text-[#6b6e76]">
                        {membros[grupoSelecionado.id]?.length ?? 0} membros · criado há {getTimeAgo(grupoSelecionado.created_at)}
                    </Text>
                </View>
                {temEscolha && (
                    <View style={{ transform: [{ rotate: aberto ? "180deg" : "0deg" }] }}>
                        <ChevronDown size={18} color={CORES.textoMuted} />
                    </View>
                )}
            </TouchableOpacity>

            {aberto && (
                <View className="mt-2 overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#0d0e12]">
                    {outrosGrupos.map((grupo, index) => (
                        <TouchableOpacity
                            key={grupo.id}
                            activeOpacity={0.75}
                            onPress={() => {
                                aoSelecionarGrupo(grupo);
                                setAberto(false);
                            }}
                            className={`flex-row items-center gap-3 p-3.5 ${
                                index > 0 ? "border-t border-[rgba(255,255,255,0.06)]" : ""
                            }`}
                        >
                            <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#13192c]">
                                {grupo.foto_grupo ? (
                                    <Image
                                        source={{ uri: grupo.foto_grupo }}
                                        className="h-[42px] w-[42px] rounded-xl"
                                    />
                                ) : (
                                    <Swords size={22} color={cor} />
                                )}
                            </View>
                            <View className="flex-1">
                                <Text className="text-sm font-semibold text-white">{grupo.nome_grupo}</Text>
                                <Text className="mt-0.5 text-xs text-[#6b6e76]">
                                    {membros[grupo.id]?.length ?? 0} membros
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
}

// ── G2. Meta semanal do grupo ──────────────────────────────────────────
export function MetaSemanalGrupo({grupos, grupoSelecionado, horas, qtdMembros}: {grupos: Grupo[], grupoSelecionado: Grupo, horas:number, qtdMembros: number}) {
    
    const progressoGrupo = grupoSelecionado.meta_horas > 0 ? horas / grupoSelecionado.meta_horas : 0

    const progressoPercentual = Math.min(Math.round(progressoGrupo * 100), 100)

    const horasDoGrupo = formatarHoras(grupoSelecionado.meta_horas * qtdMembros * 60)

    return (
        <View>
            <View className="mb-1.5 flex-row items-baseline justify-between">
                <Text className="text-base font-bold tracking-[-0.2px] text-white">Meta Semanal <Text className="text-[10px] text-[#fcc470]">• {grupoSelecionado.meta_horas}h por membro</Text> </Text>
                <Text className="text-[13px] font-semibold text-[#30d158]">{progressoPercentual}%</Text>
            </View>
            <View className="mb-3 flex-row items-baseline gap-2">
                <Text className="text-[30px] font-bold tracking-[-0.7px] text-white">{formatarHoras(horas * 60)}</Text>
                <Text className="text-[13px] text-[#6b6e76]">/ {horasDoGrupo}</Text>
           </View>
            <View className="h-2 overflow-hidden rounded-full bg-[#1a1b20]">
                <View className="h-full w-full rounded-full bg-[#30d158]" />
            </View>
            <View className="mt-1.5 flex-row justify-between">
                <Text className="text-[11px] text-[#5f636c]"></Text>
            </View>
        </View>
    );
}

// ── G3. Ranking de horas do grupo ──────────────────────────────────────
export function RankingHorasGrupo({ cor, membros, grupoSelecionado }: { cor: string, membros: membrosRankingAnalytics[], grupoSelecionado: Grupo }) {
    
    //Cálculo para a barra de progresso de horas dos membros no ranking
    const pctMembros = (minutos: number) => {
        const pct = (minutos / grupoSelecionado.meta_horas) * 100
        if(pct > 100) {
            return 100
        }
        return pct;
    }

    return (
        <View>
            <View className="mb-3.5 flex-row items-center justify-between">
                <Text className="text-base font-bold tracking-[-0.2px] text-white">Ranking de horas</Text>
                <Text className="text-[13px] text-[#6b6e76]">esta semana</Text>
            </View>
            {membros.length === 0 ? (
                <Text className="mb-6 text-[13px] text-[#6b6e76]">Nenhum membro com sessões nesse período.</Text>
            ) : (
                <View className="gap-3.5 mb-6">
                    {membros.map((membro) => (
                        <View key={membro.nome}>
                            <View className="mb-1.5 flex-row items-center justify-between">
                                <View className="flex-row items-center gap-2.5 mb-2">
                                    <Avatar foto={membro.foto}/>
                                    <Text className="text-[13px] font-semibold text-white">{membro.nome}</Text>
                                </View>
                                <Text className={`text-[13px] font-semibold ${membro.ehVoce ? "text-white" : "text-[#9a9da3]"}`}>
                                    {formatarMinutos(membro.minutos)} • <Text className="text-xs text-[#fcc470]">{(pctMembros(membro.minutos / 60)).toFixed(1)}%</Text>
                                </Text>
                            </View>
                            <View className="h-1.5 rounded-sm bg-[#1a1b20]">
                                <View
                                    className="h-full rounded-sm"
                                    style={{ width: `${pctMembros(membro.minutos / 60)}%`, backgroundColor: membro.ehVoce ? cor : CORES.barraAnterior }}
                                />
                            </View>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}

// ── G4 (esquerda). Matéria mais estudada pelo grupo ────────────────────
export function MateriaMaisEstudadaGrupo({materias, qtdMaterias}: {materias: MateriaMaisEstudada[], qtdMaterias: number}) {
    const raio = 36;
    const segmentos = segmentosDonut(materias, raio);
    return (
        <View className="flex-1 items-center justify-between rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#0d0e12] p-3.5">
            <Text className="text-[11px] font-semibold tracking-[0.5px] text-[#8a8d96]">MAIS ESTUDADA</Text>
            <View className="my-2.5 h-[84px] w-[84px]">
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
                <Text className="text-[15px] font-bold text-white text-center">
                    {materias[0]?.rotulo ?? "Sem dados"}
                </Text>
                <Text className="mt-0.5 text-xs text-[#6b6e76] text-center">
                    {materias[0] ? `${materias[0].pct}% das horas` : "nenhuma sessão no período"}
                </Text>
            </View>
        </View>
    );
}

// ── G4 (direita). Membros ativos ───────────────────────────────────────
export function MembrosAtivosGrupo({ cor, inativos, membrosTotais }: { cor: string, inativos: MembroGrupoComPerfil[], membrosTotais: MembroGrupoComPerfil[] }) {
    const raio = 24;
    const circunferencia = 2 * Math.PI * raio;

    //Quantidade de usuarios inativos e ativos
    const qtdInativos = inativos.length
    const qtdMembrosTotais = membrosTotais.length
    const qtdAtivos = qtdMembrosTotais - qtdInativos
    const pct = qtdMembrosTotais > 0 ? qtdAtivos / qtdMembrosTotais : 0;

    return (
        <View className="flex-1 items-center justify-between rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#0d0e12] p-3.5">
            <Text className="text-[11px] font-semibold tracking-[0.5px] text-[#8a8d96]">MEMBROS ATIVOS</Text>
            <View className="my-2.5 flex-row items-center gap-3">
                <View className="h-14 w-14 mr-3">
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
                    <Text className="text-2xl font-bold tracking-[-0.5px] text-white">{qtdAtivos}/{qtdMembrosTotais}</Text>
                    <Text className="mt-1 text-[11px] text-[#6b6e76]">usuários ativos</Text>
                </View>
            </View>
            <Text className="text-xs text-[#6b6e76]">{qtdInativos} sem atividade</Text>
        </View>
    );
}

// ── G5. Evolução de horas do grupo ──────────────────────────────────────
export function EvolucaoGrupo({
    cor,
    horas,
    percentual,
    pontos,
}: {
    cor: string;
    horas: string;
    percentual: string;
    pontos: PontoSerieDia[];
}) {
    const largura = 320;
    const altura = 110;
    const yTopo = 10;
    const yBase = 78;

    const maxMinutos = Math.max(...pontos.map((p) => p.minutos), 1);
    const passoX = pontos.length > 1 ? largura / (pontos.length - 1) : 0;

    const coordenadas = pontos.map((p, i) => ({
        x: i * passoX,
        y: yBase - (p.minutos / maxMinutos) * (yBase - yTopo),
    }));

    const linhaPath = coordenadas.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
    const areaPath = `${linhaPath} L ${largura} ${altura} L 0 ${altura} Z`;
    const ultimoPonto = coordenadas[coordenadas.length - 1];
    const percentualNegativo = percentual.trim().startsWith("-");

    return (
        <View>
            <Text className="mb-1.5 text-base font-bold tracking-[-0.2px] text-white">Evolução do grupo</Text>
            <View className="mb-3.5 flex-row items-baseline gap-2">
                <Text className="text-[30px] font-bold tracking-[-0.7px] text-white">{horas}</Text>
                <Text className="text-[13px] text-[#6b6e76]">esta semana</Text>
                <View className="ml-auto flex-row items-center gap-1">
                    <IconeTendenciaAlta cor={percentualNegativo ? CORES.vermelho : CORES.verde} />
                    <Text className={`text-xs font-semibold ${percentualNegativo ? "text-[#f0556b]" : "text-[#30d158]"}`}>
                        {percentual}
                    </Text>
                </View>
            </View>
            <Svg width="100%" height={altura} viewBox={`0 0 ${largura} ${altura}`}>
                <Defs>
                    <LinearGradient id="gradienteAreaGrupo" x1="0" x2="0" y1="0" y2="1">
                        <Stop offset="0%" stopColor={cor} stopOpacity={0.3} />
                        <Stop offset="100%" stopColor={cor} stopOpacity={0} />
                    </LinearGradient>
                </Defs>
                <Line x1="0" y1="35" x2={largura} y2="35" stroke={CORES.linhaGrade} strokeDasharray="2 4" />
                <Line x1="0" y1="70" x2={largura} y2="70" stroke={CORES.linhaGrade} strokeDasharray="2 4" />
                <Path d={areaPath} fill="url(#gradienteAreaGrupo)" />
                <Path
                    d={linhaPath}
                    fill="none"
                    stroke={cor}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                {ultimoPonto && (
                    <Circle cx={ultimoPonto.x} cy={ultimoPonto.y} r={4} fill="#000" stroke={cor} strokeWidth={2.5} />
                )}
            </Svg>
            <View className="mt-1.5 flex-row justify-between">
                {pontos.map((p, i) => (
                    <Text key={`${p.dia}-${i}`} className="text-[11px] text-[#5f636c]">
                        {p.dia}
                    </Text>
                ))}
            </View>
        </View>
    );
}

// ── G6. Questões por membro ──────────────────────────────────────────────
export type QuestoesMembroGrupo = {
    userId: string;
    nome: string;
    foto?: string | null;
    total: number;
    pctAcerto: number;
};

export function QuestoesPorMembroGrupo({ membros }: { membros: QuestoesMembroGrupo[] }) {
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
            {membros.length === 0 ? (
                <Text className="text-[13px] text-[#6b6e76]">Nenhuma questão respondida pelo grupo nesse período.</Text>
            ) : (
                <View className="gap-3">
                    {membros.map((membro) => (
                        <View key={membro.userId}>
                            <View className="mb-1.5 flex-row items-center justify-between">
                                <View className="flex-row items-center gap-2.5">
                                    <Avatar foto={membro.foto} nome={membro.nome} size={28} />
                                    <Text className="text-[13px] font-semibold text-white">{membro.nome}</Text>
                                </View>
                                <View className="flex-row items-baseline gap-1">
                                    <Text className="text-[13px] font-semibold text-white">{membro.total.toLocaleString("pt-BR")}</Text>
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
            )}
        </View>
    );
}
