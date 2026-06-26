import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Share } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ChevronLeft, Share2, Crown, Clock, ListChecks, Trophy, Medal, Flame, BookOpen, Swords } from "lucide-react-native";
import { COLORS } from "@/constants/colors";
import { useAuth } from "@/hooks/useAuth";
import Avatar from "@/components/ui/Avatar";
import { buscarPerfil } from "@/services/auth";
import { buscarGamificacao } from "@/services/gamificacao";
import { APP_BADGES } from "@/constants/badges";
import { getAvatarColor } from "@/constants/helpers";
import type { Profile } from "@/types/profile";
import type { Gamificacao } from "@/types/gamificacao";
import type { LucideIcon } from "lucide-react-native";

type PerfilComparavel = {
    profile: Profile;
    gamificacao: Gamificacao | null;
};

// Mesma fórmula usada dentro do componente Avatar pra colorir o fallback de iniciais —
// repetida aqui pra usar a "cor do usuário" também nas barras e nos destaques deste duelo.
const corDoUsuario = (nome?: string | null) => getAvatarColor(nome ? nome.charCodeAt(0) % 5 : 0);

type Lado = "eu" | "ele" | "empate";
const decidirLado = (meu: number, dele: number): Lado => (meu > dele ? "eu" : dele > meu ? "ele" : "empate");

const formatarNumero = (valor: number) => valor.toLocaleString('pt-BR');

export default function CompareProfileScreen() {
    const router = useRouter();
    const { userId } = useLocalSearchParams<{ userId: string }>();
    const { userId: meuId } = useAuth();

    const [eu, setEu] = useState<PerfilComparavel | null>(null);
    const [ele, setEle] = useState<PerfilComparavel | null>(null);

    useEffect(() => {
        if (!meuId || !userId) return;

        const carregarLado = async (id: string): Promise<PerfilComparavel | null> => {
            const { data: profile } = await buscarPerfil(id);
            if (!profile) return null;
            const gamificacao = await buscarGamificacao(id);
            return { profile, gamificacao };
        };

        carregarLado(meuId).then(setEu);
        carregarLado(userId).then(setEle);
    }, [meuId, userId]);

    if (!eu || !ele) {
        return (
            <SafeAreaView className="flex-1 bg-slate-950 items-center justify-center">
                <ActivityIndicator color={COLORS.primary} />
            </SafeAreaView>
        );
    }

    const corEu = corDoUsuario(eu.profile.nome_usuario);
    const corEle = corDoUsuario(ele.profile.nome_usuario);

    const minhasMedalhas = APP_BADGES.filter(b => eu.profile.medalhas_desbloqueadas?.includes(b.id)).length;
    const medalhasDele = APP_BADGES.filter(b => ele.profile.medalhas_desbloqueadas?.includes(b.id)).length;

    const metricas: { label: string; icon: LucideIcon; meu: number; dele: number; sufixo?: string }[] = [
        { label: "Horas Totais", icon: Clock, meu: eu.profile.horas_totais ?? 0, dele: ele.profile.horas_totais ?? 0, sufixo: "h" },
        { label: "Questões", icon: ListChecks, meu: eu.profile.questoes_feitas ?? 0, dele: ele.profile.questoes_feitas ?? 0 },
        { label: "Melhor Ofensiva", icon: Trophy, meu: eu.gamificacao?.melhor_ofensiva ?? 0, dele: ele.gamificacao?.melhor_ofensiva ?? 0, sufixo: " dias" },
        { label: "Medalhas", icon: Medal, meu: minhasMedalhas, dele: medalhasDele },
        { label: "Ofensiva Atual", icon: Flame, meu: eu.gamificacao?.ofensiva ?? 0, dele: ele.gamificacao?.ofensiva ?? 0, sufixo: " dias" },
    ];

    const vitoriasEu = metricas.filter(m => decidirLado(m.meu, m.dele) === "eu").length;
    const vitoriasEle = metricas.filter(m => decidirLado(m.meu, m.dele) === "ele").length;
    const liderante: Lado = vitoriasEu > vitoriasEle ? "eu" : vitoriasEle > vitoriasEu ? "ele" : "empate";

    const compartilhar = () => {
        Share.share({
            message: `Duelo no StudoCore: Você ${vitoriasEu} x ${vitoriasEle} ${ele.profile.nome_usuario} 🔥`,
        });
    };

    const desafiar = () => {
        Alert.alert("Em breve", "O modo Desafio (1x1) ainda está em desenvolvimento.");
    };

    return (
        <SafeAreaView className="flex-1 bg-slate-950" edges={['top', 'bottom']}>
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 py-3">
                <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 rounded-full bg-slate-800 items-center justify-center">
                    <ChevronLeft size={20} color="#c9ccd2" />
                </TouchableOpacity>
                <Text className="text-base font-semibold text-white">Duelo</Text>
                <TouchableOpacity onPress={compartilhar} className="w-9 h-9 rounded-full bg-slate-800 items-center justify-center">
                    <Share2 size={16} color="#c9ccd2" />
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
                {/* VS hero */}
                <View className="flex-row items-start justify-between py-6">
                    {/* Eu */}
                    <View style={{ width: 110 }} className="items-center gap-2.5">
                        <View>
                            {liderante === "eu" && (
                                <Crown size={18} color={COLORS.amber} style={{ position: 'absolute', top: -16, left: 0, right: 0, alignSelf: 'center' }} />
                            )}
                            <View className="rounded-full p-[3px]" style={{ backgroundColor: corEu }}>
                                <View style={{ borderWidth: 3, borderColor: '#000' }} className="rounded-full">
                                    <Avatar foto={eu.profile.foto_usuario} nome={eu.profile.nome_usuario} size={78} />
                                </View>
                            </View>
                        </View>
                        <View className="items-center">
                            <Text className="text-base font-bold text-white" numberOfLines={1}>{eu.profile.nome_usuario}</Text>
                            <Text className="text-xs font-semibold mt-0.5" style={{ color: corEu }}>Você</Text>
                        </View>
                    </View>

                    {/* Placar central */}
                    <View className="flex-1 items-center pt-5">
                        <View className="flex-row items-center gap-3">
                            <Text className="text-4xl font-extrabold" style={{ color: corEu }}>{vitoriasEu}</Text>
                            <Text className="text-sm font-bold text-slate-500">VS</Text>
                            <Text className="text-4xl font-extrabold" style={{ color: corEle }}>{vitoriasEle}</Text>
                        </View>
                        <Text className="text-[11px] font-semibold text-slate-500 tracking-widest mt-2">VITÓRIAS</Text>
                    </View>

                    {/* Ele */}
                    <View style={{ width: 110 }} className="items-center gap-2.5">
                        <View>
                            {liderante === "ele" && (
                                <Crown size={18} color={COLORS.amber} style={{ position: 'absolute', top: -16, left: 0, right: 0, alignSelf: 'center' }} />
                            )}
                            <View className="rounded-full p-[3px]" style={{ backgroundColor: corEle }}>
                                <View style={{ borderWidth: 3, borderColor: '#000' }} className="rounded-full">
                                    <Avatar foto={ele.profile.foto_usuario} nome={ele.profile.nome_usuario} size={78} />
                                </View>
                            </View>
                        </View>
                        <View className="items-center">
                            <Text className="text-base font-bold text-white" numberOfLines={1}>{ele.profile.nome_usuario}</Text>
                            <Text className="text-xs font-semibold mt-0.5" style={{ color: corEle }}>Rival</Text>
                        </View>
                    </View>
                </View>

                {/* Linhas de comparação, uma barra por métrica */}
                <View className="gap-5 pt-1">
                    {metricas.map(m => {
                        const lado = decidirLado(m.meu, m.dele);
                        const Icon = m.icon;
                        const total = Math.max(m.meu + m.dele, 0.0001);
                        const pctEu = (m.meu / total) * 100;
                        const pctEle = 100 - pctEu;
                        return (
                            <View key={m.label}>
                                <View className="flex-row items-center justify-between mb-2">
                                    <View className="flex-1 flex-row items-center gap-1.5">
                                        {m.label === "Ofensiva Atual" && lado === "eu" && <Flame size={14} color={COLORS.amber} />}
                                        <Text
                                            className="text-lg font-bold"
                                            style={{ color: lado === "eu" ? corEu : COLORS.textMuted }}
                                        >
                                            {formatarNumero(m.meu)}{m.sufixo || ""}
                                        </Text>
                                    </View>
                                    <View className="flex-row items-center gap-1.5 px-2">
                                        <Icon size={13} color={COLORS.textMuted} />
                                        <Text className="text-[10px] font-semibold text-slate-500 tracking-wider" numberOfLines={1}>
                                            {m.label.toUpperCase()}
                                        </Text>
                                    </View>
                                    <View className="flex-1 flex-row items-center justify-end gap-1.5">
                                        <Text
                                            className="text-lg font-bold"
                                            style={{ color: lado === "ele" ? corEle : COLORS.textMuted }}
                                        >
                                            {formatarNumero(m.dele)}{m.sufixo || ""}
                                        </Text>
                                        {m.label === "Ofensiva Atual" && lado === "ele" && <Flame size={14} color={COLORS.amber} />}
                                    </View>
                                </View>
                                <View className="flex-row gap-1" style={{ height: 8 }}>
                                    <View style={{ height: '100%', width: `${pctEu}%`, backgroundColor: corEu, opacity: lado === "ele" ? 0.3 : 1, borderRadius: 4 }} />
                                    <View style={{ height: '100%', width: `${pctEle}%`, backgroundColor: corEle, opacity: lado === "eu" ? 0.3 : 1, borderRadius: 4 }} />
                                </View>
                            </View>
                        );
                    })}
                </View>

                {/* Matéria favorita (neutro, cor de cada lado) */}
                <View className="mt-5 pt-4 border-t border-slate-800">
                    <View className="flex-row items-center justify-center gap-1.5 mb-3">
                        <BookOpen size={13} color={COLORS.textMuted} />
                        <Text className="text-[10px] font-semibold text-slate-500 tracking-wider">MATÉRIA FAVORITA</Text>
                    </View>
                    <View className="flex-row gap-2.5">
                        <View className="flex-1 py-3 rounded-xl items-center" style={{ backgroundColor: `${corEu}1a`, borderWidth: 1, borderColor: `${corEu}40` }}>
                            <Text className="text-sm font-semibold" style={{ color: corEu }} numberOfLines={1}>
                                {eu.profile.materia_favorita || "—"}
                            </Text>
                        </View>
                        <View className="flex-1 py-3 rounded-xl items-center" style={{ backgroundColor: `${corEle}1a`, borderWidth: 1, borderColor: `${corEle}40` }}>
                            <Text className="text-sm font-semibold" style={{ color: corEle }} numberOfLines={1}>
                                {ele.profile.materia_favorita || "—"}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={{ height: 20 }} />
            </ScrollView>

            {/* CTA */}
            <View className="px-5 pb-2 pt-3 border-t border-slate-800">
                <TouchableOpacity
                    onPress={desafiar}
                    className="h-[52px] rounded-2xl items-center justify-center flex-row gap-2"
                    style={{ backgroundColor: corEu }}
                >
                    <Swords size={18} color="#fff" />
                    <Text className="text-white font-bold text-base">Desafiar {ele.profile.nome_usuario}</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
