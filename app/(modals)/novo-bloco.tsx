import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput } from "react-native";
import { SafeAreaView } from "@/components/ui/TelaSegura";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Plus } from "@/components/ui/icons";
import { HADES } from "@/constants/hades";
import { Skeleton } from "@/components/ui/Skeleton";
import WheelPicker from "@/components/ui/WheelPicker";
import { useAuth } from "@/hooks/useAuth";
import { useMaterias } from "@/hooks/useMaterias";
import { usePreferencias } from "@/hooks/usePreferencias";
import { salvarBlocoRotina, editarBlocoRotina, buscarBlocoPorId, buscarBlocosSemana } from "@/services/schedule";
import { toast } from "@/services/toast";
import type { BlocoRotina } from "@/types/cronograma";

const DIAS_CURTOS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const DIAS_LONGOS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

const HORAS = ["0", "1", "2", "3", "4"];
const MINUTOS_DURACAO = ["00", "15", "30", "45"];
const MINUTOS_LEMBRETE = ["5", "10", "15", "20", "30", "45", "60"];

function paraHoraMin(totalMin: number) {
    const h = Math.floor((totalMin + 1440) / 60) % 24;
    const m = (totalMin + 1440) % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/** Índice do item mais próximo de `valor` — evita cair no índice 0 quando o valor não bate exato na grade. */
function indiceMaisProximo(lista: string[], valor: number) {
    let melhor = 0;
    let menorDiferenca = Infinity;
    lista.forEach((item, i) => {
        const diferenca = Math.abs(Number(item) - valor);
        if (diferenca < menorDiferenca) {
            menorDiferenca = diferenca;
            melhor = i;
        }
    });
    return melhor;
}

export default function NovoBlocoScreen() {
    const router = useRouter();
    const { dia, blocoId } = useLocalSearchParams<{ dia?: string; blocoId?: string }>();
    const modoEdicao = !!blocoId;
    const {userId} = useAuth()
    const { materiasComCores } = useMaterias(userId);
    const { prefs, carregando: carregandoPrefs } = usePreferencias(userId);
    const [diaIndex, setDiaIndex] = useState(dia ? Number(dia) : 1);

    const [materiaId, setMateriaId] = useState<string | undefined>(undefined);
    const [topico, setTopico] = useState("");
    const [inicioMin, setInicioMin] = useState(18 * 60 + 30);
    const [horasIdx, setHorasIdx] = useState(1);
    const [minutosIdx, setMinutosIdx] = useState(2);
    const [lembreteAtivo, setLembreteAtivo] = useState(true);
    const [lembreteIdx, setLembreteIdx] = useState(2);
    const [carregandoBloco, setCarregandoBloco] = useState(!!blocoId);
    const [blocosExistentes, setBlocosExistentes] = useState<BlocoRotina[]>([]);
    const [carregandoHorarios, setCarregandoHorarios] = useState(!modoEdicao);

    useEffect(() => {
        if (modoEdicao || !userId) {
            setCarregandoHorarios(false);
            return;
        }

        let ativo = true;
        buscarBlocosSemana(userId).then(({ data, error }) => {
            if (!ativo) return;
            if (error) {
                console.error("Erro ao carregar horários da semana:", error);
                toast.error("Não foi possível verificar os horários já preenchidos.");
            }
            setBlocosExistentes(data ?? []);
            setCarregandoHorarios(false);
        });

        return () => {
            ativo = false;
        };
    }, [modoEdicao, userId]);

    const limiteInicioMin = useMemo(() => {
        if (modoEdicao) return null;
        const finais = blocosExistentes
            .filter((bloco) => bloco.dia_semana === diaIndex)
            .map((bloco) => {
                const [horas, minutos] = bloco.hora_inicio.split(":").map(Number);
                return horas * 60 + minutos + bloco.duracao_min;
            });
        if (finais.length === 0) return null;
        const fim = Math.max(...finais);
        return ((fim % 1440) + 1440) % 1440;
    }, [blocosExistentes, diaIndex, modoEdicao]);

    const duracaoMin = Number(HORAS[horasIdx]) * 60 + Number(MINUTOS_DURACAO[minutosIdx]);
    const fimMin = inicioMin + duracaoMin;
    const duracaoInvalida = duracaoMin === 0;

    const avisarHorarioJaPreenchido = () => {
        if (limiteInicioMin === null) return;
        toast.info(
            `O horário anterior a ${paraHoraMin(limiteInicioMin)} já está preenchido com um bloco de estudo ou descanso.`
        );
    };

    const ajustarInicio = (delta: number) => {
        const novoInicio = ((inicioMin + delta) % 1440 + 1440) % 1440;
        if (limiteInicioMin !== null && novoInicio < limiteInicioMin) {
            setInicioMin(limiteInicioMin);
            avisarHorarioJaPreenchido();
            return;
        }
        setInicioMin(novoInicio);
    };

    const resumo = useMemo(
        () => `${DIAS_CURTOS[diaIndex]} · ${paraHoraMin(inicioMin)} – ${paraHoraMin(fimMin)}`,
        [diaIndex, inicioMin, fimMin]
    );

    useEffect(() => {
        if (modoEdicao || carregandoHorarios) return;
        setInicioMin(limiteInicioMin ?? 18 * 60 + 30);
    }, [modoEdicao, carregandoHorarios, diaIndex, limiteInicioMin]);

    // Seleciona a primeira matéria assim que a lista carrega (nenhuma escolhida ainda).
    useEffect(() => {
        if (!materiaId && materiasComCores.length > 0) {
            setMateriaId(materiasComCores[0].id);
        }
    }, [materiaId, materiasComCores]);

    /*
      Bloco novo nasce com as durações e a antecedência definidas nas preferências
      do cronograma. Em modo edição não faz nada: lá quem manda é o bloco salvo.
    */
    useEffect(() => {
        if (modoEdicao || carregandoPrefs) return;

        const horas = Math.floor(prefs.duracaoPadraoBlocoMin / 60);
        setHorasIdx(indiceMaisProximo(HORAS, horas));
        setMinutosIdx(indiceMaisProximo(MINUTOS_DURACAO, prefs.duracaoPadraoBlocoMin % 60));

        setLembreteAtivo(prefs.notificacoesAtivas && prefs.antecedenciaMin > 0);
        if (prefs.antecedenciaMin > 0) {
            setLembreteIdx(indiceMaisProximo(MINUTOS_LEMBRETE, prefs.antecedenciaMin));
        }
    }, [modoEdicao, carregandoPrefs, prefs.duracaoPadraoBlocoMin, prefs.antecedenciaMin, prefs.notificacoesAtivas]);

    // Modo edição: carrega o bloco existente e preenche o formulário.
    useEffect(() => {
        if (!blocoId) return;
        const carregarBloco = async () => {
            const { data, error } = await buscarBlocoPorId(blocoId);
            if (error || !data) {
                console.error(error);
                toast.error("Não foi possível carregar esse bloco.");
                setCarregandoBloco(false);
                return;
            }

            setDiaIndex(data.dia_semana);
            setMateriaId(data.materia_id ?? undefined);
            setTopico(data.topico ?? "");

            const [h, m] = data.hora_inicio.split(":").map(Number);
            setInicioMin(h * 60 + m);

            const horas = Math.floor(data.duracao_min / 60);
            const minutosRestantes = data.duracao_min % 60;
            setHorasIdx(indiceMaisProximo(HORAS, horas));
            setMinutosIdx(indiceMaisProximo(MINUTOS_DURACAO, minutosRestantes));

            setLembreteAtivo(data.notificar);
            if (data.antecedencia_min) {
                const idx = MINUTOS_LEMBRETE.indexOf(data.antecedencia_min.toString());
                if (idx >= 0) setLembreteIdx(idx);
            }
            setCarregandoBloco(false);
        };
        carregarBloco();
    }, [blocoId]);

    //Crud de blocos
    const onSubmit = async () => {
        if (!userId || !materiaId) return
        if (limiteInicioMin !== null && inicioMin < limiteInicioMin) {
            setInicioMin(limiteInicioMin);
            avisarHorarioJaPreenchido();
            return false;
        }
        const payload = {
            usuario_id: userId,
            dia_semana: diaIndex,
            hora_inicio: paraHoraMin(inicioMin),
            duracao_min: duracaoMin,
            tipo: "estudo" as const,
            materia_id: materiaId,
            topico: topico || null,
            notificar: lembreteAtivo,
            antecedencia_min: lembreteAtivo ? Number(MINUTOS_LEMBRETE[lembreteIdx]) : null,
        }
        const { error } = modoEdicao && blocoId
            ? await editarBlocoRotina({ id: blocoId, ...payload })
            : await salvarBlocoRotina(payload)
        if(error){
            console.error("Erro ao salvar bloco:", error);
            toast.error("Não foi possível salvar o bloco de estudos. Tente novamente.");
            return false;
        }
        return true;
    }


    if (carregandoBloco) {
        return <NovoBlocoSkeleton />;
    }

    return (
        <View style={{ flex: 1, backgroundColor: HADES.bg }}>
            <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
                {/* Alça */}
                <View style={{ paddingTop: 12, paddingBottom: 4, alignItems: "center" }}>
                    <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: HADES.dot }} />
                </View>

                {/* Cabeçalho */}
                <View
                    style={{
                        paddingTop: 8,
                        paddingBottom: 14,
                        paddingHorizontal: 20,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}
                >
                    <TouchableOpacity
                        onPress={() => router.back()}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={{ width: 56 }}
                    >
                        <Text style={{ fontSize: 14, color: HADES.textMuted }}>Cancelar</Text>
                    </TouchableOpacity>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: HADES.text }}>
                        {modoEdicao ? "Editar bloco" : "Novo bloco"}
                    </Text>
                    <View style={{ width: 56 }} />
                </View>

                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Dia da semana */}
                    <Text
                        style={{
                            fontSize: 12,
                            color: HADES.textFaint,
                            fontWeight: "600",
                            letterSpacing: 0.5,
                            marginBottom: 10,
                        }}
                    >
                        DIA DA SEMANA
                    </Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 8, paddingBottom: 2 }}
                    >
                        {DIAS_CURTOS.map((rotulo, i) => {
                            const selecionado = diaIndex === i;
                            return (
                                <TouchableOpacity
                                    key={rotulo}
                                    onPress={() => setDiaIndex(i)}
                                    activeOpacity={0.8}
                                    style={{
                                        alignItems: "center",
                                        justifyContent: "center",
                                        backgroundColor: selecionado ? HADES.accentTint : HADES.surfaceRaised,
                                        borderWidth: selecionado ? 1.5 : 1,
                                        borderColor: selecionado ? HADES.accentSolid : HADES.borderStrong,
                                        borderRadius: 18,
                                        paddingVertical: 8,
                                        paddingHorizontal: 13,
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 13,
                                            fontWeight: selecionado ? "700" : "600",
                                            color: selecionado ? HADES.accentSolid : HADES.textSecondary,
                                        }}
                                    >
                                        {rotulo}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    {/* Matéria */}
                    <Text
                        style={{
                            fontSize: 12,
                            color: HADES.textFaint,
                            fontWeight: "600",
                            letterSpacing: 0.5,
                            marginTop: 18,
                            marginBottom: 10,
                        }}
                    >
                        MATÉRIA
                    </Text>
                    {materiasComCores.length === 0 && (
                        <Text style={{ fontSize: 12.5, color: HADES.textMuted, marginBottom: 8 }}>
                            Você ainda não tem matérias cadastradas.
                        </Text>
                    )}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 8, paddingBottom: 2 }}
                    >
                        {materiasComCores.map((m) => {
                            const selecionada = materiaId === m.id;
                            return (
                                <TouchableOpacity
                                    key={m.id}
                                    onPress={() => setMateriaId(m.id)}
                                    activeOpacity={0.8}
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 7,
                                        backgroundColor: selecionada ? `${m.cor}29` : HADES.surfaceRaised,
                                        borderWidth: selecionada ? 1.5 : 1,
                                        borderColor: selecionada ? m.cor : HADES.borderStrong,
                                        borderRadius: 18,
                                        paddingVertical: 8,
                                        paddingHorizontal: 13,
                                    }}
                                >
                                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.cor }} />
                                    <Text
                                        style={{
                                            fontSize: 13,
                                            fontWeight: selecionada ? "700" : "600",
                                            color: selecionada ? HADES.text : HADES.textSecondary,
                                        }}
                                    >
                                        {m.nomeExibicao}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    {/* Tópico */}
                    <View
                        style={{
                            backgroundColor: HADES.surfaceRaised,
                            borderWidth: 1,
                            borderColor: HADES.borderStrong,
                            borderRadius: 12,
                            padding: 14,
                            marginTop: 12,
                        }}
                    >
                        <TextInput
                            value={topico}
                            onChangeText={setTopico}
                            placeholder="Tópico (opcional)"
                            placeholderTextColor={HADES.textFaint}
                            style={{ padding: 0, color: HADES.text, fontSize: 15, fontWeight: "600" }}
                        />
                    </View>

                    {/* Início */}
                    <View
                        style={{
                            backgroundColor: HADES.surfaceRaised,
                            borderWidth: 1,
                            borderColor: HADES.borderStrong,
                            borderRadius: 12,
                            paddingVertical: 11,
                            paddingHorizontal: 14,
                            marginTop: 10,
                            flexDirection: "row",
                            alignItems: "center",
                        }}
                    >
                        <Text style={{ flex: 1, fontSize: 14, color: HADES.text, fontWeight: "600" }}>
                            Horário de início
                        </Text>
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                backgroundColor: HADES.surfaceOverlay,
                                borderRadius: 9,
                            }}
                        >
                            <TouchableOpacity
                                onPress={() => ajustarInicio(-15)}
                                activeOpacity={0.6}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={{ width: 30, height: 30, alignItems: "center", justifyContent: "center" }}
                            >
                                <Text style={{ color: HADES.textMuted, fontSize: 16 }}>−</Text>
                            </TouchableOpacity>
                            <Text
                                style={{
                                    fontSize: 14,
                                    fontWeight: "700",
                                    color: HADES.text,
                                    minWidth: 52,
                                    textAlign: "center",
                                }}
                            >
                                {paraHoraMin(inicioMin)}
                            </Text>
                            <TouchableOpacity
                                onPress={() => ajustarInicio(15)}
                                activeOpacity={0.6}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={{ width: 30, height: 30, alignItems: "center", justifyContent: "center" }}
                            >
                                <Text style={{ color: HADES.accentSolid, fontSize: 16 }}>+</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Duração */}
                    <Text
                        style={{
                            fontSize: 12,
                            color: HADES.textFaint,
                            fontWeight: "600",
                            letterSpacing: 0.5,
                            marginTop: 18,
                            marginBottom: 10,
                        }}
                    >
                        DURAÇÃO
                    </Text>
                    <View
                        style={{
                            backgroundColor: HADES.surfaceRaised,
                            borderWidth: 1,
                            borderColor: HADES.borderStrong,
                            borderRadius: 14,
                            position: "relative",
                        }}
                    >
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
                            <WheelPicker items={HORAS} selectedIndex={horasIdx} onChange={setHorasIdx} flex={0.6} />
                            <Text style={{ fontSize: 13, color: HADES.textMuted, fontWeight: "600" }}>h</Text>
                            <WheelPicker
                                items={MINUTOS_DURACAO}
                                selectedIndex={minutosIdx}
                                onChange={setMinutosIdx}
                                flex={0.6}
                            />
                            <Text style={{ fontSize: 13, color: HADES.textMuted, fontWeight: "600" }}>min</Text>
                        </View>
                    </View>

                    {/* Lembrete */}
                    <View
                        style={{
                            backgroundColor: HADES.surfaceRaised,
                            borderWidth: 1,
                            borderColor: HADES.borderStrong,
                            borderRadius: 14,
                            marginTop: 14,
                            overflow: "hidden",
                        }}
                    >
                        <View style={{ flexDirection: "row", alignItems: "center", padding: 13 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 14, color: HADES.text, fontWeight: "600" }}>
                                    Lembrete prévio
                                </Text>
                                <Text style={{ fontSize: 12, color: HADES.textFaint, marginTop: 2 }}>
                                    Avisar antes do bloco começar
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setLembreteAtivo((v) => !v)}
                                activeOpacity={0.8}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={{
                                    width: 44,
                                    height: 27,
                                    borderRadius: 14,
                                    backgroundColor: lembreteAtivo ? HADES.accentSolid : HADES.trackOff,
                                    justifyContent: "center",
                                }}
                            >
                                <View
                                    style={{
                                        position: "absolute",
                                        left: lembreteAtivo ? 19 : 2.5,
                                        width: 22,
                                        height: 22,
                                        borderRadius: 11,
                                        backgroundColor: "#fff",
                                    }}
                                />
                            </TouchableOpacity>
                        </View>

                        {lembreteAtivo && (
                            <View
                                style={{
                                    borderTopWidth: 1,
                                    borderTopColor: HADES.border,
                                    position: "relative",
                                }}
                            >
                                <View
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 8,
                                    }}
                                >
                                    <WheelPicker
                                        items={MINUTOS_LEMBRETE}
                                        selectedIndex={lembreteIdx}
                                        onChange={setLembreteIdx}
                                        flex={0.6}
                                    />
                                    <Text style={{ fontSize: 13, color: HADES.textMuted, fontWeight: "600" }}>
                                        min antes
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>
                </ScrollView>

                {/* Rodapé */}
                <View
                    style={{
                        paddingTop: 12,
                        paddingBottom: 12,
                        paddingHorizontal: 20,
                        borderTopWidth: 1,
                        borderTopColor: "rgba(255,255,255,0.07)",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 14,
                    }}
                >
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, color: HADES.text, fontWeight: "600" }}>{resumo}</Text>
                        <Text style={{ fontSize: 12, color: duracaoInvalida ? HADES.amber : HADES.textFaint, marginTop: 1 }}>
                            {duracaoInvalida
                                ? "Escolha uma duração maior que 0"
                                : lembreteAtivo
                                    ? `Lembrete ${MINUTOS_LEMBRETE[lembreteIdx]} min antes`
                                    : "Sem lembrete"}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={async () => {
                            const salvo = await onSubmit();
                            if (salvo) router.back();
                        }}
                        activeOpacity={0.85}
                        disabled={carregandoHorarios || duracaoInvalida || !materiaId}
                        style={{
                            height: 48,
                            paddingHorizontal: 24,
                            borderRadius: 13,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 7,
                            backgroundColor: HADES.accentSolid,
                            opacity: carregandoHorarios || duracaoInvalida || !materiaId ? 0.4 : 1,
                        }}
                    >
                        <Plus size={16} color="#000" />
                        <Text style={{ fontSize: 15, fontWeight: "700", color: "#000" }}>
                            {modoEdicao ? "Salvar" : "Adicionar"}
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
}

function NovoBlocoSkeleton() {
    return (
        <View style={{ flex: 1, backgroundColor: HADES.bg }}>
            <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
                <View style={{ paddingTop: 12, paddingBottom: 4, alignItems: "center" }}>
                    <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: HADES.dot }} />
                </View>

                <View
                    style={{
                        paddingTop: 8,
                        paddingBottom: 14,
                        paddingHorizontal: 20,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}
                >
                    <View style={{ width: 56 }}>
                        <Skeleton width={56} height={14} hades />
                    </View>
                    <Skeleton width={110} height={16} hades />
                    <View style={{ width: 56 }} />
                </View>

                <View style={{ paddingHorizontal: 20 }}>
                    <Skeleton width={110} height={12} hades style={{ marginBottom: 10 }} />
                    <View style={{ flexDirection: "row", gap: 8 }}>
                        {[0, 1, 2, 3, 4].map((i) => (
                            <Skeleton key={i} width={48} height={33} borderRadius={18} hades />
                        ))}
                    </View>

                    <Skeleton width={70} height={12} hades style={{ marginTop: 18, marginBottom: 10 }} />
                    <View style={{ flexDirection: "row", gap: 8 }}>
                        {[0, 1, 2].map((i) => (
                            <Skeleton key={i} width={90} height={33} borderRadius={18} hades />
                        ))}
                    </View>

                    {/* Tópico e horário de início */}
                    <Skeleton width="100%" height={47} borderRadius={12} hades style={{ marginTop: 12 }} />
                    <Skeleton width="100%" height={52} borderRadius={12} hades style={{ marginTop: 10 }} />

                    {/* Duração: a roda de horas ocupa 5 itens de 52px. */}
                    <Skeleton width={70} height={12} hades style={{ marginTop: 18, marginBottom: 10 }} />
                    <Skeleton width="100%" height={260} borderRadius={14} hades />

                    <Skeleton width="100%" height={66} borderRadius={14} hades style={{ marginTop: 14 }} />
                </View>
            </SafeAreaView>
        </View>
    );
}
