import { useCallback, useEffect, useState } from "react";

//Componentes de Native
import { View, Text, TouchableOpacity, ScrollView, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronDown, Users, Settings, FolderArchive } from "lucide-react-native";

//Componentes de Expo
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

//Constantes
import { HADES } from "@/constants/hades";

//Componentes
import MetaGrupo from "@/components/grupo/MetaGrupo";
import RankingGrupo, { LinhaRanking } from "@/components/grupo/RankingGrupo";
import CardSessaoGrupo, { FeedVazio } from "@/components/grupo/CardSessaoGrupo";
import MembrosGrupo, { ConviteDestaque, CtaGruposPublicos, MembroCarrossel } from "@/components/grupo/MembrosGrupo";

//Hooks
import { useMembrosGrupo } from "@/hooks/useMembrosGrupo";
import { useAuth } from "@/hooks/useAuth";
import { useOnlineUsers } from "@/hooks/useOnlineUsers";
import { useSessoesFoco } from "@/hooks/useSessoesFoco";
import { buscarGrupoPorId, horasSemanaisGrupo } from "@/services/grupos";
import { buscarRankingHorasMembros } from "@/services/ranking";
import { RankingMembroComPerfil } from "@/types/ranking";
import { Grupo } from "@/types/grupos";
import { LEADERBOARD_TABS, LeaderboardFilter, formatarMinutos } from "@/constants/ranking";

export default function GroupScreen() {
    const [leaderboardFilter, setLeaderboardFilter] = useState<LeaderboardFilter>("semanal");
    const [showLeaderboardFilters, setShowLeaderboardFilters] = useState(false);
    const [horasSemanaGrupo, setHorasSemanaGrupo] = useState(0)
    const [rankingMembros, setRankingMembros] = useState<RankingMembroComPerfil[]>([])
    const [grupo, setGroup] = useState<Grupo | null>(null)

    // Captura os parâmetros recebidos da tela anterior
    const {groupId,} = useLocalSearchParams(); //<- os parametros

    useEffect(() => {
        if(!groupId) return
        const loadGroup = async () => {
            const grupo = await buscarGrupoPorId(groupId as string);
            setGroup(grupo);
            console.log('Código do grupo: ' + grupo?.codigo_convite)
        };
        loadGroup();
    }, [groupId]);

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

    //Chama função rpc do supabase
    useEffect(() => {
        const carregarRankingHoras = async () => {
            if (!groupId) return;

            const ranking = await buscarRankingHorasMembros(groupId as string, leaderboardFilter)

            const rankingComMembros = ranking.map((item) => {
                const membro = membros.find((m) => m.user_id === item.user_id);

                return {
                    ...item,
                    membro
                }
            })

            const membrosSemRanking = membros
                .filter((membro) => !ranking.some((item) => item.user_id === membro.user_id))
                .map((membro) => ({
                    user_id: membro.user_id,
                    total_minutos: 0,
                    membro,
                }));

            setRankingMembros([...rankingComMembros, ...membrosSemRanking])
        }
        carregarRankingHoras();
    }, [groupId, leaderboardFilter, membros])

    //Cálculo do progresso do grupo
    const metaPorMembro = Number(Array.isArray(grupo?.meta_horas) ? grupo.meta_horas[0] : grupo?.meta_horas) || 0
    const totalMembros = membros.length

    const metaTotalGrupo = metaPorMembro * totalMembros

    const progressoGrupo = metaTotalGrupo > 0 ? horasSemanaGrupo / metaTotalGrupo : 0

    const progressoPercentual = Math.min(Math.round(progressoGrupo * 100), 100)
    const activeLeaderboardFilter = LEADERBOARD_TABS.find((tab) => tab.key === leaderboardFilter);

    // Grupo recém-criado: a tela convida a chamar gente em vez de mostrar um ranking de um.
    const grupoSozinho = totalMembros <= 1;

    const linhasRanking: LinhaRanking[] = rankingMembros
        .filter((item) => item.membro)
        .map((item) => ({
            userId: item.user_id,
            nome: item.membro!.userData?.nome_usuario || "Sem nome",
            foto: item.membro!.userData?.foto_usuario,
            minutos: item.total_minutos,
            ofensiva: item.membro!.ofensiva ?? 0,
            admin: !!item.membro!.administrador,
            online: onlineUsers.includes(item.user_id),
            ehVoce: item.user_id === userId,
        }));

    const membrosCarrossel: MembroCarrossel[] = membros.map((membro) => ({
        id: membro.id,
        userId: membro.user_id,
        nome: membro.userData?.nome_usuario || "Sem nome",
        foto: membro.userData?.foto_usuario,
        admin: !!membro.administrador,
        ofensiva: membro.ofensiva ?? 0,
        online: onlineUsers.includes(membro.user_id),
    }));

    const abrirConvite = () =>
        router.push({
            pathname: "/invite",
            params: {
                grupoId: groupId as string,
                grupoCode: grupo?.codigo_convite,
            }
        });

    const abrirMembro = (userIdMembro: string, administrador: boolean, rank?: number) =>
        router.push({
            pathname: "/(modals)/member-profile",
            params: {
                userId: userIdMembro,
                administrador: String(administrador),
                ...(rank ? { rank: String(rank) } : {}),
            },
        });

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top"]}>
            {/* Header */}
            <View
                style={{
                    paddingTop: 15,
                    paddingHorizontal: 18,
                    paddingBottom: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                }}
            >
                <View
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        overflow: "hidden",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    {grupo?.foto_grupo ? (
                        <Image
                            source={{ uri: Array.isArray(grupo?.foto_grupo) ? grupo?.foto_grupo[0] : grupo?.foto_grupo }}
                            style={{ width: "100%", height: "100%" }}
                            resizeMode="cover"
                        />
                    ) : (
                        <LinearGradient
                            colors={["#1c2a4a", "#0e1730"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{ width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}
                        >
                            <Users size={22} color={HADES.subjectBlue} />
                        </LinearGradient>
                    )}
                </View>

                <TouchableOpacity
                    onPress={() => router.push("/(groups)")}
                    activeOpacity={0.7}
                    style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                    <Text
                        style={{ fontSize: 21, fontWeight: "700", color: HADES.text, letterSpacing: -0.3, flexShrink: 1 }}
                        numberOfLines={1}
                    >
                        {grupo?.nome_grupo || "Nome não encontrado"}
                    </Text>
                    <ChevronDown size={18} color={HADES.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => router.push("/(tabs)/vault")}
                    activeOpacity={0.8}
                    style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: HADES.surfaceRaised,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <FolderArchive size={18} color={HADES.textSecondary} />
                </TouchableOpacity>

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
                        activeOpacity={0.8}
                        style={{
                            width: 38,
                            height: 38,
                            borderRadius: 19,
                            backgroundColor: HADES.surfaceRaised,
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <Settings size={18} color={HADES.textSecondary} />
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 20, paddingTop: 10 }}
                showsVerticalScrollIndicator={false}
            >
                {grupoSozinho && <ConviteDestaque onConvidar={abrirConvite} />}

                <MetaGrupo
                    percentual={progressoPercentual}
                    horasFeitas={horasSemanaGrupo}
                    metaTotal={metaTotalGrupo}
                    metaPorMembro={metaPorMembro}
                />

                <RankingGrupo
                    linhas={linhasRanking}
                    filtros={LEADERBOARD_TABS}
                    filtroAtivo={leaderboardFilter}
                    filtrosAbertos={showLeaderboardFilters}
                    rotuloFiltro={activeLeaderboardFilter?.label ?? "Filtro"}
                    formatarMinutos={formatarMinutos}
                    onToggleFiltros={() => setShowLeaderboardFilters((current) => !current)}
                    onSelecionarFiltro={(key) => setLeaderboardFilter(key as LeaderboardFilter)}
                    onVerRankingCompleto={() =>
                        router.push({
                            pathname: "/ranking-completo",
                            params: {
                                groupId: groupId as string,
                                filtro: leaderboardFilter,
                                grupoNome: grupo?.nome_grupo ?? "",
                            },
                        })
                    }
                    onAbrirMembro={(linha, rank) => abrirMembro(linha.userId, linha.admin, rank)}
                />

                {/* Atividades ao vivo */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginTop: 22,
                        marginBottom: 12,
                    }}
                >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text
                            style={{ fontSize: 16, fontWeight: "700", color: HADES.text, letterSpacing: -0.2 }}
                        >
                            Atividades
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                            <View
                                style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: HADES.green }}
                            />
                            <Text style={{ fontSize: 11, color: HADES.green, fontWeight: "600" }}>ao vivo</Text>
                        </View>
                    </View>

                    {sessions.length > 0 && (
                        <TouchableOpacity
                            onPress={() => router.push({ pathname: "/detailing", params: { groupId: groupId as string } })}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Text style={{ fontSize: 12.5, color: HADES.textMuted, fontWeight: "600" }}>
                                Ver tudo
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={{ gap: 10, marginBottom: 22 }}>
                    {loadingSessions ? (
                        <FeedVazio carregando />
                    ) : sessions.length === 0 ? (
                        <FeedVazio />
                    ) : (
                        sessions.slice(0, 2).map((session) => (
                            <CardSessaoGrupo key={session.id} sessao={session} />
                        ))
                    )}
                </View>

                <MembrosGrupo
                    membros={membrosCarrossel}
                    onConvidar={abrirConvite}
                    onAbrirMembro={(membro) => abrirMembro(membro.userId, membro.admin)}
                />

                <CtaGruposPublicos onPress={() => router.push("/browse-groups")} />
            </ScrollView>
        </SafeAreaView>
    );
}
