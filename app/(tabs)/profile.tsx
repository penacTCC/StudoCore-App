import { Fragment, useState, useMemo, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView, DeviceEventEmitter, RefreshControl } from "react-native";
import { SafeAreaView } from "@/components/ui/TelaSegura";
import {
    Settings, Maximize2, Users, ChevronRight, FolderArchive,
    Image as ImageIcon, Flame, Pencil, PartyPopper, Plus,
} from "@/components/ui/icons";
import { router, useFocusEffect } from "expo-router";
import { HADES } from "@/constants/hades";
import { useAuth } from "@/hooks/useAuth";
import { useMaterias } from "@/hooks/useMaterias";
import { APP_BADGES, BadgeType } from "@/constants/badges";
import { getIdentityColor, getBioFromObjetivo } from "@/constants/helpers";
import { loadProfileStats, updateFavoriteSubject, updateWeeklyGoal } from "@/services/profileStats";
import { buscarGamificacao } from "@/services/gamificacao";
import { UserStats } from "@/types/profile";
import { buscarPerfil } from "@/services/auth";
import type { Profile } from "@/types/profile";
import { AvatarComOfensiva, BannerPerfil } from "@/components/profile/PerfilBanner";
import CardMedalhas, { CardMedalhasVazio } from "@/components/profile/CardMedalhas";
import MetaSemanalVazia, { HeatmapVazio } from "@/components/profile/PrimeirosPassos";
import { GradeHeatmap, LegendaHeatmap } from "@/components/profile/Heatmap";
import GaleriaSessoes from "@/components/profile/GaleriaSessoes";
import { contarFotosDoUsuario } from "@/services/fotosSessao";
import {
    ModalMetaSemanal,
    SheetMateriaFavorita,
    ModalHeatmap,
} from "@/components/profile/ModaisPerfil";
import { Skeleton, SkeletonCircle } from "@/components/ui/Skeleton";
import { useDadosCache } from "@/hooks/useDadosCache";
import { toast } from "@/services/toast";
import { confirm } from "@/services/confirm";

const BANNER_H = 176;
const AVATAR_SIZE = 100;

const sechStyle = {
    fontSize: 11.5,
    fontWeight: "700" as const,
    color: HADES.textMuted,
    letterSpacing: 0.8,
    textTransform: "uppercase" as const,
};

function getBadgeProgress(badge: BadgeType, stats: UserStats): number {
    switch (badge.requirementType) {
        case 'hours':       return Math.min(stats.totalHours / badge.requirementValue, 1);
        case 'questions':   return Math.min(stats.totalQuestions / badge.requirementValue, 1);
        case 'weekly_goal': return Math.min(stats.weeklyCurrent / stats.weeklyGoal, 1);
        case 'sessions':    return Math.min(stats.totalSessions / badge.requirementValue, 1);
        default: return 0;
    }
}

function Divider() {
    return <View style={{ height: 1, backgroundColor: HADES.border, marginVertical: 22 }} />;
}

function StatColuna({ Icone, valor, rotulo, apagado }: { Icone?: typeof Flame; valor: string; rotulo: string; apagado?: boolean }) {
    const cor = apagado ? "#3a3d45" : HADES.text;
    return (
        <View style={{ flex: 1, alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 }}>
                {Icone && <Icone size={16} color={cor} />}
                <Text style={{ fontSize: 21, fontWeight: "700", color: cor, letterSpacing: -0.5 }}>{valor}</Text>
            </View>
            <Text style={{ fontSize: 11, color: HADES.textFaint, marginTop: 3 }}>{rotulo}</Text>
        </View>
    );
}

export default function ProfileScreen() {
    const [showSubjectModal, setShowSubjectModal] = useState(false);
    const [showGoalModal, setShowGoalModal] = useState(false);
    const [tempGoalValue, setTempGoalValue] = useState("");
    const [showHeatmapModal, setShowHeatmapModal] = useState(false);
    const [selectedDayInfo, setSelectedDayInfo] = useState<{ date: Date; hours: number } | null>(null);

    const { user: sessionUser, userId } = useAuth();
    const { materiasComCores, recarregarMaterias } = useMaterias(userId);

    //Controla o estado do pull-to-refresh
    const [atualizando, setAtualizando] = useState(false);

    /*
      As quatro buscas do perfil saem juntas, não em fila.

      Antes elas eram encadeadas (usuário → perfil → gamificação → estatísticas), e como
      cada uma só começava depois da anterior responder, a tela somava quatro latências de
      rede antes de sair do skeleton. Nenhuma delas depende do resultado da outra: só
      precisam do `userId`, que o `useAuth` já entrega. O contador da galeria entrou no
      mesmo lote pelo mesmo motivo — era uma quinta ida solta ao servidor.
    */
    const { dados, recarregar, definir } = useDadosCache(
        userId ? `perfil-completo:${userId}` : null,
        async () => {
            const [perfil, gamificacao, estatisticas, fotos] = await Promise.all([
                buscarPerfil(userId!),
                buscarGamificacao(userId!),
                loadProfileStats(),
                contarFotosDoUsuario(userId!),
            ]);

            return {
                perfil: perfil.data ?? null,
                melhorOfensiva: gamificacao?.melhor_ofensiva ?? 0,
                ofensivaAtual: gamificacao?.ofensiva ?? 0,
                estatisticas,
                totalFotos: fotos,
            };
        },
        /*
          `tempoFresco: 0` = revalida a cada foco. O usuário costuma chegar aqui logo
          depois de encerrar uma sessão, e horas/ofensiva/medalhas precisam estar certas.
          Isso não traz o skeleton de volta: o dado anterior continua na tela enquanto a
          revalidação acontece.
        */
        { tempoFresco: 0 }
    );

    const profileData = dados?.perfil ?? null;
    const stats = dados?.estatisticas ?? null;
    const melhorOfensiva = dados?.melhorOfensiva ?? 0;
    const ofensivaAtual = dados?.ofensivaAtual ?? 0;
    const totalFotos = dados?.totalFotos ?? 0;

    // Desbloquear medalha muda as estatísticas por fora da navegação: força a revalidação.
    useFocusEffect(
        useCallback(() => {
            const sub = DeviceEventEmitter.addListener('badgesUnlocked', () => {
                recarregar();
            });

            return () => sub.remove();
        }, [recarregar])
    );

    const handleRefresh = async () => {
        setAtualizando(true);
        try {
            await Promise.all([recarregar(), recarregarMaterias()]);
        } finally {
            setAtualizando(false);
        }
    };

    /**
     * @constant heatmapMatrix
     * @description Hook computacional (Memoizado) que cria a matriz do Heatmap Estilo-Github.
     * Quebra os últimos 100 dias (14 semanas) em um array 2D de [semanas] x [dias],
     * onde o indíce 0 de cada semana representa o Domingo.
     * Retorna também as posições cravadas dos Tópicos de Meses para as labels no Header.
     */
    const heatmapMatrix = useMemo(() => {
        if (!stats) return { columns: [], monthPositions: [] };

        const NUM_WEEKS = 14;
        const now = new Date();
        const todayJsDay = now.getDay();

        const columns = [];
        const months = new Set();
        const monthPositions = [];

        const totalCells = NUM_WEEKS * 7;
        const emptyCellsAtEnd = 6 - todayJsDay;

        for (let col = 0; col < NUM_WEEKS; col++) {
            const week = [];
            for (let row = 0; row < 7; row++) {
                const cellIndex = col * 7 + row;
                const daysAgo = (totalCells - 1 - emptyCellsAtEnd) - cellIndex;

                if (daysAgo < 0) {
                    week.push({ dateStr: null, intensity: -1 });
                } else {
                    const d = new Date(now);
                    d.setDate(now.getDate() - daysAgo);
                    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

                    const hoursOnDay = stats.studyHistory[dateStr] || 0;
                    let intensity = 0;
                    if (hoursOnDay > 0 && hoursOnDay <= 2) intensity = 0.3;
                    else if (hoursOnDay > 2 && hoursOnDay <= 5) intensity = 0.6;
                    else if (hoursOnDay > 5) intensity = 0.9;

                    week.push({ dateStr, intensity, date: d });

                    if (row === 0) {
                        const monthName = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
                        if (!months.has(monthName)) {
                            months.add(monthName);
                            // Salvamos o array de colunas para colocar a label do mês acima dela
                            monthPositions.push({ colIndex: col, name: monthName });
                        }
                    }
                }
            }
            columns.push(week);
        }

        return { columns, monthPositions };
    }, [stats]);

    // As mutações já devolvem as estatísticas atualizadas: gravamos direto no cache em vez
    // de rebuscar o pacote inteiro do perfil.
    const aplicarEstatisticas = useCallback(
        (atualizadas: UserStats) => {
            if (dados) definir({ ...dados, estatisticas: atualizadas });
        },
        [dados, definir]
    );

    const handleSubjectSelect = async (subjectName: string) => {
        const updated = await updateFavoriteSubject(subjectName);
        aplicarEstatisticas(updated);
        setShowSubjectModal(false);
    };

    const handleGoalSave = async () => {
        const h = parseInt(tempGoalValue, 10);
        if (!isNaN(h) && h > 0) {
            const updated = await updateWeeklyGoal(h);
            aplicarEstatisticas(updated);
        }
        setShowGoalModal(false);
    };

    /**
     * Formata horas decimais em layout legível de tooltip.
     * Exemplo: 4.2 horas -> "4h12m"
     */
    const formatHoursDecimal = (decimalHours: number) => {
        if (decimalHours === 0) return "0h0m";
        const h = Math.floor(decimalHours);
        const m = Math.round((decimalHours - h) * 60);
        if (h === 0) return `${m}m`;
        return `${h}h${m}m`;
    };

    const joinDate = sessionUser?.created_at
        ? new Date(sessionUser.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        : 'Carregando...';

    if (!stats) return <ProfileSkeleton />; // Aguarda dados para não bugar a UI

    const progressPercent = Math.min((stats.weeklyCurrent / stats.weeklyGoal) * 100, 100);
    const metaAtingida = stats.weeklyCurrent >= stats.weeklyGoal;

    const abrirMeta = () => {
        setTempGoalValue(String(stats.weeklyGoal));
        setShowGoalModal(true);
    };

    // Sem nenhuma sessão registrada: a tela mostra um caminho em vez de um boletim de zeros.
    const usuarioNovo = stats.totalSessions === 0;

    const medalhasRecentes = APP_BADGES.filter((b) => stats.badgesUnlocked.includes(b.id)).slice(-6);
    const medalhasProximas = APP_BADGES
        .filter((b) => !stats.badgesUnlocked.includes(b.id))
        .map((b) => ({ badge: b, progress: getBadgeProgress(b, stats) }))
        .filter((x) => x.progress > 0)
        .sort((a, b) => b.progress - a.progress)
        .slice(0, 3);

    const corMateriaFavorita =
        materiasComCores.find((d) => d.nomeExibicao === stats.favoriteSubject)?.cor ?? HADES.subjectBlue;

    const corIdentidade = getIdentityColor(profileData?.nome_usuario);
    // A bio escrita na tela de editar perfil manda; sem ela, o objetivo do onboarding serve de texto.
    const bio = profileData?.bio?.trim() || getBioFromObjetivo(profileData?.objetivo);

    return (
        <View style={{ flex: 1, backgroundColor: HADES.bg }}>
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 28, paddingHorizontal: 20 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={atualizando} onRefresh={handleRefresh} tintColor={HADES.accentSolid} />
                }
            >
                {/* Banner + avatar sobreposto: rolam junto com o resto da tela. As margens
                    negativas cancelam o padding lateral do ScrollView pra capa sangrar de
                    ponta a ponta; a margem de baixo abre espaço pra metade do avatar que
                    o banner projeta pra fora. */}
                <View
                    style={{
                        height: BANNER_H,
                        marginHorizontal: -20,
                        marginBottom: AVATAR_SIZE / 2 + 18,
                    }}
                >
                    <BannerPerfil
                        altura={BANNER_H}
                        cor={corIdentidade}
                        iniciais={(profileData?.nome_usuario ?? "US").slice(0, 2).toUpperCase()}
                        foto={profileData?.foto_usuario}
                    />

                    <SafeAreaView edges={["top"]} style={{ position: "absolute", top: 10, left: 0, right: 0 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 2 }}>
                            <TouchableOpacity />
                            <TouchableOpacity
                                onPress={() => router.push("/(modals)/settings")}
                                activeOpacity={0.8}
                                style={{
                                    width: 36, height: 36, borderRadius: 18,
                                    backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center",
                                }}
                            >
                                <Settings size={16} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </SafeAreaView>

                    <View style={{ position: "absolute", left: 0, right: 0, bottom: -(AVATAR_SIZE / 2 + 4), alignItems: "center" }}>
                        <AvatarComOfensiva
                            tamanho={AVATAR_SIZE}
                            foto={profileData?.foto_usuario}
                            nome={profileData?.nome_usuario}
                            ofensiva={ofensivaAtual}
                            mostrarOfensiva={!usuarioNovo && (profileData?.mostrar_ofensiva ?? true)}
                            badgeEditar={usuarioNovo}
                            onPress={() => router.push("/(modals)/editar-perfil")}
                        />
                    </View>
                </View>

                {/* Identidade */}
                <View style={{ alignItems: "center" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Text style={{ fontSize: 22, fontWeight: "700", color: HADES.text, letterSpacing: -0.3 }}>
                            {profileData?.nome_usuario || "Usuário Convite"}
                        </Text>
                        <TouchableOpacity
                            onPress={() => router.push("/(modals)/editar-perfil")}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Pencil size={16} color={HADES.textMuted} />
                        </TouchableOpacity>
                    </View>
                    <Text style={{ fontSize: 12.5, color: HADES.textFaint, marginTop: 4 }}>
                        Desde {joinDate}
                    </Text>
                    {bio ? (
                        <Text style={{ fontSize: 13, color: HADES.textSecondary, lineHeight: 19, marginTop: 10, textAlign: "center", maxWidth: 280 }}>
                            {bio}
                        </Text>
                    ) : usuarioNovo ? (
                        <TouchableOpacity
                            onPress={() => router.push("/(modals)/editar-perfil")}
                            activeOpacity={0.8}
                            style={{
                                flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12,
                                borderWidth: 1, borderStyle: "dashed", borderColor: HADES.borderDashed,
                                borderRadius: 10, paddingVertical: 8, paddingHorizontal: 13,
                            }}
                        >
                            <Plus size={12} color={HADES.textMuted} />
                            <Text style={{ fontSize: 12.5, color: HADES.textMuted, fontWeight: "600" }}>Adicionar bio</Text>
                        </TouchableOpacity>
                    ) : (
                        <Text style={{ fontSize: 13, color: HADES.textDim, fontStyle: "italic", marginTop: 10 }}>
                            Ainda sem bio.
                        </Text>
                    )}
                </View>

                {/* Estatísticas rápidas */}
                <View
                    style={{
                        flexDirection: "row", alignItems: "stretch", marginTop: 22, paddingVertical: 16,
                        
                    }}
                >
                    <StatColuna valor={`${stats.totalHours}h`} rotulo="estudadas" apagado={usuarioNovo} />
                    <View style={{ width: 1, backgroundColor: HADES.border }} />
                    <StatColuna valor={stats.totalQuestions.toLocaleString("pt-BR")} rotulo="questões" apagado={usuarioNovo} />
                    <View style={{ width: 1, backgroundColor: HADES.border }} />
                    <StatColuna Icone={Flame} valor={String(melhorOfensiva)} rotulo="melhor ofensiva" apagado={usuarioNovo} />
                </View>

                {/* Meta semanal */}
                <View style={{ marginTop: 22 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <Text style={sechStyle}>Meta semanal</Text>
                        {!usuarioNovo && (
                            <TouchableOpacity
                                onPress={abrirMeta}
                                activeOpacity={0.7}
                                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                
                            </TouchableOpacity>
                        )}
                    </View>

                    {usuarioNovo ? (
                        <MetaSemanalVazia onDefinirMeta={abrirMeta} />
                    ) : (
                        <TouchableOpacity onPress={abrirMeta} activeOpacity={0.85}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                                <View style={{ flex: 1, height: 9, borderRadius: 5, backgroundColor: HADES.surfaceOverlay, overflow: "hidden" }}>
                                    <View
                                        style={{
                                            height: "100%", width: `${progressPercent}%`, borderRadius: 5,
                                            backgroundColor: metaAtingida ? HADES.green : HADES.accentSolid,
                                        }}
                                    />
                                </View>
                                <Text style={{ fontSize: 13.5, color: HADES.text, fontWeight: "700", flexShrink: 0 }}>
                                    {stats.weeklyCurrent}h{" "}
                                    <Text style={{ color: HADES.textDim, fontWeight: "500" }}>/ {stats.weeklyGoal}h</Text>
                                </Text>
                            </View>
                            {metaAtingida ? (
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 9 }}>
                                    <Text style={{ fontSize: 12, color: HADES.green, fontWeight: "600" }}>
                                         Meta semanal atingida!
                                    </Text>
                                </View>
                            ) : (
                                <Text style={{ fontSize: 12, color: HADES.textMuted, marginTop: 9 }}>
                                    Faltam <Text style={{ color: HADES.text, fontWeight: "600" }}>{stats.weeklyGoal - stats.weeklyCurrent} horas</Text> para atingir sua meta!
                                </Text>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
                <Divider />

                {/* Histórico */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <Text style={sechStyle}>Histórico</Text>
                    {!usuarioNovo && (
                        <TouchableOpacity
                            onPress={() => setShowHeatmapModal(true)}
                            activeOpacity={0.8}
                            style={{
                                flexDirection: "row", alignItems: "center", gap: 4,
                                backgroundColor: HADES.surfaceOverlay, borderRadius: 8,
                                paddingVertical: 5, paddingHorizontal: 10,
                            }}
                        >
                            <Maximize2 size={11} color={HADES.textSecondary} />
                            <Text style={{ fontSize: 11.5, color: HADES.textSecondary, fontWeight: "600" }}>Expandir</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {usuarioNovo ? (
                    <HeatmapVazio>
                        <GradeHeatmap colunas={heatmapMatrix.columns} monthPositions={[]} />
                    </HeatmapVazio>
                ) : (
                    <>
                        <GradeHeatmap
                            colunas={heatmapMatrix.columns}
                            monthPositions={heatmapMatrix.monthPositions}
                            onSelecionarDia={(dia) => {
                                setSelectedDayInfo({
                                    date: dia.date!,
                                    hours: stats.studyHistory[dia.dateStr!] || 0,
                                });
                                setShowHeatmapModal(true);
                            }}
                        />
                        <LegendaHeatmap />
                    </>
                )}
                <Divider />

                {/* Medalhas */}
                {usuarioNovo ? (
                    <CardMedalhasVazio primeira={APP_BADGES[0]} total={APP_BADGES.length} />
                ) : (
                    <CardMedalhas
                        recentes={medalhasRecentes}
                        proximas={medalhasProximas}
                        desbloqueadas={stats.badgesUnlocked.length}
                        total={APP_BADGES.length}
                        onVerTodas={() => router.push('/(modals)/badges')}
                        colunas={3}
                    />
                )}

                {/* Galeria — as fotos registradas ao fim das sessões. Escondida pra quem
                    ainda não estudou: a etapa da foto só aparece depois de uma sessão. */}
                {!usuarioNovo && userId && (
                    <>
                        <Divider />
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                            <Text style={sechStyle}>Galeria</Text>
                            {totalFotos > 0 && (
                                <Text style={{ fontSize: 11.5, color: HADES.textMuted, fontWeight: "600" }}>
                                    {totalFotos} {totalFotos === 1 ? "registro" : "registros"}
                                </Text>
                            )}
                        </View>
                        {/* 4 = duas linhas no grid de duas colunas. Com 6 a prévia ficaria
                            alta demais no meio do perfil agora que a foto é maior. */}
                        <GaleriaSessoes userId={userId} limite={4} permitirRemover />
                    </>
                )}

                {/* Matéria favorita */}
                {!usuarioNovo && (
                    <>
                        <Divider />
                        <TouchableOpacity
                            onPress={() => setShowSubjectModal(true)}
                            activeOpacity={0.8}
                            style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
                        >
                            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: corMateriaFavorita }} />
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 15, fontWeight: "700", color: corMateriaFavorita }} numberOfLines={1}>
                                    {stats.favoriteSubject}
                                </Text>
                                <Text style={{ fontSize: 11.5, color: HADES.textFaint, marginTop: 1 }}>
                                    Matéria favorita
                                </Text>
                            </View>
                            <ChevronRight size={17} color={HADES.textDim} />
                        </TouchableOpacity>
                    </>
                )}
                <Divider />

                {/* Meus Grupos */}
                <TouchableOpacity
                    onPress={() => router.push("/(groups)")}
                    activeOpacity={0.7}
                    style={{ flexDirection: "row", alignItems: "center", gap: 13 }}
                >
                    <View
                        style={{
                            width: 40, height: 40, borderRadius: 12,
                            backgroundColor: HADES.groupVioletTint, alignItems: "center", justifyContent: "center",
                        }}
                    >
                        <Users size={20} color={HADES.groupViolet} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: "600", color: HADES.text }}>
                            Meus grupos
                        </Text>
                        <Text style={{ fontSize: 12, color: HADES.textFaint, marginTop: 1 }}>
                            {usuarioNovo ? "Você ainda não faz parte de nenhum" : "Gerencie seus grupos"}
                        </Text>
                    </View>
                    <ChevronRight size={18} color={HADES.textDim} />
                </TouchableOpacity>

                {/*
                  Meus arquivos morava num botão do cabeçalho da Comunidade, dentro do
                  grupo aberto — mas o acervo é do usuário e reúne todos os grupos de uma
                  vez, então ficava prometendo menos do que entrega. Aqui fica junto do
                  resto que é da conta, e o cabeçalho da Comunidade perdeu um botão.
                */}
                <TouchableOpacity
                    onPress={() => router.push("/(tabs)/vault")}
                    activeOpacity={0.7}
                    style={{ flexDirection: "row", alignItems: "center", gap: 13, marginTop: 20 }}
                >
                    <View
                        style={{
                            width: 40, height: 40, borderRadius: 12,
                            backgroundColor: HADES.accentTint, alignItems: "center", justifyContent: "center",
                        }}
                    >
                        <FolderArchive size={20} color={HADES.accentSolid} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: "600", color: HADES.text }}>
                            Meus arquivos
                        </Text>
                        <Text style={{ fontSize: 12, color: HADES.textFaint, marginTop: 1 }}>
                            Materiais seus e dos seus grupos
                        </Text>
                    </View>
                    <ChevronRight size={18} color={HADES.textDim} />
                </TouchableOpacity>

                {/*
                  Sair da conta e excluir conta moravam aqui, soltas no fim da rolagem.
                  Foram para a zona de perigo das Configurações, junto do resto da conta —
                  o perfil é uma vitrine, não um painel de administração.
                */}
            </ScrollView>

            <SheetMateriaFavorita
                visivel={showSubjectModal}
                materias={materiasComCores}
                atual={stats.favoriteSubject}
                onSelecionar={handleSubjectSelect}
                onFechar={() => setShowSubjectModal(false)}
            />

            <ModalMetaSemanal
                visivel={showGoalModal}
                valor={tempGoalValue}
                onChangeValor={setTempGoalValue}
                onCancelar={() => setShowGoalModal(false)}
                onSalvar={handleGoalSave}
            />

            <ModalHeatmap
                visivel={showHeatmapModal}
                colunas={heatmapMatrix.columns}
                monthPositions={heatmapMatrix.monthPositions}
                diaSelecionado={selectedDayInfo}
                horasFormatadas={selectedDayInfo ? formatHoursDecimal(selectedDayInfo.hours) : ""}
                onSelecionarDia={(dia) =>
                    setSelectedDayInfo({ date: dia.date, hours: stats.studyHistory[dia.dateStr] || 0 })
                }
                onFechar={() => {
                    setShowHeatmapModal(false);
                    setSelectedDayInfo(null);
                }}
            />
        </View>
    );
}

/** Placeholder da tela de perfil enquanto as estatísticas ainda não resolveram. */
function ProfileSkeleton() {
    return (
        <View style={{ flex: 1, backgroundColor: HADES.bg }}>
            <View style={{ height: BANNER_H, backgroundColor: HADES.surfaceRaised }}>
                <SafeAreaView edges={["top"]} style={{ position: "absolute", top: 10, left: 0, right: 0 }}>
                    <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 16, paddingTop: 2 }}>
                        <SkeletonCircle size={36} hades />
                    </View>
                </SafeAreaView>
                <View style={{ position: "absolute", left: 0, right: 0, bottom: -(AVATAR_SIZE / 2 + 4), alignItems: "center" }}>
                    <View style={{ borderRadius: 999, borderWidth: 4, borderColor: HADES.bg }}>
                        <SkeletonCircle size={AVATAR_SIZE} hades />
                    </View>
                </View>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingTop: AVATAR_SIZE / 2 + 18, paddingBottom: 28, paddingHorizontal: 20 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Nome + lápis, "Desde ...", bio de duas linhas */}
                <View style={{ alignItems: "center" }}>
                    <Skeleton width={150} height={22} hades />
                    <Skeleton width={110} height={12.5} hades style={{ marginTop: 4 }} />
                    <Skeleton width={240} height={13} hades style={{ marginTop: 10 }} />
                    <Skeleton width={180} height={13} hades style={{ marginTop: 6 }} />
                </View>

                {/* Três colunas separadas por um fio de 1px, sem moldura em volta. */}
                <View style={{ flexDirection: "row", alignItems: "stretch", marginTop: 22, paddingVertical: 16 }}>
                    {[0, 1, 2].map((i) => (
                        <Fragment key={i}>
                            {i > 0 && <View style={{ width: 1, backgroundColor: HADES.border }} />}
                            <View style={{ flex: 1, alignItems: "center" }}>
                                <Skeleton width={54} height={21} hades />
                                <Skeleton width={62} height={11} hades style={{ marginTop: 3 }} />
                            </View>
                        </Fragment>
                    ))}
                </View>

                {/* Meta semanal: barra e, ao lado, o "Xh / Yh" */}
                <View style={{ marginTop: 22 }}>
                    <Skeleton width={96} height={11.5} hades style={{ marginBottom: 12 }} />
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <Skeleton height={9} borderRadius={5} hades style={{ flex: 1 }} />
                        <Skeleton width={72} height={13.5} hades />
                    </View>
                </View>

                <Divider />

                {/* Histórico: título + "Expandir", e a grade com rótulos de mês e eixo de dias */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 14,
                    }}
                >
                    <Skeleton width={70} height={11.5} hades />
                    <Skeleton width={80} height={25} borderRadius={8} hades />
                </View>
                <View>
                    <View style={{ height: 12, marginBottom: 6, paddingLeft: 24, flexDirection: "row", gap: 26 }}>
                        {[0, 1, 2].map((i) => (
                            <Skeleton key={i} width={22} height={10} hades />
                        ))}
                    </View>
                    <View style={{ flexDirection: "row", gap: 4 }}>
                        <View style={{ width: 24, gap: 4 }}>
                            {Array.from({ length: 7 }).map((_, row) => (
                                <Skeleton key={row} width={16} height={14} hades />
                            ))}
                        </View>
                        {Array.from({ length: 13 }).map((_, col) => (
                            <View key={col} style={{ gap: 4 }}>
                                {Array.from({ length: 7 }).map((_, row) => (
                                    <Skeleton key={row} width={14} height={14} borderRadius={3} hades />
                                ))}
                            </View>
                        ))}
                    </View>
                </View>

                <Divider />

                {/* Medalhas: cabeçalho com contagem e "Ver Todas", grade de três azulejos
                    (mesmo cartão da galeria de medalhas) */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        marginBottom: 16,
                    }}
                >
                    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                        <Skeleton width={68} height={11.5} hades />
                        <Skeleton width={30} height={11.5} hades />
                    </View>
                    <Skeleton width={72} height={11.5} hades />
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 }}>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                        <View
                            key={i}
                            style={{
                                width: "31.5%",
                                backgroundColor: HADES.surface,
                                borderWidth: 1,
                                borderColor: HADES.border,
                                borderRadius: 12,
                                paddingTop: 12,
                                paddingBottom: 10,
                                alignItems: "center",
                                gap: 8,
                            }}
                        >
                            <Skeleton width={58} height={58} borderRadius={12} hades />
                            <Skeleton width="80%" height={11} hades />
                            <Skeleton width="55%" height={11} hades />
                        </View>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}
