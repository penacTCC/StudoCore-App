import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput } from "react-native";
import { SafeAreaView } from "@/components/ui/TelaSegura";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Plus } from "@/components/ui/icons";
import { HADES, CORES_PLANO } from "@/constants/hades";
import WheelPicker from "@/components/ui/WheelPicker";
import { useAuth } from "@/hooks/useAuth";
import { useMaterias } from "@/hooks/useMaterias";
import { usePreferencias } from "@/hooks/usePreferencias";
import { toast } from "@/services/toast";
import { DURACAO_BLOCO_UNICO_MIN } from "@/constants/cronograma";

const HORAS = ["0", "1", "2", "3", "4"];
const MINUTOS_DURACAO = ["00", "15", "30", "45"];
const MINUTOS_LEMBRETE = ["5", "10", "15", "20", "30", "45", "60"];

function paraHoraMin(totalMin: number) {
    const h = Math.floor((totalMin + 1440) / 60) % 24;
    const m = (totalMin + 1440) % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function formatarEntradaHorario(valor: string) {
    const digitos = valor.replace(/\D/g, "").slice(0, 4);
    if (digitos.length <= 2) return digitos;
    return `${digitos.slice(0, 2)}:${digitos.slice(2)}`;
}

function minutosDoHorario(valor: string) {
    const correspondencia = /^(\d{2}):(\d{2})$/.exec(valor);
    if (!correspondencia) return null;

    const horas = Number(correspondencia[1]);
    const minutos = Number(correspondencia[2]);
    if (horas > 23 || minutos > 59) return null;

    return horas * 60 + minutos;
}

function sugerirInicioPeloRascunho(rascunho?: string) {
    if (!rascunho) return null;

    try {
        const dados = JSON.parse(rascunho) as {
            blocos?: { horaInicio?: string; duracaoMin?: number }[];
        };

        const finais = (dados.blocos ?? []).flatMap((bloco) => {
            if (typeof bloco.horaInicio !== "string" || typeof bloco.duracaoMin !== "number") return [];
            const inicio = minutosDoHorario(bloco.horaInicio);
            if (inicio === null || !Number.isFinite(bloco.duracaoMin) || bloco.duracaoMin <= 0) return [];
            return [inicio + bloco.duracaoMin];
        });

        if (finais.length === 0) return null;
        const fim = Math.max(...finais);
        return ((fim % 1440) + 1440) % 1440;
    } catch {
        // O submit já mostra o erro completo caso o rascunho realmente esteja inválido.
        return null;
    }
}

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

/**
 * Tela de criação de um bloco único de estudo no plano. Sem backend ainda:
 * devolve o bloco para o editor via params (rascunho), que faz a gravação.
 *
 * Só cria bloco de estudo: descanso agora é uma ação direta do editor de plano,
 * que emenda os descansos entre matérias diferentes sem passar por esta tela.
 */
export default function NovoBlocoPlanoScreen() {
    const router = useRouter();
    const { planoId, rascunho } = useLocalSearchParams<{
        planoId?: string;
        rascunho?: string;
    }>();
    const { userId } = useAuth();
    const { materiasComCores } = useMaterias(userId);
    const { prefs, carregando: carregandoPrefs } = usePreferencias(userId);
    const inicioSugerido = useMemo(() => sugerirInicioPeloRascunho(rascunho), [rascunho]);
    const limiteInicioMin = inicioSugerido;
    const inicioPadrao = limiteInicioMin ?? 18 * 60 + 30;

    const [materiaId, setMateriaId] = useState<string | undefined>(undefined);
    const [topico, setTopico] = useState("");
    const [inicioMin, setInicioMin] = useState(inicioPadrao);
    const [horarioTexto, setHorarioTexto] = useState(() => paraHoraMin(inicioPadrao));
    const [horarioEditado, setHorarioEditado] = useState(false);

    // Duração do bloco via wheel inline.
    const [horasIdx, setHorasIdx] = useState(1);
    // Valor em minutos (não índice): a lista de opções muda com as horas, então o
    // índice sozinho apontaria pra minutos diferentes conforme a roda ao lado.
    const [minutosValor, setMinutosValor] = useState(30);

    const [lembreteAtivo, setLembreteAtivo] = useState(true);
    const [lembreteIdx, setLembreteIdx] = useState(2);

    /*
      Em 0h a roda dos minutos só oferece 30 e 45: o piso do bloco único é 30 min,
      e barrar depois (com o botão desabilitado) deixava o usuário escolher uma
      duração que a tela não aceita.
    */
    const minutosOpcoes = horasIdx === 0
        ? MINUTOS_DURACAO.filter((m) => Number(m) >= DURACAO_BLOCO_UNICO_MIN)
        : MINUTOS_DURACAO;
    const minutosIdx = Math.max(0, minutosOpcoes.indexOf(minutosValor.toString().padStart(2, "0")));

    const escolherHoras = (i: number) => {
        setHorasIdx(i);
        if (i === 0 && minutosValor < DURACAO_BLOCO_UNICO_MIN) setMinutosValor(DURACAO_BLOCO_UNICO_MIN);
    };

    const duracaoMin = Number(HORAS[horasIdx]) * 60 + minutosValor;
    const fimMin = inicioMin + duracaoMin;
    const duracaoInvalida = duracaoMin < DURACAO_BLOCO_UNICO_MIN;
    const horarioValido = minutosDoHorario(horarioTexto) !== null;

    const avisarHorarioJaPreenchido = () => {
        if (limiteInicioMin === null) return;
        toast.info(
            `O horário anterior a ${paraHoraMin(limiteInicioMin)} já está preenchido com um bloco de estudo ou descanso.`
        );
    };

    const definirInicio = (totalMin: number) => {
        const normalizado = ((totalMin % 1440) + 1440) % 1440;
        if (limiteInicioMin !== null && normalizado < limiteInicioMin) {
            setInicioMin(limiteInicioMin);
            setHorarioTexto(paraHoraMin(limiteInicioMin));
            avisarHorarioJaPreenchido();
            return;
        }
        setInicioMin(normalizado);
        setHorarioTexto(paraHoraMin(normalizado));
    };

    const ajustarInicio = (delta: number) => {
        const inicioDigitado = minutosDoHorario(horarioTexto);
        definirInicio((inicioDigitado ?? inicioMin) + delta);
        setHorarioEditado(false);
    };

    const alterarHorario = (valor: string) => {
        const formatado = formatarEntradaHorario(valor);
        setHorarioTexto(formatado);
        setHorarioEditado(true);

        const minutos = minutosDoHorario(formatado);
        if (minutos === null) return;
        if (limiteInicioMin !== null && minutos < limiteInicioMin) {
            setInicioMin(limiteInicioMin);
            setHorarioTexto(paraHoraMin(limiteInicioMin));
            setHorarioEditado(false);
            avisarHorarioJaPreenchido();
            return;
        }
        setInicioMin(minutos);
    };

    const resumo = useMemo(
        () => `${paraHoraMin(inicioMin)} – ${paraHoraMin(fimMin)}`,
        [inicioMin, fimMin]
    );

    // Seleciona a primeira matéria assim que a lista carrega (nenhuma escolhida ainda).
    useEffect(() => {
        if (!materiaId && materiasComCores.length > 0) {
            setMateriaId(materiasComCores[0].id);
        }
    }, [materiaId, materiasComCores]);

    /*
      Semeia o formulário com as preferências do cronograma, uma vez só, quando
      elas chegam do banco. Depois disso o que vale é o que o usuário mexeu na
      tela — por isso o ref, e não um efeito que reaplica a cada render.
    */
    const semeado = useRef(false);
    useEffect(() => {
        if (carregandoPrefs || semeado.current) return;
        semeado.current = true;

        // Nunca abre abaixo do piso do bloco único, mesmo que a preferência seja menor.
        const duracaoPadrao = Math.max(prefs.duracaoPadraoBlocoMin, DURACAO_BLOCO_UNICO_MIN);
        const horas = indiceMaisProximo(HORAS, Math.floor(duracaoPadrao / 60));
        const minutos = Number(MINUTOS_DURACAO[indiceMaisProximo(MINUTOS_DURACAO, duracaoPadrao % 60)]);
        setHorasIdx(horas);
        setMinutosValor(horas === 0 ? Math.max(minutos, DURACAO_BLOCO_UNICO_MIN) : minutos);

        setLembreteAtivo(prefs.notificacoesAtivas && prefs.antecedenciaMin > 0);
        if (prefs.antecedenciaMin > 0) {
            setLembreteIdx(indiceMaisProximo(MINUTOS_LEMBRETE, prefs.antecedenciaMin));
        }
    }, [carregandoPrefs, prefs]);

    const onSubmit = () => {
        const inicioValidado = minutosDoHorario(horarioTexto);
        if (inicioValidado === null) {
            setHorarioEditado(true);
            return;
        }
        if (limiteInicioMin !== null && inicioValidado < limiteInicioMin) {
            definirInicio(limiteInicioMin);
            avisarHorarioJaPreenchido();
            return;
        }

        // O rascunho carrega nome/cor/blocos inteiros do plano — sobrevive
        // mesmo que o plano-editor remonte ao voltar dessa navegação.
        let dados: { nome: string; cor: string; blocos: unknown[] } = {
            nome: "",
            cor: CORES_PLANO[0],
            blocos: [],
        };
        if (rascunho) {
            try {
                dados = JSON.parse(rascunho);
            } catch (e) {
                console.error("Rascunho inválido recebido do plano-editor:", e);
                toast.error("Não foi possível recuperar os dados do plano. Tente novamente.");
                return;
            }
        }

        const materiaSelecionada = materiasComCores.find((m) => m.id === materiaId);
        if (!materiaSelecionada) return;

        const blocoNovo = {
                id: `novo-${Date.now()}`,
                persistido: false,
                horaInicio: paraHoraMin(inicioValidado),
                duracaoMin,
                tipo: "estudo" as const,
                materiaId: materiaSelecionada.id,
                materia: materiaSelecionada.nomeExibicao,
                topico: topico || undefined,
                cor: materiaSelecionada.cor,
                notificar: lembreteAtivo,
                antecedenciaMin: lembreteAtivo ? Number(MINUTOS_LEMBRETE[lembreteIdx]) : null,
            };

        const rascunhoAtualizado = JSON.stringify({ ...dados, blocos: [...dados.blocos, blocoNovo] });

        // dismissTo (não navigate/push) garante que volta direto pro plano-editor já
        // aberto, sem empilhar uma nova instância a cada bloco adicionado.
        router.dismissTo({
            pathname: "/(modals)/plano-editor",
            params: planoId
                ? { planoId, rascunho: rascunhoAtualizado }
                : { rascunho: rascunhoAtualizado },
        });
    };

    const podeSubmeter = horarioValido && !duracaoInvalida && !!materiaId;

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
                        paddingBottom: 4,
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
                    <Text style={{ fontSize: 16, fontWeight: "700", color: HADES.text }}>Novo bloco</Text>
                    <View style={{ width: 56 }} />
                </View>

                {/* Único tipo de bloco disponível para planos */}
                <View style={{ paddingHorizontal: 20, paddingBottom: 4 }}>
                    <View
                        style={{
                            backgroundColor: HADES.surfaceRaised,
                            borderWidth: 1,
                            borderColor: HADES.borderStrong,
                            borderRadius: 11,
                            padding: 3,
                            flexDirection: "row",
                        }}
                    >
                        <View
                            style={{
                                flex: 1,
                                paddingVertical: 8,
                                borderRadius: 8,
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: HADES.accentTint,
                                borderWidth: 1,
                                borderColor: HADES.accentTintBorder,
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 13,
                                    fontWeight: "700",
                                    color: HADES.accentSolid,
                                }}
                            >
                                Bloco único
                            </Text>
                        </View>
                    </View>
                </View>

                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Matéria */}
                    <Text
                        style={{
                            fontSize: 12,
                            color: HADES.textFaint,
                            fontWeight: "600",
                            letterSpacing: 0.5,
                            marginTop: 14,
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
                                    <TextInput
                                        value={horarioTexto}
                                        onChangeText={alterarHorario}
                                        onBlur={() => setHorarioEditado(true)}
                                        keyboardType="number-pad"
                                        inputMode="numeric"
                                        maxLength={5}
                                        selectTextOnFocus
                                        placeholder="HH:MM"
                                        placeholderTextColor={HADES.textFaint}
                                        selectionColor={HADES.accentSolid}
                                        accessibilityLabel="Horário de início"
                                        style={{
                                            fontSize: 14,
                                            fontWeight: "700",
                                            color: horarioValido ? HADES.text : HADES.red,
                                            width: 58,
                                            textAlign: "center",
                                            paddingVertical: 5,
                                            paddingHorizontal: 2,
                                            borderWidth: 1,
                                            borderColor: horarioEditado && !horarioValido ? HADES.red : "transparent",
                                            borderRadius: 6,
                                        }}
                                    />
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
                            {horarioEditado && !horarioValido && (
                                <Text style={{ color: HADES.red, fontSize: 11, marginTop: 5, marginLeft: 4 }}>
                                    Digite um horário entre 00:00 e 23:59.
                                </Text>
                            )}

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
                                    <WheelPicker items={HORAS} selectedIndex={horasIdx} onChange={escolherHoras} flex={0.6} />
                                    <Text style={{ fontSize: 13, color: HADES.textMuted, fontWeight: "600" }}>h</Text>
                                    <WheelPicker
                                        // Remonta a roda ao trocar a lista de opções, pra ela
                                        // reposicionar em vez de manter o scroll da lista antiga.
                                        key={minutosOpcoes.length}
                                        items={minutosOpcoes}
                                        selectedIndex={minutosIdx}
                                        onChange={(i) => setMinutosValor(Number(minutosOpcoes[i]))}
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
                                ? `Mínimo de ${DURACAO_BLOCO_UNICO_MIN} min`
                                : lembreteAtivo
                                    ? `Lembrete ${MINUTOS_LEMBRETE[lembreteIdx]} min antes`
                                    : "Sem lembrete"}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={onSubmit}
                        activeOpacity={0.85}
                        disabled={!podeSubmeter}
                        style={{
                            height: 48,
                            paddingHorizontal: 24,
                            borderRadius: 13,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 7,
                            backgroundColor: HADES.accentSolid,
                            opacity: podeSubmeter ? 1 : 0.4,
                        }}
                    >
                        <Plus size={16} color="#000" />
                        <Text style={{ fontSize: 15, fontWeight: "700", color: "#000" }}>Adicionar</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

        </View>
    );
}
