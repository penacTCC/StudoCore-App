import { View, Text, TouchableOpacity } from "react-native";
import { ChevronRight, Star, Target } from "@/components/ui/icons";
import { HADES } from "@/constants/hades";
import { BADGE_LEVEL_COLORS, BadgeType } from "@/constants/badges";
import IconeMedalha from "@/components/badges/IconeMedalha";

function Cabecalho({ desbloqueadas, total, onVerTodas }: { desbloqueadas: number; total: number; onVerTodas?: () => void }) {
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 16,
            }}
        >
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                <Text style={{ fontSize: 11.5, fontWeight: "700", color: HADES.textMuted, letterSpacing: 0.8, textTransform: "uppercase" }}>
                    Medalhas
                </Text>
                <Text style={{ fontSize: 11.5, color: HADES.textDim }}>
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
                    <Text style={{ fontSize: 11.5, color: HADES.textMuted, fontWeight: "600" }}>
                        Ver Todas
                    </Text>
                    <ChevronRight size={14} color={HADES.textMuted} />
                </TouchableOpacity>
            )}
        </View>
    );
}

type Props = {
    recentes: BadgeType[];
    /** Quando omitido, a seção "Próximas a conquistar" não é exibida (perfil de outro usuário). */
    proximas?: { badge: BadgeType; progress: number }[];
    desbloqueadas: number;
    total: number;
    onVerTodas?: () => void;
    /** Colunas da grade de medalhas recentes: 3 no próprio perfil, 4 no de outro usuário. */
    colunas?: 3 | 4;
};

export default function CardMedalhas({ recentes, proximas, desbloqueadas, total, onVerTodas, colunas = 3 }: Props) {
    const largura = colunas === 4 ? "25%" : "33.33%";
    const diametro = colunas === 4 ? 46 : 48;
    const iconSize = colunas === 4 ? 21 : 23;

    return (
        <View>
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
                        const cor = BADGE_LEVEL_COLORS[badge.level];
                        return (
                            <View key={badge.id} style={{ width: largura, alignItems: "center", gap: 7 }}>
                                <View
                                    style={{
                                        width: diametro,
                                        height: diametro,
                                        borderRadius: diametro / 2,
                                        backgroundColor: `${cor}24`,
                                        borderWidth: 1,
                                        borderColor: `${cor}59`,
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <IconeMedalha badgeId={badge.id} icon={badge.icon} size={iconSize} color={cor} />
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

            {proximas && proximas.length > 0 && (
                <>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginTop: 20, marginBottom: 14 }}>
                        <Target size={13} color={HADES.textMuted} />
                        <Text style={{ fontSize: 12, color: HADES.textMuted, fontWeight: "600" }}>
                            Próximas a conquistar
                        </Text>
                    </View>

                    <View style={{ gap: 14 }}>
                        {proximas.map(({ badge, progress }) => {
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
                                            <IconeMedalha badgeId={badge.id} icon={badge.icon} size={15} color={cor} />
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

/** Seção de medalhas para quem ainda não conquistou nenhuma (perfil próprio: convida a agir). */
export function CardMedalhasVazio({ primeira, total }: { primeira: BadgeType | undefined; total: number }) {
    const cor = primeira ? BADGE_LEVEL_COLORS[primeira.level] : HADES.textMuted;

    return (
        <View>
            <Cabecalho desbloqueadas={0} total={total} />

            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 13,
                    borderWidth: 1,
                    borderStyle: "dashed",
                    borderColor: HADES.borderDashed,
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
                    <IconeMedalha badgeId={primeira?.id ?? ""} icon={primeira?.icon ?? "Star"} size={19} color={cor} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13.5, fontWeight: "600", color: HADES.text }}>
                        {primeira?.name ?? "Primeira Sessão"}
                    </Text>
                    <Text style={{ fontSize: 11.5, color: HADES.textFaint, marginTop: 2 }}>
                        Sua primeira medalha está a uma sessão de distância
                    </Text>
                </View>
            </View>
        </View>
    );
}

/** Seção de medalhas vazia ao ver o perfil de outra pessoa: só informa, não convida a agir. */
export function CardMedalhasVazioOutro({ total }: { total: number }) {
    return (
        <View>
            <Cabecalho desbloqueadas={0} total={total} />
            <View
                style={{
                    alignItems: "center",
                    gap: 10,
                    borderWidth: 1,
                    borderStyle: "dashed",
                    borderColor: HADES.borderDashed,
                    borderRadius: 13,
                    paddingVertical: 22,
                    paddingHorizontal: 20,
                }}
            >
                <View
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: HADES.surfaceOverlay,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Star size={19} color={HADES.textDim} />
                </View>
                <Text style={{ fontSize: 12.5, color: HADES.textMuted, textAlign: "center", lineHeight: 18 }}>
                    Nenhuma medalha conquistada ainda.{"\n"}A jornada está só começando.
                </Text>
            </View>
        </View>
    );
}
