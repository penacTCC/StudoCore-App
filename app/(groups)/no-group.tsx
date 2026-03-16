import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus, Compass, ArrowLeft } from "lucide-react-native";
import { router } from "expo-router";
import { COLORS } from "@/constants/colors";

export default function NoGroupScreen() {
    return (
        <SafeAreaView className="flex-1 bg-navy-950 items-center justify-center px-6">
            {/* Back button */}
            <TouchableOpacity
                onPress={() => router.back()}
                style={{
                    position: "absolute",
                    left: 20,
                    top: 56,
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: "rgba(16,24,43,0.06)",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <ArrowLeft size={20} color={COLORS.bgPrimary} />
            </TouchableOpacity>
            <View className="items-center max-w-sm w-full">
                {/* Icon or Graphic can go here */}
                <View className="w-24 h-24 bg-navy-900 rounded-full items-center justify-center mb-6">
                    <Compass size={48} color={COLORS.textMuted} />
                </View>

                <Text className="text-2xl font-bold text-slate-200 text-center mb-2">
                    Você ainda não tem um grupo
                </Text>
                <Text className="text-slate-400 text-center mb-10">
                    Junte-se a um grupo existente ou crie o seu próprio para começar a estudar em equipe.
                </Text>

                <View className="w-full gap-4">
                    <TouchableOpacity
                        onPress={() => router.push("/create-group")}
                        className="w-full flex-row items-center justify-center gap-2 bg-brand-500 py-4 rounded-xl"
                    >
                        <Plus size={20} color={COLORS.white} />
                        <Text className="text-white font-semibold text-lg">
                            Criar um grupo
                        </Text>
                    </TouchableOpacity>

                    <View className="flex-row items-center justify-center my-2">
                        <View className="flex-1 h-[1px] bg-navy-800" />
                        <Text className="text-slate-500 mx-4 font-medium">Ou</Text>
                        <View className="flex-1 h-[1px] bg-navy-800" />
                    </View>

                    <TouchableOpacity
                        onPress={() => router.push("/(groups)/browse-groups")}
                        className="w-full flex-row items-center justify-center gap-2 border border-brand-500/30 py-4 rounded-xl"
                        style={{ backgroundColor: "rgba(247, 152, 44, 0.1)" }}
                    >
                        <Compass size={20} color={COLORS.violetLight} />
                        <Text className="text-slate-200 font-semibold text-lg">
                            Explorar grupos públicos
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}
