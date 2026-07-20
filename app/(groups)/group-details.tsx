import { View, Text, TouchableOpacity, ScrollView, Image, Alert, DeviceEventEmitter } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Globe, Lock, Users } from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import { HADES } from "@/constants/hades";
import { getAvatarColor } from "@/constants/helpers";
import Avatar from "@/components/ui/Avatar";
import { buscarGrupoPorId, entrarEmGrupoPublico, horasSemanaisGrupo } from "@/services/grupos";
import { salvarUltimoGrupoLocalmente } from "@/services/armazenamentoOffline";
import { useEffect, useState } from "react";
import { useMembrosGrupo } from "@/hooks/useMembrosGrupo";
import { useOnlineUsers } from "@/hooks/useOnlineUsers";
import { useAuth } from "@/hooks/useAuth";
import { GrupoComTotalMembros } from "@/types/grupos";

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
    const [group, setGroup] = useState<GrupoComTotalMembros | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [weeklyGroupHours, setWeeklyGroupHours] = useState(0);

    //Pega membros do grupo
    const { membros } = useMembrosGrupo({ grupoId: groupId });

    //Pega o id do usuário logado
    const { userId } = useAuth();

    //Pega as informações do grupo pelo ID
    useEffect(() => {
        const loadGroup = async () => {
            setIsLoading(true);
            const fetchedGroup = await buscarGrupoPorId(groupId!);
            setGroup(fetchedGroup);
            setIsLoading(false);
        };
        loadGroup();
    }, [groupId]);

    // Busca as horas reais da semana para mostrar o progresso correto nos detalhes do grupo.
    useEffect(() => {
        const loadWeeklyProgress = async () => {
            if (!groupId) return;

            const weeklyHours = await horasSemanaisGrupo(groupId);
            setWeeklyGroupHours(weeklyHours);
        };

        loadWeeklyProgress();
    }, [groupId]);

    //Pega usuários online no App (A Lista Global)
    const { onlineUsers } = useOnlineUsers(groupId);

    // Pega as IDs de todos os membros DESTE grupo específico
    const memberIds = membros.map((m) => m.user_id);

    // Filtra a lista global para mostrar APENAS quem tá logado, é membro daqui E não é você
    const activeGroupMembers = onlineUsers.filter((id) => id !== userId && memberIds.includes(id));

    if (isLoading || !group) {
        return (
            <SafeAreaView
                style={{ flex: 1, backgroundColor: HADES.bg, alignItems: "center", justifyContent: "center" }}
            >
                <Text style={{ color: HADES.textMuted }}>
                    {isLoading ? "Carregando detalhes..." : "Grupo não encontrado"}
                </Text>
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
                        const novoMembro = await entrarEmGrupoPublico(group.id);
                        if (!novoMembro) {
                            Alert.alert("Erro", "Não foi possível entrar no grupo.");
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
