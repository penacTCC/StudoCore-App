import { View, Text } from "react-native";
import { PartyPopper } from "lucide-react-native";
import { HADES } from "@/constants/hades";

type Props = {
    percentual: number;
    horasFeitas: number;
    metaTotal: number;
    metaPorMembro: number;
};

export default function MetaGrupo({ percentual, horasFeitas, metaTotal, metaPorMembro }: Props) {
    const semMeta = metaTotal <= 0;
    const atingida = !semMeta && horasFeitas >= metaTotal;

    if (atingida) {
        const acima = Math.round(horasFeitas - metaTotal);
        const percentualReal = Math.round((horasFeitas / metaTotal) * 100);

        return (
            <View
                style={{
                    backgroundColor: "rgba(48,209,88,0.07)",
                    borderWidth: 1,
                    borderColor: "rgba(48,209,88,0.35)",
                    borderRadius: 16,
                    padding: 18,
                    marginBottom: 18,
                }}
            >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <PartyPopper size={20} color={HADES.green} />
                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#eafff2" }}>
                        Meta da semana batida!
                    </Text>
                </View>

                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        marginTop: 14,
                        marginBottom: 11,
                    }}
                >
                    <Text style={{ fontSize: 13, color: "#7fae91" }}>
                        {Math.round(horasFeitas)}h de {Math.round(metaTotal)}h
                    </Text>
                    <Text style={{ fontSize: 13, color: HADES.green, fontWeight: "700" }}>
                        {percentualReal}%{acima > 0 ? ` · +${acima}h acima` : ""}
                    </Text>
                </View>

                <Barra largura="100%" cor={HADES.green} />

                <Text style={{ fontSize: 12, color: "#7fae91", marginTop: 9 }}>
                    O grupo todo mandou bem. Bora manter o ritmo. 🔥
                </Text>
            </View>
        );
    }

    return (
        <View
            style={{
                backgroundColor: HADES.surface,
                borderWidth: 1,
                borderColor: HADES.border,
                borderRadius: 16,
                paddingVertical: 15,
                paddingHorizontal: 16,
                marginBottom: 18,
            }}
        >
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    marginBottom: 11,
                }}
            >
                <Text style={{ fontSize: 14, fontWeight: "600", color: HADES.textSecondary }}>
                    Meta do grupo
                </Text>
                <Text
                    style={{
                        fontSize: 13,
                        fontWeight: semMeta ? "600" : "700",
                        color: semMeta ? HADES.textFaint : HADES.accentSolid,
                    }}
                >
                    {semMeta ? "definir" : `${percentual}% atingida`}
                </Text>
            </View>

            <Barra
                largura={semMeta ? "2%" : `${percentual}%`}
                cor={semMeta ? HADES.dot : HADES.accentSolid}
            />

            <Text style={{ fontSize: 12, color: HADES.textFaint, marginTop: 9 }}>
                {semMeta
                    ? "Nenhuma meta definida ainda"
                    : `${Math.round(horasFeitas)}h de ${Math.round(metaTotal)}h esta semana · ${metaPorMembro}h por membro`}
            </Text>
        </View>
    );
}

function Barra({ largura, cor }: { largura: string; cor: string }) {
    return (
        <View
            style={{ height: 9, borderRadius: 5, backgroundColor: HADES.surfaceOverlay, overflow: "hidden" }}
        >
            <View style={{ height: "100%", width: largura as any, borderRadius: 5, backgroundColor: cor }} />
        </View>
    );
}
