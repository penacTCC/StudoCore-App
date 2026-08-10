import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { useMemo, useState } from "react";
import { SafeAreaView } from "@/components/ui/TelaSegura";
import { ArrowLeft } from "@/components/ui/icons";
import { HADES } from "@/constants/hades";
import CardSessaoGrupo, { FeedVazio } from "@/components/grupo/CardSessaoGrupo";
import ResumoDeHoje from "@/components/grupo/ResumoDeHoje";
import TituloDaSecao from "@/components/grupo/TituloDaSecao";
import { useSessoesAoVivo, useSessoesFoco } from "@/hooks/useSessoesFoco";
import { useExtrasDoFeed } from "@/hooks/useExtrasDoFeed";
import { useAuth } from "@/hooks/useAuth";
import { router, useLocalSearchParams } from "expo-router";
import { tempoTotalSessoesFocoOntem, tempoTotalSessoesFoco } from "@/services/sessions";
import { useMembrosOnline } from "@/hooks/useMembrosOnline";
import { useDadosCache } from "@/hooks/useDadosCache";
import type { SessaoFocoRow } from "@/types/sessions";

const ehMesmoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function formatarLabelData(dataString: string) {
    const data = new Date(dataString);
    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(hoje.getDate() - 1);

    if (ehMesmoDia(data, hoje)) return "HOJE";
    if (ehMesmoDia(data, ontem)) return "ONTEM";

    return data
        .toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" })
        .toUpperCase();
}

function agruparSessoesPorData(sessoes: SessaoFocoRow[]) {
    const ordenadas = [...sessoes].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const grupos: Array<{ chave: string; label: string; sessoes: SessaoFocoRow[] }> = [];
    const mapa = new Map<string, { chave: string; label: string; sessoes: SessaoFocoRow[] }>();

    ordenadas.forEach((sessao) => {
        const data = new Date(sessao.created_at);
        const chave = `${data.getFullYear()}-${data.getMonth()}-${data.getDate()}`;

        if (!mapa.has(chave)) {
            const grupo = { chave, label: formatarLabelData(sessao.created_at), sessoes: [] };
            mapa.set(chave, grupo);
            grupos.push(grupo);
        }

        mapa.get(chave)?.sessoes.push(sessao);
    });

    return grupos;
}

export default function DetailingScreen() {
    const { groupId } = useLocalSearchParams<{ groupId?: string }>();
    const { userId } = useAuth();


    // Busca o histórico público do grupo atual para não misturar sessões de outros grupos.
    const { sessions, loading, refresh: refreshSessions } = useSessoesFoco(50, groupId);

    /*
      A tela mostrava só o histórico, e quem estava focando naquele instante simplesmente
      não aparecia em "ver todas as sessões" — o feed ao vivo existia apenas na home. Agora
      as duas listas convivem, separadas pela seção AGORA.
    */
    const { sessoes: sessoesAoVivo, loading: carregandoAoVivo, refresh: refreshAoVivo } =
        useSessoesAoVivo(20, groupId);

    const { totalOnline } = useMembrosOnline(groupId);

    const [atualizando, setAtualizando] = useState(false);

    // Os dois totais são independentes: saem juntos em vez de um esperar o outro.
    const { dados: totais, recarregar: buscarTotal } = useDadosCache(
        `totais-foco-grupo:${groupId ?? "todos"}`,
        async () => {
            const [resultado, ontem] = await Promise.all([
                tempoTotalSessoesFoco(groupId),
                tempoTotalSessoesFocoOntem(groupId),
            ]);
            return { totalMinutos: resultado.totalMinutos, minutosOntem: ontem };
        },
        { tempoFresco: 15_000 }
    );

    const totalMinutos = totais?.totalMinutos ?? 0;
    const minutosOntem = totais?.minutosOntem ?? 0;

    const handleRefresh = async () => {
        setAtualizando(true);
        try {
            await Promise.all([refreshSessions(), refreshAoVivo(), buscarTotal()]);
        } finally {
            setAtualizando(false);
        }
    };

    // A mesma sessão pode estar nas duas listas por um instante (acabou de encerrar e o
    // feed ao vivo ainda não voltou): o ao vivo tem prioridade e o id evita repetir.
    const encerradas = useMemo(() => {
        const idsAoVivo = new Set(sessoesAoVivo.map((sessao) => sessao.id));
        return sessions.filter((sessao) => !idsAoVivo.has(sessao.id));
    }, [sessoesAoVivo, sessions]);

    const todas = useMemo(() => [...sessoesAoVivo, ...encerradas], [sessoesAoVivo, encerradas]);
    const extras = useExtrasDoFeed(todas);

    const sessoesAgrupadas = agruparSessoesPorData(encerradas);
    const carregando = loading || carregandoAoVivo;
    const vazio = todas.length === 0;

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
                >
                    <ArrowLeft size={22} color={HADES.textSecondary} />
                </TouchableOpacity>

                <Text style={{ flex: 1, fontSize: 22, fontWeight: "700", color: HADES.text, letterSpacing: -0.4 }}>
                    Sessões
                </Text>

                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: HADES.greenTint,
                    }}
                >
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: HADES.green }} />
                    <Text style={{ fontSize: 11.5, fontWeight: "600", color: HADES.green }}>
                        {totalOnline} estudando
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
                <View style={{ marginBottom: 20 }}>
                    <ResumoDeHoje totalMinutos={totalMinutos} minutosOntem={minutosOntem} />
                </View>

                {carregando ? (
                    <View style={{ gap: 10 }}>
                        <FeedVazio carregando />
                    </View>
                ) : vazio ? (
                    <FeedVazio />
                ) : (
                    <View style={{ gap: 22 }}>
                        {sessoesAoVivo.length > 0 && (
                            <View style={{ gap: 10 }}>
                                <TituloDaSecao label="AGORA" aoVivo contagem={sessoesAoVivo.length} />
                                {sessoesAoVivo.map((sessao) => (
                                    <CardSessaoGrupo
                                        key={sessao.id}
                                        sessao={sessao}
                                        participantes={extras.participantesDe(sessao)}
                                        fotoUrl={extras.fotoDe(sessao)}
                                        usuarioId={userId}
                                    />
                                ))}
                            </View>
                        )}

                        {sessoesAgrupadas.map((grupo) => (
                            <View key={grupo.chave} style={{ gap: 8 }}>
                                <TituloDaSecao label={grupo.label} />
                                {grupo.sessoes.map((sessao) => (
                                    <CardSessaoGrupo
                                        key={sessao.id}
                                        sessao={sessao}
                                        participantes={extras.participantesDe(sessao)}
                                        fotoUrl={extras.fotoDe(sessao)}
                                        usuarioId={userId}
                                    />
                                ))}
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
