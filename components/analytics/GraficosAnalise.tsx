import { Fragment, useState } from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import Svg, { Path, Line, Rect, Circle, Defs, LinearGradient, Stop, Text as SvgText } from "react-native-svg";
import { Flame, Swords, ChevronRight, User, ChevronDown } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { DIAS_SEMANA_ABREV, NOME_COMPLETO_DIA, formatarHoras } from "@/lib/analytics";
import { ParDiaSemana, PontoSerieDia } from "@/types/analytics";
import { Grupo, MembroGrupoComPerfil } from "@/types/grupos";
import { getTimeAgo } from "@/constants/helpers";

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
const OPCOES_PERIODO: { key: PeriodoAnalise; label: string }[] = [
    { key: "7d", label: "7 dias" },
    { key: "30d", label: "30 dias" },
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
        <View className="flex-row gap-1.5">
            {OPCOES_PERIODO.map((opcao) => {
                const ativo = valor === opcao.key;
                return (
                    <TouchableOpacity
                        key={opcao.key}
                        onPress={() => aoAlterar(opcao.key)}
                        className={`mt-3 rounded-lg px-3.5 py-1.5 ${ativo ? "bg-[#1a1b20]" : "bg-transparent"}`}
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
    return materias.map((m) => {
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
    const horasMelhorDia = melhorDia ? formatarHoras(melhorDia.minutos) : "0h00";

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
    ofensivaAtual,
    melhorOfensiva,
    pontos,
}: {
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
            <Text className="mb-2.5 text-base font-bold tracking-[-0.2px] text-white">Evolução da ofensiva</Text>
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
export function MetaSemanalGrupo({grupos, grupoSelecionadoId, horas, qtdMembros}: {grupos: Grupo[], grupoSelecionadoId: string | null, horas:number, qtdMembros: number}) {

    //Como o usuário pode ter mais de um grupo, devemos pegar qual está selecionado
    const grupoSelecionado = grupos.find((g) => g.id === grupoSelecionadoId) ?? grupos[0] ?? null;
    
    const progressoGrupo = grupoSelecionado.meta_horas > 0 ? horas / grupoSelecionado.meta_horas : 0

    const progressoPercentual = Math.min(Math.round(progressoGrupo * 100), 100)

    const horasDoGrupo = grupoSelecionado.meta_horas * qtdMembros

    return (
        <View>
            <View className="mb-1.5 flex-row items-baseline justify-between">
                <Text className="text-base font-bold tracking-[-0.2px] text-white">Meta Semanal <Text className="text-[10px] text-[#FF9A00]">- {grupoSelecionado.meta_horas}h por membro</Text> </Text>
                <Text className="text-[13px] font-semibold text-[#30d158]">{progressoPercentual}%</Text>
            </View>
            <View className="mb-3 flex-row items-baseline gap-2">
                <Text className="text-[30px] font-bold tracking-[-0.7px] text-white">{horas}h</Text>
                <Text className="text-[13px] text-[#6b6e76]">/ {horasDoGrupo}h</Text>
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
