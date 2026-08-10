import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SafeAreaView } from "@/components/ui/TelaSegura";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Plus, Timer, Clock, Coffee, Bell, Layers, ChevronRight, Zap } from "@/components/ui/icons";
import * as Crypto from "expo-crypto";
import { HADES, CORES_PLANO } from "@/constants/hades";
import WheelPicker from "@/components/ui/WheelPicker";
import { useAuth } from "@/hooks/useAuth";
import { useMaterias } from "@/hooks/useMaterias";
import { usePreferencias } from "@/hooks/usePreferencias";
import { formatarDuracao } from "@/utils/tempo";
import { gerarSequenciaPomodoro } from "@/utils/pomodoroSequence";
import { toast } from "@/services/toast";
import {
    DURACAO_BLOCO_UNICO_MIN,
    DURACAO_POMODORO_MAX,
    DURACAO_POMODORO_MIN,
} from "@/constants/cronograma";

const HORAS = ["0", "1", "2", "3", "4"];
const MINUTOS_DURACAO = ["00", "15", "30", "45"];
const MINUTOS_LEMBRETE = ["5", "10", "15", "20", "30", "45", "60"];

const QTD_POMODOROS = Array.from({ length: 12 }, (_, i) => String(i + 1));
// Duração minuto a minuto, pra roda deslizar em passos finos. Os limites vêm de
// constants/cronograma.ts porque as configurações usam os mesmos.
const DURACAO_POMODORO = Array.from(
    { length: DURACAO_POMODORO_MAX - DURACAO_POMODORO_MIN + 1 },
    (_, i) => String(i + DURACAO_POMODORO_MIN)
);
const ALTURA_ITEM_RODA = 76; // rodas do modal de pomodoros (3 itens visíveis)
const HORAS_DIA = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
const MINUTOS_5 = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

function paraHoraMin(totalMin: number) {
    const h = Math.floor((totalMin + 1440) / 60) % 24;
    const m = (totalMin + 1440) % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
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

type ItemSequencia = {
    tipo: "estudo" | "descanso";
    duracaoMin: number;
    inicioMin: number;
    ehLongo?: boolean;
};

/**
 * Tela de bloco de um plano — dois modos: "Sessão de pomodoros" (gera vários
 * blocos de uma vez, com descansos automáticos a partir das preferências) e
 * "Bloco único" (um bloco avulso, igual já era antes). Sem backend ainda:
 * devolve o(s) bloco(s) pro editor via params (rascunho), quem grava é ele.
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

    const [modo, setModo] = useState<"pomodoros" | "unico">("pomodoros");

    const [materiaId, setMateriaId] = useState<string | undefined>(undefined);
    const [topico, setTopico] = useState("");
    const [inicioMin, setInicioMin] = useState(18 * 60 + 30);

    // Modo "Bloco único": duração via wheel inline.
    const [horasIdx, setHorasIdx] = useState(1);
    // Valor em minutos (não índice): a lista de opções muda com as horas, então o
    // índice sozinho apontaria pra minutos diferentes conforme a roda ao lado.
    const [minutosValor, setMinutosValor] = useState(30);

    // Modo "Sessão de pomodoros".
    const [qtdIdx, setQtdIdx] = useState(3); // "4"
    const [duracaoPomodoroIdx, setDuracaoPomodoroIdx] = useState(0); // "25"
    const [inserirDescansos, setInserirDescansos] = useState(true);

    /*
      Bloco único de estudo já sai com um descanso emendado atrás, na duração
      definida nas preferências — no modo "pomodoros" isso já acontecia, e ficar
      manual só aqui obrigava o usuário a criar o descanso na mão toda vez.
    */
    const [emendarDescanso, setEmendarDescanso] = useState(true);

    const [lembreteAtivo, setLembreteAtivo] = useState(true);
    const [lembreteIdx, setLembreteIdx] = useState(2);

    const [modalPomodorosAberto, setModalPomodorosAberto] = useState(false);
    const [modalHorarioAberto, setModalHorarioAberto] = useState(false);

    // Altura máxima das folhas (bottom sheets) — reserva um respiro no topo em
    // vez de deixá-las crescer até quase encostar na borda superior da tela.
    const insets = useSafeAreaInsets();
    const { height: alturaJanela } = useWindowDimensions();
    const alturaMaximaFolha = alturaJanela - insets.top - 48;

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

    const ajustarInicio = (delta: number) => setInicioMin((atual) => atual + delta);

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

        setDuracaoPomodoroIdx(indiceMaisProximo(DURACAO_POMODORO, prefs.focoMin));

        setLembreteAtivo(prefs.notificacoesAtivas && prefs.antecedenciaMin > 0);
        if (prefs.antecedenciaMin > 0) {
            setLembreteIdx(indiceMaisProximo(MINUTOS_LEMBRETE, prefs.antecedenciaMin));
        }
    }, [carregandoPrefs, prefs]);

    const qtdPomodoros = Number(QTD_POMODOROS[qtdIdx]);
    const duracaoPomodoro = Number(DURACAO_POMODORO[duracaoPomodoroIdx]);

    // Sequência de pomodoros + descansos (algoritmo compartilhado com o pomodoro solo em
    // focus.tsx), só adicionando aqui o horário de início de cada item pra exibição.
    const sequencia = useMemo<ItemSequencia[]>(() => {
        let cursor = inicioMin;
        return gerarSequenciaPomodoro({
            qtdPomodoros,
            duracaoPomodoroMin: duracaoPomodoro,
            inserirDescansos,
            descansoCurtoMin: prefs.descansoCurtoMin,
            descansoLongoMin: prefs.descansoLongoMin,
            ciclosAteLongo: prefs.ciclosAteLongo,
        }).map((item) => {
            const comInicio = { ...item, inicioMin: cursor };
            cursor += item.duracaoMin;
            return comInicio;
        });
    }, [
        inicioMin,
        qtdPomodoros,
        duracaoPomodoro,
        inserirDescansos,
        prefs.descansoCurtoMin,
        prefs.descansoLongoMin,
        prefs.ciclosAteLongo,
    ]);

    const fimSessaoMin = sequencia.length > 0
        ? sequencia[sequencia.length - 1].inicioMin + sequencia[sequencia.length - 1].duracaoMin
        : inicioMin;
    const minutosFocoTotal = qtdPomodoros * duracaoPomodoro;
    const minutosDescansoTotal = sequencia
        .filter((item) => item.tipo === "descanso")
        .reduce((soma, item) => soma + item.duracaoMin, 0);
    const qtdDescansos = sequencia.filter((item) => item.tipo === "descanso").length;

    const abrirModalHorario = () => setModalHorarioAberto(true);
    const abrirModalPomodoros = () => setModalPomodorosAberto(true);

    const aplicarInicioRapido = (minutosAPartirDeAgora: number) => {
        const agora = new Date();
        setInicioMin(agora.getHours() * 60 + agora.getMinutes() + minutosAPartirDeAgora);
        setModalHorarioAberto(false);
    };

    const onSubmit = () => {
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

        let blocosNovos: unknown[];

        if (modo === "pomodoros") {
            const materiaSelecionada = materiasComCores.find((m) => m.id === materiaId);
            if (!materiaSelecionada) return;

            const sessaoId = Crypto.randomUUID();
            blocosNovos = sequencia.map((item, i) => ({
                id: `novo-${Date.now()}-${i}`,
                persistido: false,
                sessaoId,
                horaInicio: paraHoraMin(item.inicioMin),
                duracaoMin: item.duracaoMin,
                tipo: item.tipo,
                materiaId: item.tipo === "estudo" ? materiaSelecionada.id : undefined,
                materia: item.tipo === "estudo" ? materiaSelecionada.nomeExibicao : undefined,
                topico: item.tipo === "estudo" ? topico || undefined : undefined,
                cor: item.tipo === "estudo" ? materiaSelecionada.cor : undefined,
                notificar: item.tipo === "estudo" ? lembreteAtivo : false,
                antecedenciaMin: item.tipo === "estudo" && lembreteAtivo ? Number(MINUTOS_LEMBRETE[lembreteIdx]) : null,
            }));
        } else {
            const materiaSelecionada = materiasComCores.find((m) => m.id === materiaId);
            if (!materiaSelecionada) return;

            blocosNovos = [{
                id: `novo-${Date.now()}`,
                persistido: false,
                horaInicio: paraHoraMin(inicioMin),
                duracaoMin,
                tipo: "estudo" as const,
                materiaId: materiaSelecionada.id,
                materia: materiaSelecionada.nomeExibicao,
                topico: topico || undefined,
                cor: materiaSelecionada.cor,
                notificar: lembreteAtivo,
                antecedenciaMin: lembreteAtivo ? Number(MINUTOS_LEMBRETE[lembreteIdx]) : null,
            }];

            if (emendarDescanso && prefs.duracaoPadraoDescansoMin > 0) {
                blocosNovos.push({
                    id: `novo-${Date.now()}-descanso`,
                    persistido: false,
                    horaInicio: paraHoraMin(fimMin),
                    duracaoMin: prefs.duracaoPadraoDescansoMin,
                    tipo: "descanso" as const,
                    materiaId: undefined,
                    materia: undefined,
                    topico: undefined,
                    cor: undefined,
                    notificar: false,
                    antecedenciaMin: null,
                });
            }
        }

        const rascunhoAtualizado = JSON.stringify({ ...dados, blocos: [...dados.blocos, ...blocosNovos] });

        // dismissTo (não navigate/push) garante que volta direto pro plano-editor já
        // aberto, sem empilhar uma nova instância a cada bloco adicionado.
        router.dismissTo({
            pathname: "/(modals)/plano-editor",
            params: planoId
                ? { planoId, rascunho: rascunhoAtualizado }
                : { rascunho: rascunhoAtualizado },
        });
    };

    const podeSubmeter = modo === "pomodoros" ? !!materiaId : !duracaoInvalida && !!materiaId;

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

                {/* Alternador de modo */}
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
                        <TouchableOpacity
                            onPress={() => setModo("pomodoros")}
                            activeOpacity={0.8}
                            style={{
                                flex: 1,
                                paddingVertical: 8,
                                borderRadius: 8,
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 6,
                                backgroundColor: modo === "pomodoros" ? HADES.accentTint : "transparent",
                                borderWidth: modo === "pomodoros" ? 1 : 0,
                                borderColor: HADES.accentTintBorder,
                            }}
                        >
                            <Timer size={14} color={modo === "pomodoros" ? HADES.accentSolid : HADES.textFaint} />
                            <Text
                                style={{
                                    fontSize: 13,
                                    fontWeight: "700",
                                    color: modo === "pomodoros" ? HADES.accentSolid : HADES.textFaint,
                                }}
                            >
                                Pomodoros
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setModo("unico")}
                            activeOpacity={0.8}
                            style={{
                                flex: 1,
                                paddingVertical: 8,
                                borderRadius: 8,
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: modo === "unico" ? HADES.accentTint : "transparent",
                                borderWidth: modo === "unico" ? 1 : 0,
                                borderColor: HADES.accentTintBorder,
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 13,
                                    fontWeight: "600",
                                    color: modo === "unico" ? HADES.accentSolid : HADES.textFaint,
                                }}
                            >
                                Bloco único
                            </Text>
                        </TouchableOpacity>
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

                    {modo === "pomodoros" ? (
                        <>
                            {/* Sessão */}
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
                                SESSÃO
                            </Text>
                            <View
                                style={{
                                    backgroundColor: HADES.surfaceRaised,
                                    borderWidth: 1,
                                    borderColor: HADES.borderStrong,
                                    borderRadius: 14,
                                    overflow: "hidden",
                                }}
                            >
                                <TouchableOpacity
                                    onPress={abrirModalHorario}
                                    activeOpacity={0.7}
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        padding: 14,
                                        gap: 11,
                                        borderBottomWidth: 1,
                                        borderBottomColor: HADES.border,
                                    }}
                                >
                                    <Text style={{ flex: 1, fontSize: 14, color: HADES.text, fontWeight: "600" }}>
                                        Horário de início
                                    </Text>
                                    <Text style={{ fontSize: 13, fontWeight: "700", color: HADES.textMuted }}>
                                        {paraHoraMin(inicioMin)}
                                    </Text>
                                    <ChevronRight size={16} color={HADES.grip} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={abrirModalPomodoros}
                                    activeOpacity={0.7}
                                    style={{ flexDirection: "row", alignItems: "center", padding: 14, gap: 11 }}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 14, color: HADES.text, fontWeight: "600" }}>Pomodoros</Text>
                                    </View>
                                    <Text style={{ fontSize: 13, fontWeight: "700", color: HADES.textMuted }}>
                                        {qtdPomodoros} × {duracaoPomodoro}min
                                    </Text>
                                    <ChevronRight size={16} color={HADES.grip} />
                                </TouchableOpacity>
                            </View>

                            {/* Descansos */}
                            <View
                                style={{
                                    backgroundColor: HADES.surfaceRaised,
                                    borderWidth: 1,
                                    borderColor: HADES.borderStrong,
                                    borderRadius: 14,
                                    marginTop: 10,
                                    padding: 13,
                                }}
                            >
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 14, color: HADES.text, fontWeight: "600" }}>
                                            Descanso entre pomodoros
                                        </Text>
                                        <Text style={{ fontSize: 11, color: HADES.textDim, marginTop: 2 }}>
                                            das suas preferências
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => setInserirDescansos((v) => !v)}
                                        activeOpacity={0.8}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        style={{
                                            width: 44,
                                            height: 27,
                                            borderRadius: 14,
                                            backgroundColor: inserirDescansos ? HADES.accentSolid : HADES.trackOff,
                                            justifyContent: "center",
                                        }}
                                    >
                                        <View
                                            style={{
                                                position: "absolute",
                                                left: inserirDescansos ? 19 : 2.5,
                                                width: 22,
                                                height: 22,
                                                borderRadius: 11,
                                                backgroundColor: "#fff",
                                            }}
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Lembrete */}
                            <View
                                style={{
                                    backgroundColor: HADES.surfaceRaised,
                                    borderWidth: 1,
                                    borderColor: HADES.borderStrong,
                                    borderRadius: 14,
                                    marginTop: 10,
                                    overflow: "hidden",
                                }}
                            >
                                <View style={{ flexDirection: "row", alignItems: "center", padding: 13, gap: 11 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 14, color: HADES.text, fontWeight: "600" }}>Lembrete</Text>
                                        <Text style={{ fontSize: 11, color: HADES.textDim, marginTop: 2 }}>
                                            Avisa antes de cada pomodoro
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
                                            flexDirection: "row",
                                            alignItems: "center",
                                            padding: 11,
                                            paddingHorizontal: 14,
                                            borderTopWidth: 1,
                                            borderTopColor: HADES.border,
                                        }}
                                    >
                                        <Text style={{ flex: 1, fontSize: 13, color: HADES.textSecondary }}>
                                            Antecedência
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
                                                onPress={() => setLembreteIdx((i) => Math.max(0, i - 1))}
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
                                                {MINUTOS_LEMBRETE[lembreteIdx]} min
                                            </Text>
                                            <TouchableOpacity
                                                onPress={() => setLembreteIdx((i) => Math.min(MINUTOS_LEMBRETE.length - 1, i + 1))}
                                                activeOpacity={0.6}
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                style={{ width: 30, height: 30, alignItems: "center", justifyContent: "center" }}
                                            >
                                                <Text style={{ color: HADES.accentSolid, fontSize: 16 }}>+</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                            </View>

                            {/* Prévia da sessão */}
                            <View
                                style={{
                                    flexDirection: "row",
                                    alignItems: "baseline",
                                    justifyContent: "space-between",
                                    marginTop: 30,
                                    marginBottom: 10,
                                }}
                            >
                                <Text style={{ fontSize: 12, color: HADES.textFaint, fontWeight: "600", letterSpacing: 0.5 }}>
                                    PRÉVIA DA SESSÃO
                                </Text>
                            </View>

                            <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 8 }}>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                    <View style={{ width: 8, height: 8, borderRadius: 3, backgroundColor: HADES.accentSolid }} />
                                    <Text style={{ fontSize: 11, color: HADES.textMuted }}>
                                        Foco {formatarDuracao(minutosFocoTotal)}
                                    </Text>
                                </View>
                                {inserirDescansos && (
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                        <View style={{ width: 8, height: 8, borderRadius: 3, backgroundColor: "rgba(48,209,88,0.55)" }} />
                                        <Text style={{ fontSize: 11, color: HADES.textMuted }}>
                                            Descanso {formatarDuracao(minutosDescansoTotal)}
                                        </Text>
                                    </View>
                                )}
                            </View>

                            {/* Lista da sequência */}
                            <View style={{ position: "relative", marginTop: 14, paddingLeft: 58 }}>
                                <View
                                    style={{
                                        position: "absolute",
                                        left: 38,
                                        top: 8,
                                        bottom: 8,
                                        width: 2,
                                        backgroundColor: "rgba(255,255,255,0.07)",
                                    }}
                                />
                                {(() => {
                                    let numeroPomodoro = 0;
                                    return sequencia.map((item, i) => {
                                        if (item.tipo === "estudo") {
                                            numeroPomodoro += 1;
                                            return (
                                                <View key={i} style={{ marginBottom: 8 }}>
                                                    <Text
                                                        style={{
                                                            position: "absolute",
                                                            left: -58,
                                                            top: 6,
                                                            width: 32,
                                                            textAlign: "right",
                                                            fontSize: 10,
                                                            color: HADES.textMuted,
                                                            fontWeight: "600",
                                                        }}
                                                    >
                                                        {paraHoraMin(item.inicioMin)}
                                                    </Text>
                                                    <View
                                                        style={{
                                                            position: "absolute",
                                                            left: -24,
                                                            top: 10,
                                                            width: 9,
                                                            height: 9,
                                                            borderRadius: 5,
                                                            backgroundColor: HADES.accentSolid,
                                                            borderWidth: 2,
                                                            borderColor: "#000",
                                                        }}
                                                    />
                                                    <View
                                                        style={{
                                                            backgroundColor: HADES.surfaceOverlay,
                                                            borderWidth: 1,
                                                            borderColor: HADES.border,
                                                            borderRadius: 10,
                                                            paddingVertical: 9,
                                                            paddingHorizontal: 12,
                                                            flexDirection: "row",
                                                            alignItems: "center",
                                                        }}
                                                    >
                                                        <Text style={{ flex: 1, fontSize: 13, fontWeight: "600", color: HADES.text }}>
                                                            Pomodoro {numeroPomodoro}
                                                        </Text>
                                                        <Text style={{ fontSize: 11, color: HADES.textFaint }}>
                                                            {item.duracaoMin}min
                                                        </Text>
                                                    </View>
                                                </View>
                                            );
                                        }
                                        return (
                                            <View key={i} style={{ marginBottom: 8 }}>
                                                <View
                                                    style={{
                                                        position: "absolute",
                                                        left: -23,
                                                        top: 6,
                                                        width: 7,
                                                        height: 7,
                                                        borderRadius: 4,
                                                        backgroundColor: item.ehLongo ? HADES.green : HADES.dot,
                                                        borderWidth: 2,
                                                        borderColor: "#000",
                                                    }}
                                                />
                                                <View
                                                    style={{
                                                        borderWidth: 1,
                                                        borderStyle: "dashed",
                                                        borderColor: item.ehLongo ? "rgba(48,209,88,0.45)" : "rgba(48,209,88,0.30)",
                                                        backgroundColor: item.ehLongo ? "rgba(48,209,88,0.06)" : "transparent",
                                                        borderRadius: 10,
                                                        paddingVertical: 5,
                                                        paddingHorizontal: 12,
                                                        flexDirection: "row",
                                                        alignItems: "center",
                                                        gap: 8,
                                                    }}
                                                >
                                                    <Coffee size={12} color={HADES.green} />
                                                    <Text
                                                        style={{
                                                            flex: 1,
                                                            fontSize: 12,
                                                            color: item.ehLongo ? "#8fe6a8" : HADES.textMuted,
                                                            fontWeight: item.ehLongo ? "600" : "400",
                                                        }}
                                                    >
                                                        Descanso {item.ehLongo ? "longo" : "curto"}
                                                    </Text>
                                                    <Text style={{ fontSize: 11, color: HADES.textDim }}>
                                                        {item.duracaoMin}min
                                                    </Text>
                                                </View>
                                            </View>
                                        );
                                    });
                                })()}
                            </View>
                        </>
                    ) : (
                        <>
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

                            {/* Descanso emendado */}
                            <View
                                style={{
                                    backgroundColor: HADES.surfaceRaised,
                                    borderWidth: 1,
                                    borderColor: HADES.borderStrong,
                                    borderRadius: 14,
                                    marginTop: 14,
                                    flexDirection: "row",
                                    alignItems: "center",
                                    padding: 13,
                                }}
                            >
                                <Coffee size={16} color={HADES.green} style={{ marginRight: 10 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 14, color: HADES.text, fontWeight: "600" }}>
                                        Descanso depois
                                    </Text>
                                    <Text style={{ fontSize: 12, color: HADES.textFaint, marginTop: 2 }}>
                                        {formatarDuracao(prefs.duracaoPadraoDescansoMin)}, das configurações
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => setEmendarDescanso((v) => !v)}
                                    activeOpacity={0.8}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    style={{
                                        width: 44,
                                        height: 27,
                                        borderRadius: 14,
                                        backgroundColor: emendarDescanso ? HADES.accentSolid : HADES.trackOff,
                                        justifyContent: "center",
                                    }}
                                >
                                    <View
                                        style={{
                                            width: 21,
                                            height: 21,
                                            borderRadius: 11,
                                            backgroundColor: "#fff",
                                            marginLeft: emendarDescanso ? 20 : 3,
                                        }}
                                    />
                                </TouchableOpacity>
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
                        </>
                    )}
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
                        {modo === "pomodoros" ? (
                            <>
                                <Text style={{ fontSize: 11, color: HADES.textMuted }}>
                                    {paraHoraMin(inicioMin)} → <Text style={{ color: HADES.text, fontWeight: "700", fontSize: 11 }}>{paraHoraMin(fimSessaoMin)} · <Text style={{color: HADES.textFaint}}>{formatarDuracao(fimSessaoMin - inicioMin)}</Text></Text>
                                </Text>
                            </>
                        ) : (
                            <>
                                <Text style={{ fontSize: 14, color: HADES.text, fontWeight: "600" }}>{resumo}</Text>
                                <Text style={{ fontSize: 12, color: duracaoInvalida ? HADES.amber : HADES.textFaint, marginTop: 1 }}>
                                    {duracaoInvalida
                                        ? `Mínimo de ${DURACAO_BLOCO_UNICO_MIN} min`
                                        : lembreteAtivo
                                            ? `Lembrete ${MINUTOS_LEMBRETE[lembreteIdx]} min antes`
                                            : "Sem lembrete"}
                                </Text>
                            </>
                        )}
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
                        {modo === "pomodoros" ? (
                            <>
                                <Layers size={16} color="#000" />
                                <Text style={{ fontSize: 15, fontWeight: "700", color: "#000" }}>
                                    Criar {sequencia.length} blocos
                                </Text>
                            </>
                        ) : (
                            <>
                                <Plus size={16} color="#000" />
                                <Text style={{ fontSize: 15, fontWeight: "700", color: "#000" }}>Adicionar</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            {/* Folha · Pomodoros.
                Overlay dentro da própria tela em vez de <Modal>: esta rota já é
                apresentada como modal nativo (presentation: "modal") e um Modal do RN
                aninhado nela não entrega os gestos às rodas no Android.
                O fundo é irmão da folha — como Pressable, se envolvesse o conteúdo
                viraria responder do toque e as rodas não rolariam. */}
            {modalPomodorosAberto && (
                <View style={[StyleSheet.absoluteFill, { justifyContent: "flex-end" }]}>
                    <Pressable
                        style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.55)" }]}
                        onPress={() => setModalPomodorosAberto(false)}
                    />
                    <View
                        style={{
                            backgroundColor: HADES.surfaceRaised,
                            borderWidth: 1,
                            borderColor: HADES.borderStrong,
                            borderTopLeftRadius: 24,
                            borderTopRightRadius: 24,
                            paddingHorizontal: 20,
                            paddingBottom: 26,
                            maxHeight: alturaMaximaFolha,
                        }}
                    >
                        <View style={{ paddingTop: 12, paddingBottom: 4, alignItems: "center" }}>
                            <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: HADES.dot }} />
                        </View>
                        <Text style={{ textAlign: "center", fontSize: 17, fontWeight: "700", color: HADES.text, marginTop: 8 }}>
                            Pomodoros
                        </Text>
                        <Text style={{ textAlign: "center", fontSize: 14, color: HADES.textSecondary, marginTop: 8 }}>
                            Tempo de foco estimado: {qtdPomodoros} × {duracaoPomodoro}min ={" "}
                            <Text style={{ color: HADES.text, fontWeight: "700" }}>
                                {formatarDuracao(minutosFocoTotal)}
                            </Text>
                        </Text>
                        {/* Duas colunas em cartão, item central em destaque pela cor —
                            sem faixa sobreposta, só três itens visíveis. */}
                        <View style={{ flexDirection: "row", gap: 14, marginTop: 24 }}>
                            <View style={{ flex: 1 }}>
                                <View
                                    style={{
                                        backgroundColor: HADES.surfaceOverlay,
                                        borderWidth: 1,
                                        borderColor: HADES.borderStrong,
                                        borderRadius: 20,
                                        overflow: "hidden",
                                        flexDirection: "row",
                                    }}
                                >
                                    <WheelPicker
                                        items={QTD_POMODOROS}
                                        selectedIndex={qtdIdx}
                                        onChange={setQtdIdx}
                                        flex={1}
                                        itemHeight={ALTURA_ITEM_RODA}
                                        visible={3}
                                        fonteAtiva={34}
                                        fonteInativa={30}
                                    />
                                </View>
                                <Text style={{ textAlign: "center", fontSize: 13, color: HADES.textMuted, fontWeight: "600", marginTop: 12, lineHeight: 17 }}>
                                    Pomodoros{"\n"}previstos
                                </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <View
                                    style={{
                                        backgroundColor: HADES.surfaceOverlay,
                                        borderWidth: 1,
                                        borderColor: HADES.borderStrong,
                                        borderRadius: 20,
                                        overflow: "hidden",
                                        flexDirection: "row",
                                    }}
                                >
                                    <WheelPicker
                                        items={DURACAO_POMODORO.map((v) => `${v}min`)}
                                        selectedIndex={duracaoPomodoroIdx}
                                        onChange={setDuracaoPomodoroIdx}
                                        flex={1}
                                        itemHeight={ALTURA_ITEM_RODA}
                                        visible={3}
                                        fonteAtiva={30}
                                        fonteInativa={26}
                                    />
                                </View>
                                <Text style={{ textAlign: "center", fontSize: 13, color: HADES.textMuted, fontWeight: "600", marginTop: 12, lineHeight: 17 }}>
                                    Duração do{"\n"}pomodoro
                                </Text>
                            </View>
                        </View>
                        <View style={{ flexDirection: "row", gap: 12, marginTop: 24 }}>
                            <TouchableOpacity
                                onPress={() => setModalPomodorosAberto(false)}
                                activeOpacity={0.8}
                                style={{
                                    flex: 1,
                                    height: 50,
                                    borderRadius: 25,
                                    backgroundColor: HADES.surfaceOverlay,
                                    borderWidth: 1,
                                    borderColor: HADES.borderStrong,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <Text style={{ fontSize: 15, fontWeight: "600", color: HADES.textSecondary }}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setModalPomodorosAberto(false)}
                                activeOpacity={0.85}
                                style={{
                                    flex: 1,
                                    height: 50,
                                    borderRadius: 25,
                                    backgroundColor: HADES.accentSolid,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <Text style={{ fontSize: 15, fontWeight: "700", color: "#000" }}>Concluído</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}

            {/* Folha · Horário de início (mesmo motivo da folha acima) */}
            {modalHorarioAberto && (
                <View style={[StyleSheet.absoluteFill, { justifyContent: "flex-end" }]}>
                    <Pressable
                        style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.55)" }]}
                        onPress={() => setModalHorarioAberto(false)}
                    />
                    <View
                        style={{
                            backgroundColor: HADES.surfaceRaised,
                            borderWidth: 1,
                            borderColor: HADES.borderStrong,
                            borderTopLeftRadius: 24,
                            borderTopRightRadius: 24,
                            paddingHorizontal: 20,
                            paddingBottom: 26,
                            maxHeight: alturaMaximaFolha,
                        }}
                    >
                        <View style={{ paddingTop: 12, paddingBottom: 4, alignItems: "center" }}>
                            <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: HADES.dot }} />
                        </View>
                        <Text style={{ textAlign: "center", fontSize: 17, fontWeight: "700", color: HADES.text, marginTop: 8 }}>
                            Horário de início
                        </Text>
                        <Text style={{ textAlign: "center", fontSize: 13, color: HADES.textMuted, marginTop: 6 }}>
                            O primeiro pomodoro começa às{" "}
                            <Text style={{ color: HADES.text, fontWeight: "700" }}>{paraHoraMin(inicioMin)}</Text>
                        </Text>
                        <View
                            style={{
                                position: "relative",
                                marginTop: 20,
                                backgroundColor: HADES.surfaceOverlay,
                                borderWidth: 1,
                                borderColor: HADES.borderStrong,
                                borderRadius: 16,
                                paddingVertical: 8,
                            }}
                        >
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }}>
                                <WheelPicker
                                    items={HORAS_DIA}
                                    selectedIndex={Math.floor(inicioMin / 60) % 24}
                                    onChange={(i) => setInicioMin((atual) => i * 60 + (atual % 60))}
                                    flex={0.45}
                                />
                                <Text style={{ fontSize: 20, color: HADES.textMuted, fontWeight: "700" }}>:</Text>
                                <WheelPicker
                                    items={MINUTOS_5}
                                    selectedIndex={indiceMaisProximo(MINUTOS_5, inicioMin % 60)}
                                    onChange={(i) => setInicioMin((atual) => Math.floor(atual / 60) * 60 + Number(MINUTOS_5[i]))}
                                    flex={0.45}
                                />
                            </View>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, justifyContent: "center" }}>
                            <TouchableOpacity
                                onPress={() => aplicarInicioRapido(0)}
                                activeOpacity={0.8}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 6,
                                    backgroundColor: HADES.surfaceOverlay,
                                    borderWidth: 1,
                                    borderColor: HADES.borderStrong,
                                    borderRadius: 16,
                                    paddingVertical: 7,
                                    paddingHorizontal: 13,
                                }}
                            >
                                <Zap size={13} color={HADES.accentSolid} />
                                <Text style={{ fontSize: 12, color: HADES.textSecondary, fontWeight: "600" }}>Agora</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => aplicarInicioRapido(15)}
                                activeOpacity={0.8}
                                style={{
                                    backgroundColor: HADES.surfaceOverlay,
                                    borderWidth: 1,
                                    borderColor: HADES.borderStrong,
                                    borderRadius: 16,
                                    paddingVertical: 7,
                                    paddingHorizontal: 13,
                                }}
                            >
                                <Text style={{ fontSize: 12, color: HADES.textSecondary, fontWeight: "600" }}>Em 15 min</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => aplicarInicioRapido(30)}
                                activeOpacity={0.8}
                                style={{
                                    backgroundColor: HADES.surfaceOverlay,
                                    borderWidth: 1,
                                    borderColor: HADES.borderStrong,
                                    borderRadius: 16,
                                    paddingVertical: 7,
                                    paddingHorizontal: 13,
                                }}
                            >
                                <Text style={{ fontSize: 12, color: HADES.textSecondary, fontWeight: "600" }}>Em 30 min</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
                            <TouchableOpacity
                                onPress={() => setModalHorarioAberto(false)}
                                activeOpacity={0.8}
                                style={{
                                    flex: 1,
                                    height: 50,
                                    borderRadius: 25,
                                    backgroundColor: HADES.surfaceOverlay,
                                    borderWidth: 1,
                                    borderColor: HADES.borderStrong,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <Text style={{ fontSize: 15, fontWeight: "600", color: HADES.textSecondary }}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setModalHorarioAberto(false)}
                                activeOpacity={0.85}
                                style={{
                                    flex: 1,
                                    height: 50,
                                    borderRadius: 25,
                                    backgroundColor: HADES.accentSolid,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <Text style={{ fontSize: 15, fontWeight: "700", color: "#000" }}>Concluído</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}
        </View>
    );
}
