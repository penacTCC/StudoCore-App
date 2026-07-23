import { useEffect, useRef } from "react";
import { Animated, View, Text, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Flame, Clock, Target, Lock, BarChart3, PieChart, Rocket, Play } from "lucide-react-native";

import { CartaoMetrica, CORES } from "@/components/analytics/GraficosAnalise";

/** Aplica alfa a uma cor hex de 6 dígitos (ex.: "#3b82f6" + 0.3 -> "rgba(59,130,246,0.3)"). */
function comAlfa(hex: string, alfa: number) {
    const valor = hex.replace("#", "");
    const r = parseInt(valor.substring(0, 2), 16);
    const g = parseInt(valor.substring(2, 4), 16);
    const b = parseInt(valor.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alfa})`;
}

/** Fade + leve slide-up na entrada, equivalente à animação "emptyIn" do mockup. */
function useEntradaAnimada() {
    const opacidade = useRef(new Animated.Value(0)).current;
    const deslocamento = useRef(new Animated.Value(10)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(opacidade, { toValue: 1, duration: 350, useNativeDriver: true }),
            Animated.timing(deslocamento, { toValue: 0, duration: 350, useNativeDriver: true }),
        ]).start();
    }, [opacidade, deslocamento]);

    return { opacity: opacidade, transform: [{ translateY: deslocamento }] };
}

/** Barra que pulsa (opacidade 0.5 <-> 0.85) pro esqueleto de carregamento do estado vazio. */
function BarraEsqueleto({ altura, atraso }: { altura: `${number}%`; atraso: number }) {
    const opacidade = useRef(new Animated.Value(0.5)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.delay(atraso),
                Animated.timing(opacidade, { toValue: 0.85, duration: 900, useNativeDriver: true }),
                Animated.timing(opacidade, { toValue: 0.5, duration: 900, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [opacidade, atraso]);

    return (
        <Animated.View
            style={{ flex: 1, height: altura, backgroundColor: CORES.pillAtivo, borderRadius: 6, opacity: opacidade }}
        />
    );
}

// ── Linha "desbloqueie em breve" (item bloqueado com cadeado) ───────────
function LinhaBloqueada({
    icone: Icone,
    titulo,
    descricao,
}: {
    icone: typeof BarChart3;
    titulo: string;
    descricao: string;
}) {
    return (
        <View className="flex-row items-center gap-3 rounded-2xl border border-[rgba(255,255,255,0.05)] bg-[#0b0c10] p-3.5">
            <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-[#131418]">
                <Icone size={17} color={CORES.textoFraco} />
            </View>
            <View className="flex-1">
                <Text className="text-[13.5px] font-semibold text-[#c9ccd2]">{titulo}</Text>
                <Text className="mt-0.5 text-[11.5px] text-[#5f636c]">{descricao}</Text>
            </View>
            <Lock size={15} color="#4a4d55" />
        </View>
    );
}

// ════════════════════════════════════════════════════════════════════════
// PESSOAL · poucos dados
// ════════════════════════════════════════════════════════════════════════
export function EstadoPoucosDadosPessoal({
    cor,
    qtdSessoesTotal,
    diasFaltantes,
    horasHoje,
    qtdSessoesHoje,
    questoesHoje,
    pctAcertoHoje,
}: {
    cor: string;
    qtdSessoesTotal: number;
    diasFaltantes: number;
    horasHoje: string;
    qtdSessoesHoje: number;
    questoesHoje: number;
    pctAcertoHoje: number;
}) {
    const estiloEntrada = useEntradaAnimada();
    const ordinal = qtdSessoesTotal === 1 ? "1ª" : `${qtdSessoesTotal}ª`;

    return (
        <Animated.View style={estiloEntrada}>
            <LinearGradient
                colors={[comAlfa(cor, 0.22), CORES.cartao]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 11,
                    borderWidth: 1,
                    borderColor: comAlfa(cor, 0.3),
                    borderRadius: 14,
                    padding: 14,
                    marginBottom: 24,
                }}
            >
                <View
                    className="h-[34px] w-[34px] items-center justify-center rounded-[10px]"
                    style={{ backgroundColor: comAlfa(cor, 0.25) }}
                >
                    <Flame size={18} color={cor} />
                </View>
                <View className="flex-1">
                    <Text className="text-sm font-bold text-white">Bom começo! 🔥</Text>
                    <Text className="mt-1 text-[12.5px] leading-[18px] text-[#b7bac2]">
                        Você registrou sua {ordinal} sessão. Estude mais{" "}
                        <Text className="font-semibold text-white">
                            {diasFaltantes} {diasFaltantes === 1 ? "dia" : "dias"}
                        </Text>{" "}
                        para desbloquear suas tendências.
                    </Text>
                </View>
            </LinearGradient>

            <View className="mb-6 flex-row gap-[10px]">
                <CartaoMetrica icone={Clock} rotulo="HORAS HOJE" valor={horasHoje} legenda={`${qtdSessoesHoje} ${qtdSessoesHoje === 1 ? "sessão" : "sessões"}`} />
                <CartaoMetrica icone={Target} rotulo="QUESTÕES" valor={questoesHoje.toString()} legenda={`${pctAcertoHoje}% de acerto`} />
            </View>

            <Text className="mb-3 text-xs font-semibold tracking-[0.5px] text-[#5f636c]">DESBLOQUEIE EM BREVE</Text>
            <View className="gap-2.5">
                <LinhaBloqueada icone={BarChart3} titulo="Comparação semanal" descricao="Precisa de 2 semanas de dados" />
                <LinhaBloqueada icone={PieChart} titulo="Distribuição por matéria" descricao="Estude 3 matérias diferentes" />
                <LinhaBloqueada icone={Flame} titulo="Evolução da ofensiva" descricao="Mantenha 3 dias seguidos" />
            </View>
        </Animated.View>
    );
}

// ════════════════════════════════════════════════════════════════════════
// PESSOAL · vazio (nova conta)
// ════════════════════════════════════════════════════════════════════════
export function EstadoVazioPessoal({ cor, aoIniciarSessao }: { cor: string; aoIniciarSessao: () => void }) {
    const estiloEntrada = useEntradaAnimada();
    const alturas: `${number}%`[] = ["38%", "62%", "48%", "80%", "56%", "92%", "70%"];

    return (
        <Animated.View style={[estiloEntrada, { paddingTop: 8, alignItems: "center" }]}>
            <View className="mb-1.5 h-[118px] w-full flex-row items-end justify-between gap-2 px-1">
                {alturas.map((altura, i) => (
                    <BarraEsqueleto key={i} altura={altura} atraso={i * 150} />
                ))}
            </View>

            <LinearGradient
                colors={[comAlfa(cor, 0.85), cor]}
                start={{ x: 0.15, y: 0 }}
                end={{ x: 0.85, y: 1 }}
                style={{
                    width: 66,
                    height: 66,
                    borderRadius: 20,
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 26,
                    marginBottom: 20,
                }}
            >
                <Rocket size={30} color="#0b0c10" />
            </LinearGradient>

            <Text className="text-center text-xl font-bold tracking-[-0.4px] text-white">Sua jornada começa agora</Text>
            <Text className="mt-2 max-w-[270px] text-center text-[13.5px] leading-[19.5px] text-[#8a8d96]">
                Faça sua primeira sessão de foco e veja suas horas, matérias e ofensiva ganharem vida aqui.
            </Text>

            <TouchableOpacity
                onPress={aoIniciarSessao}
                activeOpacity={0.85}
                className="mt-6 flex-row items-center justify-center gap-2 rounded-2xl px-[26px] py-[15px]"
                style={{ backgroundColor: cor }}
            >
                <Play size={17} color="#0b0c10" />
                <Text className="text-[15px] font-bold text-[#0b0c10]">Iniciar sessão de foco</Text>
            </TouchableOpacity>

            <View className="mt-[26px] flex-row gap-2">
                {[
                    { icone: Clock, rotulo: "Horas" },
                    { icone: PieChart, rotulo: "Matérias" },
                    { icone: Flame, rotulo: "Ofensiva" },
                ].map(({ icone: Icone, rotulo }) => (
                    <View
                        key={rotulo}
                        className="flex-row items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.06)] bg-[#0d0e12] px-3 py-2"
                    >
                        <Icone size={13} color={CORES.textoMuted} />
                        <Text className="text-xs font-medium text-[#8a8d96]">{rotulo}</Text>
                    </View>
                ))}
            </View>
        </Animated.View>
    );
}
