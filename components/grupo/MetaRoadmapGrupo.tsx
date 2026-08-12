import { View, Text } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { ChevronRight } from "@/components/ui/icons";
import { HADES } from "@/constants/hades";
import type { ProgressoRoadmapGrupo } from "@/types/roadmap";

/**
 * Cartão único "Meta da semana + roadmap" da home do grupo.
 *
 * Substitui os dois cartões antigos (MetaGrupo e RoadmapGrupo) por um só, seguindo o
 * redesign HADES: anel de progresso da meta semanal à esquerda, e abaixo a linha do
 * roadmap com os pontinhos de quem já cumpriu a semana e o contador "M/N concluíram".
 *
 * Estados preservados dos cartões antigos, só que compactados:
 * - meta não definida  → anel vazio, "0h de 0h" e "definir";
 * - meta batida        → anel cheio verde e "Meta batida!";
 * - roadmap inexistente→ linha explica (só o admin vê "Gerar roadmap do grupo").
 */
export default function MetaRoadmapGrupo({
    percentual,
    horasFeitas,
    metaTotal,
    progresso,
    souAdmin,
    aoGerar,
}: {
    percentual: number;
    horasFeitas: number;
    metaTotal: number;
    progresso: ProgressoRoadmapGrupo | null | undefined;
    souAdmin: boolean;
    aoGerar: () => void;
}) {
    const semMeta = metaTotal <= 0;
    const pct = semMeta ? 0 : Math.min(percentual, 100);
    const atingida = !semMeta && horasFeitas >= metaTotal;
    const faltam = !semMeta ? Math.max(0, Math.ceil(metaTotal - horasFeitas)) : 0;
    const arredondado = Math.round(horasFeitas);

    return (
        <View
            style={{
                backgroundColor: HADES.surface,
                borderWidth: 1,
                borderColor: HADES.border,
                borderRadius: 16,
                overflow: "hidden",
                marginBottom: 18,
            }}
        >
            {/* Meta da semana */}
            <View style={{ paddingVertical: 15, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 14 }}>
                <AnelMeta pct={pct} atingida={atingida} semMeta={semMeta} />

                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 10.5, fontWeight: "700", letterSpacing: 1.1, color: HADES.textFaint }}>
                        META DA SEMANA
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 2, gap: 6 }}>
                        <Text style={{ fontSize: 21, fontWeight: "700", letterSpacing: -0.4, color: HADES.text }}>
                            {arredondado}h
                        </Text>
                        <Text style={{ fontSize: 12, color: HADES.textMuted }}>
                            de {semMeta ? "0" : Math.round(metaTotal)}h
                        </Text>
                    </View>
                    <Text style={{ fontSize: 11, color: HADES.textDim, marginTop: 1 }}>
                        até domingo
                    </Text>
                </View>

                <View style={{ alignItems: "flex-end" }}>
                    <Text
                        style={{
                            fontSize: 16,
                            fontWeight: "700",
                            color: atingida ? HADES.green : pct > 0 ? HADES.accentSolid : HADES.textDim,
                        }}
                    >
                        {semMeta ? "—" : `${pct}%`}
                    </Text>
                    <Text
                        style={{
                            fontSize: 10.5,
                            color: atingida ? HADES.green : HADES.textDim,
                            marginTop: 2,
                            fontWeight: atingida ? "600" : "400",
                        }}
                    >
                        {semMeta
                            ? "definir"
                            : atingida
                              ? "meta batida!"
                              : pct > 0 && faltam > 0
                                ? `faltam ${faltam}h`
                                : "a semana"}
                    </Text>
                </View>
            </View>

            <View style={{ height: 1, backgroundColor: HADES.border }} />

            {/* Roadmap do grupo */}
            <View style={{ paddingVertical: 12, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 10.5, fontWeight: "700", letterSpacing: 1.1, color: HADES.textFaint }}>
                        ROADMAP
                    </Text>

                    {progresso ? (
                        <>
                            <Text
                                style={{
                                    fontSize: 14.5,
                                    fontWeight: "600",
                                    letterSpacing: -0.2,
                                    color: HADES.text,
                                    marginTop: 5,
                                }}
                                numberOfLines={1}
                            >
                                {progresso.nome}
                            </Text>
                            <Pontinhos progresso={progresso} />
                        </>
                    ) : (
                        <Text
                            style={{
                                fontSize: 12.5,
                                color: HADES.textMuted,
                                marginTop: 5,
                                lineHeight: 17,
                            }}
                        >
                            O grupo ainda não tem um roadmap.
                        </Text>
                    )}
                </View>

                {progresso ? (
                    <ContadorProgresso progresso={progresso} />
                ) : souAdmin ? (
                    <Text
                        style={{ fontSize: 12.5, fontWeight: "600", color: HADES.accentSolid }}
                        onPress={aoGerar}
                    >
                        Gerar roadmap
                    </Text>
                ) : null}
            </View>
        </View>
    );
}

/** Anel de progresso da meta semanal, no molde do design (46×46, traço 4). */
function AnelMeta({ pct, atingida, semMeta }: { pct: number; atingida: boolean; semMeta: boolean }) {
    const raio = 19.5;
    const perimetro = 2 * Math.PI * raio; // ≈ 122.5
    const cor = atingida ? HADES.green : HADES.accentSolid;

    return (
        <Svg width={46} height={46} viewBox="0 0 46 46">
            <Circle cx={23} cy={23} r={raio} fill="none" stroke="#1e2026" strokeWidth={4} />
            {pct > 0 && !semMeta && (
                <Circle
                    cx={23}
                    cy={23}
                    r={raio}
                    fill="none"
                    stroke={cor}
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeDasharray={`${(perimetro * pct) / 100} ${perimetro}`}
                    transform="rotate(-90 23 23)"
                />
            )}
        </Svg>
    );
}

/** Pontinhos: 1 a 5, acesos na medida dos membros que já cumpriram a semana. */
function Pontinhos({ progresso }: { progresso: ProgressoRoadmapGrupo }) {
    const semBlocos = progresso.total_blocos_semana <= 0;
    const semMembros = progresso.total_membros <= 0;

    if (semBlocos || semMembros) {
        return <LinhaPontos n={5} acesos={0} />;
    }

    const n = Math.max(1, Math.min(5, progresso.total_membros));
    const acesos = Math.min(progresso.membros_completaram, n);
    return <LinhaPontos n={n} acesos={acesos} />;
}

function LinhaPontos({ n, acesos }: { n: number; acesos: number }) {
    return (
        <View style={{ flexDirection: "row", gap: 3, marginTop: 9, maxWidth: 190 }}>
            {Array.from({ length: n }).map((_, i) => (
                <View
                    key={i}
                    style={{
                        flex: 1,
                        height: 3,
                        borderRadius: 2,
                        backgroundColor: i < acesos ? HADES.text : HADES.trackOff,
                    }}
                />
            ))}
        </View>
    );
}

/** "M/N concluíram" à direita, verde quando todo mundo cumpriu a semana. */
function ContadorProgresso({ progresso }: { progresso: ProgressoRoadmapGrupo }) {
    const semBlocos = progresso.total_blocos_semana <= 0;
    const semMembros = progresso.total_membros <= 0;
    const todosCompletaram = !semBlocos && !semMembros && progresso.membros_completaram >= progresso.total_membros;

    if (semBlocos || semMembros) {
        return <Text style={{ fontSize: 11.5, color: HADES.textFaint }}>—</Text>;
    }

    const cor = todosCompletaram ? HADES.green : HADES.textMuted;

    return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 11.5, color: cor }}>
                <Text style={{ fontWeight: "700", color: todosCompletaram ? HADES.green : HADES.text }}>
                    {progresso.membros_completaram}
                </Text>
                {" de "}
                <Text style={{ fontWeight: "700", color: todosCompletaram ? HADES.green : HADES.text }}>
                    {progresso.total_membros}
                </Text>
                {" concluíram"}
            </Text>
            <ChevronRight size={16} color={HADES.textDim} />
        </View>
    );
}