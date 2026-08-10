import { View, Text } from "react-native";
import IlustracaoMetaBatida from "@/components/grupo/IlustracaoMetaBatida";
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

        /*
          Semana batida é um estado, não uma medição — por isso este ramo é montado como um
          empty state (ilustração, título, uma frase) e não como o cartão de progresso do
          ramo de baixo. A barra cheia saiu junto: 100% desenhado é o único número que a
          própria frase já diz, e era ele que fazia o cartão parecer um gráfico de enfeite.
        */
        return (
            <View
                style={{
                    borderWidth: 1,
                    borderColor: "rgba(48,209,88,0.28)",
                    borderRadius: 16,
                    paddingVertical: 22,
                    paddingHorizontal: 20,
                    marginBottom: 18,
                    alignItems: "center",
                }}
            >
                <IlustracaoMetaBatida size={112} />

                <Text
                    style={{
                        fontSize: 16.5,
                        fontWeight: "700",
                        color: "#eafff2",
                        letterSpacing: -0.2,
                        marginTop: 14,
                    }}
                >
                    Meta da semana batida!
                </Text>

                <Text
                    style={{
                        fontSize: 13,
                        color: "#7fae91",
                        textAlign: "center",
                        lineHeight: 19,
                        marginTop: 6,
                    }}
                >
                    O grupo fez{" "}
                    <Text style={{ color: HADES.green, fontWeight: "700" }}>
                        {Math.round(horasFeitas)}h
                    </Text>{" "}
                    das {Math.round(metaTotal)}h combinadas
                    {acima > 0 ? ` — ${acima}h a mais que o combinado.` : "."}
                </Text>
            </View>
        );
    }

    return (
        <View
            style={{
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

            <View className="flex-row justify-between align-baseline">
                <Text style={{ fontSize: 12, color: HADES.textFaint, marginTop: 9,}}>
                    {semMeta
                        ? "Nenhuma meta definida ainda"
                        : `${Math.round(metaTotal)}h esta semana`}
                </Text>
            </View>
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
