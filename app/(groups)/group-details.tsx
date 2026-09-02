import { View, Text, TouchableOpacity, ScrollView, Image, DeviceEventEmitter, RefreshControl } from "react-native";
import { SafeAreaView } from "@/components/ui/TelaSegura";
import { ArrowLeft, Globe, Lock, Users } from "@/components/ui/icons";
import { router, useLocalSearchParams } from "expo-router";
import { HADES } from "@/constants/hades";
import { getAvatarColor } from "@/constants/helpers";
import Avatar from "@/components/ui/Avatar";
import { buscarGrupoPorId, entrarEmGrupoPublico, horasSemanaisGrupo } from "@/services/grupos";
import { salvarUltimoGrupoLocalmente } from "@/services/armazenamentoOffline";
import { useState } from "react";
import { useMembrosGrupo } from "@/hooks/useMembrosGrupo";
import { useDadosCache } from "@/hooks/useDadosCache";
import { useOnlineUsers } from "@/hooks/useOnlineUsers";
import { useAuth } from "@/hooks/useAuth";
import { GrupoComTotalMembros } from "@/types/grupos";
import { Skeleton, SkeletonCircle } from "@/components/ui/Skeleton";
import { EstadoDeErro } from "@/components/ui/EstadoDeErro";
import { toast } from "@/services/toast";
import { mostrarPaywallProSeLimite } from "@/services/paywall";

/** Bloco de estatística no visual HADES (substitui o antigo StatCard). */
function StatBox({ value, label, valueColor }: { value: string | number; label: string; valueColor: string }) {
    return (
        <View
            style={{
                flex: 1,
                backgroundColor: HADES.surface,
                borderWidth: 1,
                borderColor: HADES.border,
                borderRadius: 14,
                paddingVertical: 14,
                paddingHorizontal: 12,
                alignItems: "center",
            }}
        >
            <Text style={{ fontSize: 20, fontWeight: "700", color: valueColor, letterSpacing: -0.3 }}>
                {value}
            </Text>
            <Text style={{ fontSize: 11, color: HADES.textMuted, marginTop: 3, textAlign: "center" }}>
                {label}
            </Text>
        </View>
    );
}

export default function GroupDetailsScreen() {
    const { groupId } = useLocalSearchParams<{ groupId: string }>();

    //Pega membros do grupo
    const { membros, recarregar: recarregarMembros } = useMembrosGrupo({ grupoId: groupId });

    //Pega o id do usuário logado
    const { userId } = useAuth();

    //Controla o estado do pull-to-refresh
    const [atualizando, setAtualizando] = useState(false);

    /*
      Dados do grupo e horas da semana, do cache e em paralelo.

      Eram dois efeitos separados, cada um com a própria ida ao servidor, e ambos
      recomeçavam do zero a cada abertura da tela — que é uma tela para a qual se volta o
      tempo todo vindo da home.
    */
    const { dados, carregando: isLoading, erro, recarregar: recarregarGrupo } = useDadosCache(
        groupId ? `detalhes-grupo:${groupId}` : null,
        async () => {
            const [grupo, horas] = await Promise.all([
                buscarGrupoPorId(groupId!),
                horasSemanaisGrupo(groupId!),
            ]);
            return { grupo: grupo as GrupoComTotalMembros | null, horas };
        },
        // O progresso muda a cada sessão encerrada por qualquer membro.
        { tempoFresco: 0 }
    );

    const group = dados?.grupo ?? null;
    const weeklyGroupHours = dados?.horas ?? 0;

    const handleRefresh = async () => {
        setAtualizando(true);
        try {
            await Promise.all([recarregarGrupo(), recarregarMembros()]);
        } finally {
            setAtualizando(false);
        }
    };

    //Pega usuários online no App (A Lista Global)
    const { onlineUsers } = useOnlineUsers(groupId);

    // Pega as IDs de todos os membros DESTE grupo específico
    const memberIds = membros.map((m) => m.user_id);

    // Filtra a lista global para mostrar APENAS quem tá logado, é membro daqui E não é você
    const activeGroupMembers = onlineUsers.filter((id) => id !== userId && memberIds.includes(id));

    if (isLoading) {
        return <GroupDetailsSkeleton />;
    }

    if (!group && erro) {
        return (
            <SafeAreaView
                style={{ flex: 1, backgroundColor: HADES.bg, alignItems: "center", justifyContent: "center" }}
            >
                <EstadoDeErro erro={erro} onTentarNovamente={recarregarGrupo} style={{ marginHorizontal: 20 }} />
            </SafeAreaView>
        );
    }

    if (!group) {
        return (
            <SafeAreaView
                style={{ flex: 1, backgroundColor: HADES.bg, alignItems: "center", justifyContent: "center" }}
            >
                <Text style={{ color: HADES.textMuted }}>Grupo não encontrado</Text>
            </SafeAreaView>
        );
    }

    const totalWeeklyGoal = (group.meta_horas || 0) * (group.members || membros.length || 1);
    const weeklyProgress = totalWeeklyGoal > 0 ? Math.min(weeklyGroupHours / totalWeeklyGoal, 1) : 0;
    const initials = group.nome_grupo ? group.nome_grupo.substring(0, 2).toUpperCase() : "GR";
    const temAtivos = activeGroupMembers.length > 0;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top"]}>
            {/* Header */}
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
                <View style={{ flex: 1 }}>
                    <Text
                        style={{ fontSize: 20, fontWeight: "700", color: HADES.text, letterSpacing: -0.3 }}
                        numberOfLines={1}
                    >
                        {group.nome_grupo}
                    </Text>
                    <Text style={{ fontSize: 13, color: HADES.textMuted, marginTop: 2 }}>
                        {group.members} membros
                    </Text>
                </View>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={atualizando} onRefresh={handleRefresh} tintColor={HADES.accentSolid} />
                }
            >
                {/* Banner do grupo */}
                <View
                    style={{
                        backgroundColor: HADES.groupVioletTint,
                        borderWidth: 1,
                        borderColor: "rgba(124,92,252,0.22)",
                        borderRadius: 20,
                        padding: 18,
                        marginBottom: 16,
                    }}
                >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                        <View style={{ position: "relative" }}>
                            <View
                                style={{
                                    width: 72,
                                    height: 72,
                                    borderRadius: 18,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    overflow: "hidden",
                                    backgroundColor: getAvatarColor(
                                        group.nome_grupo ? group.nome_grupo.charCodeAt(0) % 5 : 0
                                    ),
                                    borderWidth: 2,
                                    borderColor: "rgba(124,92,252,0.4)",
                                }}
                            >
                                {group.foto_grupo ? (
                                    <Image
                                        source={{ uri: group.foto_grupo }}
                                        style={{ width: "100%", height: "100%" }}
                                        resizeMode="cover"
                                    />
                                ) : (
                                    <Text style={{ color: "#fff", fontSize: 24, fontWeight: "700" }}>{initials}</Text>
                                )}
                            </View>
                            {temAtivos && (
                                <View
                                    style={{
                                        position: "absolute",
                                        bottom: -2,
                                        right: -2,
                                        width: 18,
                                        height: 18,
                                        borderRadius: 9,
                                        backgroundColor: HADES.green,
                                        borderWidth: 2,
                                        borderColor: HADES.bg,
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" }} />
                                </View>
                            )}
                        </View>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                                {group.publico ? (
                                    <Globe size={13} color={HADES.groupViolet} />
                                ) : (
                                    <Lock size={13} color={HADES.groupViolet} />
                                )}
                                <Text style={{ fontSize: 12, color: HADES.groupViolet, fontWeight: "600" }}>
                                    {group.publico ? "Grupo público" : "Grupo privado"}
                                </Text>
                            </View>
                            <Text style={{ fontSize: 13, color: HADES.textSecondary, lineHeight: 19 }}>
                                {group.descricao || "Sem descrição."}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Grade de estatísticas */}
                <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
                    <StatBox value={group.members} label="Membros" valueColor={HADES.groupViolet} />
                    <StatBox value={activeGroupMembers.length} label="Ativos agora" valueColor={HADES.green} />
                    <StatBox value={`${group.meta_horas || 0}h`} label="Meta semanal" valueColor={HADES.accentSolid} />
                </View>

                {/* Membros ativos */}
                <View
                    style={{
                        backgroundColor: HADES.surface,
                        borderWidth: 1,
                        borderColor: HADES.border,
                        borderRadius: 16,
                        padding: 14,
                        marginBottom: 16,
                    }}
                >
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 12,
                        }}
                    >
                        <Text style={{ fontSize: 14, fontWeight: "600", color: HADES.text }}>Membros ativos</Text>
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 5,
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: 999,
                                backgroundColor: temAtivos ? HADES.greenTint : "rgba(240,85,107,0.12)",
                            }}
                        >
                            <View
                                style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: 3,
                                    backgroundColor: temAtivos ? HADES.green : HADES.red,
                                }}
                            />
                            <Text style={{ fontSize: 11.5, color: temAtivos ? HADES.green : HADES.red }}>
                                {temAtivos ? `${activeGroupMembers.length} estudando` : "Ninguém estudando"}
                            </Text>
                        </View>
                    </View>
                    {membros.length === 0 && (
                        <Text style={{ fontSize: 12.5, color: HADES.textMuted }}>
                            Não foi possível carregar os membros deste grupo.
                        </Text>
                    )}
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        {membros.map((member) => (
                            <View
                                key={member.id}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 8,
                                    paddingHorizontal: 10,
                                    paddingVertical: 7,
                                    borderRadius: 12,
                                    backgroundColor: HADES.surfaceOverlay,
                                }}
                            >
                                <Avatar
                                    foto={member.userData?.foto_usuario}
                                    size={30}
                                    showOnlineDot={activeGroupMembers.includes(member.user_id)}
                                />
                                <Text style={{ fontSize: 13, color: HADES.textSecondary }}>
                                    {member.userData?.nome_usuario || "Membro"}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Progresso semanal */}
                <View
                    style={{
                        backgroundColor: HADES.surface,
                        borderWidth: 1,
                        borderColor: HADES.border,
                        borderRadius: 16,
                        padding: 14,
                    }}
                >
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 12,
                        }}
                    >
                        <Text style={{ fontSize: 14, fontWeight: "600", color: HADES.text }}>Progresso semanal</Text>
                        <Text style={{ fontSize: 12, color: HADES.green }}>
                            {Math.round(weeklyProgress * 100)}% atingido
                        </Text>
                    </View>
                    <View
                        style={{
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: HADES.surfaceOverlay,
                            overflow: "hidden",
                        }}
                    >
                        <View
                            style={{
                                width: `${weeklyProgress * 100}%`,
                                height: "100%",
                                borderRadius: 5,
                                backgroundColor: HADES.green,
                            }}
                        />
                    </View>
                    <Text style={{ fontSize: 12, color: HADES.textDim, marginTop: 8 }}>
                        {Math.round(weeklyGroupHours)}h / {totalWeeklyGoal}h nesta semana
                    </Text>
                </View>
            </ScrollView>

            {/* Botão Entrar */}
            <View
                style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    paddingHorizontal: 20,
                    paddingBottom: 24,
                    paddingTop: 8,
                    backgroundColor: HADES.bg,
                }}
            >
                <TouchableOpacity
                    onPress={async () => {
                        const { membro: novoMembro, erro } = await entrarEmGrupoPublico(group.id);
                        if (!novoMembro) {
                            if (mostrarPaywallProSeLimite(erro)) return;
                            toast.error(erro ?? "Não foi possível entrar no grupo.");
                            return;
                        }

                        await salvarUltimoGrupoLocalmente(group.id);
                        DeviceEventEmitter.emit("groupMembershipChanged");
                        router.replace({
                            pathname: "/(tabs)",
                            params: {
                                groupId: group.id,
                                groupName: group.nome_grupo,
                                groupPhoto: group.foto_grupo,
                                groupGoal: group.meta_horas,
                                groupCode: group.codigo_convite,
                            },
                        });
                    }}
                    activeOpacity={0.85}
                    style={{
                        height: 54,
                        borderRadius: 15,
                        backgroundColor: HADES.accentSolid,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 9,
                    }}
                >
                    <Users size={20} color="#000" />
                    <Text style={{ color: "#000", fontWeight: "700", fontSize: 16 }}>Entrar neste grupo</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

function GroupDetailsSkeleton() {
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
                <ArrowLeft size={22} color={HADES.textSecondary} />
                <View style={{ flex: 1, gap: 5 }}>
                    <Skeleton width="55%" height={20} hades />
                    <Skeleton width={90} height={13} hades />
                </View>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
            >
                <View
                    style={{
                        backgroundColor: HADES.groupVioletTint,
                        borderWidth: 1,
                        borderColor: "rgba(124,92,252,0.22)",
                        borderRadius: 20,
                        padding: 18,
                        marginBottom: 16,
                    }}
                >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                        <SkeletonCircle size={72} hades style={{ borderRadius: 18 }} />
                        <View style={{ flex: 1, gap: 8 }}>
                            <Skeleton width={110} height={13} hades />
                            <Skeleton width="90%" height={13} hades />
                            <Skeleton width="70%" height={13} hades />
                        </View>
                    </View>
                </View>

                <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
                    {[0, 1, 2].map((i) => (
                        <View
                            key={i}
                            style={{
                                flex: 1,
                                backgroundColor: HADES.surface,
                                borderWidth: 1,
                                borderColor: HADES.border,
                                borderRadius: 14,
                                paddingVertical: 14,
                                paddingHorizontal: 12,
                                alignItems: "center",
                                gap: 8,
                            }}
                        >
                            <Skeleton width={30} height={20} hades />
                            <Skeleton width={50} height={11} hades />
                        </View>
                    ))}
                </View>

                <View
                    style={{
                        backgroundColor: HADES.surface,
                        borderWidth: 1,
                        borderColor: HADES.border,
                        borderRadius: 16,
                        padding: 14,
                        marginBottom: 16,
                    }}
                >
                    {/* Título à esquerda + pílula "N estudando" à direita, como no cartão pronto. */}
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 12,
                        }}
                    >
                        <Skeleton width={110} height={14} hades />
                        <Skeleton width={104} height={22} borderRadius={999} hades />
                    </View>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        {[0, 1, 2].map((i) => (
                            <View
                                key={i}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 8,
                                    paddingHorizontal: 10,
                                    paddingVertical: 7,
                                    borderRadius: 12,
                                    backgroundColor: HADES.surfaceOverlay,
                                }}
                            >
                                <SkeletonCircle size={30} hades />
                                <Skeleton width={70} height={13} hades />
                            </View>
                        ))}
                    </View>
                </View>

                <View
                    style={{
                        backgroundColor: HADES.surface,
                        borderWidth: 1,
                        borderColor: HADES.border,
                        borderRadius: 16,
                        padding: 14,
                    }}
                >
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 12,
                        }}
                    >
                        <Skeleton width={130} height={14} hades />
                        <Skeleton width={78} height={12} hades />
                    </View>
                    <Skeleton width="100%" height={10} borderRadius={5} hades />
                    <Skeleton width={130} height={12} hades style={{ marginTop: 8 }} />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
