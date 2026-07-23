import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Flame, SlidersHorizontal, ChevronDown, ChevronUp, ChevronRight } from "lucide-react-native";
import { HADES } from "@/constants/hades";
import Avatar from "@/components/ui/Avatar";
import PodioRanking, { corDaPosicao } from "@/components/grupo/PodioRanking";

export type { LinhaRanking } from "@/components/grupo/PodioRanking";
import type { LinhaRanking } from "@/components/grupo/PodioRanking";

type Props = {
    linhas: LinhaRanking[];
    filtros: { key: string; label: string }[];
    filtroAtivo: string;
    filtrosAbertos: boolean;
    rotuloFiltro: string;
    formatarMinutos: (m: number) => string;
    onToggleFiltros: () => void;
    onSelecionarFiltro: (key: string) => void;
    onVerRankingCompleto: () => void;
    onAbrirMembro: (linha: LinhaRanking, rank: number) => void;
};

export default function RankingGrupo({
    linhas,
    filtros,
    filtroAtivo,
    filtrosAbertos,
    rotuloFiltro,
    formatarMinutos,
    onToggleFiltros,
    onSelecionarFiltro,
    onVerRankingCompleto,
    onAbrirMembro,
}: Props) {
    // Além do pódio (1-3), mostra só as posições 4 e 5 aqui; o resto vive na tela de ranking completo.
    const pos4e5 = linhas.slice(3, 5);
    const temMais = linhas.length > 3;

    return (
        <>
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: 15,
                    marginBottom: filtrosAbertos ? 12 : 14,
                }}
            >
                <Text style={{ fontSize: 16, fontWeight: "700", color: HADES.text, letterSpacing: -0.2 }}>
                    Ranking
                </Text>

                {linhas.length > 1 && (
                    <TouchableOpacity
                        onPress={onToggleFiltros}
                        activeOpacity={0.8}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 5,
                            backgroundColor: filtrosAbertos ? HADES.surfaceOverlay : HADES.surfaceRaised,
                            borderWidth: 1,
                            borderColor: filtrosAbertos ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.07)",
                            borderRadius: 9,
                            paddingVertical: 6,
                            paddingHorizontal: 10,
                        }}
                    >
                        <SlidersHorizontal
                            size={13}
                            color={filtrosAbertos ? HADES.accentSolid : HADES.textMuted}
                        />
                        <Text
                            style={{
                                fontSize: 12.5,
                                color: filtrosAbertos ? HADES.text : HADES.textSecondary,
                                fontWeight: "600",
                            }}
                        >
                            {rotuloFiltro}
                        </Text>
                        {filtrosAbertos ? (
                            <ChevronUp size={13} color={HADES.textSecondary} />
                        ) : (
                            <ChevronDown size={13} color={HADES.textMuted} />
                        )}
                    </TouchableOpacity>
                )}
            </View>

            {filtrosAbertos && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginHorizontal: -18, marginBottom: 16 }}
                    contentContainerStyle={{ paddingHorizontal: 18, gap: 8 }}
                >
                    {filtros.map((filtro) => {
                        const ativo = filtro.key === filtroAtivo;
                        return (
                            <TouchableOpacity
                                key={filtro.key}
                                onPress={() => onSelecionarFiltro(filtro.key)}
                                activeOpacity={0.8}
                                style={{
                                    paddingVertical: 8,
                                    paddingHorizontal: 16,
                                    borderRadius: 10,
                                    backgroundColor: ativo ? HADES.accentSolid : HADES.surfaceRaised,
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 13,
                                        fontWeight: ativo ? "700" : "600",
                                        color: ativo ? "#000" : HADES.textSecondary,
                                    }}
                                >
                                    {filtro.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            )}

            {/* Pódio: 1º, 2º e 3º lugar */}
            <PodioRanking
                linhas={linhas}
                formatarMinutos={formatarMinutos}
                onAbrirMembro={onAbrirMembro}
                variante="compacta"
            />

            {/* Posições 4 e 5 */}
            {pos4e5.length > 0 && (
                <View
                    style={{
                        backgroundColor: HADES.surface,
                        borderWidth: 1,
                        borderColor: HADES.border,
                        borderRadius: 16,
                        paddingVertical: 4,
                        paddingHorizontal: 12,
                    }}
                >
                    {pos4e5.map((linha, i) => {
                        const rank = i + 4;
                        return (
                            <TouchableOpacity
                                key={linha.userId}
                                onPress={() => onAbrirMembro(linha, rank)}
                                activeOpacity={0.75}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 12,
                                    paddingVertical: 11,
                                    borderBottomWidth: i === pos4e5.length - 1 ? 0 : 1,
                                    borderBottomColor: "rgba(255,255,255,0.05)",
                                }}
                            >
                                <Text
                                    style={{
                                        width: 18,
                                        textAlign: "center",
                                        fontSize: 14,
                                        fontWeight: "700",
                                        color: corDaPosicao(rank),
                                    }}
                                >
                                    {rank}
                                </Text>

                                <Avatar
                                    foto={linha.foto}
                                    nome={linha.nome}
                                    size={38}
                                    showOnlineDot={linha.online}
                                />

                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                        <Text
                                            style={{ fontSize: 14, fontWeight: "600", color: HADES.text }}
                                            numberOfLines={1}
                                        >
                                            {linha.nome}
                                        </Text>
                                        <Selo linha={linha} />
                                    </View>
                                    <Ofensiva valor={linha.ofensiva} tamanho={11} />
                                </View>

                                <Text style={{ fontSize: 14, fontWeight: "700", color: HADES.textSecondary }}>
                                    {formatarMinutos(linha.minutos)}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}

            {temMais && (
                <TouchableOpacity
                    onPress={onVerRankingCompleto}
                    activeOpacity={0.7}
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                        paddingVertical: 14,
                    }}
                >
                    <Text style={{ fontSize: 13, color: HADES.textMuted, fontWeight: "600" }}>
                        Ver ranking completo
                    </Text>
                    <ChevronRight size={15} color={HADES.textMuted} />
                </TouchableOpacity>
            )}
        </>
    );
}

function Selo({ linha }: { linha: LinhaRanking }) {
    if (!linha.admin && !linha.ehVoce) return null;

    const texto = linha.ehVoce && linha.admin ? "VOCÊ · ADM" : linha.ehVoce ? "VOCÊ" : "ADM";

    return (
        <Text
            style={{
                fontSize: 9.5,
                fontWeight: "700",
                color: HADES.textMuted,
                backgroundColor: HADES.surfaceOverlay,
                borderRadius: 5,
                paddingVertical: 2,
                paddingHorizontal: 6,
                letterSpacing: 0.3,
                overflow: "hidden",
            }}
        >
            {texto}
        </Text>
    );
}

function Ofensiva({ valor, tamanho }: { valor: number; tamanho: number }) {
    if (valor <= 0) {
        return (
            <Text style={{ fontSize: 11, color: HADES.textFaint, marginTop: 2 }}>sem ofensiva</Text>
        );
    }

    return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
            <Flame size={tamanho} color={HADES.accentSolid} />
            <Text style={{ fontSize: tamanho === 12 ? 11.5 : 11, color: HADES.textMuted }}>
                {valor} {valor === 1 ? "dia" : "dias"}
            </Text>
        </View>
    );
}
