import { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Settings } from "lucide-react-native";
import { HADES } from "@/constants/hades";
import AbasCronograma from "@/components/cronograma/AbasCronograma";
import AbaHoje from "@/components/cronograma/AbaHoje";
import AbaSemana from "@/components/cronograma/AbaSemana";
import AbaPlanos from "@/components/cronograma/AbaPlanos";
import {
    blocosDeHoje,
    resumoHoje,
    planosSalvos,
    blocosDaSemana,
    resumoSemana,
} from "@/constants/cronograma-mock";
import type { AbaCronograma, BlocoDoDia, Plano } from "@/types/cronograma";

const DIAS_EXTENSO = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MESES = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function dataPorExtenso(d: Date) {
    return `${DIAS_EXTENSO[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

export default function ScheduleScreen() {
    const router = useRouter();
    const [aba, setAba] = useState<AbaCronograma>("hoje");
    const [menuPlanoId, setMenuPlanoId] = useState<string | null>(null);

    // Sem backend ainda: os dados vêm de constants/cronograma-mock.
    const hoje = new Date();

    const subtitulo =
        aba === "hoje"
            ? dataPorExtenso(hoje)
            : aba === "semana"
                ? resumoSemana.intervalo
                : `${planosSalvos.length} planos salvos`;

    const abrirEditor = (planoId?: string) =>
        router.push({
            pathname: "/(modals)/plano-editor",
            params: planoId ? { planoId } : undefined,
        });

    const iniciarFoco = (bloco: BlocoDoDia) =>
        router.push({
            pathname: "/(tabs)/focus",
            params: {
                subject: bloco.materia ?? "",
                content: bloco.topico ?? "",
                blocoId: bloco.id,
                duracaoMin: bloco.duracaoMin.toString(),
                fimEm: resumoHoje.proximo.hora,
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
                    onIniciarFoco={iniciarFoco}
                    onMontarDia={() => abrirEditor()}
                    onAplicarPlano={() => setAba("planos")}
                />
            )}

            {aba === "semana" && (
                <AbaSemana blocos={blocosDaSemana} resumo={resumoSemana} diaAtual={2} />
            )}

            {aba === "planos" && (
                <AbaPlanos
                    planos={planosSalvos}
                    menuAbertoId={menuPlanoId}
                    onAbrirMenu={setMenuPlanoId}
                    onNovoPlano={() => abrirEditor()}
                    onEditarPlano={(p: Plano) => abrirEditor(p.id)}
                />
            )}
        </SafeAreaView>
    );
}
