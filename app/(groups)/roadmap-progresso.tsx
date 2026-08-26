import { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "@/components/ui/TelaSegura";
import { ArrowLeft, CheckCircle2, Sparkles } from "@/components/ui/icons";
import { router, useLocalSearchParams } from "expo-router";
import { HADES } from "@/constants/hades";
import { formatarDuracao } from "@/utils/tempo";
import Avatar from "@/components/ui/Avatar";
import { Skeleton, SkeletonCircle } from "@/components/ui/Skeleton";
import { useMembrosGrupo } from "@/hooks/useMembrosGrupo";
import { useDadosCache } from "@/hooks/useDadosCache";
import { useAuth } from "@/hooks/useAuth";
import {
    buscarBlocosRoadmapGrupo,
    buscarProgressoRoadmapGrupo,
    buscarProgressoRoadmapMembros,
} from "@/services/roadmapIA";
import type { BlocoRoadmapCanonico } from "@/types/roadmap";

const DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

/**
 * Progresso do roadmap do grupo — combina o agregado semanal ("M de N concluíram") com
 * o conteúdo do roadmap e o progresso de cada membro. Aberta a partir do chevron do card
 * `MetaRoadmapGrupo` na home do grupo.
 *
 * Modelo: `ranking-completo.tsx` (mesma estrutura de cabeçalho + pull-to-refresh + skeleton).
 */
export default function RoadmapProgressoScreen() {
    const { grupoId, grupoNome } = useLocalSearchParams<{ grupoId?: string; grupoNome?: string }>();
    const { userId } = useAuth();

    const { membros, recarregar: recarregarMembros } = useMembrosGrupo({ grupoId: grupoId as string });

    const { dados, carregando, recarregar } = useDadosCache(
        grupoId ? `roadmap-progresso:${grupoId}` : null,
        async () => {
            const [progresso, porMembro, blocos] = await Promise.all([
                buscarProgressoRoadmapGrupo(grupoId as string),
                buscarProgressoRoadmapMembros(grupoId as string),
                buscarBlocosRoadmapGrupo(grupoId as string),
            ]);
            return { progresso, porMembro, blocos };
        },
        { tempoFresco: 0 }
    );

    const [atualizando, setAtualizando] = useState(false);
    const handleRefresh = async () => {
        setAtualizando(true);
        try {
            await Promise.all([recarregar(), recarregarMembros()]);
        } finally {
            setAtualizando(false);
        }
    };

    const progresso = dados?.progresso ?? null;
    const blocosPorDia = useMemo(() => {
        const grupos = new Map<number | null, BlocoRoadmapCanonico[]>();
        for (const bloco of dados?.blocos ?? []) {
            const lista = grupos.get(bloco.diaSemana) ?? [];
            lista.push(bloco);
            grupos.set(bloco.diaSemana, lista);
        }
        return [...grupos.entries()].sort((a, b) => {
            if (a[0] === null) return 1;
            if (b[0] === null) return -1;
            return a[0] - b[0];
        });
    }, [dados?.blocos]);

    const linhasMembros = useMemo(() => {
        const porMembro = dados?.porMembro ?? [];
        return membros
            .map((membro) => {
                const linha = porMembro.find((p) => p.user_id === membro.user_id);
                return {
                    userId: membro.user_id,
                    nome: membro.userData?.nome_usuario || "Sem nome",
                    foto: membro.userData?.foto_usuario,
                    admin: !!membro.administrador,
                    ehVoce: membro.user_id === userId,
                    concluidos: linha?.blocos_concluidos ?? 0,
                    total: linha?.blocos_estudo ?? progresso?.total_blocos_semana ?? 0,
                };
            })
            .sort((a, b) => b.concluidos - a.concluidos);
    }, [membros, dados?.porMembro, progresso?.total_blocos_semana, userId]);

    const souAdmin = !!membros.find((m) => m.user_id === userId)?.administrador;

    const abrirGeracao = () =>
        router.push({
            pathname: "/(modals)/gerar-roadmap",
            params: { escopo: "grupo", grupoId: grupoId as string, grupoNome: grupoNome ?? "" },
        });

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top"]}>
            <View
                style={{
                    paddingTop: 6,
                    paddingHorizontal: 20,
                    paddingBottom: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                }}
            >
                <TouchableOpacity
                    onPress={() => router.back()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ width: 38, height: 38, alignItems: "center", justifyContent: "center" }}
                >
                    <ArrowLeft size={19} color={HADES.textSecondary} />
                </TouchableOpacity>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 18, fontWeight: "700", color: HADES.text, letterSpacing: -0.2 }}>
                        Roadmap do grupo
                    </Text>
                </View>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={atualizando} onRefresh={handleRefresh} tintColor={HADES.accentSolid} />
                }
            >
                {carregando ? (
                    <ProgressoSkeleton />
                ) : !progresso ? (
                    <EstadoVazio souAdmin={souAdmin} onGerar={abrirGeracao} />
                ) : (
                    <>
                        <HeroRoadmap
                            nome={progresso.nome}
                            cor={progresso.cor}
                            membrosCompletaram={progresso.membros_completaram}
                            totalMembros={progresso.total_membros}
                        />

                        <Text style={estilosSecao.titulo}>Blocos da semana</Text>
                        {blocosPorDia.length === 0 ? (
                            <Text style={{ fontSize: 12.5, color: HADES.textMuted, marginBottom: 20 }}>
                                Este roadmap ainda não tem blocos.
                            </Text>
                        ) : (
                            <View style={{ gap: 16, marginBottom: 22 }}>
                                {blocosPorDia.map(([dia, lista]) => (
                                    <View key={dia ?? "sempre"}>
                                        <Text style={estilosSecao.diaTitulo}>
                                            {dia === null ? "Todos os dias" : DIAS_SEMANA[dia]}
                                        </Text>
                                        <View style={{ gap: 9 }}>
                                            {lista.map((bloco, i) => (
                                                <LinhaBloco key={i} bloco={bloco} />
                                            ))}
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}

                        <Text style={estilosSecao.titulo}>Progresso por membro</Text>
                        <View style={{ marginBottom: 12 }}>
                            {linhasMembros.map((linha) => (
                                <LinhaMembro key={linha.userId} linha={linha} />
                            ))}
                        </View>

                        {souAdmin && (
                            <TouchableOpacity
                                onPress={abrirGeracao}
                                activeOpacity={0.85}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 8,
                                    height: 50,
                                    borderRadius: 14,
                                    borderWidth: 1,
                                    borderColor: HADES.border,
                                    backgroundColor: HADES.surfaceRaised,
                                    marginTop: 8,
                                }}
                            >
                                <Sparkles size={15} color={HADES.accentSolid} />
                                <Text style={{ fontSize: 13.5, fontWeight: "600", color: HADES.text }}>
                                    Gerar novo roadmap
                                </Text>
                            </TouchableOpacity>
                        )}
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

function HeroRoadmap({
    nome,
    cor,
    membrosCompletaram,
    totalMembros,
}: {
    nome: string;
    cor: string;
    membrosCompletaram: number;
    totalMembros: number;
}) {
    const pct = totalMembros > 0 ? Math.round((membrosCompletaram / totalMembros) * 100) : 0;
    const todosCompletaram = totalMembros > 0 && membrosCompletaram >= totalMembros;

    return (
        <View
            style={{
                borderRadius: 20,
                borderWidth: 1,
                borderColor: HADES.border,
                backgroundColor: HADES.surface,
                padding: 17,
                marginTop: 8,
                marginBottom: 22,
            }}
        >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cor }} />
                <Text style={{ fontSize: 20, fontWeight: "700", color: HADES.text, letterSpacing: -0.4 }}>
                    {nome}
                </Text>
            </View>

            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: 16,
                    paddingTop: 14,
                    borderTopWidth: 1,
                    borderTopColor: HADES.border,
                }}
            >
                <View>
                    <Text style={{ fontSize: 12.5, color: HADES.textMuted }}>
                        <Text style={{ fontWeight: "700", color: todosCompletaram ? HADES.green : HADES.text }}>
                            {membrosCompletaram}
                        </Text>
                        {" de "}
                        <Text style={{ fontWeight: "700", color: todosCompletaram ? HADES.green : HADES.text }}>
                            {totalMembros}
                        </Text>
                        {" concluíram esta semana"}
                    </Text>
                </View>
                <Text
                    style={{
                        fontSize: 18,
                        fontWeight: "700",
                        color: todosCompletaram ? HADES.green : HADES.accentSolid,
                    }}
                >
                    {pct}%
                </Text>
            </View>

            <View style={{ height: 6, borderRadius: 3, backgroundColor: "#1e2026", marginTop: 10, overflow: "hidden" }}>
                <View
                    style={{
                        width: `${pct}%`,
                        height: "100%",
                        borderRadius: 3,
                        backgroundColor: todosCompletaram ? HADES.green : HADES.accentSolid,
                    }}
                />
            </View>
        </View>
    );
}

function LinhaBloco({ bloco }: { bloco: BlocoRoadmapCanonico }) {
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 11,
                backgroundColor: HADES.surfaceRaised,
                borderWidth: 1,
                borderColor: HADES.borderStrong,
                borderRadius: 13,
                paddingVertical: 12,
                paddingHorizontal: 13,
            }}
        >
            <Text style={{ width: 42, fontSize: 12.5, fontWeight: "700", color: HADES.textMuted }}>
                {bloco.horaInicio.slice(0, 5)}
            </Text>
            <View
                style={{
                    width: 3,
                    alignSelf: "stretch",
                    borderRadius: 2,
                    backgroundColor: bloco.materiaCor ?? HADES.accentSolid,
                }}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                    style={{ fontSize: 14, fontWeight: "600", color: bloco.materiaCor ?? HADES.text }}
                    numberOfLines={1}
                >
                    {bloco.materiaNome ?? "Sem matéria"}
                </Text>
                {!!bloco.topico && (
                    <Text style={{ fontSize: 12, color: HADES.textFaint, marginTop: 1 }} numberOfLines={1}>
                        {bloco.topico}
                    </Text>
                )}
            </View>
            <Text style={{ fontSize: 13.5, fontWeight: "700", color: HADES.text }}>
                {formatarDuracao(bloco.duracaoMin)}
            </Text>
        </View>
    );
}

function LinhaMembro({
    linha,
}: {
    linha: {
        userId: string;
        nome: string;
        foto?: string | null;
        admin: boolean;
        ehVoce: boolean;
        concluidos: number;
        total: number;
    };
}) {
    const completou = linha.total > 0 && linha.concluidos >= linha.total;

    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 13,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: "rgba(255,255,255,0.055)",
            }}
        >
            <Avatar foto={linha.foto} nome={linha.nome} size={38} />
            <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: HADES.text }} numberOfLines={1}>
                        {linha.nome}
                    </Text>
                    {linha.ehVoce && (
                        <Text
                            style={{
                                fontSize: 8,
                                fontWeight: "800",
                                letterSpacing: 0.4,
                                color: "#000",
                                backgroundColor: HADES.accentSolid,
                                borderRadius: 4,
                                paddingVertical: 2,
                                paddingHorizontal: 5,
                            }}
                        >
                            VOCÊ
                        </Text>
                    )}
                </View>
                {linha.admin && (
                    <Text style={{ fontSize: 11, color: HADES.textDim, marginTop: 1 }}>Administrador</Text>
                )}
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <Text
                    style={{
                        fontSize: 13.5,
                        fontWeight: "700",
                        color: completou ? HADES.green : HADES.textSecondary,
                    }}
                >
                    {linha.concluidos}/{linha.total}
                </Text>
                {completou && <CheckCircle2 size={17} color={HADES.green} />}
            </View>
        </View>
    );
}

function EstadoVazio({ souAdmin, onGerar }: { souAdmin: boolean; onGerar: () => void }) {
    return (
        <View style={{ alignItems: "center", paddingTop: 60, paddingHorizontal: 20 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: HADES.text, textAlign: "center" }}>
                O grupo ainda não tem um roadmap
            </Text>
            <Text
                style={{
                    fontSize: 13,
                    color: HADES.textMuted,
                    marginTop: 6,
                    textAlign: "center",
                    lineHeight: 19,
                }}
            >
                {souAdmin
                    ? "Gere um roadmap por IA para o grupo e acompanhe o progresso de cada membro aqui."
                    : "Só o administrador do grupo pode gerar um roadmap."}
            </Text>
            {souAdmin && (
                <TouchableOpacity
                    onPress={onGerar}
                    activeOpacity={0.85}
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 18,
                        paddingHorizontal: 18,
                        height: 48,
                        borderRadius: 14,
                        backgroundColor: HADES.accentSolid,
                    }}
                >
                    <Sparkles size={15} color="#000" />
                    <Text style={{ fontSize: 13.5, fontWeight: "700", color: "#000" }}>Gerar roadmap</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

function ProgressoSkeleton() {
    return (
        <>
            <Skeleton width="100%" height={150} borderRadius={20} hades style={{ marginTop: 8, marginBottom: 22 }} />
            <Skeleton width={140} height={16} hades style={{ marginBottom: 14 }} />
            <View style={{ gap: 9, marginBottom: 22 }}>
                {[0, 1, 2].map((i) => (
                    <Skeleton key={i} width="100%" height={58} borderRadius={13} hades />
                ))}
            </View>
            <Skeleton width={160} height={16} hades style={{ marginBottom: 14 }} />
            <View style={{ gap: 12 }}>
                {[0, 1, 2].map((i) => (
                    <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 13 }}>
                        <SkeletonCircle size={38} hades />
                        <Skeleton width="45%" height={14} hades />
                        <View style={{ flex: 1 }} />
                        <Skeleton width={40} height={14} hades />
                    </View>
                ))}
            </View>
        </>
    );
}

const estilosSecao = {
    titulo: {
        fontSize: 16,
        fontWeight: "700" as const,
        color: HADES.text,
        marginBottom: 14,
    },
    diaTitulo: {
        fontSize: 12,
        fontWeight: "700" as const,
        color: HADES.textMuted,
        letterSpacing: 0.5,
        textTransform: "uppercase" as const,
        marginBottom: 8,
    },
};
