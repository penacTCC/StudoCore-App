import { View, Text, TouchableOpacity, Image } from "react-native";
import { Users, Clock, Lock } from "lucide-react-native";
import { HADES } from "@/constants/hades";
import type { Grupo } from "@/types/grupos";

interface GroupCardProps {
    group: Grupo;
    onPress: () => void;
}

export default function GroupCard({ group, onPress }: GroupCardProps) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.8}
            style={{
                backgroundColor: HADES.surface,
                borderWidth: 1,
                borderColor: HADES.border,
                borderRadius: 16,
                overflow: "hidden",
                marginBottom: 12,
            }}
        >
            <View style={{ flexDirection: "row", padding: 14, alignItems: "center", gap: 14 }}>
                {/* Foto ou ícone do grupo */}
                <View
                    style={{
                        width: 58,
                        height: 58,
                        borderRadius: 14,
                        backgroundColor: HADES.groupVioletTint,
                        overflow: "hidden",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    {group.foto_grupo ? (
                        <Image
                            source={{ uri: group.foto_grupo }}
                            style={{ width: "100%", height: "100%" }}
                            resizeMode="cover"
                        />
                    ) : (
                        <Users size={26} color={HADES.groupViolet} />
                    )}
                </View>

                {/* Conteúdo */}
                <View style={{ flex: 1, justifyContent: "center" }}>
                    <Text
                        style={{ fontSize: 16, fontWeight: "700", color: HADES.text, marginBottom: 2 }}
                        numberOfLines={1}
                    >
                        {group.nome_grupo}
                    </Text>
                    <Text
                        style={{ fontSize: 13, color: HADES.textMuted, marginBottom: 8 }}
                        numberOfLines={1}
                    >
                        {group.descricao || "Sem descrição"}
                    </Text>

                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 4,
                                backgroundColor: HADES.surfaceOverlay,
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: 7,
                            }}
                        >
                            <Clock size={12} color={HADES.accentSolid} />
                            <Text style={{ fontSize: 10.5, color: HADES.textSecondary, fontWeight: "600" }}>
                                {group.meta_horas}h / semana
                            </Text>
                        </View>
                        {!group.publico && (
                            <View
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 4,
                                    backgroundColor: HADES.surfaceOverlay,
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderRadius: 7,
                                }}
                            >
                                <Lock size={11} color={HADES.textMuted} />
                                <Text
                                    style={{
                                        fontSize: 10,
                                        color: HADES.textMuted,
                                        fontWeight: "600",
                                        letterSpacing: 0.5,
                                        textTransform: "uppercase",
                                    }}
                                >
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
