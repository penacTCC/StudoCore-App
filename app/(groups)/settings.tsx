import { useState } from "react";

//Componentes do Native
import { View, Text, TouchableOpacity, ScrollView, Switch, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

//Componentes Lucide Native
import {
  ArrowLeft,
  Pencil,
  Globe,
  Lock,
  Target,
  Link as LinkIcon,
  LogOut,
  Trash2,
  ChevronRight,
} from "lucide-react-native";

//Componente do expo-router
import { router } from "expo-router";

//Componentes do Projeto
import { COLORS } from "@/constants/colors";
import ImagePickerAvatar from "@/components/ui/ImagePickerAvatar";

export default function GroupSettingsScreen() {
  const [isPublic, setIsPublic] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const handleLeaveGroup = () => {
    Alert.alert(
      "Sair do Grupo",
      "Tem certeza que deseja sair do Study Squad Alpha?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Sair", style: "destructive", onPress: () => router.push("/(tabs)") }
      ]
    );
  };

  const handleDeleteGroup = () => {
    Alert.alert(
      "Excluir Grupo",
      "Esta ação é irreversível. Todos os dados, arquivos e histórico do grupo serão apagados.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Excluir", style: "destructive", onPress: () => router.push("/(tabs)") }
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-950" edges={["top"]}>
      <View className="px-4 py-3 flex-row items-center justify-between border-b border-slate-900 mb-4">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-slate-900 items-center justify-center"
        >
          <ArrowLeft size={20} color={COLORS.textSecondary || "#94a3b8"} />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-slate-200">Group Settings</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        <View className="items-center mb-8 mt-2">
          <ImagePickerAvatar
            bucket="images"
            onImageUploaded={(url) => setImageUrl(url)}
          />
          <Text className="text-xl font-bold text-slate-200">Study Squad Alpha</Text>
          <Text className="text-sm text-slate-400 mt-1">Criado por você em Fev 2026</Text>
        </View>

        <View className="bg-slate-900 border border-slate-800 rounded-3xl p-2 mb-6">
          <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-4 mt-2 mb-2">Geral</Text>

          <TouchableOpacity className="flex-row items-center justify-between p-3 border-b border-slate-800/50">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-slate-800 items-center justify-center">
                <Pencil size={18} color={"#cbd5e1"} />
              </View>
              <View>
                <Text className="text-base font-medium text-slate-200">Editar Nome e Descrição</Text>
              </View>
            </View>
            <ChevronRight size={18} color={COLORS.textMuted || "#64748b"} />
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center justify-between p-3">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-slate-800 items-center justify-center">
                <Target size={18} color={COLORS.emeraldLight || "#34d399"} />
              </View>
              <View>
                <Text className="text-base font-medium text-slate-200">Meta Semanal</Text>
                <Text className="text-xs text-slate-400">Atualmente: 10 horas</Text>
              </View>
            </View>
            <ChevronRight size={18} color={COLORS.textMuted || "#64748b"} />
          </TouchableOpacity>
        </View>

        <View className="bg-slate-900 border border-slate-800 rounded-3xl p-2 mb-6">
          <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-4 mt-2 mb-2">Privacidade e Acesso</Text>

          <View className="flex-row items-center justify-between p-3 border-b border-slate-800/50">
            <View className="flex-row items-center gap-3 flex-1 pr-4">
              <View className="w-10 h-10 rounded-xl bg-slate-800 items-center justify-center">
                {isPublic ? <Globe size={18} color={COLORS.violetLight || "#a78bfa"} /> : <Lock size={18} color={COLORS.violetLight || "#a78bfa"} />}
              </View>
              <View className="flex-1">
                <Text className="text-base font-medium text-slate-200">Grupo Público</Text>
                <Text className="text-xs text-slate-400">Qualquer pessoa pode encontrar</Text>
              </View>
            </View>
            <Switch
              value={isPublic}
              onValueChange={setIsPublic}
              trackColor={{ false: "#1e293b", true: COLORS.primary || "#f59e0b" }}
              thumbColor={"#ffffff"}
            />
          </View>

          <TouchableOpacity className="flex-row items-center justify-between p-3">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-slate-800 items-center justify-center">
                <LinkIcon size={18} color={"#cbd5e1"} />
              </View>
              <View>
                <Text className="text-base font-medium text-slate-200">Link de Convite</Text>
                <Text className="text-xs text-slate-400">studocore://join/alpha-123</Text>
              </View>
            </View>
            <ChevronRight size={18} color={COLORS.textMuted || "#64748b"} />
          </TouchableOpacity>
        </View>

        <View className="bg-slate-900 border border-slate-800 rounded-3xl p-2 mb-10">
          <Text className="text-xs font-bold text-red-500/70 uppercase tracking-wider ml-4 mt-2 mb-2">Zona de Perigo</Text>

          <TouchableOpacity
            onPress={handleLeaveGroup}
            className="flex-row items-center justify-between p-3 border-b border-slate-800/50"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-red-500/10 items-center justify-center">
                <LogOut size={18} color="#ef4444" />
              </View>
              <Text className="text-base font-medium text-red-400">Sair do Grupo</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDeleteGroup}
            className="flex-row items-center justify-between p-3"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-red-500/10 items-center justify-center">
                <Trash2 size={18} color="#ef4444" />
              </View>
              <Text className="text-base font-medium text-red-400">Excluir Grupo</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}