import { View, Text, TouchableOpacity } from "react-native";
import { ChevronRight, Star, Target } from "lucide-react-native";
import { HADES } from "@/constants/hades";
import { BADGE_LEVEL_COLORS, BadgeType } from "@/constants/badges";
import { BADGE_ICON_MAP as iconMap } from "@/constants/badgeIcons";

function Cabecalho({ desbloqueadas, total, onVerTodas }: { desbloqueadas: number; total: number; onVerTodas?: () => void }) {
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: onVerTodas ? 16 : 14,
            }}
        >
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: HADES.text, letterSpacing: -0.2 }}>
                    Medalhas
                </Text>
                <Text style={{ fontSize: 12, color: HADES.textFaint }}>
                    {desbloqueadas}/{total}
                </Text>
            </View>
            {onVerTodas && (
                <TouchableOpacity
                    onPress={onVerTodas}
                    activeOpacity={0.7}
                    style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Text style={{ fontSize: 12.5, color: HADES.textMuted, fontWeight: "600" }}>
                        Ver todas
                    </Text>
                    <ChevronRight size={15} color={HADES.textMuted} />
                </TouchableOpacity>
            )}
        </View>
    );
}

type Props = {
    recentes: BadgeType[];
    proximas: { badge: BadgeType; progress: number }[];
    desbloqueadas: number;
    total: number;
    onVerTodas: () => void;
};

export default function CardMedalhas({ recentes, proximas, desbloqueadas, total, onVerTodas }: Props) {
    return (
        <View
            style={{
                backgroundColor: HADES.surface,
                borderWidth: 1,
                borderColor: HADES.border,
                borderRadius: 16,
                padding: 16,
                marginBottom: 16,
            }}
        >
            <Cabecalho desbloqueadas={desbloqueadas} total={total} onVerTodas={onVerTodas} />

            {recentes.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 16 }}>
                    <Text style={{ fontSize: 12, color: HADES.textDim }}>
                        Nenhuma medalha conquistada ainda.
                    </Text>
                </View>
            ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 14 }}>
                    {recentes.map((badge) => {
                        const BadgeIcon = iconMap[badge.icon] || Star;
                        const cor = BADGE_LEVEL_COLORS[badge.level];
                        return (
                            <View key={badge.id} style={{ width: "33.33%", alignItems: "center", gap: 7 }}>
                                <View
                                    style={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: 22,
                                        backgroundColor: `${cor}24`,
                                        borderWidth: 1,
                                        borderColor: `${cor}59`,
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <BadgeIcon size={21} color={cor} />
                                </View>
                                <Text
                                    style={{
                                        fontSize: 11,
                                        color: HADES.textSecondary,
                                        fontWeight: "500",
                                        lineHeight: 14,
                                        textAlign: "center",
                                    }}
                                    numberOfLines={2}
                                >
                                    {badge.name}
                                </Text>
                            </View>
                        );
                    })}
                </View>
            )}

            {proximas.length > 0 && (
                <>
                    <View
                        style={{
                            height: 1,
                            backgroundColor: HADES.border,
                            marginTop: 18,
                            marginBottom: 16,
                        }}
                    />
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 14 }}>
                        <Target size={14} color={HADES.textMuted} />
                        <Text style={{ fontSize: 12.5, color: HADES.textSecondary, fontWeight: "600" }}>
                            Próximas a conquistar
                        </Text>
                    </View>

                    <View style={{ gap: 14 }}>
                        {proximas.map(({ badge, progress }) => {
                            const BadgeIcon = iconMap[badge.icon] || Star;
                            const cor = BADGE_LEVEL_COLORS[badge.level];
                            const pct = Math.round(progress * 100);
                            return (
                                <View key={badge.id}>
                                    <View
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            gap: 11,
                                            marginBottom: 8,
                                        }}
                                    >
                                        <View
                                            style={{
                                                width: 30,
                                                height: 30,
                                                borderRadius: 15,
                                                backgroundColor: `${cor}24`,
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}
                                        >
                                            <BadgeIcon size={15} color={cor} />
                                        </View>
                                        <Text
                                            style={{ flex: 1, fontSize: 13, color: "#e8e9ec", fontWeight: "500" }}
                                            numberOfLines={1}
                                        >
                                            {badge.name}
                                        </Text>
                                        <Text style={{ fontSize: 12, color: cor, fontWeight: "700" }}>{pct}%</Text>
                                    </View>
                                    <View
                                        style={{
                                            height: 3,
                                            borderRadius: 2,
                                            backgroundColor: HADES.surfaceOverlay,
                                            overflow: "hidden",
                                        }}
                                    >
                                        <View
                                            style={{ height: "100%", width: `${pct}%`, backgroundColor: cor }}
                                        />
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </>
            )}
        </View>
    );
}

/** Card de medalhas para quem ainda não conquistou nenhuma. */
export function CardMedalhasVazio({ primeira, total }: { primeira: BadgeType | undefined; total: number }) {
    const BadgeIcon = primeira ? iconMap[primeira.icon] || Star : Star;
    const cor = primeira ? BADGE_LEVEL_COLORS[primeira.level] : HADES.textMuted;

    return (
        <View
            style={{
                backgroundColor: HADES.surface,
                borderWidth: 1,
                borderColor: HADES.border,
                borderRadius: 16,
                padding: 16,
                marginBottom: 16,
            }}
        >
            <Cabecalho desbloqueadas={0} total={total} />

            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 13,
                    backgroundColor: HADES.bg,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.07)",
                    borderRadius: 13,
                    padding: 14,
                }}
            >
                <View
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: `${cor}24`,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <BadgeIcon size={19} color={cor} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: HADES.text }}>
                        {primeira?.name ?? "Primeira Sessão"}
                    </Text>
                    <Text style={{ fontSize: 12, color: HADES.textFaint, marginTop: 2 }}>
                        Sua primeira medalha está a uma sessão de distância
                    </Text>
                </View>
            </View>

            <Text style={{ fontSize: 12, color: HADES.textDim, marginTop: 12, textAlign: "center" }}>
                Comece a estudar para desbloquear as {total} medalhas.
            </Text>
        </View>
    );
}
