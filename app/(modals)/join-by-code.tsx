import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Link as LinkIcon } from "lucide-react-native";
import { router } from "expo-router";
import { COLORS } from "@/constants/colors";
import { useState } from "react";

export default function JoinByCodeScreen() {
    const [code, setCode] = useState("");

    const handleJoin = () => {
        // Implement join logic here
        // For now, we will just go back
        if (code.trim()) {
            router.back();
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-navy-950" edges={["top"]}>
            <View className="px-4 py-3 flex-row items-center gap-3">
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center"
                >
                    <ArrowLeft size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
                <Text className="text-xl font-bold text-slate-200">Entrar com Código</Text>
            </View>

            <View className="flex-1 px-6 pt-10">
                <View className="items-center mb-8">
                    <View className="w-16 h-16 bg-navy-900 rounded-full items-center justify-center mb-4 border border-brand-500/20">
                        <LinkIcon size={28} color={COLORS.primary} />
                    </View>
                    <Text className="text-2xl font-bold text-slate-200 text-center mb-2">
                        Possui um código ou link?
                    </Text>
                    <Text className="text-slate-400 text-center text-base">
                        Insira abaixo para entrar em um grupo privado.
                    </Text>
                </View>

                <View className="mb-6">
                    <Text className="text-slate-300 font-medium mb-2 ml-1">Código do Grupo ou Link</Text>
                    <TextInput
                        value={code}
                        onChangeText={setCode}
                        placeholder="Ex: abc-defg-hij ou https://..."
                        placeholderTextColor={COLORS.textMuted}
                        className="bg-navy-900 border border-navy-800 rounded-xl px-4 py-4 text-slate-200 text-base"
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                </View>

                <TouchableOpacity
                    onPress={handleJoin}
                    className={`w-full py-4 rounded-xl items-center justify-center ${
                        code.trim().length > 0 ? "bg-brand-500" : "bg-navy-800"
                    }`}
                    disabled={code.trim().length === 0}
                >
                    <Text
                        className={`font-semibold text-lg ${
                            code.trim().length > 0 ? "text-white" : "text-slate-500"
                        }`}
                    >
                        Entrar no Grupo
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
