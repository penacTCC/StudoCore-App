import { View, Text, TouchableOpacity, Image } from "react-native";
import { Flame, Pencil, PartyPopper } from "lucide-react-native";
import { HADES } from "@/constants/hades";

type Props = {
    nome: string;
    desde: string;
    foto: string | null;
    iniciais: string;
    corAvatar: string;
    ofensiva: number;
    /** Sem meta e sem histórico: mostra o selo NOVO e esconde o progresso. */
    novo?: boolean;
    metaAtual: number;
    metaAlvo: number;
    progressoPercent: number;
    onEditarMeta: () => void;
};

export default function CartaoIdentidade({
    nome,
    desde,
    foto,
    iniciais,
    corAvatar,
    ofensiva,
    novo,
    metaAtual,
    metaAlvo,
    progressoPercent,
    onEditarMeta,
}: Props) {
    const metaAtingida = metaAtual >= metaAlvo;
    const faltam = metaAlvo - metaAtual;

    return (
        <View
            style={{
                backgroundColor: HADES.surface,
                borderWidth: 1,
                borderColor: HADES.border,
                borderRadius: 16,
                padding: 18,
                marginBottom: 16,
            }}
        >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <View style={{ position: "relative" }}>
                    <View
                        style={{
                            width: 60,
                            height: 60,
                            borderRadius: 30,
                            backgroundColor: corAvatar,
                            alignItems: "center",
                            justifyContent: "center",
                            overflow: "hidden",
                        }}
                    >
                        {foto ? (
                            <Image source={{ uri: foto }} style={{ width: "100%", height: "100%" }} />
                        ) : (
                            <Text
                                style={{
                                    fontSize: 22,
                                    fontWeight: "700",
                                    color: "#fff",
                                    letterSpacing: 0.5,
                                }}
                            >
                                {iniciais}
                            </Text>
                        )}
                    </View>

                    {/* Ofensiva atual */}
                    {!novo && (
                        <View
                            style={{
                                position: "absolute",
                                bottom: -3,
                                right: -4,
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 2,
                                backgroundColor: HADES.surfaceRaised,
                                borderWidth: 1.5,
                                borderColor: HADES.surface,
                                borderRadius: 11,
                                paddingVertical: 3,
                                paddingLeft: 5,
                                paddingRight: 7,
                            }}
                        >
                            <Flame size={13} color={HADES.accentSolid} />
                            <Text style={{ fontSize: 12, fontWeight: "700", color: HADES.text }}>
                                {ofensiva}
                            </Text>
                        </View>
                    )}
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text
                            style={{
                                fontSize: 19,
                                fontWeight: "700",
                                color: HADES.text,
                                letterSpacing: -0.2,
                            }}
                            numberOfLines={1}
                        >
                            {nome}
                        </Text>
                        {novo && (
                            <Text
                                style={{
                                    fontSize: 10,
                                    fontWeight: "700",
                                    color: HADES.accentSolid,
                                    backgroundColor: HADES.tintAccent,
                                    borderRadius: 6,
                                    paddingVertical: 3,
                                    paddingHorizontal: 7,
                                    overflow: "hidden",
                                }}
                            >
                                NOVO
                            </Text>
                        )}
                    </View>
                    <Text style={{ fontSize: 12.5, color: HADES.textFaint, marginTop: novo ? 3 : 2 }}>
                        {desde}
                    </Text>
                </View>
            </View>

            {!novo && (
                <>
                    <View style={{ height: 1, backgroundColor: HADES.border, marginVertical: 16 }} />

                    <TouchableOpacity onPress={onEditarMeta} activeOpacity={0.8}>
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginBottom: 12,
                            }}
                        >
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
                                <Text style={{ fontSize: 13, fontWeight: "600", color: HADES.textSecondary }}>
                                    Meta semanal
                                </Text>
                                <View
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 4,
                                        backgroundColor: HADES.surfaceOverlay,
                                        borderRadius: 7,
                                        paddingVertical: 4,
                                        paddingHorizontal: 8,
                                    }}
                                >
                                    <Pencil size={11} color={HADES.textMuted} />
                                    <Text style={{ fontSize: 11, color: HADES.textMuted, fontWeight: "600" }}>
                                        Editar
                                    </Text>
                                </View>
                            </View>
                            <Text style={{ fontSize: 14, color: HADES.text, fontWeight: "700" }}>
                                {metaAtual}h{" "}
                                <Text style={{ color: HADES.textDim, fontWeight: "500" }}>/ {metaAlvo}h</Text>
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
                            <View
                                style={{
                                    height: "100%",
                                    width: `${progressoPercent}%`,
                                    borderRadius: 5,
                                    backgroundColor: metaAtingida ? HADES.green : HADES.accentSolid,
                                }}
                            />
                        </View>

                        {metaAtingida ? (
                            <View
                                style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 9 }}
                            >
                                <PartyPopper size={14} color={HADES.green} />
                                <Text style={{ fontSize: 12.5, color: HADES.green, fontWeight: "600" }}>
                                    Meta semanal atingida! Parabéns!
                                </Text>
                            </View>
                        ) : (
                            <Text style={{ fontSize: 12.5, color: HADES.textMuted, marginTop: 9 }}>
                                Faltam <Text style={{ color: HADES.text, fontWeight: "600" }}>{faltam} horas</Text>{" "}
                                para atingir sua meta!
                            </Text>
                        )}
                    </TouchableOpacity>
                </>
            )}
        </View>
    );
}
