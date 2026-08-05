import { View, Text, TouchableOpacity } from "react-native";
import { Pause, Play, Square, SkipForward, Check, Repeat, HandMetal } from "lucide-react-native";
import { HADES } from "@/constants/hades";
import AnelPomodoro from "@/components/focus/AnelPomodoro";
import {
    Relogio,
    EtiquetaEmFoco,
    EtiquetaPublica,
    EtiquetaPausado,
    PontosDeCiclo,
    ColegasFocando,
} from "@/components/focus/PecasFoco";
import type { ContextoBloco, FaseFoco, ModoFoco } from "@/types/foco";

const VERDE = "#34c759";
const VERDE_CLARO = "#eafff2";

type Props = {
    modo: ModoFoco;
    fase: FaseFoco;
    pausado: boolean;
    materia: string;
    conteudo: string;
    publica: boolean;
    /** Cronômetro: tempo decorrido. Pomodoro: tempo restante da fase. */
    textoRelogio: string;
    /** 0–1, só no pomodoro. */
    progressoFase: number;
    ciclo: number;
    totalCiclos: number;
    contexto: ContextoBloco | null;
    autoFoco: boolean;
    /**
     * `false` para quem entrou numa sessão em grupo: esticar o foco e pular o descanso
     * reescrevem o cronograma de todos os participantes, então ficam só com quem criou a
     * sessão. Quem entrou segue o ritmo combinado (e pode encerrar a qualquer momento).
     */
    podeControlarCronograma?: boolean;
    colegas: string[] | null;
    /** Quantas pessoas mandaram força para esta sessão. */
    incentivosRecebidos?: number;
    iniciadaEm: string | null;
    onPausar: () => void;
    onEncerrar: () => void;
    onEstender: () => void;
    onPularDescanso: () => void;
    onConcluirBloco: () => void;
    onAbrirColegas?: () => void;
};

export default function SessaoAtiva(props: Props) {
    const emDescanso = props.fase !== "foco";
    if (emDescanso) return <TelaDescanso {...props} />;
    if (props.pausado) return <TelaPausada {...props} />;
    if (props.modo === "pomodoro") return <TelaPomodoroFoco {...props} />;
    return <TelaCronometro {...props} />;
}
/** Selo discreto com a torcida acumulada; some quando ninguém mandou força ainda. */
function SeloTorcida({ total }: { total?: number }) {
    if (!total) return null;

    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                marginTop: 14,
                backgroundColor: "rgba(255,154,0,0.12)",
                borderWidth: 1,
                borderColor: "rgba(255,154,0,0.28)",
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 5,
            }}
        >
            <HandMetal size={14} color={HADES.accentSolid} />
            <Text style={{ fontSize: 12, fontWeight: "700", color: HADES.accentSolid }}>
                {total === 1 ? "1 mandou força" : `${total} mandaram força`}
            </Text>
        </View>
    );
}

function TelaCronometro({
    materia,
    conteudo,
    publica,
    textoRelogio,
    colegas,
    incentivosRecebidos,
    iniciadaEm,
    onPausar,
    onEncerrar,
    onAbrirColegas,
}: Props) {
    return (
        <>
            <View style={{ flex: 1, alignItems: "center", paddingTop: 8, paddingHorizontal: 24 }}>
                {publica && (
                    <View style={{ marginTop: 12 }}>
                        <EtiquetaPublica />
                    </View>
                )}

                <Text style={{ fontSize: 20, fontWeight: "700", color: HADES.text, marginTop: publica ? 22 : 26 }}>
                    {materia || "Estudo geral"}
                </Text>
                <Text style={{ fontSize: 14, color: HADES.textMuted, marginTop: 5 }}>
                    {conteudo || "Sessão livre"}
                </Text>

                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <EtiquetaEmFoco />
                    <Relogio texto={textoRelogio} tamanho={colegas ? 64 : 72} />
                    {iniciadaEm && (
                        <Text style={{ fontSize: 13, color: HADES.textDim, marginTop: 12 }}>
                            iniciada às {iniciadaEm}
                        </Text>
                    )}
                    <SeloTorcida total={incentivosRecebidos} />
                </View>

                {colegas && (
                    <ColegasFocando nomes={colegas} total={colegas.length} onPress={onAbrirColegas} />
                )}
            </View>

            <View style={{ paddingHorizontal: 24, paddingBottom: 12, gap: 12 }}>
                <BotaoPausar onPress={onPausar} />
                <BotaoEncerrar onPress={onEncerrar} />
            </View>
        </>
    );
}

function TelaPausada({ materia, conteudo, textoRelogio, colegas, incentivosRecebidos, onPausar, onEncerrar, onAbrirColegas }: Props) {
    return (
        <>
            <View style={{ flex: 1, alignItems: "center", paddingTop: 8, paddingHorizontal: 24 }}>
                <View style={{ marginTop: 24 }}>
                    <EtiquetaPausado />
                </View>

                <Text style={{ fontSize: 20, fontWeight: "700", color: HADES.text, marginTop: 26 }}>
                    {materia || "Estudo geral"}
                </Text>
                <Text style={{ fontSize: 14, color: HADES.textMuted, marginTop: 5 }}>
                    {conteudo || "Sessão livre"}
                </Text>

                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <Relogio texto={textoRelogio} tamanho={72} cor={HADES.textFaint} />
                    <SeloTorcida total={incentivosRecebidos} />
                </View>

                {colegas && (
                    <View style={{ width: "100%", marginBottom: 8 }}>
                        <ColegasFocando nomes={colegas} total={colegas.length} onPress={onAbrirColegas} />
                    </View>
                )}
            </View>

            <View style={{ paddingHorizontal: 24, paddingBottom: 12, gap: 12 }}>
                <TouchableOpacity
                    onPress={onPausar}
                    activeOpacity={0.85}
                    style={{
                        height: 60,
                        borderRadius: 16,
                        backgroundColor: HADES.accentSolid,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 9,
                    }}
                >
                    <Play size={20} color="#000" fill="#000" />
                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#000" }}>Retomar</Text>
                </TouchableOpacity>
                <BotaoEncerrar onPress={onEncerrar} />
            </View>
        </>
    );
}

function TelaPomodoroFoco({
    materia,
    conteudo,
    textoRelogio,
    progressoFase,
    ciclo,
    totalCiclos,
    contexto,
    incentivosRecebidos,
    podeControlarCronograma,
    onPausar,
    onEncerrar,
    onEstender,
    onConcluirBloco,
}: Props) {
    return (
        <>
            <View style={{ flex: 1, alignItems: "center", paddingTop: 8, paddingHorizontal: 24 }}>
                {!contexto && (
                    <>
                        <Text style={{ fontSize: 13, color: HADES.textMuted, marginTop: 14 }}>{materia}</Text>
                        <Text style={{ fontSize: 13, color: HADES.textDim, marginTop: 3 }} numberOfLines={1}>
                            {conteudo}
                        </Text>
                    </>
                )}

                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <AnelPomodoro progresso={progressoFase} cor={HADES.accentSolid}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                            <View
                                style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: HADES.accentSolid }}
                            />
                            <Text
                                style={{
                                    fontSize: 11,
                                    color: HADES.accentSolid,
                                    fontWeight: "700",
                                    letterSpacing: 1.2,
                                }}
                            >
                                FOCO
                            </Text>
                        </View>
                        <Relogio texto={textoRelogio} tamanho={contexto ? 58 : 60} />
                        <Text style={{ fontSize: contexto ? 12 : 13, color: HADES.textMuted, marginTop: 10 }}>
                            {contexto ? (
                                "restam do bloco"
                            ) : (
                                <>
                                    Ciclo <Text style={{ color: HADES.text, fontWeight: "600" }}>{ciclo} de {totalCiclos}</Text>
                                </>
                            )}
                        </Text>
                    </AnelPomodoro>
                    <SeloTorcida total={incentivosRecebidos} />
                </View>

                {!contexto && <PontosDeCiclo total={totalCiclos} concluidos={ciclo - 1} />}
            </View>

            <View
                style={{
                    paddingTop: 16,
                    paddingHorizontal: 24,
                    paddingBottom: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                }}
            >
                <TouchableOpacity
                    onPress={contexto ? onConcluirBloco : onEncerrar}
                    activeOpacity={0.85}
                    style={{
                        width: 56,
                        height: 56,
                        borderRadius: 16,
                        backgroundColor: HADES.surfaceRaised,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.10)",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    {contexto ? (
                        <Check size={20} color={VERDE} />
                    ) : (
                        <Square size={18} color={HADES.red} />
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={onPausar}
                    activeOpacity={0.85}
                    style={{
                        flex: 1,
                        height: 60,
                        borderRadius: 16,
                        backgroundColor: HADES.surfaceRaised,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.10)",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 9,
                    }}
                >
                    <Pause size={20} color={HADES.text} />
                    <Text style={{ fontSize: 16, fontWeight: "700", color: HADES.text }}>Pausar</Text>
                </TouchableOpacity>

                {!contexto && podeControlarCronograma !== false && (
                    <TouchableOpacity
                        onPress={onEstender}
                        activeOpacity={0.85}
                        style={{
                            height: 56,
                            paddingHorizontal: 16,
                            borderRadius: 16,
                            backgroundColor: HADES.surfaceRaised,
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.10)",
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4,
                        }}
                    >
                        <Text style={{ fontSize: 15, fontWeight: "700", color: HADES.text }}>+5</Text>
                        <Text style={{ fontSize: 12, color: HADES.textMuted }}>min</Text>
                    </TouchableOpacity>
                )}
            </View>
        </>
    );
}

function TelaDescanso({
    fase,
    textoRelogio,
    progressoFase,
    autoFoco,
    podeControlarCronograma,
    onPularDescanso,
    onEncerrar,
}: Props) {
    const longo = fase === "descansoLongo";

    return (
        <>
            <View style={{ flex: 1, alignItems: "center", paddingTop: 8, paddingHorizontal: 24 }}>
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        backgroundColor: "rgba(52,199,89,0.12)",
                        borderWidth: 1,
                        borderColor: "rgba(52,199,89,0.3)",
                        borderRadius: 20,
                        paddingVertical: 8,
                        paddingHorizontal: 16,
                        marginTop: 14,
                    }}
                >
                    <Repeat size={15} color={VERDE} />
                    <Text style={{ fontSize: 13, color: VERDE, fontWeight: "600" }}>Hora de respirar</Text>
                </View>

                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <AnelPomodoro
                        progresso={progressoFase}
                        cor={VERDE}
                        corTrilha="rgba(255,255,255,0.06)"
                    >
                        <Text
                            style={{
                                fontSize: 11,
                                color: VERDE,
                                fontWeight: "700",
                                letterSpacing: 1.2,
                                marginBottom: 8,
                            }}
                        >
                            {longo ? "DESCANSO LONGO" : "DESCANSO CURTO"}
                        </Text>
                        <Relogio texto={textoRelogio} tamanho={60} cor={VERDE_CLARO} />
                    </AnelPomodoro>
                </View>

                {autoFoco && (
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 7,
                            marginBottom: 8,
                        }}
                    >
                    </View>
                )}
            </View>

            <View style={{ paddingTop: 16, paddingHorizontal: 24, paddingBottom: 12, gap: 12 }}>
                {podeControlarCronograma !== false ? (
                    <TouchableOpacity
                        onPress={onPularDescanso}
                        activeOpacity={0.85}
                        style={{
                            height: 60,
                            borderRadius: 16,
                            backgroundColor: "rgba(52,199,89,0.14)",
                            borderWidth: 1,
                            borderColor: "rgba(52,199,89,0.35)",
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 9,
                        }}
                    >
                        <SkipForward size={19} color={VERDE} />
                        <Text style={{ fontSize: 16, fontWeight: "700", color: VERDE_CLARO }}>Pular descanso</Text>
                    </TouchableOpacity>
                ) : (
                    // Quem entrou na sessão não encurta o descanso do grupo — mas precisa
                    // saber por que o botão não está ali.
                    <Text
                        style={{
                            fontSize: 13,
                            color: "#5f7a68",
                            textAlign: "center",
                            paddingVertical: 18,
                        }}
                    >
                        O descanso acaba junto para todo mundo.
                    </Text>
                )}

                <TouchableOpacity
                    onPress={onEncerrar}
                    activeOpacity={0.7}
                    style={{ height: 50, borderRadius: 15, alignItems: "center", justifyContent: "center" }}
                >
                    <Text style={{ fontSize: 15, fontWeight: "600", color: "#5f7a68" }}>Encerrar sessão</Text>
                </TouchableOpacity>
            </View>
        </>
    );
}

function BotaoPausar({ onPress }: { onPress: () => void }) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.85}
            style={{
                height: 60,
                borderRadius: 16,
                backgroundColor: HADES.surfaceRaised,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.10)",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 9,
            }}
        >
            <Pause size={20} color={HADES.text} />
            <Text style={{ fontSize: 16, fontWeight: "700", color: HADES.text }}>Pausar</Text>
        </TouchableOpacity>
    );
}

function BotaoEncerrar({ onPress }: { onPress: () => void }) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.85}
            style={{
                height: 52,
                borderRadius: 15,
                borderWidth: 1.5,
                borderColor: "rgba(240,85,107,0.4)",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
            }}
        >
            <Square size={16} color={HADES.red} />
            <Text style={{ fontSize: 15, fontWeight: "600", color: HADES.red }}>Encerrar sessão</Text>
        </TouchableOpacity>
    );
}
