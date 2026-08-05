import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Globe, Lock, Flame, Clock, BadgeCheck, Pause, Wind } from "lucide-react-native";
import { router } from "expo-router";
import { HADES } from "@/constants/hades";
import { getSubjectColor, getTimeAgo } from "@/constants/helpers";
import { tempoAoVivoDaSessao } from "@/utils/tempo";
import Avatar from "@/components/ui/Avatar";
import { Skeleton, SkeletonCircle } from "@/components/ui/Skeleton";
import type { SessaoFocoRow } from "@/types/sessions";

/** "1h 30m" para sessões encerradas; "12:34" enquanto a sessão ainda corre. */
function formatarDuracaoDoCard(segundos: number, aoVivo: boolean) {
    const totalSegundos = Math.max(0, Math.floor(segundos));

    if (aoVivo) {
        const h = Math.floor(totalSegundos / 3600);
        const m = Math.floor((totalSegundos % 3600) / 60);
        const s = totalSegundos % 60;
        const doisDigitos = (n: number) => n.toString().padStart(2, "0");
        return h > 0 ? `${h}:${doisDigitos(m)}:${doisDigitos(s)}` : `${doisDigitos(m)}:${doisDigitos(s)}`;
    }

    const minutosTotais = Math.round(totalSegundos / 60);
    const horas = Math.floor(minutosTotais / 60);
    const minutos = minutosTotais % 60;
    return horas === 0 ? `${minutos}m` : minutos === 0 ? `${horas}h` : `${horas}h ${minutos}m`;
}

/**
 * Card de sessão no feed da home do grupo, no visual HADES.
 *
 * Separado do `components/groups/SessionCard`, que continua servindo a tela de
 * detalhamento — aquela ainda não migrou para o HADES.
 */
export default function CardSessaoGrupo({ sessao }: { sessao: SessaoFocoRow }) {
    const nome = sessao.profiles?.nome_real || sessao.profiles?.nome_usuario || "Usuário";
    const corMateria = getSubjectColor(sessao.disciplina);
    const publica = sessao.is_public;
    const estaConcluida = Boolean(sessao.concluido_em || sessao.status === "concluido" || sessao.status === "salvo");
    const emAndamento = !estaConcluida && (sessao.status === "ativo" || sessao.status === "pausado");
    const focandoAgora = emAndamento && sessao.status === "ativo";

    /*
      Tick de 1s só para repintar enquanto a sessão corre — o tempo em si sempre sai de
      `tempoAoVivoDaSessao` (acumulado no banco + o que passou desde `ultimo_inicio`), nunca
      de um contador local. Numa sessão pausada ou encerrada o valor não muda, então não há
      intervalo rodando: um feed com vários cards antigos não fica repintando à toa.
    */
    const [, setTick] = useState(0);
    useEffect(() => {
        if (!focandoAgora) return;
        const id = setInterval(() => setTick((t) => t + 1), 1000);
        return () => clearInterval(id);
    }, [focandoAgora]);

    const duracao = formatarDuracaoDoCard(tempoAoVivoDaSessao(sessao), emAndamento);

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={() =>
                router.push({
                    pathname: "/session-preview",
                    // Sem o id a prévia abria sempre a última sessão encerrada, não a que foi tocada.
                    params: { sessionId: sessao.id, isPublic: String(sessao.is_public) },
                })
            }
            style={{
                backgroundColor: HADES.surface,
                borderWidth: 1,
                borderColor: HADES.border,
                borderRadius: 16,
                padding: 14,
            }}
        >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
                <Avatar foto={sessao.profiles?.foto_usuario} nome={nome} size={30} />

                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: HADES.text }} numberOfLines={1}>
                        {nome}
                    </Text>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {estaConcluida ? (
                        // O selo de destaque (>70% no quiz) era um filtro que sumia com todo
                        // o resto do feed; agora é só esta marcação (ver services/sessions.ts).
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 4,
                                backgroundColor: sessao.destaque ? "rgba(255,154,0,0.10)" : HADES.surfaceOverlay,
                                borderRadius: 7,
                                paddingVertical: 3,
                                paddingHorizontal: 8,
                            }}
                        >
                            <BadgeCheck size={11} color={sessao.destaque ? HADES.accentSolid : HADES.textMuted} />
                        </View>
                    ) : emAndamento ? (
                        // Pausa e descanso do pomodoro chegam aqui como `status = 'pausado'`:
                        // o card não pode anunciar "focando" enquanto o cronômetro está parado.
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 4,
                                backgroundColor: focandoAgora ? "rgba(52,199,89,0.10)" : HADES.surfaceOverlay,
                                borderRadius: 7,
                                paddingVertical: 3,
                                paddingHorizontal: 8,
                            }}
                        >
                            {focandoAgora ? (
                                <View
                                    style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: HADES.green }}
                                />
                            ) : (
                                <Pause size={11} color={HADES.textMuted} />
                            )}
                        </View>
                    ) : null}
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                            backgroundColor: publica ? "rgba(255,154,0,0.10)" : HADES.surfaceOverlay,
                            borderRadius: 7,
                            paddingVertical: 3,
                            paddingHorizontal: 8,
                        }}
                    >
                        {publica ? (
                            <Globe size={11} color={HADES.accentSolid} />
                        ) : (
                            <Lock size={11} color={HADES.textMuted} />
                        )}
                    </View>
                </View>
            </View>

            <Text style={{ marginTop: 11 }} numberOfLines={1}>
                <Text style={{ fontSize: 13.5, fontWeight: "600", color: corMateria.text }}>
                    {sessao.disciplina}
                </Text>
                <Text style={{ fontSize: 13, color: HADES.textMuted }}>
                    {sessao.conteudo_especifico ? ` · ${sessao.conteudo_especifico}` : ""}
                </Text>
            </Text>

            <View
                style={{
                    flexDirection: "row",
                    alignItems: "flex-end",
                    justifyContent: "space-between",
                    marginTop: 12,
                    paddingTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: "rgba(255,255,255,0.05)",
                }}
            >
                <View>
                    <Text
                        style={{ fontSize: 19, fontWeight: "700", color: HADES.text, letterSpacing: -0.3 }}
                    >
                        {duracao}
                    </Text>
                    <Text
                        style={{
                            fontSize: 10,
                            color: HADES.textDim,
                            fontWeight: "600",
                            letterSpacing: 0.5,
                            marginTop: 1,
                        }}
                    >
                        {emAndamento ? "TEMPO DE FOCO" : "DURAÇÃO"}
                    </Text>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <Clock size={13} color={HADES.textFaint} />
                        <Text style={{ fontSize: 12.5, color: HADES.textMuted }}>{getTimeAgo(sessao.created_at)}</Text>
                    </View>
                    {/* O quiz só existe depois do encerramento: numa sessão em andamento o
                        placar seria sempre 0/0. */}
                    {!emAndamento && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                            <Flame size={14} color={HADES.accentSolid} />
                            <Text style={{ fontSize: 12.5, color: HADES.textSecondary, fontWeight: "600" }}>
                                {sessao.questoes_acertadas}/{sessao.questoes_respondidas}
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
}

export function FeedVazio({ carregando }: { carregando?: boolean }) {
    if (carregando) {
        return (
            <>
                <CardSessaoGrupoSkeleton />
                <CardSessaoGrupoSkeleton style={{ marginTop: 10 }} />
            </>
        );
    }

    return (
        <View
            style={{
                backgroundColor: HADES.surface,
                borderWidth: 1,
                borderColor: HADES.border,
                borderRadius: 16,
                paddingVertical: 28,
                paddingHorizontal: 20,
                alignItems: "center",
            }}
        >
            <Wind size={26} color={HADES.dot} />
            <Text style={{ fontSize: 13.5, color: HADES.textMuted, marginTop: 12 }}>
                Nenhuma sessão registrada ainda.
            </Text>
            <Text style={{ fontSize: 12, color: HADES.textDim, marginTop: 4 }}>
                As sessões dos membros aparecem aqui.
            </Text>
        </View>
    );
}

function CardSessaoGrupoSkeleton({ style }: { style?: object }) {
    return (
        <View
            style={[
                {
                    backgroundColor: HADES.surface,
                    borderWidth: 1,
                    borderColor: HADES.border,
                    borderRadius: 16,
                    padding: 14,
                    gap: 12,
                },
                style,
            ]}
        >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
                <SkeletonCircle size={30} hades />
                <Skeleton width={100} height={13} hades />
            </View>
            <Skeleton width="65%" height={13} hades />
            <Skeleton width="100%" height={32} hades />
        </View>
    );
}
