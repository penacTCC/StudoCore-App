import { useEffect, useState } from "react";

//Componentes do React Native
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Clock, Play, Flame } from "lucide-react-native";

//Componentes do expo router
import { router } from "expo-router";

//Constantes
import { COLORS } from "@/constants/colors";
import { useLocalSearchParams } from 'expo-router'


export default function JoinSessionScreen() {
    const { subjectColors } = useLocalSearchParams()
    const colors = JSON.parse(subjectColors as string)

    const handleJoin = () => {
        // In a real app, this would register the user in the session
        // Direct them to the focus tab
        router.dismissAll();
        router.replace("/(tabs)/focus");
    };

    //lógica do timer
    const [elapsed, setElapsed] = useState(0)

    useEffect(() => {
        const interval = setInterval(() => {
            setElapsed(e => e + 1)
        }, 1000)
        return () => clearInterval(interval)
    }, [])

    const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0')
    const seconds = String(elapsed % 60).padStart(2, '0')

    return (
        <SafeAreaView className="flex-1 bg-navy-950" edges={["top"]}>
            {/* Header */}
            <View className="px-4 py-3 flex-row items-center justify-between border-b border-navy-800">
                <Text className="text-xl font-bold text-slate-200">Join Session</Text>
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center"
                >
                    <X size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
                {/* Session Info */}
                <View className="bg-navy-900 border border-navy-800 p-4 rounded-xl mb-6">
                    <View className="flex-row items-center gap-3 mb-4">
                        <View className="w-12 h-12 rounded-full bg-slate-800 items-center justify-center">
                            <Text className="text-white font-bold text-lg">AC</Text>
                        </View>
                        <View className="flex-1">
                            <View className="flex-row items-center w-full justify-between">
                                <Text className="font-medium text-slate-200">Alex Chen</Text>
                                <View style={{ backgroundColor: "rgb(180, 83, 9, 0.4)", borderWidth: 1, borderColor: "rgba(251, 146, 60, 0.2);" }} className="flex-row items-center gap-1 px-2 py-1 rounded-lg">
                                    <Flame size={14} color={COLORS.amber} />
                                    <Text className="text-xs font-bold text-amber-400">
                                        5
                                    </Text>
                                </View>
                            </View>
                            <Text className="text-sm text-emerald-400">Estudando Agora</Text>
                        </View>
                    </View>

                    <View className="flex-row items-center gap-6">
                        <View className="flex-row items-center gap-1.5">
                            <Clock size={14} color={COLORS.textMuted} />
                            <Text className="text-sm text-slate-400">Começou há <Text className="text-brand-400">2m</Text></Text>
                        </View>
                    </View>
                    <View
                        style={{ backgroundColor: colors.bg, borderColor: colors.border }}
                        className="border p-4 mt-3 rounded-xl"
                    >
                        <View className="flex-row items-center justify-between">
                            <View className="flex-1 mr-4">
                                <Text style={{ color: colors.text }} className="text-xs font-bold tracking-widest mb-1">
                                    MATEMÁTICA
                                </Text>
                                <Text className="text-white text-sm font-semibold" numberOfLines={2}>
                                    Cálculo diferencial e integral
                                </Text>
                            </View>

                            <View className="items-end">
                                <Text className="text-white text-2xl font-bold">{minutes}:{seconds}</Text>
                                <Text className="text-slate-500 text-xs font-bold tracking-widest">AO VIVO</Text>
                            </View>
                        </View>
                    </View>
                </View>
                {/* /Cards */}
                <View className="flex-row gap-3">
                    <View className="flex-1 bg-navy-900 border border-navy-800 p-4 rounded-xl items-center">
                        <Text className="text-white text-lg font-semibold">3</Text>
                        <Text numberOfLines={1} className="text-slate-500 text-xs font-medium tracking-widest">participantes</Text>
                    </View>

                    <View className="flex-1 bg-navy-900 border border-navy-800 p-4 rounded-xl items-center">
                        <Text className="text-white text-lg font-semibold">12</Text>
                        <Text numberOfLines={1} className="text-slate-500 text-xs font-medium tracking-widest">reações</Text>
                    </View>

                    <View className="flex-1 bg-navy-900 border border-navy-800 p-4 rounded-xl items-center">
                        <Text className="text-white text-lg font-semibold">pública</Text>
                        <Text numberOfLines={1} className="text-slate-500 text-xs font-medium tracking-widest">visibilidade</Text>
                    </View>
                </View>

                {/* Container dos membros */}
                <View className="flex-row gap-3 mt-6">
                    <View className="flex-1 bg-navy-900 border border-navy-800 p-4 rounded-xl">
                        <Text className="text-[0.8rem] font-bold tracking-widest text-slate-400">PARTICIPANTES</Text>

                        <View className="flex-row items-center gap-3 mb-4 mt-4">
                            <View style={{ backgroundColor: "#1e3a5f" }} className="w-12 h-12 rounded-full items-center justify-center">
                                <Text className="text-white font-bold text-sm">AC</Text>
                            </View>
                            <View className="flex-1 flex-row justify-between">
                                <View>
                                    <Text className="font-medium text-sm text-slate-200">Alex Chen</Text>
                                    <Text className="text-xs text-slate-500 tracking-wide">anfitrião</Text>
                                </View>
                                <View className="flex-row items-center gap-1"><Text className="text-xs text-slate-500">2m</Text></View>
                            </View>
                        </View>

                        <View className="flex-row items-center gap-3 mb-4 mt-4">
                            <View style={{ backgroundColor: "#2d1b4e" }} className="w-12 h-12 rounded-full items-center justify-center">
                                <Text className="text-white font-bold text-sm">MR</Text>
                            </View>
                            <View className="flex-1 flex-row justify-between">
                                <View>
                                    <Text className="font-medium text-sm text-slate-200">Maria Ribeiro</Text>
                                    <Text className="text-xs text-slate-500 tracking-wide">participante</Text>
                                </View>
                                <View className="flex-row items-center gap-1"><Text className="text-xs text-slate-500">2m</Text></View>
                            </View>
                        </View>

                        <View className="flex-row items-center gap-3 mb-4 mt-4">
                            <View style={{ backgroundColor: "#1a3320" }} className="w-12 h-12 rounded-full items-center justify-center">
                                <Text className="text-white font-bold text-sm">JS</Text>
                            </View>
                            <View className="flex-1 flex-row justify-between">
                                <View>
                                    <Text className="font-medium text-sm text-slate-200">João Silva</Text>
                                    <Text className="text-xs text-slate-500 tracking-wide">participante</Text>
                                </View>
                                <View className="flex-row items-center gap-1"><Text className="text-xs text-slate-500">2m</Text></View>
                            </View>
                        </View>
                    </View>
                </View>
            </ScrollView>
            {/* Bottom Button */}
            <View className="px-4 pb-6 pt-2 border-t border-navy-800" style={{ backgroundColor: COLORS.bgPrimary }}>
                <TouchableOpacity
                    onPress={handleJoin}
                    className="bg-brand-500 py-4 rounded-2xl flex-row items-center justify-center gap-2"
                >
                    <Play size={20} color={COLORS.white} />
                    <Text className="font-semibold text-lg text-white">
                        Entrar na Sessão
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
