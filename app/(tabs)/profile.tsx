import { useEffect, useState, useMemo, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView, Alert, Modal, Pressable, TextInput, KeyboardAvoidingView, Platform, Image, DeviceEventEmitter } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
    CalendarDays, ChevronRight, Star, Clock, BookOpen, Flame, Trophy,
    Users, LogOut, Settings, X, Edit2,
    Zap, Play, BookMarked, Pencil, HelpCircle, CheckCircle, List, Search,
    CalendarCheck, TrendingUp, Award, BarChart2, Target, BookCheck,
    Activity, Eye, Repeat, Calendar, Medal, FileSearch, Hash,
    Shield, Layers, Lock, Cpu, GraduationCap, Milestone,
    Crosshair, Sword, Swords, Anchor, Dumbbell, Mountain,
    Compass, Sparkles, Globe, Crown, Gem, Infinity, Diamond,
    Timer, LayoutGrid, BrainCircuit,
} from "lucide-react-native";
import { router, useFocusEffect } from "expo-router";
import { COLORS } from "@/constants/colors";
import { disciplinasComCores } from "@/constants/mock-data";
import { APP_BADGES, BADGE_LEVEL_COLORS, BadgeType } from "@/constants/badges";
import { getAvatarColor } from "@/constants/helpers";
import type { LucideIcon } from "lucide-react-native";
import { supabase } from "@/supabase";
import { loadProfileStats, updateFavoriteSubject, updateWeeklyGoal, UserStats } from "@/services/profileStats";
import { buscarPerfil, buscarUsuarioLogado } from "@/services/auth";

const iconMap: Record<string, LucideIcon> = {
    Star, Clock, BookOpen, Flame, Trophy, Users, Zap, Play, BookMarked, Pencil,
    HelpCircle, CheckCircle, List, Search, CalendarCheck, TrendingUp, Award,
    BarChart2, Target, BookCheck, Activity, Eye, Repeat, Calendar, Medal,
    FileSearch, Hash, Shield, Layers, Lock, Cpu, GraduationCap, Milestone,
    Crosshair, Sword, Swords, Anchor, Dumbbell, Mountain, Compass, Sparkles,
    Globe, Crown, Gem, Infinity, Diamond, Timer, LayoutGrid, BrainCircuit,
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

export default function ProfileScreen() {
    const [profileData, setProfileData] = useState<any>(null);
    const [sessionUser, setSessionUser] = useState<any>(null);
    const [stats, setStats] = useState<UserStats | null>(null);
    const [showSubjectModal, setShowSubjectModal] = useState(false);
    const [showGoalModal, setShowGoalModal] = useState(false);
    const [tempGoalValue, setTempGoalValue] = useState("");

    useFocusEffect(
        useCallback(() => {
            const fetchInitialData = async () => {
                const { data } = await buscarUsuarioLogado();
                if (data?.user) {
                    setSessionUser(data.user);
                    const { data: prof } = await buscarPerfil(data.user.id);
                    if (prof) setProfileData(prof);
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
                        const { error } = await supabase.auth.signOut();
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

    const joinDate = sessionUser?.created_at
        ? new Intl.DateTimeFormat('pt-BR').format(new Date(sessionUser.created_at))
        : 'Carregando...';

    const renderInitials = (name: string) => {
        if (!name) return "US";
        return name.slice(0, 2).toUpperCase();
    };

    if (!stats) return null; // Aguarda dados para não bugar a UI

    const progressPercent = Math.min((stats.weeklyCurrent / stats.weeklyGoal) * 100, 100);

    return (
        <SafeAreaView className="flex-1 bg-slate-950" edges={["top"]}>
            {/* Header */}
            <View className="bg-slate-950 border-b border-slate-800 px-4 py-3 flex-row items-center justify-between">
                <Text className="text-xl font-bold text-slate-200">Perfil</Text>
                <TouchableOpacity onPress={() => router.push("/(modals)/settings")} className="p-2">
                    <Settings size={24} color="#cbd5e1" />
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Avatar & Level */}
                <View className="px-4 py-6">
                    <View className="flex-row items-center gap-4">
                        <View className="relative">
                            <View
                                className="w-20 h-20 rounded-full items-center justify-center overflow-hidden"
                                style={{
                                    backgroundColor: profileData?.nome_usuario ? getAvatarColor(profileData.nome_usuario.charCodeAt(0) % 5) : getAvatarColor(0),
                                    borderWidth: 2,
                                    borderColor: COLORS.primary,
                                }}
                            >
                                {profileData?.foto_usuario ? (
                                    <Image source={{ uri: profileData.foto_usuario }} style={{ width: '100%', height: '100%' }} />
                                ) : (
                                    <Text className="text-white text-2xl font-bold">
                                        {renderInitials(profileData?.nome_usuario)}
                                    </Text>
                                )}
                            </View>
                            <View className="absolute -bottom-1 -right-1 bg-brand-500 px-2 py-0.5 rounded-full">
                                <Text className="text-white text-xs font-bold">LV 12</Text>
                            </View>
                        </View>
                        <View>
                            <Text className="text-xl font-bold text-slate-200">
                                {profileData?.nome_usuario || "Usuário Convite"}
                            </Text>
                            <Text className="text-sm text-slate-400">Desde {joinDate}</Text>
                        </View>
                    </View>
                </View>

                {/* Weekly Goal */}
                <View className="px-4 mb-4">
                    <TouchableOpacity 
                        onPress={() => {
                            setTempGoalValue(String(stats.weeklyGoal));
                            setShowGoalModal(true);
                        }}
                        className="bg-slate-900 border border-slate-800 rounded-3xl p-4"
                    >
                        <View className="flex-row items-center justify-between mb-2">
                            <View className="flex-row items-center gap-2">
                                <Text className="text-sm font-medium text-slate-400">Meta Semanal</Text>
                                <View className="bg-slate-800/80 px-2 py-0.5 rounded-md flex-row items-center gap-1">
                                    <Edit2 size={10} color={COLORS.textMuted} />
                                    <Text className="text-[10px] text-slate-400">Editar</Text>
                                </View>
                            </View>
                            <Text className="text-sm text-slate-200">{stats.weeklyCurrent}h / {stats.weeklyGoal}h</Text>
                        </View>
                        <View className="h-3 bg-slate-800 rounded-full overflow-hidden">
                            <View
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </View>
                        <Text className="text-xs text-emerald-400 mt-2">
                            {stats.weeklyGoal - stats.weeklyCurrent > 0
                                ? `Faltam ${stats.weeklyGoal - stats.weeklyCurrent} horas para atingir sua meta!`
                                : "Meta semanal atingida! Parabéns!"}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Heatmap Github Style */}
                <View className="px-4 mb-4">
                    <View className="bg-slate-900 border border-slate-800 rounded-3xl p-4">
                        <Text className="text-sm font-medium text-slate-400 mb-3">Histórico de Contribuições</Text>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View className="pr-4">
                                {/* Header dos Meses */}
                                <View className="flex-row relative" style={{ marginLeft: 24, height: 16, marginBottom: 8 }}>
                                    {heatmapMatrix.monthPositions.map((m: any, i: number) => (
                                        <Text
                                            key={i}
                                            className="text-[10px] text-slate-500 uppercase font-bold absolute"
                                            style={{ left: m.colIndex * 18 }} // 14px size + 4px gap = 18px per column
                                        >
                                            {m.name}
                                        </Text>
                                    ))}
                                </View>

                                {/* Grade do Heatmap */}
                                <View className="flex-row">
                                    {/* Eixo Y das Semanas */}
                                    <View className="justify-between mr-2" style={{ height: 7 * 14 + 6 * 4, paddingVertical: 2 }}>
                                        <Text className="text-[10px] text-slate-500 font-medium">Dom</Text>
                                        <Text className="text-[10px] text-slate-500 font-medium opacity-0">Seg</Text>
                                        <Text className="text-[10px] text-slate-500 font-medium">Ter</Text>
                                        <Text className="text-[10px] text-slate-500 font-medium opacity-0">Qua</Text>
                                        <Text className="text-[10px] text-slate-500 font-medium">Qui</Text>
                                        <Text className="text-[10px] text-slate-500 font-medium opacity-0">Sex</Text>
                                        <Text className="text-[10px] text-slate-500 font-medium">Sab</Text>
                                    </View>

                                    {/* Colunas (Semanas) */}
                                    <View className="flex-row gap-1">
                                        {heatmapMatrix.columns.map((week: any, colIndex: number) => (
                                            <View key={colIndex} className="gap-1">
                                                {week.map((day: any, rowIndex: number) => {
                                                    if (day.intensity === -1) {
                                                        return <View key={rowIndex} style={{ width: 14, height: 14, backgroundColor: 'transparent' }} />;
                                                    }

                                                    let bg = COLORS.bgTertiary;
                                                    if (day.intensity > 0.8) bg = "#34d399";
                                                    else if (day.intensity > 0.6) bg = "#10b981";
                                                    else if (day.intensity > 0.4) bg = "#059669";
                                                    else if (day.intensity > 0.2) bg = "#047857";

                                                    return (
                                                        <View
                                                            key={rowIndex}
                                                            style={{
                                                                width: 14,
                                                                height: 14,
                                                                backgroundColor: bg,
                                                                borderRadius: 3,
                                                            }}
                                                        />
                                                    );
                                                })}
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            </View>
                        </ScrollView>

                        <View className="flex-row items-center justify-end gap-2 mt-4">
                            <Text className="text-xs text-slate-500">Menos</Text>
                            <View className="flex-row gap-1">
                                <View className="w-3 h-3 rounded-sm bg-slate-800" />
                                <View className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#047857" }} />
                                <View className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#10b981" }} />
                                <View className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#34d399" }} />
                            </View>
                            <Text className="text-xs text-slate-500">Mais</Text>
                        </View>
                    </View>
                </View>

                {/* ── MEDALHAS – PREVIEW ─────────────────────────── */}
                <View className="px-4 mb-4">
                    <View className="bg-slate-900 border border-slate-800 rounded-3xl p-4">

                        {/* Header com botão Ver todas */}
                        <TouchableOpacity
                            onPress={() => router.push('/(modals)/badges')}
                            className="flex-row items-center justify-between mb-4"
                        >
                            <View>
                                <Text className="text-sm font-semibold text-slate-200">Minhas Medalhas</Text>
                                <Text className="text-xs text-slate-500">{stats.badgesUnlocked.length}/{APP_BADGES.length} conquistadas</Text>
                            </View>
                            <View className="flex-row items-center gap-1">
                                <Text className="text-xs text-slate-400">Ver todas</Text>
                                <ChevronRight size={16} color="#94a3b8" />
                            </View>
                        </TouchableOpacity>

                        {/* 6 medalhas desbloqueadas mais recentes */}
                        {(() => {
                            const unlocked = APP_BADGES.filter(b => stats.badgesUnlocked.includes(b.id)).slice(-6);
                            if (unlocked.length === 0) {
                                return (
                                    <View className="items-center py-4">
                                        <Text className="text-xs text-slate-500">Nenhuma medalha conquistada ainda.</Text>
                                        <Text className="text-xs text-slate-600">Comece a estudar para ganhar!</Text>
                                    </View>
                                );
                            }
                            return (
                                <View className="flex-row flex-wrap gap-2 mb-4">
                                    {unlocked.map(badge => {
                                        const BadgeIcon = iconMap[badge.icon] || Star;
                                        const levelColor = BADGE_LEVEL_COLORS[badge.level];
                                        return (
                                            <View
                                                key={badge.id}
                                                className="items-center gap-1 p-2 rounded-xl"
                                                style={{ width: '30%', backgroundColor: `${levelColor}18` }}
                                            >
                                                <View
                                                    className="w-9 h-9 rounded-full items-center justify-center"
                                                    style={{ backgroundColor: `${levelColor}30` }}
                                                >
                                                    <BadgeIcon size={18} color={levelColor} />
                                                </View>
                                                <Text className="text-[10px] text-center text-slate-300" numberOfLines={2}>
                                                    {badge.name}
                                                </Text>
                                            </View>
                                        );
                                    })}
                                </View>
                            );
                        })()}

                        {/* Separador */}
                        <View className="h-px bg-slate-800 mb-4" />

                        {/* 3 próximas mais próximas de desbloquear */}
                        {(() => {
                            const locked = APP_BADGES
                                .filter(b => !stats.badgesUnlocked.includes(b.id))
                                .map(b => ({ badge: b, progress: getBadgeProgress(b, stats) }))
                                .filter(x => x.progress > 0)
                                .sort((a, b) => b.progress - a.progress)
                                .slice(0, 3);

                            if (locked.length === 0) return null;

                            return (
                                <View>
                                    <Text className="text-xs font-semibold text-slate-400 mb-3">🎯 Próximas a conquistar</Text>
                                    <View className="gap-3">
                                        {locked.map(({ badge, progress }) => {
                                            const BadgeIcon = iconMap[badge.icon] || Star;
                                            const levelColor = BADGE_LEVEL_COLORS[badge.level];
                                            const pct = Math.round(progress * 100);
                                            return (
                                                <View key={badge.id} className="flex-row items-center gap-3">
                                                    <View
                                                        className="w-9 h-9 rounded-full items-center justify-center flex-shrink-0"
                                                        style={{ backgroundColor: 'rgba(51,65,85,0.5)' }}
                                                    >
                                                        <BadgeIcon size={17} color={levelColor} />
                                                    </View>
                                                    <View className="flex-1">
                                                        <View className="flex-row justify-between">
                                                            <Text className="text-xs font-semibold text-slate-300">{badge.name}</Text>
                                                            <Text className="text-xs text-slate-500">{pct}%</Text>
                                                        </View>
                                                        <View className="h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1.5">
                                                            <View
                                                                className="h-full rounded-full"
                                                                style={{ width: `${pct}%`, backgroundColor: levelColor }}
                                                            />
                                                        </View>
                                                    </View>
                                                </View>
                                            );
                                        })}
                                    </View>
                                </View>
                            );
                        })()}

                    </View>
                </View>

                {/* Stats & Favorite Subject */}
                <View className="px-4 mb-4">
                    <View className="bg-slate-900 border border-slate-800 rounded-3xl p-4">
                        <Text className="text-sm font-medium text-slate-400 mb-3">Estatísticas Gerais</Text>
                        <View className="flex-row flex-wrap gap-3">
                            <View className="flex-1 p-3 rounded-xl" style={{ backgroundColor: COLORS.primaryFaint, minWidth: "45%" }}>
                                <Text className="text-2xl font-bold text-slate-200">{stats.totalHours}h</Text>
                                <Text className="text-xs text-slate-400">Total de Horas</Text>
                            </View>
                            <View className="flex-1 p-3 rounded-xl" style={{ backgroundColor: COLORS.primaryFaint, minWidth: "45%" }}>
                                <Text className="text-2xl font-bold text-slate-200">{stats.totalQuestions}</Text>
                                <Text className="text-xs text-slate-400">Total Questões</Text>
                            </View>
                        </View>

                        {/* Favorite Subject Editable */}
                        <TouchableOpacity
                            onPress={() => setShowSubjectModal(true)}
                            className="p-3 rounded-xl mt-3 flex-row justify-between items-center"
                            style={{ backgroundColor: COLORS.primaryFaint }}
                        >
                            <View>
                                <Text className="text-lg font-bold" style={{
                                    color: disciplinasComCores.find(d => d.name === stats.favoriteSubject)?.color || COLORS.violetLight
                                }}>
                                    {stats.favoriteSubject}
                                </Text>
                                <Text className="text-xs text-slate-400">Matéria Favorita (Toque para editar)</Text>
                            </View>
                            <ChevronRight size={20} color="#94a3b8" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* My Groups CTA */}
                <View className="px-4 mb-4">
                    <TouchableOpacity
                        onPress={() => router.push("/(groups)")}
                        className="bg-slate-900 border border-slate-800 rounded-3xl p-4 flex-row items-center gap-4"
                    >
                        <View
                            className="w-12 h-12 rounded-xl items-center justify-center"
                            style={{ backgroundColor: "rgba(139, 92, 246, 0.15)" }}
                        >
                            <Users size={24} color={COLORS.violetLight} />
                        </View>
                        <View className="flex-1">
                            <Text className="font-medium text-slate-200">Meus Grupos</Text>
                            <Text className="text-xs text-slate-400">Gerencie seus grupos</Text>
                        </View>
                        <ChevronRight size={20} color={COLORS.textMuted} />
                    </TouchableOpacity>
                </View>

                {/* Cronogram CTA */}
                <View className="px-4 mb-4">
                    <TouchableOpacity
                        onPress={() => router.push("/schedule")}
                        className="bg-slate-900 border border-slate-800 rounded-3xl p-4 flex-row items-center gap-4"
                    >
                        <View
                            className="w-12 h-12 rounded-xl items-center justify-center"
                            style={{ backgroundColor: "rgba(247, 152, 44, 0.15)" }}
                        >
                            <CalendarDays size={24} color={COLORS.violetLight} />
                        </View>
                        <View className="flex-1">
                            <Text className="font-medium text-slate-200">Cronograma de Estudo</Text>
                            <Text className="text-xs text-slate-400">Planeje e organize seu cronograma</Text>
                        </View>
                        <ChevronRight size={20} color={COLORS.textMuted} />
                    </TouchableOpacity>
                </View>

                {/* Sign Out */}
                <View className="px-4 mb-8">
                    <TouchableOpacity
                        onPress={handleSignOut}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 10,
                            backgroundColor: "rgba(244, 63, 94, 0.08)",
                            borderWidth: 1,
                            borderColor: "rgba(244, 63, 94, 0.2)",
                            borderRadius: 20,
                            paddingVertical: 16,
                        }}
                    >
                        <LogOut size={18} color={COLORS.rose} />
                        <Text style={{ color: COLORS.rose, fontWeight: "700", fontSize: 15 }}>
                            Sair da conta
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* Modal de Matérias Favoritas */}
            <Modal
                visible={showSubjectModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowSubjectModal(false)}
            >
                <View className="flex-1 justify-end bg-black/60">
                    <View className="bg-slate-900 rounded-t-3xl min-h-[50%] p-4 border-t border-slate-800">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-lg font-bold text-slate-200">Escolha a Matéria Favorita</Text>
                            <TouchableOpacity onPress={() => setShowSubjectModal(false)}>
                                <X size={24} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {disciplinasComCores.map((disciplina, idx) => (
                                <TouchableOpacity
                                    key={idx}
                                    onPress={() => handleSubjectSelect(disciplina.name)}
                                    className="p-4 border-b border-slate-800 flex-row items-center gap-4"
                                >
                                    <View className="w-4 h-4 rounded-full" style={{ backgroundColor: disciplina.color }} />
                                    <Text className="text-base text-slate-200">{disciplina.name}</Text>
                                    {stats.favoriteSubject === disciplina.name && (
                                        <View className="bg-emerald-500/20 px-2 py-1 rounded">
                                            <Text className="text-xs text-emerald-400">Atual</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Modal de Meta Semanal */}
            <Modal
                visible={showGoalModal}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setShowGoalModal(false)}
            >
                <KeyboardAvoidingView 
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    className="flex-1 justify-center px-4 bg-black/70"
                >
                    <View className="bg-slate-900 border border-slate-700 rounded-3xl p-6">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-lg font-bold text-slate-200">Editar Meta Semanal (Horas)</Text>
                        </View>
                        
                        <TextInput
                            value={tempGoalValue}
                            onChangeText={setTempGoalValue}
                            keyboardType="number-pad"
                            placeholder="Ex: 15"
                            placeholderTextColor="#64748b"
                            className="bg-slate-950/50 border border-slate-800 rounded-2xl px-4 py-4 text-center text-2xl font-bold text-slate-200 mb-6"
                            autoFocus={true}
                        />

                        <View className="flex-row gap-3">
                            <TouchableOpacity 
                                onPress={() => setShowGoalModal(false)}
                                className="flex-1 py-3 items-center rounded-xl border border-slate-700"
                            >
                                <Text className="text-slate-300 font-bold">Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={handleGoalSave}
                                className="flex-1 py-3 items-center rounded-xl bg-emerald-600"
                            >
                                <Text className="text-white font-bold">Salvar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}
