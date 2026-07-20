import { View, Text, TouchableOpacity, Image, Alert, DeviceEventEmitter } from "react-native";
import { Users, Target } from "lucide-react-native";
import { router } from "expo-router";
import { HADES } from "@/constants/hades";
import { entrarEmGrupoPublico } from "@/services/grupos";
import { useGruposPublicos } from "@/hooks/useGruposPublicos";
import { salvarUltimoGrupoLocalmente } from "@/services/armazenamentoOffline";
import { CartaoGrupoPublicoProps } from "@/types/grupos";

/**
 * Card de grupo público com avatar, nome, descrição, membros, meta semanal
 * e botão Entrar, no visual HADES. Extraído de browse-groups.tsx.
 */
export default function PublicGroupCard({ grupo }: CartaoGrupoPublicoProps) {
    const { recarregarGrupos } = useGruposPublicos();

    const entrarNoGrupo = async (grupoId: string) => {
        const novoMembro = await entrarEmGrupoPublico(grupoId);
        if (!novoMembro) {
            Alert.alert("Erro", "Não foi possível entrar no grupo.");
            return;
        }

        await salvarUltimoGrupoLocalmente(grupoId);
        recarregarGrupos();
        DeviceEventEmitter.emit("groupMembershipChanged");
        router.replace({
            pathname: "/(tabs)",
            params: {
                groupId: grupoId,
                groupName: grupo.nome_grupo,
                groupPhoto: grupo.foto_grupo,
                groupGoal: grupo.meta_horas,
            },
        });
    };

    return (
        <TouchableOpacity
            onPress={() =>
                router.push({
                    pathname: "/(groups)/group-details",
                    params: { groupId: grupo.id.toString() },
                })
            }
            activeOpacity={0.8}
            style={{
                backgroundColor: HADES.surface,
                borderWidth: 1,
                borderColor: HADES.border,
                borderRadius: 16,
                padding: 14,
            }}
        >
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                {/* Avatar */}
                <View style={{ position: "relative" }}>
                    <View
                        style={{
                            width: 56,
                            height: 56,
                            borderRadius: 14,
                            backgroundColor: HADES.groupVioletTint,
                            overflow: "hidden",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        {grupo.foto_grupo ? (
                            <Image
                                source={{ uri: grupo.foto_grupo }}
                                style={{ width: "100%", height: "100%" }}
                                resizeMode="cover"
                            />
                        ) : (
                            <Users size={26} color={HADES.groupViolet} />
                        )}
                    </View>
                    {grupo.isOnline && (
                        <View
                            style={{
                                position: "absolute",
                                bottom: -2,
                                right: -2,
                                width: 14,
                                height: 14,
                                borderRadius: 7,
                                backgroundColor: HADES.green,
                                borderWidth: 2,
                                borderColor: HADES.surface,
                            }}
                        />
                    )}
                </View>

                {/* Info */}
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <Text
                            style={{ fontSize: 15, fontWeight: "600", color: HADES.text, flexShrink: 1 }}
                            numberOfLines={1}
                        >
                            {grupo.nome_grupo}
                        </Text>
                        {(grupo.activeNow ?? 0) > 0 && (
                            <View
                                style={{
                                    paddingHorizontal: 8,
                                    paddingVertical: 2,
                                    borderRadius: 999,
                                    backgroundColor: HADES.greenTint,
                                }}
                            >
                                <Text style={{ fontSize: 11, color: HADES.green }}>
                                    {grupo.activeNow ?? 0} ativos
                                </Text>
                            </View>
                        )}
                    </View>
                    <Text
                        style={{ fontSize: 13, color: HADES.textMuted, marginBottom: 8, lineHeight: 18 }}
                        numberOfLines={2}
                    >
                        {grupo.descricao || "Sem descrição"}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Users size={12} color={HADES.textFaint} />
                            <Text style={{ fontSize: 12, color: HADES.textFaint }}>
                                {grupo.members} membros
                            </Text>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Target size={12} color={HADES.textFaint} />
                            <Text style={{ fontSize: 12, color: HADES.textFaint }}>
                                {grupo.meta_horas}h/semana
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Botão Entrar */}
                <TouchableOpacity
                    onPress={() => entrarNoGrupo(grupo.id)}
                    activeOpacity={0.85}
                    style={{
                        backgroundColor: HADES.accentSolid,
                        paddingHorizontal: 16,
                        paddingVertical: 9,
                        borderRadius: 11,
                    }}
                >
                    <Text style={{ color: "#000", fontSize: 13, fontWeight: "700" }}>Entrar</Text>
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );
}
