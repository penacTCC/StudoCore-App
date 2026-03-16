import { useState } from "react";
import { View, Text, Switch, TouchableOpacity, ScrollView, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Clock, Users, Play } from "lucide-react-native";
import { router } from "expo-router";
import { COLORS } from "@/constants/colors";

export default function JoinSessionScreen() {
    const [showActivity, setShowActivity] = useState(true);
    const [allowMessages, setAllowMessages] = useState(true);

    const handleJoin = () => {
        // In a real app, this would register the user in the session
        // Direct them to the focus tab
        router.dismissAll();
        router.replace("/(tabs)/focus");
    };

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
                            <Text className="font-medium text-slate-200">Alex Chen</Text>
                            <Text className="text-sm text-violet-400">started a Math session</Text>
                        </View>
                    </View>

                    <View className="flex-row items-center gap-6">
                        <View className="flex-row items-center gap-1.5">
                            <Clock size={14} color={COLORS.textMuted} />
                            <Text className="text-sm text-slate-400">Started 2m ago</Text>
                        </View>
                        <View className="flex-row items-center gap-1.5">
                            <Users size={14} color={COLORS.textMuted} />
                            <Text className="text-sm text-slate-400">2 studying</Text>
                        </View>
                    </View>
                </View>

                {/* Privacy Options */}
                <View className="mb-6">
                    <Text className="text-sm font-medium text-slate-400 mb-4">Your settings</Text>

                    <View className="bg-navy-900 border border-navy-800 rounded-2xl overflow-hidden">
                        <View className="flex-row items-center justify-between p-4 border-b border-navy-800">
                            <Text className="text-sm font-medium text-slate-200">Show my activity</Text>
                            <Switch
                                value={showActivity}
                                onValueChange={setShowActivity}
                                trackColor={{ false: COLORS.bgTertiary, true: COLORS.primary }}
                                thumbColor={COLORS.white}
                            />
                        </View>
                        <View className="flex-row items-center justify-between p-4">
                            <Text className="text-sm font-medium text-slate-200">Allow messages</Text>
                            <Switch
                                value={allowMessages}
                                onValueChange={setAllowMessages}
                                trackColor={{ false: COLORS.bgTertiary, true: COLORS.primary }}
                                thumbColor={COLORS.white}
                            />
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
                        Join Session
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
