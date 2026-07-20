import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Plus, Flame, UserPlus, Share2, Compass, ChevronRight } from "lucide-react-native";
import { HADES } from "@/constants/hades";
import Avatar from "@/components/ui/Avatar";

export type MembroCarrossel = {
    id: string;
    userId: string;
    nome: string;
    foto?: string | null;
    admin: boolean;
    ofensiva: number;
    online: boolean;
};

type Props = {
    membros: MembroCarrossel[];
    onConvidar: () => void;
    onAbrirMembro: (membro: MembroCarrossel) => void;
};

export default function MembrosGrupo({ membros, onConvidar, onAbrirMembro }: Props) {
    const sozinho = membros.length <= 1;

    return (
        <>
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 14,
                }}
            >
                <Text style={{ fontSize: 16, fontWeight: "700", color: HADES.text, letterSpacing: -0.2 }}>
                    Membros <Text style={{ color: HADES.textFaint, fontWeight: "600" }}>{membros.length}</Text>
                </Text>

                {!sozinho && (
                    <TouchableOpacity
                        onPress={onConvidar}
                        activeOpacity={0.85}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 5,
                            backgroundColor: HADES.accentSolid,
                            borderRadius: 9,
                            paddingVertical: 7,
                            paddingHorizontal: 12,
                        }}
                    >
                        <Plus size={14} color="#000" />
                        <Text style={{ fontSize: 12.5, color: "#000", fontWeight: "700" }}>Convidar</Text>
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -18, marginBottom: 22 }}
                contentContainerStyle={{ paddingHorizontal: 18, gap: 14 }}
            >
                {membros.map((membro) => (
                    <TouchableOpacity
                        key={membro.id}
                        onPress={() => onAbrirMembro(membro)}
                        activeOpacity={0.75}
                        style={{ width: 60, alignItems: "center", gap: 7 }}
                    >
                        <View style={{ position: "relative" }}>
                            <Avatar
                                foto={membro.foto}
                                nome={membro.nome}
                                size={56}
                                showOnlineDot={membro.online}
                            />

                            {membro.admin && (
                                <Text
                                    style={{
                                        position: "absolute",
                                        top: 0,
                                        right: 0,
                                        fontSize: 8,
                                        fontWeight: "700",
                                        color: "#000",
                                        backgroundColor: "#f2b03d",
                                        borderRadius: 5,
                                        paddingVertical: 1,
                                        paddingHorizontal: 4,
                                        overflow: "hidden",
                                    }}
                                >
                                    ADM
                                </Text>
                            )}

                            {membro.ofensiva >= 10 && (
                                <View style={{ position: "absolute", bottom: 0, left: 2 }}>
                                    <Flame size={15} color={HADES.accentSolid} />
                                </View>
                            )}
                        </View>

                        <Text style={{ fontSize: 11, color: HADES.textSecondary }} numberOfLines={1}>
                            {membro.nome}
                        </Text>
                    </TouchableOpacity>
                ))}

                {/* Convite aparece como um lugar vago no carrossel quando o grupo é só você. */}
                {sozinho && (
                    <TouchableOpacity
                        onPress={onConvidar}
                        activeOpacity={0.75}
                        style={{ width: 60, alignItems: "center", gap: 7 }}
                    >
                        <View
                            style={{
                                width: 56,
                                height: 56,
                                borderRadius: 28,
                                borderWidth: 1.5,
                                borderStyle: "dashed",
                                borderColor: "rgba(255,255,255,0.2)",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <Plus size={22} color={HADES.textMuted} />
                        </View>
                        <Text style={{ fontSize: 11, color: HADES.textMuted }}>Convidar</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </>
    );
}

/** Chamada de convite no topo de um grupo recém-criado. */
export function ConviteDestaque({ onConvidar }: { onConvidar: () => void }) {
    return (
        <View
            style={{
                backgroundColor: HADES.surface,
                borderWidth: 1,
                borderColor: "rgba(255,154,0,0.30)",
                borderRadius: 16,
                padding: 20,
                marginBottom: 18,
                alignItems: "center",
            }}
        >
            <View
                style={{
                    width: 52,
                    height: 52,
                    borderRadius: 15,
                    backgroundColor: HADES.tintAccent,
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <UserPlus size={26} color={HADES.accentSolid} />
            </View>

            <Text
                style={{
                    fontSize: 18,
                    fontWeight: "700",
                    color: HADES.text,
                    marginTop: 14,
                    textAlign: "center",
                }}
            >
                Grupo criado! Agora chame a galera
            </Text>
            <Text
                style={{
                    fontSize: 13,
                    color: HADES.textMuted,
                    marginTop: 6,
                    lineHeight: 19,
                    textAlign: "center",
                }}
            >
                Um grupo fica bom com gente estudando junto. Convide colegas para o ranking começar a
                esquentar.
            </Text>

            <TouchableOpacity
                onPress={onConvidar}
                activeOpacity={0.85}
                style={{
                    alignSelf: "stretch",
                    height: 50,
                    borderRadius: 14,
                    backgroundColor: HADES.accentSolid,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    marginTop: 16,
                }}
            >
                <Share2 size={17} color="#000" />
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#000" }}>Convidar colegas</Text>
            </TouchableOpacity>
        </View>
    );
}

export function CtaGruposPublicos({ onPress }: { onPress: () => void }) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.85}
            style={{
                backgroundColor: HADES.surface,
                borderWidth: 1,
                borderColor: HADES.border,
                borderRadius: 16,
                paddingVertical: 14,
                paddingHorizontal: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 13,
            }}
        >
            <View
                style={{
                    width: 44,
                    height: 44,
                    borderRadius: 13,
                    backgroundColor: HADES.surfaceOverlay,
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <Compass size={22} color={HADES.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: HADES.text }}>Grupos públicos</Text>
                <Text style={{ fontSize: 12, color: HADES.textFaint, marginTop: 1 }}>
                    Encontre e entre em grupos de estudo
                </Text>
            </View>
            <ChevronRight size={18} color={HADES.textDim} />
        </TouchableOpacity>
    );
}
