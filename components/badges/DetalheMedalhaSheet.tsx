import { View, Text, Modal, Pressable } from "react-native";
import { Lock, Star, Timer } from "lucide-react-native";
import { router } from "expo-router";
import { HADES } from "@/constants/hades";
import { BADGE_LEVEL_COLORS, BADGE_LEVEL_LABELS, BadgeType } from "@/constants/badges";
import { BADGE_ICON_MAP } from "@/constants/badgeIcons";

const UNIT_LABELS: Record<BadgeType["requirementType"], string> = {
    hours: "horas",
    questions: "questões",
    sessions: "sessões",
    weekly_goal: "semanas",
};

type Props = {
    badge: BadgeType | null;
    isUnlocked: boolean;
    progress: number; // 0..1
    currentVal: number;
    onClose: () => void;
};

export default function DetalheMedalhaSheet({ badge, isUnlocked, progress, currentVal, onClose }: Props) {
    const visible = !!badge;
    if (!badge) return null;

    const cor = BADGE_LEVEL_COLORS[badge.level];
    const BadgeIcon = BADGE_ICON_MAP[badge.icon] || Star;
    const pct = Math.round(progress * 100);
    const unit = UNIT_LABELS[badge.requirementType];
    const atual = Math.min(Math.round(currentVal), badge.requirementValue);
    const faltam = Math.max(badge.requirementValue - atual, 0);

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.62)" }} onPress={onClose}>
                <View style={{ flex: 1, justifyContent: "flex-end" }}>
                    <Pressable
                        style={{
                            backgroundColor: HADES.surface,
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.08)",
                            borderTopLeftRadius: 26,
                            borderTopRightRadius: 26,
                            paddingTop: 12,
                            paddingHorizontal: 22,
                            paddingBottom: 28,
                        }}
                    >
                        <View style={{ alignItems: "center", marginBottom: 18 }}>
                            <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: HADES.dot }} />
                        </View>

                        <View style={{ alignItems: "center" }}>
                            <View
                                style={{
                                    width: 96,
                                    height: 96,
                                    borderRadius: 48,
                                    backgroundColor: `${cor}1a`,
                                    borderWidth: 1,
                                    borderColor: `${cor}47`,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <BadgeIcon size={44} color={cor} />
                                {!isUnlocked && (
                                    <View
                                        style={{
                                            position: "absolute",
                                            bottom: 2,
                                            right: 2,
                                            width: 26,
                                            height: 26,
                                            borderRadius: 13,
                                            backgroundColor: HADES.surfaceRaised,
                                            borderWidth: 2,
                                            borderColor: HADES.surface,
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <Lock size={12} color={HADES.textMuted} />
                                    </View>
                                )}
                            </View>
                        </View>

                        <View style={{ alignItems: "center", marginTop: 16 }}>
                            <View
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 5,
                                    backgroundColor: `${cor}1f`,
                                    borderRadius: 7,
                                    paddingVertical: 4,
                                    paddingHorizontal: 10,
                                }}
                            >
                                <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: cor }} />
                                <Text style={{ fontSize: 10.5, fontWeight: "800", letterSpacing: 0.5, color: cor }}>
                                    {BADGE_LEVEL_LABELS[badge.level].toUpperCase()}
                                </Text>
                            </View>

                            <Text
                                style={{
                                    fontSize: 23,
                                    fontWeight: "800",
                                    color: HADES.text,
                                    marginTop: 12,
                                    letterSpacing: -0.4,
                                    textAlign: "center",
                                }}
                            >
                                {badge.name}
                            </Text>
                            <Text
                                style={{
                                    fontSize: 13.5,
                                    color: HADES.textMuted,
                                    marginTop: 7,
                                    lineHeight: 20,
                                    textAlign: "center",
                                }}
                            >
                                {badge.description}
                            </Text>
                        </View>

                        {isUnlocked ? (
                            <View
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 8,
                                    backgroundColor: HADES.bg,
                                    borderWidth: 1,
                                    borderColor: `${cor}30`,
                                    borderRadius: 14,
                                    padding: 16,
                                    marginTop: 20,
                                }}
                            >
                                <Star size={16} color={cor} />
                                <Text style={{ fontSize: 13, color: HADES.textSecondary, fontWeight: "600" }}>
                                    Você já conquistou esta medalha!
                                </Text>
                            </View>
                        ) : (
                            <>
                                <View
                                    style={{
                                        backgroundColor: HADES.bg,
                                        borderWidth: 1,
                                        borderColor: HADES.border,
                                        borderRadius: 14,
                                        padding: 16,
                                        marginTop: 20,
                                    }}
                                >
                                    <View
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "baseline",
                                            justifyContent: "space-between",
                                            marginBottom: 10,
                                        }}
                                    >
                                        <Text style={{ fontSize: 12.5, color: HADES.textMuted, fontWeight: "600" }}>
                                            Seu progresso
                                        </Text>
                                        <Text style={{ fontSize: 13, color: HADES.text, fontWeight: "700" }}>
                                            {atual}{" "}
                                            <Text style={{ color: HADES.textDim, fontWeight: "500" }}>
                                                / {badge.requirementValue} {unit}
                                            </Text>
                                        </Text>
                                    </View>
                                    <View
                                        style={{
                                            height: 9,
                                            borderRadius: 5,
                                            backgroundColor: HADES.surfaceOverlay,
                                            overflow: "hidden",
                                        }}
                                    >
                                        <View style={{ height: "100%", width: `${pct}%`, borderRadius: 5, backgroundColor: cor }} />
                                    </View>
                                    {faltam > 0 && (
                                        <Text style={{ fontSize: 12.5, color: HADES.textSecondary, marginTop: 12 }}>
                                            Faltam{" "}
                                            <Text style={{ color: HADES.text, fontWeight: "700" }}>
                                                {faltam} {unit}
                                            </Text>{" "}
                                            para desbloquear.
                                        </Text>
                                    )}
                                </View>

                                <Pressable
                                    onPress={() => {
                                        onClose();
                                        router.push("/(tabs)/focus");
                                    }}
                                    style={{
                                        height: 52,
                                        borderRadius: 14,
                                        backgroundColor: HADES.accentSolid,
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexDirection: "row",
                                        gap: 8,
                                        marginTop: 16,
                                    }}
                                >
                                    <Timer size={18} color="#000" />
                                    <Text style={{ fontSize: 15, fontWeight: "700", color: "#000" }}>Estudar agora</Text>
                                </Pressable>
                            </>
                        )}
                    </Pressable>
                </View>
            </Pressable>
        </Modal>
    );
}
