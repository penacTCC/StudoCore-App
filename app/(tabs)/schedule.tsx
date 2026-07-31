import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Settings } from "lucide-react-native";
import { HADES } from "@/constants/hades";
import AbasCronograma from "@/components/cronograma/AbasCronograma";
import AbaHoje from "@/components/cronograma/AbaHoje";
import AbaSemana from "@/components/cronograma/AbaSemana";
import AbaPlanos from "@/components/cronograma/AbaPlanos";
import { resumoSemana } from "@/constants/cronograma-mock";
import type { AbaCronograma, BlocoDoDia, Plano } from "@/types/cronograma";
import { pegarIntervaloSemanaFormatado } from "@/utils/tempo";
import { useAuth } from "@/hooks/useAuth";
import { usePlanos } from "@/hooks/usePlanos";
import { useAgendaHoje } from "@/hooks/useAgendaHoje";

const DIAS_EXTENSO = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MESES = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function dataPorExtenso(d: Date) {
    return `${DIAS_EXTENSO[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/** Horário de fim do bloco, formatado como "11h" ou "11h30" (mesmo estilo do resumo do dia). */
function calcularFimEm(bloco: BlocoDoDia) {
    const [h, m] = bloco.horaInicio.split(":").map(Number);
    const fimMin = h * 60 + m + bloco.duracaoMin;
    const horaFim = Math.floor(fimMin / 60) % 24;
    const minFim = fimMin % 60;
    return minFim === 0 ? `${horaFim}h` : `${horaFim}h${minFim.toString().padStart(2, "0")}`;
}

export default function ScheduleScreen() {
    const router = useRouter();
    const { aba: abaAlvo } = useLocalSearchParams<{ aba?: AbaCronograma }>();
    const { userId } = useAuth();
    const { planos, carregando: carregandoPlanos, recarregarPlanos } = usePlanos(userId);
    const { blocos: blocosDeHoje, resumo: resumoHoje, carregando: carregandoHoje, recarregar: recarregarHoje } = useAgendaHoje(userId);
    const [aba, setAba] = useState<AbaCronograma>("hoje");
    const [menuPlanoId, setMenuPlanoId] = useState<string | null>(null);

    // O plano-editor volta pra cá com `?aba=planos` (via dismissTo) depois de salvar,
    // pra pousar direto na aba de planos em vez de deixar a última aba visitada.
    useEffect(() => {
        if (abaAlvo) {
            setAba(abaAlvo);
            router.setParams({ aba: undefined });
        }
    }, [abaAlvo]);

    const hoje = new Date();

    const subtitulo =
        aba === "hoje"
            ? dataPorExtenso(hoje)
            : aba === "semana"
                ? pegarIntervaloSemanaFormatado()
                : `${planos.length} planos salvos`;

    const abrirEditor = (planoId?: string, aplicarHoje?: boolean) =>
        router.push({
            pathname: "/(modals)/plano-editor",
            params: {
                ...(planoId ? { planoId } : {}),
                ...(aplicarHoje ? { aplicarHoje: "1" } : {}),
            },
        });

    const iniciarFoco = (bloco: BlocoDoDia) =>
        router.push({
            pathname: "/(tabs)/focus",
            params: {
                subject: bloco.materia ?? "",
                content: bloco.topico ?? "",
                blocoId: bloco.id,
                origemBloco: bloco.origem ?? "rotina",
                duracaoMin: bloco.duracaoMin.toString(),
                fimEm: calcularFimEm(bloco),
            },
        });

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top"]}>
            {/* Header */}
            <View style={{ paddingTop: 6, paddingHorizontal: 20, paddingBottom: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
                    <View>
                        <Text
                            style={{
                                fontSize: 23,
                                fontWeight: "700",
                                color: HADES.text,
                                letterSpacing: -0.3,
                            }}
                        >
                            Cronograma
                        </Text>
                        <Text style={{ fontSize: 13, color: HADES.textMuted, marginTop: 2 }}>{subtitulo}</Text>
                    </View>

                    <TouchableOpacity
                        onPress={() => router.push("/(modals)/cronograma-config")}
                        activeOpacity={0.8}
                        style={{
                            width: 38,
                            height: 38,
                            borderRadius: 19,
                            backgroundColor: HADES.surfaceRaised,
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <Settings size={18} color={HADES.textSecondary} />
                    </TouchableOpacity>
                </View>
            </View>

            <AbasCronograma ativa={aba} onChange={setAba} />

            {aba === "hoje" && (
                <AbaHoje
                    blocos={blocosDeHoje}
                    resumo={resumoHoje}
                    carregando={carregandoHoje}
                    onIniciarFoco={iniciarFoco}
                    onMontarDia={() => abrirEditor(undefined, true)}
                    onAplicarPlano={() => setAba("planos")}
                    refreshing={carregandoHoje}
                    onRefresh={recarregarHoje}
                />
            )}

            {aba === "semana" && (
                <AbaSemana resumo={resumoSemana} />
            )}

            {aba === "planos" && (
                <AbaPlanos
                    planos={planos}
                    userId={userId}
                    menuAbertoId={menuPlanoId}
                    carregando={carregandoPlanos}
                    onAbrirMenu={setMenuPlanoId}
                    onNovoPlano={() => abrirEditor()}
                    onEditarPlano={(p: Plano) => abrirEditor(p.id)}
                    onRecarregar={() => {
                        recarregarPlanos();
                        recarregarHoje();
                    }}
                />
            )}
        </SafeAreaView>
    );
}
