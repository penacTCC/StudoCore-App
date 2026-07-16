import { useState, useMemo, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView, Alert, DeviceEventEmitter } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LogOut, Settings, Maximize2, Users, ChevronRight } from "lucide-react-native";
import { router, useFocusEffect } from "expo-router";
import { HADES } from "@/constants/hades";
import { useAuth } from "@/hooks/useAuth";
import { useMaterias } from "@/hooks/useMaterias";
import { APP_BADGES, BadgeType } from "@/constants/badges";
import { getAvatarColor } from "@/constants/helpers";
import { loadProfileStats, updateFavoriteSubject, updateWeeklyGoal } from "@/services/profileStats";
import { buscarGamificacao } from "@/services/gamificacao";
import { UserStats } from "@/types/profile";
import { buscarPerfil, buscarUsuarioLogado, deslogarUsuario } from "@/services/auth";
import type { AuthUser } from "@/types/auth";
import type { Profile } from "@/types/profile";
import CartaoIdentidade from "@/components/profile/CartaoIdentidade";
import CardMedalhas, { CardMedalhasVazio } from "@/components/profile/CardMedalhas";
import CardEstatisticas from "@/components/profile/CardEstatisticas";
import PrimeirosPassos, { HeatmapVazio } from "@/components/profile/PrimeirosPassos";
import { GradeHeatmap, LegendaHeatmap } from "@/components/profile/Heatmap";
import {
    ModalMetaSemanal,
    SheetMateriaFavorita,
    ModalHeatmap,
} from "@/components/profile/ModaisPerfil";

function getBadgeProgress(badge: BadgeType, stats: UserStats): number {
    switch (badge.requirementType) {
        case 'hours':       return Math.min(stats.totalHours / badge.requirementValue, 1);
        case 'questions':   return Math.min(stats.totalQuestions / badge.requirementValue, 1);
        case 'weekly_goal': return Math.min(stats.weeklyCurrent / stats.weeklyGoal, 1);
        case 'sessions':    return Math.min(stats.totalSessions / badge.requirementValue, 1);
        default: return 0;
    }
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

    const { userId } = useAuth();
    const { materiasComCores } = useMaterias(userId);

    useFocusEffect(
        useCallback(() => {
            const fetchInitialData = async () => {
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
            };
            fetchInitialData();

            const sub = DeviceEventEmitter.addListener('badgesUnlocked', async () => {
                const s = await loadProfileStats();
                setStats(s);
            });

            return () => sub.remove();
        }, [])
    );

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
        Alert.alert(
            "Sair da conta",
            "Tem certeza que deseja sair?",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Sair",
                    style: "destructive",
                    onPress: async () => {
                        const { error } = await deslogarUsuario();
                        if (error) {
                            Alert.alert("Erro", "Não foi possível sair da conta.");
                        }
                    },
                },
            ]
        );
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

    const renderInitials = (name: string) => {
        if (!name) return "US";
        return name.slice(0, 2).toUpperCase();
    };

    if (!stats) return null; // Aguarda dados para não bugar a UI

    const progressPercent = Math.min((stats.weeklyCurrent / stats.weeklyGoal) * 100, 100);

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

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top"]}>
            {/* Header */}
            <View
                style={{
                    paddingTop: 6,
                    paddingHorizontal: 20,
                    paddingBottom: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <Text style={{ fontSize: 23, fontWeight: "700", color: HADES.text, letterSpacing: -0.3 }}>
                    Perfil
                </Text>
                <TouchableOpacity
                    onPress={() => router.push("/(modals)/settings")}
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
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
                showsVerticalScrollIndicator={false}
            >
                <CartaoIdentidade
                    nome={profileData?.nome_usuario || "Usuário Convite"}
                    desde={`Desde ${joinDate}`}
                    foto={profileData?.foto_usuario ?? null}
                    iniciais={renderInitials(profileData?.nome_usuario ?? "")}
                    corAvatar={
                        profileData?.nome_usuario
                            ? getAvatarColor(profileData.nome_usuario.charCodeAt(0) % 5)
                            : getAvatarColor(0)
                    }
                    ofensiva={ofensivaAtual}
                    novo={usuarioNovo}
                    metaAtual={stats.weeklyCurrent}
                    metaAlvo={stats.weeklyGoal}
                    progressoPercent={progressPercent}
                    onEditarMeta={abrirMeta}
                />

                {usuarioNovo && (
                    <PrimeirosPassos
                        onDefinirMeta={abrirMeta}
                        onPrimeiraSessao={() => router.push("/(tabs)/focus")}
                        onEntrarGrupo={() => router.push("/(groups)")}
                    />
                )}

                {/* Histórico de contribuições */}
                {usuarioNovo ? (
                    <HeatmapVazio>
                        <GradeHeatmap colunas={heatmapMatrix.columns} monthPositions={[]} />
                    </HeatmapVazio>
                ) : (
                    <View
                        style={{
                            backgroundColor: HADES.surface,
                            borderWidth: 1,
                            borderColor: HADES.border,
                            borderRadius: 16,
                            padding: 16,
                            marginBottom: 16,
                        }}
                    >
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginBottom: 16,
                            }}
                        >
                            <Text
                                style={{ fontSize: 16, fontWeight: "700", color: HADES.text, letterSpacing: -0.2 }}
                            >
                                Histórico
                            </Text>
                            <TouchableOpacity
                                onPress={() => setShowHeatmapModal(true)}
                                activeOpacity={0.8}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 4,
                                    backgroundColor: HADES.surfaceOverlay,
                                    borderRadius: 8,
                                    paddingVertical: 5,
                                    paddingHorizontal: 10,
                                }}
                            >
                                <Maximize2 size={12} color={HADES.textSecondary} />
                                <Text style={{ fontSize: 12, color: HADES.textSecondary, fontWeight: "600" }}>
                                    Expandir
                                </Text>
                            </TouchableOpacity>
                        </View>

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
                    </View>
                )}

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
                    />
                )}

                {/* Estatísticas gerais */}
                {!usuarioNovo && (
                    <CardEstatisticas
                        totalHoras={stats.totalHours}
                        totalQuestoes={stats.totalQuestions}
                        melhorOfensiva={melhorOfensiva}
                        materiaFavorita={stats.favoriteSubject}
                        corMateria={corMateriaFavorita}
                        onEditarMateria={() => setShowSubjectModal(true)}
                    />
                )}

                {/* Meus Grupos */}
                <TouchableOpacity
                    onPress={() => router.push("/(groups)")}
                    activeOpacity={0.85}
                    style={{
                        backgroundColor: HADES.surface,
                        borderWidth: 1,
                        borderColor: HADES.border,
                        borderRadius: 16,
                        paddingVertical: 14,
                        paddingHorizontal: 16,
                        marginBottom: 16,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 13,
                    }}
                >
                    <View
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 13,
                            backgroundColor: HADES.groupVioletTint,
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <Users size={22} color={HADES.groupViolet} />
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
                        height: 50,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: "rgba(240,85,107,0.3)",
                        backgroundColor: "rgba(240,85,107,0.07)",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                    }}
                >
                    <LogOut size={17} color={HADES.red} />
                    <Text style={{ fontSize: 14.5, fontWeight: "600", color: HADES.red }}>
                        Sair da conta
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
        </SafeAreaView>
    );
}
