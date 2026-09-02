import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Pressable } from "react-native";
import { SafeAreaView } from "@/components/ui/TelaSegura";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Coffee, Plus, ChevronDown, Check, Trash2, Share2 } from "@/components/ui/icons";
import { HADES, CORES_PLANO } from "@/constants/hades";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatarDuracao } from "@/utils/tempo";
import { encontrarConflitos } from "@/utils/conflitos";
import { useAuth } from "@/hooks/useAuth";
import { useMaterias } from "@/hooks/useMaterias";
import { usePreferencias } from "@/hooks/usePreferencias";
import {
    buscarPlanoPorId,
    buscarBlocosPlano,
    criarPlano,
    atualizarPlano,
    salvarBlocoPlano,
    editarBlocoPlano,
    excluirBlocoPlano,
    aplicarPlanoHoje,
    ressincronizarLembretesDoPlano,
} from "@/services/planos";
import { cancelarLembretesPlano } from "@/services/lembretes";
import type { TipoBloco } from "@/types/cronograma";
import { toast } from "@/services/toast";
import { confirm } from "@/services/confirm";
import { mostrarPaywallProSeLimite } from "@/services/paywall";

/** Bloco em edição na tela — `persistido` diz se ele já existe em planos_blocos ou é novo (só local até "Salvar"). */
type BlocoEditor = {
    id: string;
    persistido: boolean;
    materiaId?: string;
    materia?: string;
    cor?: string;
    topico?: string;
    horaInicio: string;
    duracaoMin: number;
    tipo: TipoBloco;
    notificar: boolean;
    antecedenciaMin: number | null;
    /** Dia da semana exclusivo deste bloco (0 = segunda ... 6 = domingo). Ausente = vale em todos os dias. */
    diaSemana?: number;
};

function paraMinutos(horaInicio: string) {
    const [h, m] = horaInicio.split(":").map(Number);
    return h * 60 + m;
}

function paraHoraMin(totalMin: number) {
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/** Rótulo curto de dia da semana — mesma convenção de dia_semana/agenda_dias (0 = segunda). */
const DIAS_CURTOS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export default function PlanoEditorScreen() {
    const router = useRouter();
    const { planoId, rascunho, aplicarHoje } = useLocalSearchParams<{
        planoId?: string;
        rascunho?: string;
        aplicarHoje?: string;
    }>();
    const { userId } = useAuth();
    const { materiasComCores } = useMaterias(userId);
    const { prefs } = usePreferencias(userId);

    const materiaPorId = useMemo(
        () => new Map(materiasComCores.map((m) => [m.id, m])),
        [materiasComCores]
    );

    const [nome, setNome] = useState("");
    const [cor, setCor] = useState<string>(CORES_PLANO[0]);
    // Compartilhar o plano no Explorar da Comunidade. Como nome e cor, só vale depois do
    // "Salvar" — o editor inteiro é local até lá.
    const [publico, setPublico] = useState(false);
    const [corMenuAberto, setCorMenuAberto] = useState(false);
    const [blocos, setBlocos] = useState<BlocoEditor[]>([]);
    const [salvando, setSalvando] = useState(false);
    const [carregandoPlano, setCarregandoPlano] = useState(!!planoId && !rascunho);
    const [modalDescansoAberto, setModalDescansoAberto] = useState(false);
    const [duracaoDescansoMin, setDuracaoDescansoMin] = useState(10);
    // Se a tela já nasceu com um rascunho (voltando de "novo bloco"), o estado
    // já vai ser restaurado a partir dele — não busca do banco por cima, senão
    // sobrescreve o que o usuário editou (nome/cor/blocos ainda não salvos).
    const restaurandoRascunho = useRef(!!rascunho);

    // Modo edição: carrega o plano e os blocos existentes.
    useEffect(() => {
        if (!planoId || restaurandoRascunho.current) return;
        const carregar = async () => {
            const plano = await buscarPlanoPorId(planoId);
            if (plano) {
                setNome(plano.nome);
                setCor(plano.cor);
                setPublico(plano.publico);
            }

            const { data, error } = await buscarBlocosPlano(planoId);
            if (error) {
                console.error("Erro ao buscar blocos do plano:", error);
                toast.error("Não foi possível carregar os blocos do plano.");
                setCarregandoPlano(false);
                return;
            }
            if (data) {
                setBlocos(
                    data.map((row) => {
                        const materia = row.materia_id ? materiaPorId.get(row.materia_id) : undefined;
                        return {
                            id: row.id,
                            persistido: true,
                            materiaId: row.materia_id ?? undefined,
                            materia: materia?.nomeExibicao,
                            cor: materia?.cor,
                            topico: row.topico ?? undefined,
                            horaInicio: row.hora_inicio.slice(0, 5),
                            duracaoMin: row.duracao_min,
                            tipo: row.tipo,
                            notificar: row.notificar,
                            antecedenciaMin: row.antecedencia_min,
                            diaSemana: row.dia_semana ?? undefined,
                        };
                    })
                );
            }
            setCarregandoPlano(false);
        };
        carregar();
    }, [planoId, materiaPorId]);

    // Volta da tela "novo bloco" com nome/cor/blocos completos — restaura tudo de
    // uma vez (funciona mesmo se essa tela remontar ao voltar da navegação).
    useEffect(() => {
        if (!rascunho) return;
        try {
            const dados = JSON.parse(rascunho) as {
                nome: string;
                cor: string;
                publico?: boolean;
                blocos: BlocoEditor[];
            };
            setNome(dados.nome);
            setCor(dados.cor);
            setPublico(!!dados.publico);
            setBlocos(dados.blocos);
        } catch (e) {
            console.error("Rascunho inválido recebido do editor:", e);
            toast.error("Não foi possível recuperar os dados do plano.");
        }
        router.setParams({ rascunho: undefined });
    }, [rascunho]);

    const abrirNovoBloco = () => {
        const rascunhoAtual = JSON.stringify({ nome, cor, publico, blocos });
        router.push({
            pathname: "/(modals)/novo-bloco-plano",
            params: planoId ? { planoId, rascunho: rascunhoAtual } : { rascunho: rascunhoAtual },
        });
    };

    const ultimoEstudo = useMemo(
        () => blocos
            .filter((bloco) => bloco.tipo === "estudo")
            .sort((a, b) => {
                const diaA = a.diaSemana ?? -1;
                const diaB = b.diaSemana ?? -1;
                if (diaA !== diaB) return diaB - diaA;
                return paraMinutos(b.horaInicio) + b.duracaoMin - (paraMinutos(a.horaInicio) + a.duracaoMin);
            })[0],
        [blocos]
    );

    const horaInicioDescanso = ultimoEstudo
        ? paraHoraMin(paraMinutos(ultimoEstudo.horaInicio) + ultimoEstudo.duracaoMin)
        : null;

    const descansoDepoisDoUltimoJaExiste = !!ultimoEstudo && blocos.some(
        (bloco) =>
            bloco.tipo === "descanso" &&
            bloco.diaSemana === ultimoEstudo.diaSemana &&
            bloco.horaInicio === horaInicioDescanso
    );

    const abrirSeletorDescanso = () => {
        if (!ultimoEstudo) {
            toast.info("Adicione um bloco de matéria antes do descanso.");
            return;
        }
        if (descansoDepoisDoUltimoJaExiste) {
            toast.info("Já existe um descanso depois do último bloco de matéria.");
            return;
        }

        setDuracaoDescansoMin(Math.min(60, Math.max(5, prefs.duracaoPadraoDescansoMin || 10)));
        setModalDescansoAberto(true);
    };

    /** Adiciona o descanso escolhido imediatamente após o último bloco de estudo. */
    const confirmarDescanso = () => {
        if (!ultimoEstudo || !horaInicioDescanso) {
            setModalDescansoAberto(false);
            toast.info("Adicione um bloco de matéria antes do descanso.");
            return;
        }

        if (descansoDepoisDoUltimoJaExiste) {
            setModalDescansoAberto(false);
            toast.info("Já existe um descanso depois do último bloco de matéria.");
            return;
        }

        setBlocos((atual) => [
            ...atual,
            {
                id: `novo-${Date.now()}-descanso`,
                persistido: false,
                horaInicio: horaInicioDescanso,
                duracaoMin: duracaoDescansoMin,
                tipo: "descanso",
                notificar: false,
                antecedenciaMin: null,
                diaSemana: ultimoEstudo.diaSemana,
            },
        ]);
        setModalDescansoAberto(false);
        toast.success("Descanso adicionado depois do último bloco.");
    };

    const alternarNotificacao = (id: string) =>
        setBlocos((atual) =>
            atual.map((b) => (b.id === id ? { ...b, notificar: !b.notificar } : b))
        );

    const removerBloco = (bloco: BlocoEditor) => {
        confirm({
            title: bloco.tipo === "descanso" ? "Remover descanso" : "Remover bloco",
            message: `Remover "${bloco.tipo === "descanso" ? "Descanso" : bloco.materia}" do plano?`,
            confirmText: "Remover",
            destructive: true,
            onConfirm: async () => {
                if (bloco.persistido) {
                    const { error } = await excluirBlocoPlano(bloco.id);
                    if (error) {
                        console.error("Erro ao excluir bloco do plano:", error);
                        toast.error("Não foi possível remover esse bloco.");
                        return;
                    }
                    await cancelarLembretesPlano(planoId ?? "", [bloco.id]);
                }
                setBlocos((atual) => atual.filter((b) => b.id !== bloco.id));
            },
        });
    };

    // Conflito de horário: cada dia da semana é independente — blocos com diaSemana
    // diferentes (ou com dia vs sem dia) NUNCA conflitam entre si. Só blocos do mesmo
    // dia (mesmo diaSemana, ou ambos sem dia = vale todo dia) podem se sobrepor.
    const conflitos = useMemo(() => {
        const grupos = new Map<number, { id: string; horaInicio: string; duracaoMin: number }[]>();
        const semDia: { id: string; horaInicio: string; duracaoMin: number }[] = [];

        for (const b of blocos) {
            const item = { id: b.id, horaInicio: b.horaInicio, duracaoMin: b.duracaoMin };
            if (b.diaSemana != null) {
                const lista = grupos.get(b.diaSemana) ?? [];
                lista.push(item);
                grupos.set(b.diaSemana, lista);
            } else {
                semDia.push(item);
            }
        }

        const resultado = new Map<string, { comId: string; minutos: number }[]>();
        if (semDia.length > 1) {
            for (const [id, conflitosDoDia] of encontrarConflitos(semDia)) {
                resultado.set(id, conflitosDoDia);
            }
        }
        for (const [, itens] of grupos) {
            if (itens.length < 2) continue;
            for (const [id, conflitosDoDia] of encontrarConflitos(itens)) {
                resultado.set(id, conflitosDoDia);
            }
        }
        return resultado;
    }, [blocos]);
    const blocoPorId = useMemo(() => new Map(blocos.map((b) => [b.id, b])), [blocos]);
    const rotuloConflito = (id: string) => {
        const c = conflitos.get(id)?.[0];
        if (!c) return undefined;
        const outro = blocoPorId.get(c.comId);
        return outro?.tipo === "descanso" ? "Descanso" : outro?.materia ?? "outro bloco";
    };

    // A lista não é reordenável: a ordem exibida segue dia da semana e horário.
    const blocosOrdenados = useMemo(() =>
        [...blocos].sort((a, b) => {
            const diaA = a.diaSemana ?? -1;
            const diaB = b.diaSemana ?? -1;
            if (diaA !== diaB) return diaA - diaB;
            return a.horaInicio.localeCompare(b.horaInicio);
        }),
        [blocos]
    );

    const minutosEstudo = blocos
        .filter((b) => b.tipo === "estudo")
        .reduce((total, b) => total + b.duracaoMin, 0);
    const minutosDescanso = blocos
        .filter((b) => b.tipo === "descanso")
        .reduce((total, b) => total + b.duracaoMin, 0);

    const onSalvar = async () => {
        if (!userId || !nome.trim() || salvando) return;
        setSalvando(true);

        let planoIdReal: string | undefined = planoId;
        if (!planoIdReal) {
            const resultado = await criarPlano(userId, nome, cor, publico);
            if (!resultado.sucesso || !resultado.plano) {
                if (mostrarPaywallProSeLimite(resultado.erro)) {
                    setSalvando(false);
                    return;
                }
                toast.error(resultado.erro ?? "Não foi possível criar o plano.");
                setSalvando(false);
                return;
            }
            planoIdReal = resultado.plano.id;
        } else {
            const resultado = await atualizarPlano(planoIdReal, { nome, cor, publico });
            if (!resultado.sucesso) {
                toast.error(resultado.erro ?? "Não foi possível atualizar o plano.");
                setSalvando(false);
                return;
            }
        }

        if (!planoIdReal) {
            setSalvando(false);
            return;
        }

        let houveErroBloco = false;
        for (const bloco of blocos) {
            const payload = {
                plano_id: planoIdReal,
                hora_inicio: bloco.horaInicio,
                duracao_min: bloco.duracaoMin,
                tipo: bloco.tipo,
                materia_id: bloco.materiaId ?? null,
                topico: bloco.topico || null,
                notificar: bloco.notificar,
                antecedencia_min: bloco.antecedenciaMin,
                dia_semana: bloco.diaSemana ?? null,
            };

            const { error } = bloco.persistido
                ? await editarBlocoPlano({ id: bloco.id, ...payload })
                : await salvarBlocoPlano(payload);

            if (error) {
                console.error("Erro ao salvar bloco do plano:", error);
                houveErroBloco = true;
            }
        }

        if (houveErroBloco) {
            toast.error("Alguns blocos não puderam ser salvos. Confira o plano antes de sair.");
        }

        // Veio de "Montar meu dia" — aplica esse plano recém-salvo a hoje na hora.
        // (aplicarPlanoHoje já resincroniza os lembretes por baixo; caso contrário,
        // resincroniza aqui pra refletir blocos novos/editados na agenda já em vigor.)
        if (aplicarHoje === "1") {
            const resultado = await aplicarPlanoHoje(userId, planoIdReal);
            if (!resultado.sucesso) {
                toast.error(resultado.erro ?? "O plano foi salvo, mas não deu pra aplicá-lo a hoje.");
            }
        } else {
            await ressincronizarLembretesDoPlano(planoIdReal);
        }

        setSalvando(false);
        // dismissTo (não back) fecha o editor e qualquer folha de "novo bloco" aberta
        // por baixo de uma vez, direto pra aba de planos — em vez de voltar tela por tela.
        router.dismissTo({ pathname: "/(tabs)/schedule", params: { aba: "planos" } });
    };

    if (carregandoPlano) {
        return <PlanoEditorSkeleton />;
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
                    <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Text style={{ fontSize: 14, color: HADES.textMuted }}>Cancelar</Text>
                    </TouchableOpacity>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: HADES.text }}>
                        {planoId ? "Editar plano" : "Novo plano"}
                    </Text>
                    <View style={{ width: 56 }} />
                </View>

                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Nome + cor */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 }}>
                        <View
                            style={{
                                flex: 1,
                                backgroundColor: HADES.surfaceRaised,
                                borderWidth: 1,
                                borderColor: HADES.borderStrong,
                                borderRadius: 12,
                                padding: 14,
                            }}
                        >
                            <TextInput
                                value={nome}
                                onChangeText={setNome}
                                placeholder="Nome do plano"
                                placeholderTextColor={HADES.textFaint}
                                style={{
                                    padding: 0,
                                    color: HADES.text,
                                    fontSize: 15,
                                    fontWeight: "600",
                                }}
                            />
                        </View>

                        <TouchableOpacity
                            onPress={() => setCorMenuAberto(true)}
                            activeOpacity={0.8}
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 6,
                                height: 50,
                                paddingHorizontal: 12,
                                backgroundColor: HADES.surfaceRaised,
                                borderWidth: 1,
                                borderColor: HADES.borderStrong,
                                borderRadius: 12,
                            }}
                        >
                            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: cor }} />
                            <ChevronDown size={16} color={HADES.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <Modal
                        visible={corMenuAberto}
                        transparent
                        animationType="fade"
                        onRequestClose={() => setCorMenuAberto(false)}
                    >
                        <Pressable
                            style={{
                                flex: 1,
                                backgroundColor: "rgba(0,0,0,0.55)",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                            onPress={() => setCorMenuAberto(false)}
                        >
                            <View
                                style={{
                                    backgroundColor: HADES.surfaceRaised,
                                    borderWidth: 1,
                                    borderColor: HADES.borderStrong,
                                    borderRadius: 16,
                                    padding: 16,
                                    width: 232,
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 12,
                                        color: HADES.textFaint,
                                        fontWeight: "600",
                                        letterSpacing: 0.5,
                                        marginBottom: 12,
                                    }}
                                >
                                    COR DO PLANO
                                </Text>
                                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                                    {CORES_PLANO.map((c) => {
                                        const selecionada = cor === c;
                                        return (
                                            <TouchableOpacity
                                                key={c}
                                                onPress={() => {
                                                    setCor(c);
                                                    setCorMenuAberto(false);
                                                }}
                                                activeOpacity={0.8}
                                                style={{
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: 16,
                                                    backgroundColor: c,
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    borderWidth: selecionada ? 2.5 : 0,
                                                    borderColor: "#fff",
                                                }}
                                            >
                                                {selecionada && <Check size={14} color="#fff" />}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        </Pressable>
                    </Modal>

                    {/*
                      Compartilhar fica em cima, junto de nome e cor, porque é uma decisão
                      sobre o plano inteiro — não mais um item da lista de blocos. Só passa
                      a valer no "Salvar", como todo o resto desta tela.
                    */}
                    <TouchableOpacity
                        onPress={() => setPublico((antes) => !antes)}
                        activeOpacity={0.8}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 12,
                            padding: 14,
                            marginBottom: 20,
                            borderRadius: 12,
                            borderWidth: 1,
                            backgroundColor: publico ? HADES.accentTint : HADES.surfaceRaised,
                            borderColor: publico ? HADES.accentTintBorder : HADES.borderStrong,
                        }}
                    >
                        <Share2 size={17} color={publico ? HADES.accentSolid : HADES.textMuted} />
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontWeight: "600", color: HADES.text }}>
                                Compartilhar no Explorar
                            </Text>
                            <Text style={{ fontSize: 12, color: HADES.textFaint, marginTop: 2, lineHeight: 17 }}>
                                {publico
                                    ? "Qualquer pessoa do app vê os blocos e pode importar uma cópia."
                                    : "Só você vê este plano."}
                            </Text>
                        </View>
                        <Interruptor
                            ligado={publico}
                            onPress={() => setPublico((antes) => !antes)}
                            cor={HADES.accentSolid}
                            pequeno
                        />
                    </TouchableOpacity>

                    <Text
                        style={{
                            fontSize: 12,
                            color: HADES.textFaint,
                            fontWeight: "600",
                            letterSpacing: 0.5,
                            marginBottom: 12,
                        }}
                    >
                        BLOCOS
                    </Text>

                    {blocosOrdenados.length === 0 && (
                        <View
                            style={{
                                backgroundColor: HADES.surfaceRaised,
                                borderWidth: 1,
                                borderColor: HADES.border,
                                borderRadius: 14,
                                paddingVertical: 20,
                                paddingHorizontal: 16,
                                alignItems: "center",
                                marginBottom: 10,
                            }}
                        >
                            <Text style={{ fontSize: 13.5, color: HADES.textMuted, textAlign: "center" }}>
                                Este plano ainda não tem blocos.
                            </Text>
                            <Text style={{ fontSize: 12, color: HADES.textDim, marginTop: 4, textAlign: "center" }}>
                                Adicione o primeiro bloco de estudo ou descanso abaixo.
                            </Text>
                        </View>
                    )}

                    <View style={{ gap: 10 }}>
                        {blocosOrdenados.map((bloco) => (
                            <LinhaBloco
                                key={bloco.id}
                                bloco={bloco}
                                conflitaCom={rotuloConflito(bloco.id)}
                                onRemover={() => removerBloco(bloco)}
                                onAlternarNotificacao={() => alternarNotificacao(bloco.id)}
                            />
                        ))}
                    </View>

                    {/* Adicionar */}
                    <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                        <BotaoAdicionar
                            Icone={Plus}
                            rotulo="Bloco"
                            corIcone={HADES.accent}
                            corTexto={HADES.text}
                            onPress={abrirNovoBloco}
                        />
                        <BotaoAdicionar
                            Icone={Coffee}
                            rotulo="Descanso"
                            corIcone={HADES.textMuted}
                            corTexto={HADES.textSecondary}
                            onPress={abrirSeletorDescanso}
                        />
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
                        <Text style={{ fontSize: 14, color: HADES.text, fontWeight: "600" }}>
                            {formatarDuracao(minutosEstudo)} de estudo
                        </Text>
                        <Text style={{ fontSize: 12, color: HADES.textFaint, marginTop: 1 }}>
                            {formatarDuracao(minutosDescanso)} de descanso
                        </Text>
                    </View>

                    <TouchableOpacity
                        onPress={onSalvar}
                        activeOpacity={0.85}
                        disabled={salvando || !nome.trim()}
                        style={{
                            height: 48,
                            paddingHorizontal: 28,
                            borderRadius: 13,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: HADES.accentSolid,
                            opacity: salvando || !nome.trim() ? 0.6 : 1,
                        }}
                    >
                        <Text style={{ fontSize: 15, fontWeight: "700", color: "#000" }}>
                            {salvando ? "Salvando..." : "Salvar"}
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            <Modal
                visible={modalDescansoAberto}
                transparent
                animationType="fade"
                onRequestClose={() => setModalDescansoAberto(false)}
            >
                <View
                    style={{
                        flex: 1,
                        alignItems: "center",
                        justifyContent: "center",
                        paddingHorizontal: 24,
                    }}
                >
                    <Pressable
                        style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.65)" }}
                        onPress={() => setModalDescansoAberto(false)}
                    />
                    <View
                        style={{
                            width: "100%",
                            maxWidth: 360,
                            backgroundColor: HADES.surfaceRaised,
                            borderWidth: 1,
                            borderColor: HADES.borderStrong,
                            borderRadius: 18,
                            padding: 18,
                        }}
                    >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                            <View
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 18,
                                    backgroundColor: HADES.greenTint,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <Coffee size={18} color={HADES.green} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: HADES.text, fontSize: 17, fontWeight: "700" }}>
                                    Duração do descanso
                                </Text>
                                <Text style={{ color: HADES.textMuted, fontSize: 12, marginTop: 2 }}>
                                    Começa às {horaInicioDescanso ?? "--:--"}
                                </Text>
                            </View>
                        </View>

                        <View
                            style={{
                                marginTop: 22,
                                height: 64,
                                borderRadius: 14,
                                backgroundColor: HADES.surfaceOverlay,
                                borderWidth: 1,
                                borderColor: HADES.borderStrong,
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                paddingHorizontal: 12,
                            }}
                        >
                            <TouchableOpacity
                                onPress={() => setDuracaoDescansoMin((valor) => Math.max(5, valor - 5))}
                                disabled={duracaoDescansoMin <= 5}
                                activeOpacity={0.7}
                                style={{
                                    width: 42,
                                    height: 42,
                                    borderRadius: 12,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    backgroundColor: HADES.surfaceRaised,
                                    opacity: duracaoDescansoMin <= 5 ? 0.35 : 1,
                                }}
                            >
                                <Text style={{ color: HADES.textSecondary, fontSize: 24 }}>−</Text>
                            </TouchableOpacity>
                            <Text style={{ color: HADES.text, fontSize: 22, fontWeight: "700" }}>
                                {duracaoDescansoMin} min
                            </Text>
                            <TouchableOpacity
                                onPress={() => setDuracaoDescansoMin((valor) => Math.min(60, valor + 5))}
                                disabled={duracaoDescansoMin >= 60}
                                activeOpacity={0.7}
                                style={{
                                    width: 42,
                                    height: 42,
                                    borderRadius: 12,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    backgroundColor: HADES.surfaceRaised,
                                    opacity: duracaoDescansoMin >= 60 ? 0.35 : 1,
                                }}
                            >
                                <Text style={{ color: HADES.accentSolid, fontSize: 24 }}>+</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
                            <TouchableOpacity
                                onPress={() => setModalDescansoAberto(false)}
                                activeOpacity={0.8}
                                style={{
                                    flex: 1,
                                    height: 48,
                                    borderRadius: 13,
                                    backgroundColor: HADES.surfaceOverlay,
                                    borderWidth: 1,
                                    borderColor: HADES.borderStrong,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <Text style={{ color: HADES.textSecondary, fontSize: 14, fontWeight: "600" }}>
                                    Cancelar
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={confirmarDescanso}
                                activeOpacity={0.85}
                                style={{
                                    flex: 1,
                                    height: 48,
                                    borderRadius: 13,
                                    backgroundColor: HADES.accentSolid,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <Text style={{ color: "#000", fontSize: 14, fontWeight: "700" }}>
                                    Adicionar
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

function PlanoEditorSkeleton() {
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
                    <Skeleton width={56} height={13} hades />
                    <Skeleton width={110} height={16} hades />
                    <View style={{ width: 56 }} />
                </View>

                <View style={{ flex: 1, paddingHorizontal: 20 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 }}>
                        <Skeleton width="100%" height={50} borderRadius={12} hades style={{ flex: 1 }} />
                        <Skeleton width={64} height={50} borderRadius={12} hades />
                    </View>

                    {/* Cartão de "Compartilhar este plano" */}
                    <Skeleton width="100%" height={65} borderRadius={12} hades style={{ marginBottom: 20 }} />

                    <Skeleton width={56} height={12} hades style={{ marginBottom: 12 }} />

                    <View style={{ gap: 10 }}>
                        {[0, 1, 2].map((i) => (
                            <Skeleton key={i} width="100%" height={58} borderRadius={13} hades />
                        ))}
                    </View>

                    {/* Botões de adicionar bloco / descanso */}
                    <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                        <Skeleton height={46} borderRadius={12} hades style={{ flex: 1 }} />
                        <Skeleton height={46} borderRadius={12} hades style={{ flex: 1 }} />
                    </View>
                </View>

                {/* Rodapé fixo: resumo à esquerda, "Salvar" à direita */}
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
                        <Skeleton width={110} height={14} hades />
                        <Skeleton width={150} height={12} hades style={{ marginTop: 1 }} />
                    </View>
                    <Skeleton width={120} height={48} borderRadius={13} hades />
                </View>
            </SafeAreaView>
        </View>
    );
}

/** Linha de um bloco de estudo ou descanso. */
function LinhaBloco({
    bloco,
    conflitaCom,
    onRemover,
    onAlternarNotificacao,
}: {
    bloco: BlocoEditor;
    conflitaCom?: string;
    onRemover: () => void;
    onAlternarNotificacao: () => void;
}) {
    if (bloco.tipo === "descanso") {
        return (
            <View
                style={{
                    borderWidth: 1,
                    borderStyle: "dashed",
                    borderColor: "rgba(48,209,88,0.35)",
                    backgroundColor: "rgba(48,209,88,0.06)",
                    borderRadius: 13,
                    padding: 12,
                }}
            >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
                    <Coffee size={16} color={HADES.green} />
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: HADES.textSecondary }}>
                            Descanso
                        </Text>
                        <Text style={{ fontSize: 12, color: HADES.textFaint, marginTop: 1 }}>
                            {bloco.horaInicio} · {formatarDuracao(bloco.duracaoMin)}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={onRemover} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Trash2 size={15} color={HADES.textFaint} />
                    </TouchableOpacity>
                </View>
                {conflitaCom && (
                    <Text style={{ fontSize: 11, color: HADES.amber, marginTop: 8 }}>
                        Conflita com {conflitaCom}
                    </Text>
                )}
            </View>
        );
    }

    return (
        <View
            style={{
                backgroundColor: HADES.surfaceRaised,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.08)",
                borderRadius: 13,
                paddingVertical: 13,
                paddingHorizontal: 12,
            }}
        >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
                <View style={{ flex: 1 }}>
                    <Text
                        style={{
                            fontSize: 14,
                            fontWeight: "600",
                            color: bloco.cor ?? HADES.text,
                        }}
                    >
                        {bloco.materia}
                    </Text>
                    <Text style={{ fontSize: 12, color: HADES.textFaint, marginTop: 1 }}>
                        {bloco.diaSemana != null && (
                            <Text style={{ color: bloco.cor ?? HADES.accentSolid, fontWeight: "700" }}>
                                {DIAS_CURTOS[bloco.diaSemana]} ·{" "}
                            </Text>
                        )}
                        {bloco.topico} · {bloco.horaInicio} · {formatarDuracao(bloco.duracaoMin)}
                    </Text>
                </View>
                <Interruptor ligado={bloco.notificar} onPress={onAlternarNotificacao} cor={bloco.cor ?? HADES.accentSolid} />
                <TouchableOpacity onPress={onRemover} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Trash2 size={15} color={HADES.textFaint} />
                </TouchableOpacity>
            </View>
            {conflitaCom && (
                <Text style={{ fontSize: 11, color: HADES.amber, marginTop: 8 }}>
                    Conflita com {conflitaCom}
                </Text>
            )}
        </View>
    );
}

function Interruptor({
    ligado,
    onPress,
    cor,
    pequeno,
}: {
    ligado: boolean;
    onPress: () => void;
    cor: string;
    pequeno?: boolean;
}) {
    const largura = pequeno ? 34 : 44;
    const altura = pequeno ? 20 : 27;
    const tamanhoThumb = pequeno ? 16 : 22;
    const margem = pequeno ? 2 : 2.5;
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
                width: largura,
                height: altura,
                borderRadius: altura / 2,
                backgroundColor: ligado ? cor : HADES.trackOff,
                justifyContent: "center",
            }}
        >
            <View
                style={{
                    position: "absolute",
                    left: ligado ? largura - tamanhoThumb - margem : margem,
                    width: tamanhoThumb,
                    height: tamanhoThumb,
                    borderRadius: tamanhoThumb / 2,
                    backgroundColor: ligado ? "#fff" : HADES.textMuted,
                }}
            />
        </TouchableOpacity>
    );
}

function BotaoAdicionar({
    Icone,
    rotulo,
    corIcone,
    corTexto,
    onPress,
}: {
    Icone: typeof Plus;
    rotulo: string;
    corIcone: string;
    corTexto: string;
    onPress?: () => void;
}) {
    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            style={{
                flex: 1,
                height: 46,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.10)",
                backgroundColor: HADES.surfaceRaised,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
            }}
        >
            <Icone size={16} color={corIcone} />
            <Text style={{ fontSize: 14, fontWeight: "600", color: corTexto }}>{rotulo}</Text>
        </TouchableOpacity>
    );
}
