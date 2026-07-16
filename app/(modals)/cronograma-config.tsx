import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { HADES } from "@/constants/hades";
import {
    SecaoConfig,
    LinhaStepper,
    LinhaSwitch,
    LinhaEscolha,
} from "@/components/cronograma/LinhasConfig";
import type { PreferenciasCronograma } from "@/types/cronograma";

const PADRAO: PreferenciasCronograma = {
    focoMin: 25,
    descansoCurtoMin: 5,
    descansoLongoMin: 15,
    ciclosAteLongo: 4,
    autoDescanso: true,
    autoFoco: false,
    notificacoesAtivas: true,
    antecedenciaMin: 10,
    avisarFimDeFase: true,
    resumoDiaSeguinte: false,
    naoPerturbar: true,
    naoPerturbarInicio: "22:00",
    naoPerturbarFim: "07:00",
    somFimFoco: true,
    vibrar: true,
    manterTelaLigada: false,
    inicioSemana: "segunda",
    duracaoPadraoBlocoMin: 50,
    duracaoPadraoDescansoMin: 10,
    contarDescansoComoEstudado: false,
};

/** Mantém o valor dentro de [min, max] ao usar os steppers. */
function limitar(valor: number, min: number, max: number) {
    return Math.min(max, Math.max(min, valor));
}

export default function CronogramaConfigScreen() {
    const router = useRouter();
    // Sem backend ainda: as preferências vivem só no estado da tela.
    const [prefs, setPrefs] = useState<PreferenciasCronograma>(PADRAO);

    const ajustar = <C extends keyof PreferenciasCronograma>(
        chave: C,
        valor: PreferenciasCronograma[C]
    ) => setPrefs((atual) => ({ ...atual, [chave]: valor }));

    const alternar = (chave: keyof PreferenciasCronograma) =>
        setPrefs((atual) => ({ ...atual, [chave]: !atual[chave] }));

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.settingsBg }} edges={["top"]}>
            {/* Header */}
            <View
                style={{
                    paddingTop: 6,
                    paddingHorizontal: 20,
                    paddingBottom: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                }}
            >
                <TouchableOpacity
                    onPress={() => router.back()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <ChevronLeft size={22} color={HADES.textSecondary} />
                </TouchableOpacity>
                <Text style={{ fontSize: 20, fontWeight: "700", color: HADES.text }}>Configurações</Text>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
                showsVerticalScrollIndicator={false}
            >
                <SecaoConfig titulo="POMODORO">
                    <LinhaStepper
                        rotulo="Foco"
                        valor={`${prefs.focoMin}min`}
                        onDiminuir={() => ajustar("focoMin", limitar(prefs.focoMin - 5, 5, 180))}
                        onAumentar={() => ajustar("focoMin", limitar(prefs.focoMin + 5, 5, 180))}
                    />
                    <LinhaStepper
                        rotulo="Descanso curto"
                        valor={`${prefs.descansoCurtoMin}min`}
                        onDiminuir={() => ajustar("descansoCurtoMin", limitar(prefs.descansoCurtoMin - 1, 1, 30))}
                        onAumentar={() => ajustar("descansoCurtoMin", limitar(prefs.descansoCurtoMin + 1, 1, 30))}
                    />
                    <LinhaStepper
                        rotulo="Descanso longo"
                        valor={`${prefs.descansoLongoMin}min`}
                        onDiminuir={() => ajustar("descansoLongoMin", limitar(prefs.descansoLongoMin - 5, 5, 60))}
                        onAumentar={() => ajustar("descansoLongoMin", limitar(prefs.descansoLongoMin + 5, 5, 60))}
                    />
                    <LinhaStepper
                        rotulo="Ciclos até o longo"
                        valor={`${prefs.ciclosAteLongo}`}
                        onDiminuir={() => ajustar("ciclosAteLongo", limitar(prefs.ciclosAteLongo - 1, 2, 8))}
                        onAumentar={() => ajustar("ciclosAteLongo", limitar(prefs.ciclosAteLongo + 1, 2, 8))}
                    />
                    <LinhaSwitch
                        rotulo="Iniciar descanso automaticamente"
                        ligado={prefs.autoDescanso}
                        onToggle={() => alternar("autoDescanso")}
                    />
                    <LinhaSwitch
                        rotulo="Iniciar próximo foco automaticamente"
                        ligado={prefs.autoFoco}
                        onToggle={() => alternar("autoFoco")}
                        ultima
                    />
                </SecaoConfig>

                <SecaoConfig titulo="NOTIFICAÇÕES">
                    <LinhaSwitch
                        rotulo="Notificações do cronograma"
                        ligado={prefs.notificacoesAtivas}
                        onToggle={() => alternar("notificacoesAtivas")}
                    />
                    <LinhaStepper
                        rotulo="Antecedência padrão"
                        valor={`${prefs.antecedenciaMin} min`}
                        largura={48}
                        onDiminuir={() => ajustar("antecedenciaMin", limitar(prefs.antecedenciaMin - 5, 0, 60))}
                        onAumentar={() => ajustar("antecedenciaMin", limitar(prefs.antecedenciaMin + 5, 0, 60))}
                    />
                    <LinhaSwitch
                        rotulo="Avisar no fim de cada fase"
                        ligado={prefs.avisarFimDeFase}
                        onToggle={() => alternar("avisarFimDeFase")}
                    />
                    <LinhaSwitch
                        rotulo="Resumo do dia seguinte"
                        ligado={prefs.resumoDiaSeguinte}
                        onToggle={() => alternar("resumoDiaSeguinte")}
                    />
                    <LinhaSwitch
                        rotulo="Não perturbar"
                        descricao={`${prefs.naoPerturbarInicio} – ${prefs.naoPerturbarFim}`}
                        ligado={prefs.naoPerturbar}
                        onToggle={() => alternar("naoPerturbar")}
                        ultima
                    />
                </SecaoConfig>

                <SecaoConfig titulo="SOM E VIBRAÇÃO">
                    <LinhaSwitch
                        rotulo="Som ao fim do foco"
                        ligado={prefs.somFimFoco}
                        onToggle={() => alternar("somFimFoco")}
                    />
                    <LinhaSwitch rotulo="Vibrar" ligado={prefs.vibrar} onToggle={() => alternar("vibrar")} />
                    <LinhaSwitch
                        rotulo="Manter tela ligada"
                        ligado={prefs.manterTelaLigada}
                        onToggle={() => alternar("manterTelaLigada")}
                        ultima
                    />
                </SecaoConfig>

                <SecaoConfig titulo="CRONOGRAMA">
                    <LinhaEscolha
                        rotulo="Início da semana"
                        valor={prefs.inicioSemana === "segunda" ? "Segunda" : "Domingo"}
                        onPress={() =>
                            ajustar("inicioSemana", prefs.inicioSemana === "segunda" ? "domingo" : "segunda")
                        }
                    />
                    <LinhaStepper
                        rotulo="Duração padrão do bloco"
                        valor={`${prefs.duracaoPadraoBlocoMin}min`}
                        onDiminuir={() =>
                            ajustar("duracaoPadraoBlocoMin", limitar(prefs.duracaoPadraoBlocoMin - 5, 10, 180))
                        }
                        onAumentar={() =>
                            ajustar("duracaoPadraoBlocoMin", limitar(prefs.duracaoPadraoBlocoMin + 5, 10, 180))
                        }
                    />
                    <LinhaStepper
                        rotulo="Duração padrão do descanso"
                        valor={`${prefs.duracaoPadraoDescansoMin}min`}
                        onDiminuir={() =>
                            ajustar("duracaoPadraoDescansoMin", limitar(prefs.duracaoPadraoDescansoMin - 5, 5, 60))
                        }
                        onAumentar={() =>
                            ajustar("duracaoPadraoDescansoMin", limitar(prefs.duracaoPadraoDescansoMin + 5, 5, 60))
                        }
                    />
                    <LinhaSwitch
                        rotulo="Contar descanso como estudado"
                        descricao="Descanso nunca conta como tempo de estudo — mantém suas horas reais fiéis."
                        ligado={false}
                        travado
                        ultima
                    />
                </SecaoConfig>

                <View style={{ height: 10 }} />
            </ScrollView>
        </SafeAreaView>
    );
}
