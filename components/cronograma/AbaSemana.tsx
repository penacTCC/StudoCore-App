import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { CalendarDays, LayoutGrid, CalendarPlus } from "lucide-react-native";
import { HADES } from "@/constants/hades";
import { GRADE_INICIO_HORA, GRADE_MIN_POR_PX } from "@/constants/cronograma-mock";
import AbaSemanaBlocos from "@/components/cronograma/AbaSemanaBlocos";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import type { BlocoListaDia, BlocoRotina, BlocoSemana, VisualizacaoSemana } from "@/types/cronograma";
import { useAuth } from "@/hooks/useAuth";
import { useMaterias } from "@/hooks/useMaterias";
import { buscarBlocosSemana, excluirBlocoRotina, moverBlocoRotina } from "@/services/schedule";
import { toast } from "@/services/toast";
import { formatarDuracao, pegarDiaDaSemanaAtual, pegarDiasDaSemanaAtual } from "@/utils/tempo";
import { encontrarConflitos, somarMinutosSemSobreposicao } from "@/utils/conflitos";
import { buscarSessoesSemana } from "@/services/sessions";
import { normalizarNomeMateria } from "@/services/materias";
import { SessaoFocoRow } from "@/types/sessions";

const LARGURA_EIXO = 26;
const DURACAO_GRADE_PADRAO_MIN = 720; // 12h, usado quando não há blocos ainda
const PASSO_EIXO_MIN = 180; // marcação a cada 3h

/** Converte um valor em minutos (relativo ao início da grade) para pixels. */
function minParaPx(min: number) {
    return min / GRADE_MIN_POR_PX;
}

type Props = {
    resumo: { planejado: string; realizado: string };
};

export default function AbaSemana({ resumo }: Props) {
    const router = useRouter();
    const diaAtual = pegarDiaDaSemanaAtual();
    const diasDaSemanaGrade = useMemo(() => pegarDiasDaSemanaAtual(), []);
    const { userId } = useAuth();
    const { materiasComCores } = useMaterias(userId);
    const [visualizacao, setVisualizacao] = useState<VisualizacaoSemana>("calendario");
    const [blocosCru, setBlocosCru] = useState<BlocoRotina[]>([]);
    const [sessaoSemanaUsuario, setSessaoSemanaUsuario] = useState<SessaoFocoRow[]>([])
    const [carregando, setCarregando] = useState(true);

    //Busca os blocos do usuário
    const buscarBlocosLista = useCallback(async () => {
        if (!userId) {
            setCarregando(false);
            return;
        }
        setCarregando(true);
        const { data, error } = await buscarBlocosSemana(userId);
        if (error) {
            console.error(error);
            toast.error("Não foi possível carregar sua semana.");
        }
        if (data) {
            setBlocosCru(data);
        }
        setCarregando(false);
    }, [userId]);

    useEffect(() => {
        buscarBlocosLista();
    }, [buscarBlocosLista]);

    // Matéria por id, pra não percorrer o array de matérias a cada bloco.
    const materiaPorId = useMemo(
        () => new Map(materiasComCores.map((m) => [m.id, m])),
        [materiasComCores]
    );

    // Janela de horas exibida na grade: começa na hora cheia do bloco mais cedo
    // e cobre até o fim do bloco mais tarde (com o mínimo de 12h, igual ao padrão antigo).
    const janela = useMemo(() => {
        if (blocosCru.length === 0) {
            return { inicioMin: GRADE_INICIO_HORA * 60, duracaoMin: DURACAO_GRADE_PADRAO_MIN };
        }

        const inicios = blocosCru.map((b) => {
            const [h, m] = b.hora_inicio.split(":").map(Number);
            return h * 60 + m;
        });
        const fins = blocosCru.map((b, i) => inicios[i] + b.duracao_min);

        const inicioMin = Math.floor(Math.min(...inicios) / 60) * 60;
        const fimMin = Math.ceil(Math.max(...fins) / 60) * 60;

        return { inicioMin, duracaoMin: Math.max(fimMin - inicioMin, DURACAO_GRADE_PADRAO_MIN) };
    }, [blocosCru]);

    const alturaGrade = minParaPx(janela.duracaoMin);

    // Marcações do eixo de horas, a cada 3h a partir do início da janela.
    const horasEixo = useMemo(() => {
        const marcacoes = [];
        for (let min = 0; min <= janela.duracaoMin; min += PASSO_EIXO_MIN) {
            const horaAbs = Math.floor((janela.inicioMin + min) / 60) % 24;
            marcacoes.push({ rotulo: `${horaAbs}h`, topo: minParaPx(min) });
        }
        return marcacoes;
    }, [janela]);

    // Converte as linhas cruas do banco pro formato que a grade espera.
    const blocosSemana = useMemo<BlocoSemana[]>(
        () =>
            blocosCru.map((bloco) => {
                const [h, m] = bloco.hora_inicio.split(":").map(Number);
                const inicioMin = h * 60 + m - janela.inicioMin;
                const materia = bloco.materia_id ? materiaPorId.get(bloco.materia_id) : undefined;
                const descanso = bloco.tipo === "descanso";

                return {
                    id: bloco.id,
                    dia: bloco.dia_semana,
                    inicioMin,
                    duracaoMin: bloco.duracao_min,
                    rotulo: descanso ? "Zzz" : materia?.nomeExibicao.slice(0, 3) ?? "—",
                    cor: descanso ? HADES.green : materia?.cor ?? HADES.textFaint,
                    tipo: bloco.tipo,
                };
            }),
        [blocosCru, materiaPorId, janela]
    );

    // Mesmas linhas cruas, formato da visualização "Blocos" (lista por dia).
    const blocosListaSemana = useMemo<BlocoListaDia[]>(
        () =>
            blocosCru.map((bloco) => {
                const materia = bloco.materia_id ? materiaPorId.get(bloco.materia_id) : undefined;
                const descanso = bloco.tipo === "descanso";

                return {
                    id: bloco.id,
                    dia: bloco.dia_semana,
                    materia: descanso ? "Descanso" : materia?.nomeExibicao ?? "—",
                    topico: bloco.topico ?? "",
                    horaInicio: bloco.hora_inicio.slice(0, 5),
                    duracaoRotulo: formatarDuracao(bloco.duracao_min),
                    cor: descanso ? HADES.green : materia?.cor ?? HADES.textFaint,
                    tipo: bloco.tipo,
                };
            }),
        [blocosCru, materiaPorId]
    );

    // Conflitos calculados por dia da semana (mesma fonte — a rotina inteira
    // desse dia), depois achatados num único mapa id -> rótulo do conflito.
    const conflitosPorId = useMemo(() => {
        const mapa = new Map<string, string>();
        const materiaLabel = (materiaId: string | null) =>
            materiaId ? materiaPorId.get(materiaId)?.nomeExibicao ?? "outro bloco" : "outro bloco";
        const blocoPorId = new Map(blocosCru.map((b) => [b.id, b]));

        for (let dia = 0; dia < 7; dia++) {
            const doDia = blocosCru.filter((b) => b.dia_semana === dia);
            const conflitos = encontrarConflitos(
                doDia.map((b) => ({ id: b.id, horaInicio: b.hora_inicio.slice(0, 5), duracaoMin: b.duracao_min }))
            );
            for (const [id, lista] of conflitos) {
                const outro = blocoPorId.get(lista[0].comId);
                if (!outro) continue;
                mapa.set(id, outro.tipo === "descanso" ? "Descanso" : materiaLabel(outro.materia_id));
            }
        }
        return mapa;
    }, [blocosCru, materiaPorId]);
    
    //Blocos ordenados pelo horário crescente
    const blocosOrdenados = useMemo(() => {
        return blocosListaSemana.sort((a, b) => {
            const [hA, mA] = a.horaInicio.split(":").map(Number);
            const [hB, mB] = b.horaInicio.split(":").map(Number);
            return hA * 60 + mA - (hB * 60 + mB);
        });
    }, [blocosListaSemana]);

    // Soma de minutos por matéria, pro rodapé "Total semanal".
    const totalPorMateriaSemana = useMemo(() => {
        const minutosPorMateria = new Map<string, number>();
        for (const bloco of blocosCru) {
            if (!bloco.materia_id) continue;
            minutosPorMateria.set(
                bloco.materia_id,
                (minutosPorMateria.get(bloco.materia_id) ?? 0) + bloco.duracao_min
            );
        }

        return Array.from(minutosPorMateria.entries()).map(([materiaId, minutos]) => {
            const materia = materiaPorId.get(materiaId);
            return {
                materia: materia?.nomeExibicao ?? "—",
                cor: materia?.cor ?? HADES.textFaint,
                total: formatarDuracao(minutos),
            };
        });
    }, [blocosCru, materiaPorId]);

    // Soma por união de intervalos, dia a dia — não conta 2x minuto sobreposto.
    const totalSemanal = useMemo(() => {
        let total = 0;
        for (let dia = 0; dia < 7; dia++) {
            const itens = blocosCru
                .filter((b) => b.dia_semana === dia)
                .map((b) => {
                    const [h, m] = b.hora_inicio.split(":").map(Number);
                    return { inicioMin: h * 60 + m, duracaoMin: b.duracao_min };
                });
            total += somarMinutosSemSobreposicao(itens);
        }
        return formatarDuracao(total);
    }, [blocosCru]);

    const abrirNovoBloco = (dia: number) =>
        router.push({
            pathname: "/(modals)/novo-bloco",
            params: { dia: dia.toString() },
        });

    const abrirEdicaoBloco = (blocoId: string) =>
        router.push({
            pathname: "/(modals)/novo-bloco",
            params: { blocoId },
        });

    const excluirBloco = async (blocoId: string) => {
        const { error } = await excluirBlocoRotina(blocoId);
        if (error) {
            console.error(error);
            toast.error("Não foi possível remover o bloco.");
            return;
        }
        setBlocosCru((atual) => atual.filter((b) => b.id !== blocoId));
    };

    // Move (otimista) um bloco pra outro dia, arrastado na aba Blocos. Se o
    // salvamento falhar, devolve o bloco pro dia original.
    const moverBloco = async (blocoId: string, novoDia: number) => {
        let diaAnterior: number | undefined;
        setBlocosCru((atual) =>
            atual.map((b) => {
                if (b.id !== blocoId) return b;
                diaAnterior = b.dia_semana;
                return { ...b, dia_semana: novoDia };
            })
        );

        const { error } = await moverBlocoRotina(blocoId, novoDia);
        if (error) {
            console.error(error);
            toast.error("Não foi possível mover o bloco.");
            setBlocosCru((atual) =>
                atual.map((b) => (b.id === blocoId && diaAnterior !== undefined ? { ...b, dia_semana: diaAnterior! } : b))
            );
        }
    };

    const buscarSessoesUsuario = useCallback(async () => {
        if (!userId) return;
        const { data } = await buscarSessoesSemana(userId);
        setSessaoSemanaUsuario(data ?? []);
    }, [userId]);

    useEffect(() => {
        buscarSessoesUsuario();
    }, [buscarSessoesUsuario]);

    //Controla o estado do pull-to-refresh
    const [atualizando, setAtualizando] = useState(false);
    const handleRefresh = async () => {
        setAtualizando(true);
        try {
            await Promise.all([buscarBlocosLista(), buscarSessoesUsuario()]);
        } finally {
            setAtualizando(false);
        }
    };

    //Cria um Set com o par dia-materia a partir dos blocos da rotina.
    //1. Filtra os blocos para o tipo estudo
    const blocosEstudoFiltrados = blocosCru.filter(b => b.tipo === 'estudo')
    
    //Crie o set com o par dia-materia
    const rotinaSet = useMemo(
        //percorre pelos blocos filtrados, e pega o nomeExibição da materia, e o dia_semana do bloco
        () => new Set(blocosEstudoFiltrados.map((bloco) => {
            const materia = bloco.materia_id ? materiaPorId.get(bloco.materia_id) : undefined;
            if (!materia) return null;
            return `${bloco.dia_semana}-${normalizarNomeMateria(materia.nomeExibicao)}`; 
        })
        //filtra somente os index que não são null
        .filter(chave => chave !== null)),
        [blocosEstudoFiltrados, materiaPorId]
    )

    //Percorre a sessão para verificar se existe no setRotina
    const minutosRealizados = useMemo(
        () =>
        //Reduz as sessoes do usuário ao seu tempo total, e também sessões 
        sessaoSemanaUsuario.reduce((totalMinutos, sessao) => {
            //Desestrutura a data para não ficar no formato UTC
            const [ano, mes, dia] = sessao.data_sessao.split("-").map(Number);
            const diaSemanaJS = new Date(ano, mes - 1, dia).getDay(); // construtor local, sem UTC
            //Passa o primeiro dia da semana para segunda-feira
            const diaSemana = (diaSemanaJS + 6) % 7;
            const materia = normalizarNomeMateria(sessao.disciplina)
            //Forma o par diaSessao
            const chave = `${diaSemana}-${materia}`

            if(rotinaSet.has(chave)) {
                return totalMinutos + sessao.tempo_minutos
            }
            return totalMinutos
        }, 0),
        [sessaoSemanaUsuario, rotinaSet]
    )

    if (carregando) {
        return <AbaSemanaSkeleton />;
    }

    return (
        <View style={{ flex: 1 }}>
            {/* Resumo */}
            <View
                style={{
                    paddingTop: 2,
                    paddingBottom: 10,
                    paddingHorizontal: 20,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                }}
            >
                {visualizacao === "calendario" &&
                    <>
                        <Text style={{ fontSize: 13, color: HADES.textMuted }}>
                            Planejado <Text style={{ color: HADES.text, fontWeight: "600" }}>{totalSemanal}</Text>
                        </Text>
                        <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: HADES.dot }} />
                        <Text style={{ fontSize: 13, color: HADES.textMuted }}>
                            Realizado <Text style={{ color: HADES.green, fontWeight: "600" }}>{formatarDuracao(minutosRealizados)}</Text>
                        </Text>
                    </>
                }
            </View>

            {/* Calendário / Blocos */}
            <View style={{ paddingHorizontal: 20, paddingBottom: 14, flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                    onPress={() => setVisualizacao("calendario")}
                    activeOpacity={0.8}
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingVertical: 7,
                        paddingHorizontal: 14,
                        borderRadius: 20,
                        backgroundColor: visualizacao === "calendario" ? HADES.accentTint : HADES.surface,
                        borderWidth: 1,
                        borderColor: visualizacao === "calendario" ? HADES.accentTintBorder : HADES.borderStrong,
                    }}
                >
                    <CalendarDays
                        size={14}
                        color={visualizacao === "calendario" ? HADES.accentSolid : HADES.textMuted}
                    />
                    <Text
                        style={{
                            fontSize: 12,
                            fontWeight: visualizacao === "calendario" ? "700" : "600",
                            color: visualizacao === "calendario" ? HADES.accentSolid : HADES.textMuted,
                        }}
                    >
                        Calendário
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setVisualizacao("blocos")}
                    activeOpacity={0.8}
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingVertical: 7,
                        paddingHorizontal: 14,
                        borderRadius: 20,
                        backgroundColor: visualizacao === "blocos" ? HADES.accentTint : HADES.surface,
                        borderWidth: 1,
                        borderColor: visualizacao === "blocos" ? HADES.accentTintBorder : HADES.borderStrong,
                    }}
                >
                    <LayoutGrid size={14} color={visualizacao === "blocos" ? HADES.accentSolid : HADES.textMuted} />
                    <Text
                        style={{
                            fontSize: 12,
                            fontWeight: visualizacao === "blocos" ? "700" : "600",
                            color: visualizacao === "blocos" ? HADES.accentSolid : HADES.textMuted,
                        }}
                    >
                        Blocos
                    </Text>
                </TouchableOpacity>
            </View>

            {visualizacao === "blocos" ? (
                <AbaSemanaBlocos
                    blocos={blocosOrdenados}
                    totais={totalPorMateriaSemana}
                    totalSemanal={totalSemanal}
                    conflitos={conflitosPorId}
                    onAdicionarBloco={abrirNovoBloco}
                    onEditarBloco={abrirEdicaoBloco}
                    onExcluirBloco={excluirBloco}
                    onMoverBloco={moverBloco}
                />
            ) : blocosCru.length === 0 ? (
                <View style={{ paddingHorizontal: 20 }}>
                    <EmptyState
                        icon={CalendarPlus}
                        title="Sua rotina semanal está vazia"
                        subtitle="Adicione blocos de estudo aos dias da semana pra montar sua grade de horários."
                        actionLabel="Adicionar bloco"
                        onAction={() => abrirNovoBloco(diaAtual)}
                    />
                </View>
            ) : (
                <>
            {/* Cabeçalho dos dias */}
            <View style={{ paddingHorizontal: 12, flexDirection: "row" }}>
                <View style={{ width: LARGURA_EIXO }} />
                {diasDaSemanaGrade.map((dia, i) => {
                    const hoje = i === diaAtual;
                    return (
                        <View key={i} style={{ flex: 1, alignItems: "center" }}>
                            <Text
                                style={{
                                    fontSize: 11,
                                    fontWeight: hoje ? "700" : "600",
                                    color: hoje ? HADES.accentSolid : HADES.textFaint,
                                }}
                            >
                                {dia.letra}
                            </Text>
                            <Text
                                style={{
                                    fontSize: 12,
                                    marginTop: 2,
                                    color: hoje ? "#000" : HADES.textMuted,
                                    fontWeight: hoje ? "700" : "400",
                                    backgroundColor: hoje ? HADES.accentSolid : "transparent",
                                    borderRadius: 6,
                                    width: 22,
                                    textAlign: "center",
                                    overflow: "hidden",
                                }}
                            >
                                {dia.numero}
                            </Text>
                        </View>
                    );
                })}
            </View>

            {/* Grade de horários */}
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingTop: 10, paddingBottom: 20, paddingHorizontal: 12 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={atualizando} onRefresh={handleRefresh} tintColor={HADES.accentSolid} />
                }
            >
                <View style={{ flexDirection: "row", height: alturaGrade, position: "relative" }}>
                    {/* Eixo de horas */}
                    <View style={{ width: LARGURA_EIXO }}>
                        {horasEixo.map((h) => (
                            <Text
                                key={h.rotulo}
                                style={{
                                    position: "absolute",
                                    top: h.topo,
                                    right: 4,
                                    fontSize: 10,
                                    color: HADES.textDim,
                                }}
                            >
                                {h.rotulo}
                            </Text>
                        ))}
                    </View>

                    {/* Linhas de hora */}
                    <View
                        style={{
                            position: "absolute",
                            left: LARGURA_EIXO,
                            right: 0,
                            top: 0,
                            height: "100%",
                        }}
                        pointerEvents="none"
                    >
                        {horasEixo.map((h) => (
                            <View
                                key={h.rotulo}
                                style={{
                                    position: "absolute",
                                    top: h.topo,
                                    left: 0,
                                    right: 0,
                                    height: 1,
                                    backgroundColor: "rgba(255,255,255,0.05)",
                                }}
                            />
                        ))}
                    </View>

                    {/* Colunas dos dias */}
                    {diasDaSemanaGrade.map((_, dia) => (
                        <View
                            key={dia}
                            style={{
                                flex: 1,
                                position: "relative",
                                paddingHorizontal: 2,
                                backgroundColor: dia === diaAtual ? "rgba(255,122,47,0.05)" : "transparent",
                            }}
                        >
                            {blocosSemana
                                .filter((b) => b.dia === dia)
                                .map((bloco) => (
                                    <View
                                        key={bloco.id}
                                        style={{
                                            position: "absolute",
                                            top: minParaPx(bloco.inicioMin),
                                            left: 2,
                                            right: 2,
                                            height: minParaPx(bloco.duracaoMin),
                                            backgroundColor: `${bloco.cor}33`,
                                            borderLeftWidth: 2.5,
                                            borderLeftColor: bloco.cor,
                                            borderRadius: 6,
                                            paddingVertical: 5,
                                            paddingHorizontal: 4,
                                            overflow: "hidden",
                                        }}
                                    >
                                        <Text
                                            style={{
                                                fontSize: 9,
                                                color: HADES.text,
                                                fontWeight: "600",
                                                lineHeight: 11,
                                            }}
                                            numberOfLines={2}
                                        >
                                            {bloco.rotulo}
                                        </Text>
                                        {conflitosPorId.has(bloco.id) && (
                                            <View
                                                style={{
                                                    position: "absolute",
                                                    top: 3,
                                                    right: 3,
                                                    width: 6,
                                                    height: 6,
                                                    borderRadius: 3,
                                                    backgroundColor: HADES.amber,
                                                }}
                                            />
                                        )}
                                    </View>
                                ))}
                        </View>
                    ))}
                </View>
            </ScrollView>
                </>
            )}
        </View>
    );
}

function AbaSemanaSkeleton() {
    const letras = ["S", "T", "Q", "Q", "S", "S", "D"];

    return (
        <View style={{ flex: 1 }}>
            <View style={{ paddingTop: 2, paddingBottom: 10, paddingHorizontal: 20, flexDirection: "row", gap: 8 }}>
                <Skeleton width={90} height={13} hades />
                <Skeleton width={90} height={13} hades />
            </View>

            <View style={{ paddingHorizontal: 12, flexDirection: "row" }}>
                <View style={{ width: LARGURA_EIXO }} />
                {letras.map((letra, i) => (
                    <View key={i} style={{ flex: 1, alignItems: "center", gap: 6 }}>
                        <Skeleton width={12} height={11} hades />
                        <Skeleton width={22} height={16} borderRadius={6} hades />
                    </View>
                ))}
            </View>

            <View style={{ flex: 1, paddingTop: 16, paddingHorizontal: 12, flexDirection: "row", gap: 4 }}>
                <View style={{ width: LARGURA_EIXO }} />
                {letras.map((_, dia) => (
                    <View key={dia} style={{ flex: 1, paddingHorizontal: 2, gap: 10 }}>
                        {dia % 2 === 0 && <Skeleton width="100%" height={54} borderRadius={6} hades style={{ marginTop: dia * 14 }} />}
                    </View>
                ))}
            </View>
        </View>
    );
}
