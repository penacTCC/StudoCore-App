import { View, Text, TouchableOpacity } from "react-native";
import { Crown } from "lucide-react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, RadialGradient, Stop, Circle } from "react-native-svg";
import { HADES } from "@/constants/hades";
import Avatar from "@/components/ui/Avatar";

export const OURO = "#f2b03d";
export const PRATA = "#cbd5e1";
export const BRONZE = "#fb923c";
const OURO_GRADIENTE = ["#fde68a", "#f2b03d", "#b8792a"] as const;

/** Aplica um gradiente dourado sobre qualquer conteúdo (texto ou ícone). */
export function DouradoGradiente({ children }: { children: React.ReactElement }) {
    return (
        <MaskedView maskElement={children}>
            <LinearGradient
                colors={OURO_GRADIENTE}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={{ opacity: 0 }}>{children}</View>
            </LinearGradient>
        </MaskedView>
    );
}

/** Brilho dourado radial (de verdade, via SVG) atrás do avatar do 1º lugar. */
function BrilhoDourado({ size }: { size: number }) {
    return (
        <Svg width={size} height={size}>
            <Defs>
                <RadialGradient id="brilhoDourado" cx="50%" cy="50%" r="50%">
                    <Stop offset="0%" stopColor={OURO} stopOpacity={0.5} />
                    <Stop offset="55%" stopColor={OURO} stopOpacity={0.2} />
                    <Stop offset="100%" stopColor={OURO} stopOpacity={0} />
                </RadialGradient>
            </Defs>
            <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#brilhoDourado)" />
        </Svg>
    );
}

/** Cor do número da posição: pódio colorido, resto neutro. */
export function corDaPosicao(rank: number) {
    if (rank === 1) return OURO;
    if (rank === 2) return PRATA;
    if (rank === 3) return BRONZE;
    return HADES.textFaint;
}

export type LinhaRanking = {
    userId: string;
    nome: string;
    foto?: string | null;
    minutos: number;
    ofensiva: number;
    admin: boolean;
    online: boolean;
    ehVoce: boolean;
};

const TAMANHOS = {
    compacta: { avatar: [52, 64, 52], bar: [58, 84, 46], numero: [26, 34, 24], nome: [12.5, 13.5, 12.5], tempo: [12, 13, 12], coroa: 20, gap: 9 },
    completa: { avatar: [56, 70, 56], bar: [66, 98, 52], numero: [30, 40, 28], nome: [12.5, 14, 12.5], tempo: [12, 13.5, 12], coroa: 22, gap: 10 },
} as const;

type Props = {
    linhas: LinhaRanking[];
    formatarMinutos: (m: number) => string;
    onAbrirMembro: (linha: LinhaRanking, rank: number) => void;
    /** compacta = pódio da home do grupo; completa = tela de ranking completo. */
    variante?: keyof typeof TAMANHOS;
};

/** Pódio com o top 3 do ranking: 2º à esquerda, 1º ao centro (mais alto), 3º à direita. */
export default function PodioRanking({ linhas, formatarMinutos, onAbrirMembro, variante = "compacta" }: Props) {
    const t = TAMANHOS[variante];
    const ordem = [linhas[1], linhas[0], linhas[2]];
    const ranks = [2, 1, 3];

    if (!linhas[0]) return null;

    return (
        <View style={{ paddingTop: 22, paddingHorizontal: 4, marginBottom: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: t.gap }}>
                {ordem.map((linha, i) => {
                    if (!linha) return <View key={`vazio-${i}`} style={{ flex: 1 }} />;

                    const rank = ranks[i];
                    const cor = corDaPosicao(rank);
                    const ehPrimeiro = rank === 1;

                    return (
                        <TouchableOpacity
                            key={linha.userId}
                            onPress={() => onAbrirMembro(linha, rank)}
                            activeOpacity={0.85}
                            style={{ flex: 1, alignItems: "center", minWidth: 0 }}
                        >
                            {ehPrimeiro && (
                                <Crown size={t.coroa} color={OURO} style={{ marginBottom: 5 }} />
                            )}

                            <View style={{ width: t.avatar[i], height: t.avatar[i], alignItems: "center", justifyContent: "center" }}>
                                {ehPrimeiro && (
                                    <View
                                        pointerEvents="none"
                                        style={{
                                            position: "absolute",
                                            width: t.avatar[i] + 46,
                                            height: t.avatar[i] + 46,
                                            left: -23,
                                            top: -23,
                                        }}
                                    >
                                        <BrilhoDourado size={t.avatar[i] + 46} />
                                    </View>
                                )}
                                <View
                                    style={{
                                        width: t.avatar[i],
                                        height: t.avatar[i],
                                        borderRadius: t.avatar[i] / 2,
                                        borderWidth: 2,
                                        borderColor: cor,
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <Avatar foto={linha.foto} nome={linha.nome} size={t.avatar[i] - 4} />
                                </View>
                            </View>

                            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8, maxWidth: "100%" }}>
                                {ehPrimeiro ? (
                                    <DouradoGradiente>
                                        <Text numberOfLines={1} style={{ fontSize: t.nome[i], fontWeight: "700", color: "#000" }}>
                                            {linha.nome}
                                        </Text>
                                    </DouradoGradiente>
                                ) : (
                                    <Text numberOfLines={1} style={{ fontSize: t.nome[i], fontWeight: "600", color: HADES.text, maxWidth: "100%" }}>
                                        {linha.nome}
                                    </Text>
                                )}
                                {linha.ehVoce && (
                                    <Text
                                        style={{
                                            fontSize: 8,
                                            fontWeight: "800",
                                            letterSpacing: 0.4,
                                            color: ehPrimeiro ? OURO : HADES.textMuted,
                                            backgroundColor: ehPrimeiro ? "rgba(242,176,61,0.16)" : HADES.surfaceOverlay,
                                            borderRadius: 4,
                                            paddingVertical: 2,
                                            paddingHorizontal: 5,
                                        }}
                                    >
                                        VOCÊ
                                    </Text>
                                )}
                            </View>

                            <Text style={{ fontSize: t.tempo[i], fontWeight: ehPrimeiro ? "800" : "700", color: cor, marginTop: 2 }}>
                                {formatarMinutos(linha.minutos)}
                            </Text>

                            <View
                                style={{
                                    width: "100%",
                                    height: t.bar[i],
                                    marginTop: 9,
                                    borderTopLeftRadius: 12,
                                    borderTopRightRadius: 12,
                                    borderTopWidth: 2,
                                    borderTopColor: cor,
                                    backgroundColor: HADES.surfaceRaised,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <Text style={{ fontSize: t.numero[i], fontWeight: "800", color: cor, opacity: 0.55 }}>
                                    {rank}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}
