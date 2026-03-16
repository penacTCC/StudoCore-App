import { View, Text, TouchableOpacity, Image } from "react-native";
import { Users, Clock } from "lucide-react-native";
import { COLORS } from "@/constants/colors";

interface GroupCardProps {
    group: {
        id: string;
        nome_grupo: string;
        descricao: string;
        foto_grupo?: string | null;
        meta_horas: number;
        publico: boolean;
    };
    onPress: () => void;
}

export default function GroupCard({ group, onPress }: GroupCardProps) {
    return (
        <TouchableOpacity
            onPress={onPress}
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden mb-4"
        >
            <View className="flex-row p-4 items-center">
                {/* Image or initial */}
                <View className="w-16 h-16 rounded-xl bg-slate-800 overflow-hidden items-center justify-center border border-slate-700 mr-4">
                    {group.foto_grupo ? (
                        <Image source={{ uri: group.foto_grupo }} className="w-full h-full" resizeMode="cover" />
                    ) : (
                        <Users size={28} color={COLORS.textMuted} />
                    )}
                </View>

                {/* Content */}
                <View className="flex-1 justify-center">
                    <Text className="text-lg font-bold text-slate-200 mb-1" numberOfLines={1}>
                        {group.nome_grupo}
                    </Text>
                    <Text className="text-sm text-slate-400 mb-2" numberOfLines={1}>
                        {group.descricao || "Sem descrição"}
                    </Text>

                    {/* Tags */}
                    <View className="flex-row items-center gap-3">
                        <View className="flex-row items-center gap-1 bg-slate-800 px-2 py-1 rounded-md">
                            <Clock size={12} color={COLORS.primaryLight} />
                            <Text className="text-[10px] text-slate-300 font-medium">
                                {group.meta_horas}h / semana
                            </Text>
                        </View>
                        {!group.publico && (
                            <View className="bg-slate-800 px-2 py-1 rounded-md">
                                <Text className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                                    Privado
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
}
