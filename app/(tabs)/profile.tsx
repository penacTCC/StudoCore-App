import { useState, useMemo, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView, DeviceEventEmitter, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
    LogOut, Settings, Maximize2, Users, ChevronRight,
    Image as ImageIcon, Flame, Pencil, PartyPopper, Plus, Trash2,
} from "lucide-react-native";
import { router, useFocusEffect } from "expo-router";
import { HADES } from "@/constants/hades";
import { useAuth } from "@/hooks/useAuth";
import { useMaterias } from "@/hooks/useMaterias";
import { APP_BADGES, BadgeType } from "@/constants/badges";
import { getIdentityColor, getBioFromObjetivo } from "@/constants/helpers";
import { loadProfileStats, updateFavoriteSubject, updateWeeklyGoal } from "@/services/profileStats";
import { buscarGamificacao } from "@/services/gamificacao";
import { UserStats } from "@/types/profile";
import { buscarPerfil, buscarUsuarioLogado, deslogarUsuario, excluirConta } from "@/services/auth";
import type { AuthUser } from "@/types/auth";
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
    const [profileData, setProfileData] = useState<Profile | null>(null);
    const [sessionUser, setSessionUser] = useState<AuthUser | null>(null);
    const [stats, setStats] = useState<UserStats | null>(null);
    const [showSubjectModal, setShowSubjectModal] = useState(false);
    const [showGoalModal, setShowGoalModal] = useState(false);
    const [tempGoalValue, setTempGoalValue] = useState("");
    const [showHeatmapModal, setShowHeatmapModal] = useState(false);
    const [selectedDayInfo, setSelectedDayInfo] = useState<{ date: Date; hours: number } | null>(null);
    const [melhorOfensiva, setMelhorOfensiva] = useState(0);
    const [ofensivaAtual, setOfensivaAtual] = useState(0);
    const [excluindoConta, setExcluindoConta] = useState(false);

    const { userId } = useAuth();
    const { materiasComCores, recarregarMaterias } = useMaterias(userId);

    //Controla o estado do pull-to-refresh
    const [atualizando, setAtualizando] = useState(false);

    // Contador da seção Galeria. Vem separado da grade porque ela só carrega uma prévia
    // curta, e o número ao lado do título tem que ser o total real.
    const [totalFotos, setTotalFotos] = useState(0);

    useFocusEffect(
        useCallback(() => {
            if (!userId) return;
            contarFotosDoUsuario(userId).then(setTotalFotos);
        }, [userId])
    );

    const fetchInitialData = useCallback(async () => {
        const { data } = await buscarUsuarioLogado();
        if (data?.user) {
            setSessionUser(data.user);
            const { data: prof } = await buscarPerfil(data.user.id);
            if (prof) setProfileData(prof);
            const gamificacao = await buscarGamificacao(data.user.id);
            setMelhorOfensiva(gamificacao?.melhor_ofensiva ?? 0);
            setOfensivaAtual(gamificacao?.ofensiva ?? 0);
        }
        const s = await loadProfileStats();
        setStats(s);
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchInitialData();

            const sub = DeviceEventEmitter.addListener('badgesUnlocked', async () => {
                const s = await loadProfileStats();
                setStats(s);
            });

            return () => sub.remove();
        }, [fetchInitialData])
    );

    const handleRefresh = async () => {
        setAtualizando(true);
        try {
            await Promise.all([fetchInitialData(), recarregarMaterias()]);
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

    const handleSignOut = () => {
        confirm({
            title: "Sair da conta",
            message: "Tem certeza que deseja sair?",
            confirmText: "Sair",
            destructive: true,
            onConfirm: async () => {
                const { error } = await deslogarUsuario();
                if (error) {
                    toast.error("Não foi possível sair da conta.");
                }
            },
        });
    };

    /**
     * Exclusão de conta: dois avisos antes de chamar o servidor, porque não existe desfazer —
     * o primeiro conta o que some, o segundo é a confirmação final. Quem apaga é a Edge
     * Function `excluir-conta` (ver services/auth.ts); o signOut lá dentro devolve o app
     * pro login sozinho, então aqui não há navegação a fazer.
     */
    const handleDeleteAccount = () => {
        confirm({
            title: "Excluir conta",
            message:
                "Isso apaga para sempre seu perfil, sessões de foco, ofensivas, medalhas e a participação nos seus grupos. Não dá para desfazer.",
            confirmText: "Continuar",
            destructive: true,
            onConfirm: () => {
                confirm({
                    title: "Tem certeza absoluta?",
                    message: "Sua conta e todos os seus dados serão excluídos agora.",
                    confirmText: "Excluir para sempre",
                    destructive: true,
                    onConfirm: async () => {
                        setExcluindoConta(true);
                        const { error } = await excluirConta();
                        if (error) {
                            setExcluindoConta(false);
                            toast.error(error);
                        }
                    },
                });
            },
        });
    };

    const handleSubjectSelect = async (subjectName: string) => {
        const updated = await updateFavoriteSubject(subjectName);
        setStats(updated);
        setShowSubjectModal(false);
    };

    const handleGoalSave = async () => {
        const h = parseInt(tempGoalValue, 10);
        if (!isNaN(h) && h > 0) {
            const updated = await updateWeeklyGoal(h);
            setStats(updated);
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
            {/* Banner + avatar sobreposto, fixos no topo. Ficam numa camada acima do
                ScrollView (zIndex/elevation) pra que o conteúdo role por baixo do avatar
                em vez de passar por cima da metade que ele projeta pra fora do banner. */}
            <View
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: BANNER_H,
                    zIndex: 10,
                    elevation: 10,
                }}
                pointerEvents="box-none"
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

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingTop: BANNER_H + AVATAR_SIZE / 2 + 18, paddingBottom: 28, paddingHorizontal: 20 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={atualizando}
                        onRefresh={handleRefresh}
                        tintColor={HADES.accentSolid}
                        // O spinner nasceria escondido atrás do banner fixo.
                        progressViewOffset={BANNER_H}
                    />
                }
            >
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
                         `              Meta semanal atingida!
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

                {/* Sair da conta */}
                <TouchableOpacity
                    onPress={handleSignOut}
                    activeOpacity={0.85}
                    style={{
                        height: 48, borderRadius: 13,
                        borderWidth: 1, borderColor: "rgba(240,85,107,0.3)",
                        backgroundColor: "rgba(240,85,107,0.07)",
                        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                        marginTop: 20,
                    }}
                >
                    <LogOut size={17} color={HADES.red} />
                    <Text style={{ fontSize: 14.5, fontWeight: "600", color: HADES.red }}>
                        Sair da conta
                    </Text>
                </TouchableOpacity>

                {/* Excluir conta */}
                <TouchableOpacity
                    onPress={handleDeleteAccount}
                    disabled={excluindoConta}
                    activeOpacity={0.85}
                    style={{
                        height: 44, borderRadius: 13,
                        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                        marginTop: 10,
                        opacity: excluindoConta ? 0.6 : 1,
                    }}
                >
                    {excluindoConta ? (
                        <ActivityIndicator size="small" color={HADES.textMuted} />
                    ) : (
                        <Trash2 size={15} color={HADES.textMuted} />
                    )}
                    <Text style={{ fontSize: 13.5, fontWeight: "600", color: HADES.textMuted }}>
                        {excluindoConta ? "Excluindo conta…" : "Excluir minha conta"}
                    </Text>
                </TouchableOpacity>
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
                <SafeAreaView edges={["top"]} style={{ position: "absolute", top: 0, left: 0, right: 0 }}>
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
                <View style={{ alignItems: "center", gap: 8 }}>
                    <Skeleton width={140} height={22} hades />
                    <Skeleton width={110} height={13} hades />
                </View>

                <View
                    style={{
                        flexDirection: "row", marginTop: 22, paddingVertical: 16,
                        borderTopWidth: 1, borderBottomWidth: 1, borderColor: HADES.border, gap: 16,
                    }}
                >
                    {[0, 1, 2].map((i) => (
                        <View key={i} style={{ flex: 1, alignItems: "center", gap: 6 }}>
                            <Skeleton width={40} height={21} hades />
                            <Skeleton width={60} height={11} hades />
                        </View>
                    ))}
                </View>

                <View style={{ marginTop: 22 }}>
                    <Skeleton width={100} height={12} hades style={{ marginBottom: 14 }} />
                    <Skeleton width="100%" height={9} borderRadius={5} hades />
                </View>

                <View style={{ marginTop: 22 }}>
                    <Skeleton width={90} height={12} hades style={{ marginBottom: 14 }} />
                    <View style={{ flexDirection: "row", gap: 4 }}>
                        {Array.from({ length: 14 }).map((_, col) => (
                            <View key={col} style={{ gap: 4 }}>
                                {Array.from({ length: 7 }).map((_, row) => (
                                    <Skeleton key={row} width={14} height={14} borderRadius={3} hades />
                                ))}
                            </View>
                        ))}
                    </View>
                </View>

                <View style={{ marginTop: 22 }}>
                    <Skeleton width={90} height={12} hades style={{ marginBottom: 16 }} />
                    <View style={{ flexDirection: "row", gap: 12 }}>
                        {[0, 1, 2].map((i) => (
                            <View key={i} style={{ flex: 1, alignItems: "center", gap: 7 }}>
                                <SkeletonCircle size={48} hades />
                                <Skeleton width="80%" height={11} hades />
                            </View>
                        ))}
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}
