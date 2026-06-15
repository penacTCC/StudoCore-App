import { useCallback, useEffect, useState } from "react";

//Componentes de Native
import { View, Text, TouchableOpacity, ScrollView, Image, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Crown, Flame, Plus, ChevronRight, ChevronDown, Compass, Users, Settings } from "lucide-react-native";

//Componentes de Expo
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

//Constantes
import { COLORS } from "@/constants/colors";

//Componentes
import { Avatar } from "@/components/ui";
import SessionCard from "@/components/groups/SessionCard";

//Hooks
import { useMembrosGrupo } from "@/hooks/useMembrosGrupo";
import { useAuth } from "@/hooks/useAuth";
import { useOnlineUsers } from "@/hooks/useOnlineUsers";
import { useSessoesFoco } from "@/hooks/useSessoesFoco";
import { horasSemanaisGrupo } from "@/services/grupos";

type LeaderboardFilter = "horas" | "constancia" | "questoes" | "acertos" | "semanal" | "mensal" | "anual";

const LEADERBOARD_TABS = [
    // Filtro principal atual, baseado nas horas de estudo do membro.
    { key: "horas", label: "Horas" },

    // Filtro reservado para o ranking futuro de constância.
    { key: "constancia", label: "Constância" },

    // Filtro reservado para o ranking futuro por quantidade de questões respondidas.
    { key: "questoes", label: "Questões" },

    // Filtro reservado para o ranking futuro por questões acertadas.
    { key: "acertos", label: "Acertos" },

    // Filtros de período mantidos no layout para a evolução do ranking.
    { key: "semanal", label: "Semana" },
    { key: "mensal", label: "Mês" },
    { key: "anual", label: "Ano" },
];

const getRankColor = (rank: number) => {
    // Primeiro lugar usa dourado para combinar com a borda especial do campeão.
    if (rank === 1) return COLORS.amber;

    // Segundo lugar usa prata para manter a hierarquia visual clássica do pódio.
    if (rank === 2) return "#cbd5e1";

    // Terceiro lugar usa bronze para fechar o destaque dos três primeiros colocados.
    if (rank === 3) return "#fb923c";

    // Demais posições ficam neutras para não competir com o top 3.
    return COLORS.textMuted;
};

export default function GroupScreen() {
    const [leaderboardFilter, setLeaderboardFilter] = useState<LeaderboardFilter>("horas");
    const [selectedMember, setSelectedMember] = useState<any>(null);
    const [horasSemanaGrupo, setHorasSemanaGrupo] = useState(0)

    // Captura os parâmetros recebidos da tela anterior
    const { groupName, groupId, groupPhoto, groupGoal } = useLocalSearchParams(); //<- os parametros

    //Pega os membros do grupo
    const { membros } = useMembrosGrupo({ grupoId: groupId as string });

    //Pega o usuário atual
    const { userId } = useAuth();

    //Verifica se o usuário atual é o administrador
    const isAdmin = membros.some(member => member.user_id === userId && member.administrador);

    //Pega a quantidade de usuários online
    const { onlineUsers } = useOnlineUsers(groupId as string);

    // Busca apenas as sessões públicas do grupo atual para o feed ao vivo.
    const { sessions, loading: loadingSessions } = useSessoesFoco(5, groupId as string);

    //Faz useEffect para pegar as horas semanais do grupo
    useEffect(() => {
        if(!groupId) return
        const carregarHoras = async () => {
            const horas = await horasSemanaisGrupo(groupId as string)
            setHorasSemanaGrupo(horas)
        }
        carregarHoras()
    }, [groupId])

    // Recarrega o progresso quando a aba volta para frente depois de uma sessão de foco.
    useFocusEffect(
        useCallback(() => {
            if (!groupId) return;

            const reloadGroupProgress = async () => {
                const weeklyHours = await horasSemanaisGrupo(groupId as string);
                setHorasSemanaGrupo(weeklyHours);
            };

            reloadGroupProgress();
        }, [groupId])
    );

    //Cálculo do progresso do grupo
    const metaPorMembro = Number(Array.isArray(groupGoal) ? groupGoal[0] : groupGoal) || 0
    const totalMembros = membros.length

    const metaTotalGrupo = metaPorMembro * totalMembros

    const progressoGrupo = metaTotalGrupo > 0 ? horasSemanaGrupo / metaTotalGrupo : 0

    const progressoPercentual = Math.min(Math.round(progressoGrupo * 100), 100)

    return (
        <SafeAreaView className="flex-1 bg-slate-950" edges={["top"]}>
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View className="bg-slate-950 px-4 pt-4 pb-2">
                    <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-4 flex-1 pr-4">
                            <View className="w-12 h-12 rounded-xl bg-slate-800 items-center justify-center border border-slate-700">
                                {groupPhoto ? (
                                    <Image source={{ uri: Array.isArray(groupPhoto) ? groupPhoto[0] : groupPhoto }} className="w-full h-full rounded-xl" resizeMode="cover" />
                                ) : (
                                    <Users size={28} color={COLORS.textMuted} />
                                )}
                            </View>
                            <View className="flex-1">
                                <TouchableOpacity
                                    onPress={() => router.push("/(groups)")}
                                    className="flex-row items-center"
                                    activeOpacity={0.7}
                                >
                                    <Text
                                        className="text-2xl font-bold text-slate-200"
                                        numberOfLines={1}
                                        style={{ maxWidth: 200 }}
                                    >
                                        {groupName || "Nome não encontrado"}
                                    </Text>
                                    <View className="p-1.5 rounded-full ml-1">
                                        <ChevronDown size={22} color={COLORS.textMuted} />
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {isAdmin && (
                            <TouchableOpacity
                                onPress={() =>
                                    router.push({
                                        pathname: "/(groups)/settings",
                                        params: {
                                            groupId
                                        }
                                    })
                                }
                                className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 items-center justify-center"
                                activeOpacity={0.75}
                            >
                                <Settings size={20} color={COLORS.textMuted} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Gradient Progress Bar */}
                <View className="px-4 pb-4 border-b border-slate-800 bg-slate-950 mt-5">
                    <View className="flex-row justify-between items-center mb-2">
                        <Text className="text-sm text-slate-400 font-medium">Meta do Grupo</Text>
                        <Text className="text-sm text-emerald-400 font-bold">{progressoPercentual}% Atingida</Text>
                    </View>
                    <View className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                        <LinearGradient
                            colors={["#8b5cf6", "#10b981"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{ height: "100%", width: `${progressoPercentual}%`, borderRadius: 999 }}
                        />
                    </View>
                </View>

                {/* Leaderboard */}
                <View className="px-4 mt-4">
                    <View className="bg-slate-900 border border-slate-800 rounded-3xl p-4">
                        <View className="mb-4">
                            <View className="flex-row items-center justify-between mb-3">
                                <View>
                                    <Text className="text-lg font-semibold text-slate-200">Ranking</Text>
                                    <Text className="text-xs text-slate-500">Compare por horas, constância e questões</Text>
                                </View>
                                <Text className="text-xs font-semibold text-slate-400">top 5</Text>
                            </View>

                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ gap: 8, paddingRight: 4 }}
                            >
                                {LEADERBOARD_TABS.map((tab) => {
                                    // Identifica o filtro ativo para aplicar destaque visual no chip.
                                    const isActiveFilter = tab.key === leaderboardFilter;

                                    return (
                                        <TouchableOpacity
                                            key={tab.key}
                                            onPress={() => setLeaderboardFilter(tab.key as LeaderboardFilter)}
                                            activeOpacity={0.75}
                                            className={`px-3 py-2 rounded-full border ${isActiveFilter
                                                ? "bg-brand-500 border-brand-400"
                                                : "bg-slate-800/60 border-slate-700"
                                                }`}
                                        >
                                            {/* Nome do filtro em formato de chip para suportar muitos critérios. */}
                                            <Text
                                                className={`text-xs font-semibold ${isActiveFilter ? "text-white" : "text-slate-300"
                                                    }`}
                                            >
                                                {tab.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>

                        <ScrollView
                            nestedScrollEnabled
                            showsVerticalScrollIndicator={membros.length > 5}
                            style={{ maxHeight: 350 }}
                        >
                            {membros.map((member, index) => {
                                // Usa o rank vindo do membro quando existir e cai para a posição da lista como segurança.
                                const memberRank = member.rank || index + 1;

                                // Define se a linha recebe o destaque visual do primeiro colocado.
                                const isFirstPlace = memberRank === 1;

                                // Calcula a cor do número para diferenciar 1º, 2º e 3º lugar.
                                const rankColor = getRankColor(memberRank);

                                return (
                                    <TouchableOpacity
                                        key={member.id}
                                        onPress={() => setSelectedMember(member)}
                                        className="flex-row items-center gap-3 p-3 rounded-2xl mb-2 bg-slate-800/30"
                                        style={
                                            isFirstPlace
                                                ? {
                                                    borderWidth: 2,
                                                    borderColor: COLORS.amber,
                                                    shadowColor: COLORS.amber,
                                                    shadowOffset: { width: 0, height: 0 },
                                                    shadowOpacity: 0.4,
                                                    shadowRadius: 10,
                                                    elevation: 5,
                                                }
                                                : undefined
                                        }
                                    >
                                        {/* Número do ranking posicionado à esquerda do avatar. */}
                                        <View className="w-8 items-center justify-center">
                                            {isFirstPlace && (
                                                <View className="absolute -top-3 z-10">
                                                    <Crown size={14} color={COLORS.amber} />
                                                </View>
                                            )}
                                            <Text className="text-base font-bold" style={{ color: rankColor }}>
                                                #{memberRank}
                                            </Text>
                                        </View>

                                        {/* Avatar do membro com indicador online. */}
                                        <Avatar
                                            foto={member.userData?.foto_usuario}
                                            nome={member.userData?.nome_usuario}
                                            size={40}
                                            showOnlineDot={onlineUsers.includes(member.user_id)}
                                        />

                                        {/* Informações principais do membro no ranking. */}
                                        <View className="flex-1">
                                            <Text
                                                className={`font-medium ${isFirstPlace ? "text-amber-400" : "text-slate-200"
                                                    }`}
                                            >
                                                {member.userData?.nome_usuario || "Sem nome"}
                                            </Text>
                                            <Text className="text-xs text-slate-400">
                                                15h esta semana
                                            </Text>
                                        </View>

                                        {/* Ofensiva e selo de administrador do membro. */}
                                        <View className="flex-row items-center gap-1">
                                            <Flame size={14} color={COLORS.emeraldLight} />
                                            <Text className="text-sm font-bold text-emerald-400">
                                                {member.ofensiva ?? 0}
                                            </Text>
                                            {member.administrador ? (
                                                <Text className="text-xs font-bold text-amber-400">ADM</Text>
                                            ) : null}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>

                {/* Live Feed */}
                <View className="px-4 mt-4">
                    <View className="bg-slate-900 border border-slate-800 rounded-3xl p-4">
                        <View className="flex-row items-center justify-between mb-3">
                            <Text className="text-lg font-semibold text-slate-200">Atividades ao vivo</Text>
                            <TouchableOpacity
                                className="flex-row items-center gap-1"
                                onPress={() => router.push({ pathname: "/detailing", params: { groupId: groupId as string } })}
                            >
                                <Text className="text-sm text-violet-400">Ver tudo</Text>
                                <ChevronRight size={16} color={COLORS.violetLight} />
                            </TouchableOpacity>
                        </View>

                        {loadingSessions ? (
                            <Text className="text-sm text-slate-500 text-center py-4">Carregando...</Text>
                        ) : sessions.length === 0 ? (
                            <Text className="text-sm text-slate-500 text-center py-4">Nenhuma sessão registrada ainda.</Text>
                        ) : (
                            sessions.slice(0, 2).map((session, index) => (
                                <SessionCard
                                    key={session.id}
                                    session={session}
                                    colorIndex={index}
                                />
                            ))
                        )}
                    </View>
                </View>

                {/* Members */}
                <View className="px-4 mt-4">
                    <View className="bg-slate-900 border border-slate-800 rounded-3xl p-4">
                        <View className="flex-row items-center justify-between mb-3">
                            <Text className="text-lg font-semibold text-slate-200">Membros</Text>
                            <TouchableOpacity
                                onPress={() => router.push({ pathname: "/invite", params: { groupId: groupId as string, groupName: groupName as string } })}
                                className="flex-row items-center gap-1 bg-brand-500 px-3 py-1.5 rounded-lg"
                            >
                                <Plus size={16} color={COLORS.white} />
                                <Text className="text-white text-xs font-medium">Convidar</Text>
                            </TouchableOpacity>
                        </View>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ gap: 14, paddingRight: 4, marginTop: 15 }}
                        >
                            {membros.map((member) => (
                                <TouchableOpacity
                                    key={member.id}
                                    onPress={() => setSelectedMember(member)}
                                    activeOpacity={0.75}
                                    className="items-center w-20"
                                >
                                    {/* Foto circular do membro no carrossel horizontal. */}
                                    <View className="relative mb-2">
                                        <Avatar
                                            foto={member.userData?.foto_usuario}
                                            nome={member.userData?.nome_usuario}
                                            size={56}
                                            showOnlineDot={onlineUsers.includes(member.user_id)}
                                        />

                                        {/* Sinaliza administradores sem ocupar espaço no nome. */}
                                        {member.administrador ? (
                                            <View className="absolute -top-1 -right-1 bg-amber-500 rounded-full px-1.5 py-0.5 border border-slate-900">
                                                <Text className="text-[9px] font-bold text-slate-950">ADM</Text>
                                            </View>
                                        ) : null}

                                        {/* Destaca membros com ofensiva alta com o ícone de fogo. */}
                                        {(member.ofensiva ?? 0) >= 10 && (
                                            <View className="absolute -bottom-1 -right-1 bg-slate-900 rounded-full p-1 border border-slate-800">
                                                <Flame size={12} color={COLORS.emeraldLight} />
                                            </View>
                                        )}
                                    </View>

                                    {/* Nome curto abaixo da bolinha para manter o carrossel limpo. */}
                                    <Text className="text-xs text-slate-200 text-center" numberOfLines={1}>
                                        {member.userData?.nome_usuario || "Sem nome"}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>

                {/* Browse Groups CTA */}
                <View className="px-4 mt-4 mb-6">
                    <TouchableOpacity
                        onPress={() => router.push("/browse-groups")}
                        className="flex-row items-center gap-4 p-4 rounded-2xl border border-brand-500/30"
                        style={{ backgroundColor: "rgba(247, 152, 44, 0.1)" }}
                    >
                        <View
                            className="w-12 h-12 rounded-xl items-center justify-center"
                            style={{ backgroundColor: "rgba(247, 152, 44, 0.15)" }}
                        >
                            <Compass size={24} color={COLORS.violetLight} />
                        </View>
                        <View className="flex-1">
                            <Text className="font-medium text-slate-200">Grupos Públicos</Text>
                            <Text className="text-xs text-slate-400">Encontre e entre em grupos de estudo</Text>
                        </View>
                        <ChevronRight size={20} color={COLORS.violetLight} />
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* User Detail Modal */}
            <Modal
                visible={!!selectedMember}
                transparent
                animationType="fade"
                onRequestClose={() => setSelectedMember(null)}
            >
                <View className="flex-1 bg-black/60 justify-center items-center px-6">
                    <View className="bg-slate-900 w-full rounded-3xl p-6 border border-slate-800">
                        <View className="items-center mb-6">
                            <Avatar
                                foto={selectedMember?.userData?.foto_usuario}
                                nome={selectedMember?.userData?.nome_usuario}
                                size={100}
                                showOnlineDot={onlineUsers.includes(selectedMember?.user_id || selectedMember?.userData?.id)}
                            />
                            <Text className="text-2xl font-bold text-slate-200 mt-4 text-center">
                                {selectedMember?.userData?.nome_usuario || "Sem nome"}
                            </Text>
                            {selectedMember?.administrador && (
                                <View className="bg-amber-500/10 px-3 py-1 rounded-full mt-2 border border-amber-500/20">
                                    <Text className="text-amber-400 text-xs font-bold">ADMINISTRADOR</Text>
                                </View>
                            )}
                        </View>

                        <View className="flex-row gap-4 mb-6">
                            <View className="flex-1 bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 items-center">
                                <Text className="text-slate-400 text-xs mb-1">Ranking</Text>
                                <Text className="text-xl font-bold text-slate-200">#{selectedMember?.rank || "-"}</Text>
                            </View>
                            <View className="flex-1 bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 items-center">
                                <Text className="text-slate-400 text-xs mb-1">Sequência</Text>
                                <View className="flex-row items-center gap-1">
                                    <Flame size={18} color={COLORS.emeraldLight} />
                                    <Text className="text-xl font-bold text-emerald-400">{selectedMember?.streak || 0}</Text>
                                </View>
                            </View>
                        </View>

                        <TouchableOpacity
                            onPress={() => setSelectedMember(null)}
                            className="bg-slate-800 py-4 rounded-2xl items-center"
                        >
                            <Text className="text-slate-200 font-semibold text-lg">Fechar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
