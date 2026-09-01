import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Modal, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { CalendarPlus, ChevronRight } from "@/components/ui/icons";
import { HADES } from "@/constants/hades";
import { minParaPx } from "@/constants/cronograma";
import AbaSemanaBlocos from "@/components/cronograma/AbaSemanaBlocos";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { EstadoDeErro } from "@/components/ui/EstadoDeErro";
import type { VisualizacaoSemana } from "@/types/cronograma";
import { useAuth } from "@/hooks/useAuth";
import { useSemanaCronograma } from "@/hooks/useSemanaCronograma";

const LARGURA_EIXO = 26;
/** Altura mínima de um bloco na grade — um bloco de 5 min precisa ser clicável. */
const ALTURA_MINIMA_BLOCO = 36;
/**
 * A partir dessa duração o bloco mostra a abreviação da matéria. O corte é pela
 * duração, não pela altura: um bloco de 30 min é esticado até a altura mínima e
 * tem espaço de sobra pro rótulo, mas o cálculo em pixels o classificava como
 * compacto e ele aparecia mudo na grade.
 */
const DURACAO_PARA_ROTULO_MIN = 25;

type Props = {
    visualizacao: VisualizacaoSemana;
    /** Primeiro dia da semana exibida — quem manda é o cabeçalho da tela. */
    inicioDaSemana: Date;
};

export default function AbaSemana({ visualizacao, inicioDaSemana }: Props) {
    const router = useRouter();
    const { userId } = useAuth();
    const dados = useSemanaCronograma(userId, inicioDaSemana);
    const diaAtual = dados.indiceDeHoje; // -1 quando a semana exibida não é a atual
    const diasDaSemanaGrade = dados.diasDaSemana;
    const [detalhesAbertos, setDetalhesAbertos] = useState(false);

    // A coluna da tela é uma posição na semana exibida; o banco quer o dia_semana
    // (0 = segunda), que pode não ser o mesmo quando a semana começa no domingo.
    const abrirNovoBloco = (coluna: number) =>
        router.push({
            pathname: "/(modals)/novo-bloco",
            params: { dia: (diasDaSemanaGrade[coluna]?.diaSemana ?? 0).toString() },
        });

    const abrirEdicaoBloco = (blocoId: string) =>
        router.push({
            pathname: "/(modals)/novo-bloco",
            params: { blocoId },
        });

    if (dados.carregando) {
        return <AbaSemanaSkeleton />;
    }

    if (dados.vazia && dados.erro) {
        return (
            <View style={{ paddingHorizontal: 20, flex: 1, justifyContent: "center" }}>
                <EstadoDeErro erro={dados.erro} onTentarNovamente={dados.recarregar} />
            </View>
        );
    }

    if (dados.vazia && visualizacao === "calendario") {
        return (
            <View style={{ paddingHorizontal: 20 }}>
                <EmptyState
                    icon={CalendarPlus}
                    title="Sua rotina semanal está vazia"
                    subtitle="Adicione blocos de estudo aos dias da semana pra montar sua grade de horários."
                    actionLabel="Adicionar bloco"
                    onAction={() => abrirNovoBloco(diaAtual >= 0 ? diaAtual : 0)}
                />
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            {visualizacao === "blocos" ? (
                <AbaSemanaBlocos
                    blocos={dados.blocosLista}
                    rotulosDias={diasDaSemanaGrade.map((d) => d.nomeCurto)}
                    conflitos={dados.conflitosPorId}
                    onAdicionarBloco={abrirNovoBloco}
                    onEditarBloco={abrirEdicaoBloco}
                    onExcluirBloco={dados.excluirBloco}
                    onMoverBloco={dados.moverBloco}
                />
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
                            <RefreshControl
                                refreshing={dados.atualizando}
                                onRefresh={dados.recarregar}
                                tintColor={HADES.accentSolid}
                            />
                        }
                    >
                        <View style={{ flexDirection: "row", height: dados.alturaGrade, position: "relative" }}>
                            {/* Eixo de horas */}
                            <View style={{ width: LARGURA_EIXO }}>
                                {dados.horasEixo.map((h) => (
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
                                {dados.horasEixo.map((h) => (
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
                                    {dados.blocosSemana
                                        .filter((b) => b.dia === dia)
                                        .map((bloco) => {
                                            /*
                                              Um bloco de 5 min daria ~4px: o rótulo sumia, o
                                              padding esmagava o cartão e o ponto de conflito
                                              vazava pra fora. Abaixo do limite ele vira uma
                                              barrinha compacta, sem texto — a altura passa a
                                              mentir um pouco, mas fica legível e clicável.
                                            */
                                            const altura = Math.max(minParaPx(bloco.duracaoMin), ALTURA_MINIMA_BLOCO);
                                            const compacto = bloco.duracaoMin < DURACAO_PARA_ROTULO_MIN;

                                            return (
                                                <View
                                                    key={bloco.id}
                                                    style={{
                                                        position: "absolute",
                                                        top: minParaPx(bloco.inicioMin),
                                                        left: 2,
                                                        right: 2,
                                                        height: altura,
                                                        backgroundColor: `${bloco.cor}33`,
                                                        borderLeftWidth: 2.5,
                                                        borderLeftColor: bloco.cor,
                                                        borderRadius: compacto ? 3 : 6,
                                                        paddingVertical: compacto ? 0 : 5,
                                                        paddingHorizontal: 4,
                                                        justifyContent: compacto ? "center" : "flex-start",
                                                        overflow: "hidden",
                                                    }}
                                                >
                                                    {!compacto && (
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
                                                    )}
                                                    {dados.conflitosPorId.has(bloco.id) && (
                                                        <View
                                                            style={{
                                                                position: "absolute",
                                                                top: compacto ? undefined : 3,
                                                                right: 3,
                                                                width: 6,
                                                                height: 6,
                                                                borderRadius: 3,
                                                                backgroundColor: HADES.amber,
                                                            }}
                                                        />
                                                    )}
                                                </View>
                                            );
                                        })}
                                </View>
                            ))}
                        </View>
                    </ScrollView>
                </>
            )}

            {!dados.vazia && (
                <BarraResumo
                    planejado={dados.totalSemanal}
                    realizado={dados.realizado}
                    qtdMaterias={dados.totalPorMateria.length}
                    onPress={() => setDetalhesAbertos(true)}
                />
            )}

            <FolhaDetalhes
                visivel={detalhesAbertos}
                onFechar={() => setDetalhesAbertos(false)}
                planejado={dados.totalSemanal}
                realizado={dados.realizado}
                totais={dados.totalPorMateria}
            />
        </View>
    );
}

/**
 * Barra fina no rodapé: substitui a antiga faixa de resumo do topo e o bloco de
 * totais por matéria, que ocupavam altura permanente nas duas visualizações.
 * O detalhamento por matéria vive na folha que ela abre.
 */
function BarraResumo({
    planejado,
    realizado,
    qtdMaterias,
    onPress,
}: {
    planejado: string;
    realizado: string;
    qtdMaterias: number;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                borderTopWidth: 1,
                borderTopColor: "rgba(255,255,255,0.07)",
                paddingVertical: 12,
                paddingHorizontal: 20,
            }}
        >
            <Text style={{ fontSize: 13, color: HADES.textMuted }}>
                <Text style={{ color: HADES.text, fontWeight: "600" }}>{planejado}</Text> planejado
            </Text>
            <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: HADES.dot }} />
            <Text style={{ fontSize: 13, color: HADES.textMuted }}>
                <Text style={{ color: HADES.green, fontWeight: "600" }}>{realizado}</Text> feito
            </Text>
            {qtdMaterias > 0 && (
                <>
                    <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: HADES.dot }} />
                    <Text style={{ fontSize: 13, color: HADES.textMuted }}>
                        {qtdMaterias} {qtdMaterias === 1 ? "matéria" : "matérias"}
                    </Text>
                </>
            )}
            <ChevronRight size={16} color={HADES.textFaint} style={{ marginLeft: "auto" }} />
        </TouchableOpacity>
    );
}

function FolhaDetalhes({
    visivel,
    onFechar,
    planejado,
    realizado,
    totais,
}: {
    visivel: boolean;
    onFechar: () => void;
    planejado: string;
    realizado: string;
    totais: { materia: string; cor: string; total: string }[];
}) {
    return (
        <Modal visible={visivel} transparent animationType="fade" onRequestClose={onFechar}>
            <Pressable
                style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}
                onPress={onFechar}
            >
                {/* Folha escura com os cartões mais claros por cima — invertido em
                    relação às outras folhas, pra que os totais é que saltem. */}
                <Pressable
                    style={{
                        backgroundColor: HADES.surface,
                        borderWidth: 1,
                        borderColor: HADES.borderStrong,
                        borderTopLeftRadius: 24,
                        borderTopRightRadius: 24,
                        paddingHorizontal: 20,
                        paddingBottom: 30,
                    }}
                >
                    <View style={{ paddingTop: 12, paddingBottom: 4, alignItems: "center" }}>
                        <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: HADES.dot }} />
                    </View>

                    <Text
                        style={{
                            textAlign: "center",
                            fontSize: 17,
                            fontWeight: "700",
                            color: HADES.text,
                            marginTop: 8,
                        }}
                    >
                        Resumo da semana
                    </Text>

                    <View style={{ flexDirection: "row", gap: 12, marginTop: 18 }}>
                        <CaixaTotal rotulo="Planejado" valor={planejado} cor={HADES.text} />
                        <CaixaTotal rotulo="Feito" valor={realizado} cor={HADES.green} />
                    </View>

                    {totais.length > 0 && (
                        <>
                            <Text
                                style={{
                                    fontSize: 11,
                                    color: HADES.textFaint,
                                    fontWeight: "700",
                                    letterSpacing: 0.8,
                                    marginTop: 22,
                                    marginBottom: 10,
                                }}
                            >
                                POR MATÉRIA
                            </Text>
                            <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
                                <View style={{ gap: 8 }}>
                                    {totais.map((t) => (
                                        <View
                                            key={t.materia}
                                            style={{
                                                flexDirection: "row",
                                                alignItems: "center",
                                                gap: 10,
                                                backgroundColor: HADES.surfaceOverlay,
                                                borderWidth: 1,
                                                borderColor: HADES.borderStrong,
                                                borderRadius: 12,
                                                paddingVertical: 12,
                                                paddingHorizontal: 14,
                                            }}
                                        >
                                            <View
                                                style={{
                                                    width: 8,
                                                    height: 8,
                                                    borderRadius: 4,
                                                    backgroundColor: t.cor,
                                                }}
                                            />
                                            <Text
                                                style={{
                                                    fontSize: 14,
                                                    color: HADES.textSecondary,
                                                    fontWeight: "600",
                                                    flex: 1,
                                                }}
                                            >
                                                {t.materia}
                                            </Text>
                                            <Text style={{ fontSize: 14, color: t.cor, fontWeight: "700" }}>
                                                {t.total}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </ScrollView>
                        </>
                    )}
                </Pressable>
            </Pressable>
        </Modal>
    );
}

function CaixaTotal({ rotulo, valor, cor }: { rotulo: string; valor: string; cor: string }) {
    return (
        <View
            style={{
                flex: 1,
                backgroundColor: HADES.surfaceOverlay,
                borderWidth: 1,
                borderColor: HADES.borderStrong,
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: "center",
            }}
        >
            <Text style={{ fontSize: 20, fontWeight: "700", color: cor }}>{valor}</Text>
            <Text style={{ fontSize: 12, color: HADES.textMuted, marginTop: 3 }}>{rotulo}</Text>
        </View>
    );
}

function AbaSemanaSkeleton() {
    const letras = ["S", "T", "Q", "Q", "S", "S", "D"];

    return (
        <View style={{ flex: 1 }}>
            <View style={{ paddingHorizontal: 12, flexDirection: "row" }}>
                <View style={{ width: LARGURA_EIXO }} />
                {/* Letra e número colados, como no cabeçalho da grade (marginTop 2, sem gap). */}
                {letras.map((letra, i) => (
                    <View key={i} style={{ flex: 1, alignItems: "center" }}>
                        <Skeleton width={12} height={11} hades />
                        <Skeleton width={22} height={15} borderRadius={6} hades style={{ marginTop: 2 }} />
                    </View>
                ))}
            </View>

            {/* Colunas coladas uma na outra e paddingTop 10: os mesmos da grade real. */}
            <View style={{ flex: 1, paddingTop: 10, paddingHorizontal: 12, flexDirection: "row" }}>
                <View style={{ width: LARGURA_EIXO, paddingRight: 4, gap: 42 }}>
                    {[0, 1, 2, 3].map((i) => (
                        <Skeleton key={i} width={22} height={10} hades style={{ alignSelf: "flex-end" }} />
                    ))}
                </View>
                {letras.map((_, dia) => (
                    <View key={dia} style={{ flex: 1, paddingHorizontal: 2 }}>
                        {dia % 2 === 0 && (
                            <Skeleton width="100%" height={54} borderRadius={6} hades style={{ marginTop: dia * 14 }} />
                        )}
                    </View>
                ))}
            </View>
        </View>
    );
}
