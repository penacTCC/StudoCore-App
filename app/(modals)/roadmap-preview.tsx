import { useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "@/components/ui/TelaSegura";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ChevronLeft, Clock, Layers, Check, Users, Sparkles, X } from "@/components/ui/icons";
import type { IconeComponente } from "@/components/ui/icons";

import { HADES } from "@/constants/hades";
import { useAuth } from "@/hooks/useAuth";
import { useMaterias } from "@/hooks/useMaterias";
import { normalizarNomeMateria } from "@/services/materias";
import { aceitarRoadmapPessoal, publicarRoadmapGrupo } from "@/services/roadmapIA";
import { formatarDuracao } from "@/utils/tempo";
import { toast } from "@/services/toast";
import { mostrarPaywallProSeLimite } from "@/services/paywall";
import type { BlocoRoadmapProposta, EscopoRoadmap, RoadmapProposta } from "@/types/roadmap";

const DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

/**
 * Revisão da proposta de roadmap antes de gravar qualquer coisa.
 *
 * A IA não grava sozinha: esta tela mostra a proposta (nome, resumo do que ela entendeu do
 * objetivo, blocos agrupados por dia) e deixa REMOVER blocos antes de aceitar. Só o que
 * sobrevive aqui é materializado. No pessoal vira um plano seu; no grupo, o admin publica
 * e a RPC `grupo_distribuir_roadmap` entrega uma cópia para cada membro.
 *
 * Modelo: `plano-preview.tsx` (a prévia de plano importado da Comunidade).
 */
export default function RoadmapPreviewScreen() {
    const router = useRouter();
    const { proposta: propostaJson, escopo: escopoParam, grupoId, grupoNome } = useLocalSearchParams<{
        proposta?: string;
        escopo?: string;
        grupoId?: string;
        grupoNome?: string;
    }>();
    const escopo: EscopoRoadmap = escopoParam === "grupo" ? "grupo" : "pessoal";
    const ehGrupo = escopo === "grupo";

    const { userId } = useAuth();
    const { materiasComCores } = useMaterias(userId);

    const corPorMateria = useMemo(() => {
        const mapa = new Map<string, string>();
        for (const m of materiasComCores) {
            mapa.set(m.nomeNormalizado, m.cor);
        }
        return mapa;
    }, [materiasComCores]);

    const corDaMateria = (nome: string) => {
        const normalizado = normalizarNomeMateria(nome);
        return corPorMateria.get(normalizado);
    };

    const proposta = useMemo<RoadmapProposta | null>(() => {
        if (!propostaJson) return null;
        try {
            const parsed = JSON.parse(propostaJson) as RoadmapProposta;
            if (!parsed || typeof parsed.nome !== "string" || !Array.isArray(parsed.blocos)) return null;
            return parsed;
        } catch {
            return null;
        }
    }, [propostaJson]);

    // Blocos que sobrevivem à revisão humana. Remover nunca é "perder a IA": é a revisão
    // que a tela promete — nada é gravado antes do botão de aceitar.
    const [removidos, setRemovidos] = useState<Set<number>>(new Set());
    const [publicando, setPublicando] = useState(false);

    const blocos = useMemo(() => {
        if (!proposta) return [];
        return proposta.blocos.filter((_, indice) => !removidos.has(indice));
    }, [proposta, removidos]);

    const porDia = useMemo(() => {
        const grupos = new Map<number, BlocoRoadmapProposta[]>();
        for (const bloco of blocos) {
            const lista = grupos.get(bloco.diaSemana) ?? [];
            lista.push(bloco);
            grupos.set(bloco.diaSemana, lista);
        }
        return [...grupos.entries()].sort((a, b) => a[0] - b[0]);
    }, [blocos]);

    const minutosEstudo = blocos.reduce((soma, bloco) => soma + bloco.duracaoMin, 0);
    const diasUsados = porDia.length;

    if (!proposta) {
        return (
            <View style={{ flex: 1, backgroundColor: HADES.bg }}>
                <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
                    <Cabecalho />
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: HADES.text }}>Proposta indisponível</Text>
                        <Text style={{ fontSize: 13, color: HADES.textMuted, marginTop: 6, textAlign: "center", lineHeight: 19 }}>
                            Algo deu errado ao passar a proposta para esta tela. Volte e tente gerar de novo.
                        </Text>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    const aceitar = async () => {
        if (!userId) return;
        if (blocos.length === 0) {
            toast.warning("Remova menos blocos — um roadmap precisa de pelo menos um bloco.");
            return;
        }

        setPublicando(true);
        try {
            if (ehGrupo && grupoId) {
                const resultado = await publicarRoadmapGrupo(userId, grupoId, { ...proposta, blocos });
                if (!resultado.sucesso) {
                    if (mostrarPaywallProSeLimite(resultado.erro)) return;
                    toast.error(resultado.erro ?? "Não foi possível publicar o roadmap.");
                    return;
                }
                toast.success(
                    resultado.copias && resultado.copias > 0
                        ? `Roadmap publicado para ${resultado.copias} ${resultado.copias === 1 ? "membro" : "membros"}.`
                        : "Roadmap publicado. Os membros já receberam a cópia."
                );
                router.dismissTo({ pathname: "/(tabs)/schedule", params: { aba: "planos" } });
                return;
            }

            const resultado = await aceitarRoadmapPessoal(userId, { ...proposta, blocos });
            if (!resultado.sucesso) {
                if (mostrarPaywallProSeLimite(resultado.erro)) return;
                toast.error(resultado.erro ?? "Não foi possível salvar o roadmap.");
                return;
            }
            toast.success("Roadmap salvo nos seus planos.");
            router.dismissTo({ pathname: "/(tabs)/schedule", params: { aba: "planos" } });
        } catch (erro) {
            console.warn("Erro ao aceitar roadmap:", erro);
            toast.error("Não foi possível salvar o roadmap. Tente de novo.");
        } finally {
            setPublicando(false);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: HADES.bg }}>
            <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
                <Cabecalho />

                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 20 }}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={estilos.hero}>
                        <View
                            style={{
                                position: "absolute",
                                top: -40,
                                right: -30,
                                width: 150,
                                height: 150,
                                borderRadius: 75,
                                backgroundColor: HADES.accentSolid,
                                opacity: 0.12,
                            }}
                        />
                        <Text style={estilos.nomeDoPlano}>{proposta.nome}</Text>
                        {!!proposta.resumoObjetivo && (
                            <View style={estilos.resumo}>
                                <Sparkles size={13} color={HADES.accentSolid} style={{ marginTop: 1 }} />
                                <Text style={estilos.resumoTexto}>{proposta.resumoObjetivo}</Text>
                            </View>
                        )}
                        <View style={estilos.stats}>
                            <Coluna Icone={Layers} valor={String(blocos.length)} rotulo={blocos.length === 1 ? "BLOCO" : "BLOCOS"} />
                            <Coluna Icone={Clock} valor={formatarDuracao(minutosEstudo)} rotulo="DE ESTUDO" divisor />
                            <Coluna Icone={Users} valor={`${diasUsados}d`} rotulo="POR SEMANA" divisor />
                        </View>
                    </View>

                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "flex-start",
                            gap: 9,
                            marginTop: 16,
                            padding: 12,
                            borderRadius: 13,
                            backgroundColor: ehGrupo ? "rgba(255,154,0,0.07)" : HADES.accentTint,
                            borderWidth: 1,
                            borderColor: ehGrupo ? "rgba(255,154,0,0.18)" : HADES.accentTintBorder,
                        }}
                    >
                        <Sparkles size={15} color={HADES.accentSolid} />
                        <Text style={{ flex: 1, fontSize: 12.5, color: HADES.textSecondary, lineHeight: 18 }}>
                            {ehGrupo
                                ? `Publicar envia uma cópia deste roadmap para cada membro de ${grupoNome ?? "o grupo"} — todos recebem os mesmos blocos, cada um no dia dele.`
                                : "Ao aceitar, o plano fica em \"Seus planos\" sem agenda — os dias de cada bloco são preservados e você escolhe depois em que dias o plano vale na sua agenda."}
                        </Text>
                    </View>

                    <Text style={estilos.secaoTitulo}>Sua semana</Text>
                    <Text style={estilos.secaoDica}>
                        Toque em um bloco para removê-lo da proposta antes de aceitar.
                    </Text>

                    {blocos.length === 0 ? (
                        <View style={estilos.vazioCard}>
                            <Text style={{ fontSize: 13.5, color: HADES.textMuted, textAlign: "center" }}>
                                Você removeu todos os blocos.
                            </Text>
                            <Text style={{ fontSize: 12, color: HADES.textDim, marginTop: 4, textAlign: "center" }}>
                                Reative os blocos que quiser manter tocando nos dias abaixo.
                            </Text>
                        </View>
                    ) : (
                        <View style={{ gap: 16 }}>
                            {porDia.map(([dia, lista]) => (
                                <View key={dia}>
                                    <Text style={estilos.diaTitulo}>{DIAS_SEMANA[dia]}</Text>
                                    <View style={{ gap: 9 }}>
                                        {lista.map((bloco, indice) => {
                                            const indiceOriginal = proposta.blocos.indexOf(bloco);
                                            return (
                                                <LinhaBloco
                                                    key={indice}
                                                    bloco={bloco}
                                                    corMateria={corDaMateria(bloco.materia)}
                                                    removida={false}
                                                    onRemover={() => setRemovidos((atual) => new Set(atual).add(indiceOriginal))}
                                                />
                                            );
                                        })}
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}

                    {removidos.size > 0 && (
                        <View style={{ gap: 16, marginTop: 20 }}>
                            <Text style={estilos.diaTitulo}>Removidos</Text>
                            <View style={{ gap: 9 }}>
                                {proposta.blocos.map((bloco, indice) => {
                                    if (!removidos.has(indice)) return null;
                                    return (
                                        <LinhaBloco
                                            key={indice}
                                            bloco={bloco}
                                            corMateria={corDaMateria(bloco.materia)}
                                            removida
                                            onRemover={() =>
                                                setRemovidos((atual) => {
                                                    const novo = new Set(atual);
                                                    novo.delete(indice);
                                                    return novo;
                                                })
                                            }
                                        />
                                    );
                                })}
                            </View>
                        </View>
                    )}
                </ScrollView>

                <View style={estilos.footer}>
                    <TouchableOpacity
                        onPress={aceitar}
                        disabled={publicando}
                        activeOpacity={0.85}
                        style={[estilos.botaoAceitar, publicando && { opacity: 0.6 }]}
                    >
                        {publicando ? (
                            <ActivityIndicator color="#000" size="small" />
                        ) : (
                            <>
                                <Check size={19} color="#000" />
                                <Text style={{ fontSize: 16, fontWeight: "700", color: "#000" }}>
                                    {ehGrupo ? "Publicar para o grupo" : "Aceitar e salvar"}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
}

function Cabecalho() {
    const router = useRouter();
    return (
        <View style={estilos.header}>
            <TouchableOpacity
                onPress={() => router.back()}
                style={estilos.botaoCircular}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
                <ChevronLeft size={20} color={HADES.textSecondary} />
            </TouchableOpacity>
            <Text style={estilos.headerTitulo}>Revisar proposta</Text>
            <View style={{ width: 38 }} />
        </View>
    );
}

function Coluna({
    Icone,
    valor,
    rotulo,
    divisor = false,
}: {
    Icone: IconeComponente;
    valor: string;
    rotulo: string;
    divisor?: boolean;
}) {
    return (
        <View style={[{ flex: 1 }, divisor && estilos.statDivider]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Icone size={14} color={HADES.textMuted} />
                <Text style={estilos.statValor}>{valor}</Text>
            </View>
            <Text style={estilos.statRotulo}>{rotulo}</Text>
        </View>
    );
}

function LinhaBloco({
    bloco,
    corMateria,
    removida,
    onRemover,
}: {
    bloco: BlocoRoadmapProposta;
    corMateria?: string;
    removida: boolean;
    onRemover: () => void;
}) {
    return (
        <View
            style={[
                estilos.linha,
                removida && { borderColor: HADES.border, backgroundColor: "transparent", opacity: 0.55 },
            ]}
        >
            <Text style={estilos.hora}>{bloco.horaInicio}</Text>
            <View style={[estilos.marcaMateria, { backgroundColor: removida ? HADES.dot : (corMateria ?? HADES.accentSolid) }]} />
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                    style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: removida ? HADES.textFaint : (corMateria ?? HADES.text),
                    }}
                    numberOfLines={1}
                >
                    {bloco.materia}
                </Text>
                {!!bloco.topico && (
                    <Text
                        style={{
                            fontSize: 12,
                            color: removida ? HADES.textDim : HADES.textFaint,
                            marginTop: 1,
                        }}
                        numberOfLines={1}
                    >
                        {bloco.topico}
                    </Text>
                )}
            </View>
            <Text style={estilos.duracao}>{formatarDuracao(bloco.duracaoMin)}</Text>
            <TouchableOpacity
                onPress={onRemover}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ marginLeft: 4 }}
            >
                <X size={15} color={removida ? HADES.textMuted : HADES.textFaint} />
            </TouchableOpacity>
        </View>
    );
}

const estilos = StyleSheet.create({
    header: {
        paddingTop: 6,
        paddingHorizontal: 18,
        paddingBottom: 12,
        flexDirection: "row" as const,
        alignItems: "center",
        gap: 12,
    },
    headerTitulo: {
        flex: 1,
        textAlign: "center" as const,
        fontSize: 16,
        fontWeight: "600" as const,
        color: HADES.text,
        letterSpacing: 0.2,
    },
    botaoCircular: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: HADES.surfaceRaised,
        alignItems: "center" as const,
        justifyContent: "center" as const,
    },
    hero: {
        position: "relative" as const,
        overflow: "hidden" as const,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: HADES.border,
        backgroundColor: HADES.surface,
        padding: 17,
    },
    nomeDoPlano: {
        fontSize: 24,
        fontWeight: "700" as const,
        color: HADES.text,
        letterSpacing: -0.5,
    },
    resumo: {
        flexDirection: "row" as const,
        alignItems: "flex-start",
        gap: 7,
        marginTop: 10,
    },
    resumoTexto: {
        flex: 1,
        fontSize: 13,
        color: HADES.textSecondary,
        lineHeight: 19,
    },
    stats: {
        flexDirection: "row" as const,
        marginTop: 18,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: HADES.border,
    },
    statDivider: {
        borderLeftWidth: 1,
        borderLeftColor: HADES.border,
        paddingLeft: 14,
    },
    statValor: {
        fontSize: 18,
        fontWeight: "700" as const,
        color: HADES.text,
        letterSpacing: -0.3,
    },
    statRotulo: {
        fontSize: 10,
        color: HADES.textDim,
        fontWeight: "600" as const,
        letterSpacing: 0.5,
        marginTop: 2,
    },
    secaoTitulo: {
        fontSize: 16,
        fontWeight: "700" as const,
        color: HADES.text,
        marginTop: 24,
        marginBottom: 4,
        marginHorizontal: 2,
    },
    secaoDica: {
        fontSize: 12.5,
        color: HADES.textDim,
        marginBottom: 14,
        marginHorizontal: 2,
    },
    diaTitulo: {
        fontSize: 12,
        fontWeight: "700" as const,
        color: HADES.textMuted,
        letterSpacing: 0.5,
        textTransform: "uppercase" as const,
        marginBottom: 8,
    },
    linha: {
        flexDirection: "row" as const,
        alignItems: "center",
        gap: 11,
        backgroundColor: HADES.surfaceRaised,
        borderWidth: 1,
        borderColor: HADES.borderStrong,
        borderRadius: 13,
        paddingVertical: 12,
        paddingHorizontal: 13,
    },
    hora: {
        width: 42,
        fontSize: 12.5,
        fontWeight: "700" as const,
        color: HADES.textMuted,
        fontVariant: ["tabular-nums"] as const,
    },
    marcaMateria: {
        width: 3,
        alignSelf: "stretch",
        borderRadius: 2,
    },
    duracao: {
        fontSize: 13.5,
        fontWeight: "700" as const,
        color: HADES.text,
    },
    vazioCard: {
        borderWidth: 1.5,
        borderStyle: "dashed" as const,
        borderColor: HADES.borderDashed,
        borderRadius: 14,
        paddingVertical: 22,
        paddingHorizontal: 18,
        alignItems: "center",
    },
    footer: {
        flexDirection: "row" as const,
        alignItems: "center",
        paddingHorizontal: 18,
        paddingTop: 12,
        paddingBottom: 12,
        borderTopWidth: 1,
        borderTopColor: HADES.border,
    },
    botaoAceitar: {
        flex: 1,
        height: 54,
        borderRadius: 15,
        backgroundColor: HADES.accentSolid,
        flexDirection: "row" as const,
        alignItems: "center",
        justifyContent: "center",
        gap: 9,
    },
});
