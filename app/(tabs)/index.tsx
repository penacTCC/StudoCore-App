import { useCallback, useMemo, useState } from "react";

//Componentes de Native
import { View, Text, TouchableOpacity, ScrollView, Image, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronDown, Users, Settings, FolderArchive } from "lucide-react-native";

//Componentes de Expo
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";

//Constantes
import { HADES } from "@/constants/hades";

//Componentes
import MetaGrupo from "@/components/grupo/MetaGrupo";
import RankingGrupo, { LinhaRanking } from "@/components/grupo/RankingGrupo";
import CardSessaoGrupo, { FeedVazio } from "@/components/grupo/CardSessaoGrupo";
import MembrosGrupo, { ConviteDestaque, CtaGruposPublicos, MembroCarrossel } from "@/components/grupo/MembrosGrupo";
import { Skeleton, SkeletonCircle } from "@/components/ui/Skeleton";

//Hooks
import { useMembrosGrupo } from "@/hooks/useMembrosGrupo";
import { useDadosCache } from "@/hooks/useDadosCache";
import { useAuth } from "@/hooks/useAuth";
import { useOnlineUsers } from "@/hooks/useOnlineUsers";
import { useSessoesAoVivo, useSessoesFoco } from "@/hooks/useSessoesFoco";
import { useExtrasDoFeed } from "@/hooks/useExtrasDoFeed";
import TituloDaSecao from "@/components/grupo/TituloDaSecao";
import { buscarGrupoPorId, horasSemanaisGrupo } from "@/services/grupos";
import { buscarRankingHorasMembros } from "@/services/ranking";
import { RankingMembroComPerfil } from "@/types/ranking";
import { LEADERBOARD_TABS, LeaderboardFilter, formatarMinutos } from "@/constants/ranking";

export default function GroupScreen() {
    const [leaderboardFilter, setLeaderboardFilter] = useState<LeaderboardFilter>("semanal");
    const [showLeaderboardFilters, setShowLeaderboardFilters] = useState(false);
    // Captura os parâmetros recebidos da tela anterior
    const {groupId,} = useLocalSearchParams(); //<- os parametros

    /*
      Dados do grupo e progresso da semana vêm juntos, do cache.

      Eram três efeitos separados — um para o grupo, dois quase idênticos para as horas
      (um na montagem, outro no foco) — e todos começavam do zero a cada vez que a home
      voltava, o que deixava a meta piscando. Uma chave só, buscada em paralelo, resolve
      as duas coisas.
    */
    const { dados: dadosGrupo, recarregar: recarregarGrupo } = useDadosCache(
        groupId ? `grupo-home:${groupId}` : null,
        async () => {
            const [grupo, horas] = await Promise.all([
                buscarGrupoPorId(groupId as string),
                horasSemanaisGrupo(groupId as string),
            ]);
            return { grupo, horas };
        },
        // O progresso muda a cada sessão encerrada por qualquer membro — inclusive a que o
        // próprio usuário acabou de fazer antes de voltar pra home. Revalida sempre.
        { tempoFresco: 0 }
    );

    const grupo = dadosGrupo?.grupo ?? null;
    const horasSemanaGrupo = dadosGrupo?.horas ?? 0;

    //Pega os membros do grupo
    const { membros, carregando: carregandoMembros, recarregar: recarregarMembros } = useMembrosGrupo({ grupoId: groupId as string });

    //Pega o usuário atual
    const { userId } = useAuth();

    //Pega a quantidade de usuários online
    const { onlineUsers } = useOnlineUsers(groupId as string);

    /*
      O feed da home junta quem está focando agora com as sessões já encerradas, em vez de
      escolher um ou outro: antes, uma única sessão ao vivo (inclusive uma esquecida
      aberta) fazia a home mostrar SÓ o feed ao vivo, e a sessão que o usuário acabara de
      encerrar não aparecia — só aparecia em "ver todas as atividades".
    */
    const { sessoes: sessoesAoVivo, loading: loadingAoVivo, refresh: refreshAoVivo } = useSessoesAoVivo(5, groupId as string);
    const { sessions, loading: loadingSessions, refresh: refreshSessions } = useSessoesFoco(5, groupId as string);

    //Controla o estado do pull-to-refresh
    const [atualizandoTela, setAtualizandoTela] = useState(false);

    const sessoesDoFeed = useMemo(() => {
        // A mesma sessão pode estar nas duas listas por um instante (ela acabou de encerrar
        // e o feed ao vivo ainda não voltou): o ao vivo tem prioridade e o id evita repetir.
        const idsAoVivo = new Set(sessoesAoVivo.map((sessao) => sessao.id));
        return [...sessoesAoVivo, ...sessions.filter((sessao) => !idsAoVivo.has(sessao.id))];
    }, [sessoesAoVivo, sessions]);

    /*
      Cota por seção em vez de um `slice(0, 2)` no feed inteiro.

      Com o corte simples, duas sessões ao vivo empurravam TODO o histórico para fora e a
      home nunca mostrava o que o grupo já concluiu — inclusive a sessão que a pessoa
      acabou de encerrar. Agora o ao vivo cede uma vaga: pelo menos uma encerrada aparece
      sempre que existir uma.
    */
    const { aoVivoVisiveis, encerradasVisiveis, sessoesVisiveis } = useMemo(() => {
        const aoVivo = sessoesDoFeed.filter(
            (sessao) => !sessao.concluido_em && (sessao.status === "ativo" || sessao.status === "pausado")
        );
        const encerradas = sessoesDoFeed.filter((sessao) => !aoVivo.includes(sessao));

        const TOTAL = 3;
        const cotaEncerradas = Math.min(encerradas.length, 1);
        const visiveisAoVivo = aoVivo.slice(0, TOTAL - cotaEncerradas);
        const visiveisEncerradas = encerradas.slice(0, TOTAL - visiveisAoVivo.length);

        return {
            aoVivoVisiveis: visiveisAoVivo,
            encerradasVisiveis: visiveisEncerradas,
            sessoesVisiveis: [...visiveisAoVivo, ...visiveisEncerradas],
        };
    }, [sessoesDoFeed]);

    // Participantes e fotos das sessões visíveis — em lote, não uma busca por card.
    const extrasDoFeed = useExtrasDoFeed(sessoesVisiveis);

    const carregandoFeed = loadingAoVivo || loadingSessions;

    /*
      Ranking: a busca depende só do grupo e do filtro; o cruzamento com os membros é
      cálculo local.

      Antes as duas coisas viviam no mesmo efeito, com `membros` na lista de dependências
      — como o hook devolvia um array novo a cada busca, a RPC do ranking era refeita toda
      vez que os membros recarregavam, mesmo sem nada ter mudado.
    */
    const { dados: rankingBruto } = useDadosCache(
        groupId ? `ranking-horas:${groupId}:${leaderboardFilter}` : null,
        () => buscarRankingHorasMembros(groupId as string, leaderboardFilter),
        { tempoFresco: 15_000 }
    );

    const rankingMembros: RankingMembroComPerfil[] = useMemo(() => {
        const ranking = rankingBruto ?? [];

        const rankingComMembros = ranking.map((item) => ({
            ...item,
            membro: membros.find((m) => m.user_id === item.user_id),
        }));

        const membrosSemRanking = membros
            .filter((membro) => !ranking.some((item) => item.user_id === membro.user_id))
            .map((membro) => ({
                user_id: membro.user_id,
                total_minutos: 0,
                membro,
            }));

        return [...rankingComMembros, ...membrosSemRanking];
    }, [rankingBruto, membros]);

    // Atualiza todos os dados da tela quando o usuário puxa para atualizar.
    const handleRefresh = useCallback(async () => {
        if (!groupId) return;
        setAtualizandoTela(true);
        try {
            await Promise.all([
                recarregarGrupo(),
                recarregarMembros(),
                refreshSessions(),
                refreshAoVivo(),
            ]);
        } finally {
            setAtualizandoTela(false);
        }
    }, [groupId, recarregarGrupo, recarregarMembros, refreshSessions, refreshAoVivo]);

    //Cálculo do progresso do grupo
    const metaPorMembro = Number(Array.isArray(grupo?.meta_horas) ? grupo.meta_horas[0] : grupo?.meta_horas) || 0
    const totalMembros = membros.length

    const metaTotalGrupo = metaPorMembro * totalMembros

    const progressoGrupo = metaTotalGrupo > 0 ? horasSemanaGrupo / metaTotalGrupo : 0

    const progressoPercentual = Math.min(Math.round(progressoGrupo * 100), 100)
    const activeLeaderboardFilter = LEADERBOARD_TABS.find((tab) => tab.key === leaderboardFilter);

    // Grupo recém-criado: a tela convida a chamar gente em vez de mostrar um ranking de um.
    const grupoSozinho = totalMembros <= 1;

    /*
      Convidar é do administrador. Ele pode passar a permissão para quem quiser, membro a
      membro, nas configurações do grupo — quem não recebeu não vê os caminhos de convite.
      A regra de verdade está na RPC `definir_codigo_convite`; aqui é só o que a tela mostra.
    */
    const meuVinculo = membros.find((membro) => membro.user_id === userId);
    const podeConvidar = !!meuVinculo && (meuVinculo.administrador || !!meuVinculo.pode_convidar);

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

    // Só considera carregado quando o grupo e os membros já resolveram — evita
    // piscar "Nome não encontrado" e um ranking vazio antes da 1ª resposta.
    const carregandoTela = !grupo || carregandoMembros;

    if (carregandoTela) {
        return <HomeSkeleton />;
    }

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

                {/*
                  Sem gate de admin: esta é a única porta para "Sair do grupo", e escondê-la
                  de quem não é administrador deixava o membro comum preso no grupo sem
                  nenhuma saída pela interface. A tela de configurações esconde por conta
                  própria o que é exclusivo do administrador.
                */}
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
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 20, paddingTop: 10 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={atualizandoTela}
                        onRefresh={handleRefresh}
                        tintColor={HADES.accentSolid}
                    />
                }
            >
                {grupoSozinho && podeConvidar && <ConviteDestaque onConvidar={abrirConvite} />}

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
                    {/*
                      O selo "ao vivo" saiu daqui: quem diz o estado agora é o cabeçalho
                      AGORA da própria seção, logo abaixo — do contrário a home anunciaria
                      duas vezes a mesma coisa, que é o ruído que o redesenho corta.
                    */}
                    <Text
                        style={{ fontSize: 16, fontWeight: "700", color: HADES.text, letterSpacing: -0.2 }}
                    >
                        Atividades
                    </Text>

                    {sessoesDoFeed.length > 0 && (
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
                    {carregandoFeed ? (
                        <FeedVazio carregando />
                    ) : sessoesDoFeed.length === 0 ? (
                        <FeedVazio />
                    ) : (
                        <View style={{ gap: 18 }}>
                            {/*
                              Mesmas seções da tela de sessões, em miniatura: aqui o feed é
                              uma prévia de duas linhas, então o histórico não se divide por
                              dia — vira só "RECENTES".
                            */}
                            {aoVivoVisiveis.length > 0 && (
                                <View style={{ gap: 10 }}>
                                    <TituloDaSecao label="AGORA" aoVivo contagem={aoVivoVisiveis.length} />
                                    {aoVivoVisiveis.map((session) => (
                                        <CardSessaoGrupo
                                            key={session.id}
                                            sessao={session}
                                            participantes={extrasDoFeed.participantesDe(session)}
                                            fotoUrl={extrasDoFeed.fotoDe(session)}
                                            usuarioId={userId}
                                        />
                                    ))}
                                </View>
                            )}

                            {encerradasVisiveis.length > 0 && (
                                <View style={{ gap: 8 }}>
                                    <TituloDaSecao label="RECENTES" />
                                    {encerradasVisiveis.map((session) => (
                                        <CardSessaoGrupo
                                            key={session.id}
                                            sessao={session}
                                            participantes={extrasDoFeed.participantesDe(session)}
                                            fotoUrl={extrasDoFeed.fotoDe(session)}
                                            usuarioId={userId}
                                        />
                                    ))}
                                </View>
                            )}
                        </View>
                    )}
                </View>

                <MembrosGrupo
                    membros={membrosCarrossel}
                    podeConvidar={podeConvidar}
                    onConvidar={abrirConvite}
                    onAbrirMembro={(membro) => abrirMembro(membro.userId, membro.admin)}
                />

                <CtaGruposPublicos onPress={() => router.push("/browse-groups")} />
            </ScrollView>
        </SafeAreaView>
    );
}

/** Placeholder da home enquanto grupo, membros e ranking ainda não resolveram. */
function HomeSkeleton() {
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top"]}>
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
                <Skeleton width={44} height={44} borderRadius={12} hades />
                <Skeleton width={140} height={21} borderRadius={6} hades style={{ flex: 1 }} />
                <SkeletonCircle size={38} hades />
                <SkeletonCircle size={38} hades />
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 20, paddingTop: 10 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Meta do grupo */}
                <View
                    style={{
                        borderWidth: 1,
                        borderColor: HADES.border,
                        borderRadius: 16,
                        paddingVertical: 15,
                        paddingHorizontal: 16,
                        marginBottom: 18,
                        gap: 11,
                    }}
                >
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Skeleton width={100} height={14} hades />
                        <Skeleton width={70} height={13} hades />
                    </View>
                    <Skeleton width="100%" height={9} borderRadius={5} hades />
                    <Skeleton width={120} height={12} hades />
                </View>

                {/* Ranking */}
                <Skeleton width={90} height={16} hades style={{ marginTop: 15, marginBottom: 14 }} />
                <View style={{ flexDirection: "row", justifyContent: "center", gap: 14, marginBottom: 16 }}>
                    <SkeletonCircle size={56} hades />
                    <SkeletonCircle size={68} hades />
                    <SkeletonCircle size={56} hades />
                </View>
                <View
                    style={{
                        backgroundColor: HADES.surface,
                        borderWidth: 1,
                        borderColor: HADES.border,
                        borderRadius: 16,
                        paddingVertical: 4,
                        paddingHorizontal: 12,
                    }}
                >
                    {[0, 1].map((i) => (
                        <View
                            key={i}
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 12,
                                paddingVertical: 11,
                                borderBottomWidth: i === 0 ? 1 : 0,
                                borderBottomColor: "rgba(255,255,255,0.05)",
                            }}
                        >
                            <SkeletonCircle size={38} hades />
                            <Skeleton width="45%" height={14} hades style={{ flex: 1 }} />
                            <Skeleton width={40} height={14} hades />
                        </View>
                    ))}
                </View>

                {/* Atividades */}
                <Skeleton width={110} height={16} hades style={{ marginTop: 22, marginBottom: 12 }} />
                <View style={{ gap: 10, marginBottom: 22 }}>
                    {[0, 1].map((i) => (
                        <View
                            key={i}
                            style={{
                                backgroundColor: HADES.surface,
                                borderWidth: 1,
                                borderColor: HADES.border,
                                borderRadius: 16,
                                padding: 14,
                                gap: 12,
                            }}
                        >
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
                                <SkeletonCircle size={30} hades />
                                <Skeleton width={100} height={13} hades />
                            </View>
                            <Skeleton width="70%" height={13} hades />
                            <Skeleton width="100%" height={30} hades />
                        </View>
                    ))}
                </View>

                {/* Membros */}
                <Skeleton width={100} height={16} hades style={{ marginBottom: 17 }} />
                <View style={{ flexDirection: "row", gap: 14 }}>
                    {[0, 1, 2, 3].map((i) => (
                        <View key={i} style={{ alignItems: "center", gap: 6 }}>
                            <SkeletonCircle size={54} hades />
                            <Skeleton width={40} height={10} hades />
                        </View>
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
