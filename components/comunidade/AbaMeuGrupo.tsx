import { useCallback, useEffect, useMemo, useRef, useState } from "react";

//Componentes de Native
import { View, Text, TouchableOpacity, ScrollView, RefreshControl } from "react-native";
import { Users, Plus, Compass } from "@/components/ui/icons";

//Componentes de Expo
import { router, useLocalSearchParams } from "expo-router";

//Constantes
import { HADES } from "@/constants/hades";

//Componentes
import MetaRoadmapGrupo from "@/components/grupo/MetaRoadmapGrupo";
import RankingGrupo, { LinhaRanking } from "@/components/grupo/RankingGrupo";
import CardSessaoGrupo, { FeedVazio } from "@/components/grupo/CardSessaoGrupo";
import MembrosGrupo, { ConviteDestaque, CtaGruposPublicos, MembroCarrossel } from "@/components/grupo/MembrosGrupo";

import { Skeleton, SkeletonCircle } from "@/components/ui/Skeleton";
import { EstadoDeErro } from "@/components/ui/EstadoDeErro";

//Hooks
import { useMembrosGrupo } from "@/hooks/useMembrosGrupo";
import { useDadosCache } from "@/hooks/useDadosCache";
import { useAuth } from "@/hooks/useAuth";
import { useOnlineUsers } from "@/hooks/useOnlineUsers";
import { useSessoesAoVivo, useSessoesFoco } from "@/hooks/useSessoesFoco";
import { useExtrasDoFeed } from "@/hooks/useExtrasDoFeed";
import TituloDaSecao from "@/components/grupo/TituloDaSecao";
import { buscarGrupoPorId, horasSemanaisGrupo } from "@/services/grupos";
import { buscarProgressoRoadmapGrupo } from "@/services/roadmapIA";
import { buscarRankingHorasMembros } from "@/services/ranking";
import { RankingMembroComPerfil } from "@/types/ranking";
import { LEADERBOARD_TABS, LeaderboardFilter, formatarMinutos } from "@/constants/ranking";

/**
 * Escopo "Meu grupo" da aba Comunidade — a antiga home de grupo, inteira.
 *
 * Saiu de `app/(tabs)/index.tsx` para virar componente quando a aba passou a abrigar
 * dois escopos; o conteúdo é o mesmo, só o cabeçalho de identidade do grupo desceu para
 * dentro do scroll, já que o alternador de escopo agora ocupa o topo fixo.
 */
export default function AbaMeuGrupo() {
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
    const { dados: dadosGrupo, recarregar: recarregarGrupo, erro: erroGrupo } = useDadosCache(
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

    /*
      Sem isto, uma primeira busca que falhava (rede ainda instável logo depois do login,
      por exemplo) deixava `grupo` nulo pra sempre — e como `carregandoTela` abaixo só olha
      pra `!grupo`, a home ficava travada no skeleton indefinidamente. Só saía voltando pra
      outra aba e de volta, o que refoca a tela e dá mais uma chance pro `useFocusEffect` do
      cache tentar de novo. Aqui a mesma nova tentativa acontece sozinha, sem precisar sair
      da tela — limitada, pra não virar um loop insistindo contra uma queda de rede de
      verdade.
    */
    const tentativasGrupoRef = useRef(0);
    useEffect(() => {
        if (grupo || !erroGrupo) {
            tentativasGrupoRef.current = 0;
            return;
        }
        if (tentativasGrupoRef.current >= 3) return;
        tentativasGrupoRef.current += 1;
        const id = setTimeout(() => {
            recarregarGrupo();
        }, 1500);
        return () => clearTimeout(id);
    }, [erroGrupo, grupo, recarregarGrupo]);

    // Progresso coletivo do roadmap: muda quando qualquer membro marca um bloco, então
    // revalida sempre que a tela volta a focar (mesmo espírito da meta).
    const { dados: progressoRoadmap, recarregar: recarregarRoadmap } = useDadosCache(
        groupId ? `grupo-roadmap:${groupId}` : null,
        () => buscarProgressoRoadmapGrupo(groupId as string),
        { tempoFresco: 0 }
    );

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
                recarregarRoadmap(),
                refreshSessions(),
                refreshAoVivo(),
            ]);
        } finally {
            setAtualizandoTela(false);
        }
    }, [groupId, recarregarGrupo, recarregarMembros, recarregarRoadmap, refreshSessions, refreshAoVivo]);

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

    // Sem grupo nenhum, este escopo não tem o que mostrar: em vez de um esqueleto que
    // nunca resolve, ele convida a criar ou procurar um grupo.
    if (!groupId) {
        return <SemGrupo />;
    }

    if (!grupo && erroGrupo) {
        return (
            <View style={{ flex: 1, backgroundColor: HADES.bg, justifyContent: "center" }}>
                <EstadoDeErro erro={erroGrupo} onTentarNovamente={recarregarGrupo} style={{ marginHorizontal: 20 }} />
            </View>
        );
    }

    if (carregandoTela) {
        return <HomeSkeleton />;
    }

    return (
        <View style={{ flex: 1, backgroundColor: HADES.bg }}>
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 20, paddingTop: 4 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={atualizandoTela}
                        onRefresh={handleRefresh}
                        tintColor={HADES.accentSolid}
                    />
                }
            >
                {/* Identidade do grupo */}
                <View
                    style={{
                        paddingBottom: 14,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                    }}
                >
                </View>

                {grupoSozinho && podeConvidar && <ConviteDestaque onConvidar={abrirConvite} />}

                <MetaRoadmapGrupo
                    percentual={progressoPercentual}
                    horasFeitas={horasSemanaGrupo}
                    metaTotal={metaTotalGrupo}
                    progresso={progressoRoadmap}
                    souAdmin={!!meuVinculo?.administrador}
                    aoGerar={() =>
                        router.push({
                            pathname: "/(modals)/gerar-roadmap",
                            params: {
                                escopo: "grupo",
                                grupoId: groupId as string,
                                grupoNome: grupo?.nome_grupo ?? "",
                            },
                        })
                    }
                    aoAbrirProgresso={() =>
                        router.push({
                            pathname: "/(groups)/roadmap-progresso",
                            params: {
                                grupoId: groupId as string,
                                grupoNome: grupo?.nome_grupo ?? "",
                            },
                        })
                    }
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

        </View>
    );
}

/**
 * Escopo "Meu grupo" de quem ainda não entrou em nenhum: o Explorar continua cheio de
 * conteúdo, então aqui a tela argumenta pelo grupo em vez de mostrar um vazio seco.
 */
function SemGrupo() {
    return (
        <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 28, paddingBottom: 60 }}>
            <View style={{ alignItems: "center", marginBottom: 26 }}>
                <View
                    style={{
                        width: 64,
                        height: 64,
                        borderRadius: 19,
                        backgroundColor: HADES.tintAccent,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Users size={32} color={HADES.accentSolid} />
                </View>
                <Text
                    style={{
                        fontSize: 20,
                        fontWeight: "700",
                        color: "#fff",
                        marginTop: 16,
                        letterSpacing: -0.3,
                    }}
                >
                    Estudar junto rende mais
                </Text>
                <Text
                    style={{
                        fontSize: 13.5,
                        color: HADES.textMuted,
                        marginTop: 8,
                        lineHeight: 21,
                        textAlign: "center",
                    }}
                >
                    Num grupo você acompanha o ranking de horas, vê quem está estudando agora e mantém a meta
                    semanal viva.
                </Text>
            </View>

            <TouchableOpacity
                onPress={() => router.push("/(modals)/create-group")}
                activeOpacity={0.85}
                style={{
                    height: 54,
                    borderRadius: 15,
                    backgroundColor: HADES.accentSolid,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 9,
                    marginBottom: 12,
                }}
            >
                <Plus size={18} color="#000" />
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#000" }}>Criar um grupo</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.08)" }} />
                <Text style={{ fontSize: 12, color: HADES.textDim, fontWeight: "600" }}>ou</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.08)" }} />
            </View>

            <TouchableOpacity
                onPress={() => router.push("/(groups)/browse-groups")}
                activeOpacity={0.85}
                style={{
                    height: 54,
                    borderRadius: 15,
                    backgroundColor: HADES.surfaceRaised,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.08)",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 9,
                }}
            >
                <Compass size={18} color={HADES.textSecondary} />
                <Text style={{ fontSize: 15, fontWeight: "600", color: HADES.text }}>
                    Procurar grupos públicos
                </Text>
            </TouchableOpacity>
        </View>
    );
}

/** Placeholder da home enquanto grupo, membros e ranking ainda não resolveram. */
function HomeSkeleton() {
    return (
        <View style={{ flex: 1, backgroundColor: HADES.bg }}>
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 20, paddingTop: 4 }}
                showsVerticalScrollIndicator={false}
            >
                {/*
                  Só o respiro: o cabeçalho (hambúrguer, foto do grupo, sino) vive na tab e
                  fica na tela durante o carregamento — desenhá-lo aqui duplicava a faixa e
                  empurrava todo o resto 21px para baixo quando os dados chegavam.
                */}
                <View style={{ paddingBottom: 14 }} />

                {/* Meta da semana + roadmap, no molde do novo cartão único */}
                <View
                    style={{
                        backgroundColor: HADES.surface,
                        borderWidth: 1,
                        borderColor: HADES.border,
                        borderRadius: 16,
                        overflow: "hidden",
                        marginBottom: 18,
                    }}
                >
                    <View
                        style={{
                            paddingVertical: 15,
                            paddingHorizontal: 16,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 14,
                        }}
                    >
                        <SkeletonCircle size={46} hades />
                        <View style={{ flex: 1, gap: 6 }}>
                            <Skeleton width={108} height={10} hades />
                            <Skeleton width={112} height={20} hades />
                        </View>
                        <View style={{ alignItems: "flex-end", gap: 6 }}>
                            <Skeleton width={42} height={16} hades />
                            <Skeleton width={48} height={10} hades />
                        </View>
                    </View>
                    <View style={{ height: 1, backgroundColor: HADES.border }} />
                    <View
                        style={{
                            paddingVertical: 12,
                            paddingHorizontal: 16,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}
                    >
                        <View style={{ flex: 1, gap: 6 }}>
                            <Skeleton width={64} height={10} hades />
                            <Skeleton width={150} height={14} hades />
                        </View>
                        <Skeleton width={88} height={11} hades />
                    </View>
                </View>

                {/* Ranking: título + pílula de filtro, e o pódio compacto com as barras */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginTop: 15,
                        marginBottom: 14,
                    }}
                >
                    <Skeleton width={78} height={16} hades />
                    <Skeleton width={112} height={29} borderRadius={9} hades />
                </View>

                {/* Medidas de TAMANHOS.compacta em PodioRanking, na ordem 2º / 1º / 3º. */}
                <View style={{ paddingTop: 22, paddingHorizontal: 4, marginBottom: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 9 }}>
                        {[
                            { avatar: 52, barra: 58 },
                            { avatar: 64, barra: 84 },
                            { avatar: 52, barra: 46 },
                        ].map(({ avatar, barra }, i) => (
                            <View key={i} style={{ flex: 1, alignItems: "center" }}>
                                {i === 1 && (
                                    <Skeleton width={20} height={20} hades style={{ marginBottom: 5 }} />
                                )}
                                <SkeletonCircle size={avatar} hades />
                                <Skeleton
                                    width={58}
                                    height={i === 1 ? 13.5 : 12.5}
                                    hades
                                    style={{ marginTop: 8 }}
                                />
                                <Skeleton
                                    width={38}
                                    height={i === 1 ? 13 : 12}
                                    hades
                                    style={{ marginTop: 2 }}
                                />
                                <Skeleton
                                    width="100%"
                                    height={barra}
                                    borderRadius={12}
                                    hades
                                    style={{ marginTop: 9, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
                                />
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
                            <Skeleton width={18} height={14} hades />
                            <SkeletonCircle size={38} hades />
                            <View style={{ flex: 1, gap: 3 }}>
                                <Skeleton width="55%" height={14} hades />
                                <Skeleton width={72} height={11} hades />
                            </View>
                            <Skeleton width={40} height={14} hades />
                        </View>
                    ))}
                </View>

                {/* "Ver ranking completo" */}
                <View style={{ alignItems: "center", paddingVertical: 14 }}>
                    <Skeleton width={132} height={13} hades />
                </View>

                {/* Atividades: título + "Ver tudo", e os cards do próprio feed */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginTop: 22,
                        marginBottom: 12,
                    }}
                >
                    <Skeleton width={88} height={16} hades />
                    <Skeleton width={54} height={12.5} hades />
                </View>
                <View style={{ marginBottom: 22 }}>
                    <FeedVazio carregando />
                </View>

                {/* Membros */}
                <Skeleton width={100} height={16} hades style={{ marginTop: 10, marginBottom: 17 }} />
                <View style={{ flexDirection: "row", gap: 14, marginBottom: 22 }}>
                    {[0, 1, 2, 3].map((i) => (
                        <View key={i} style={{ width: 60, alignItems: "center", gap: 7 }}>
                            <SkeletonCircle size={56} hades />
                            <Skeleton width={44} height={11} hades />
                        </View>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}
