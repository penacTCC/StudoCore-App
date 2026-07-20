import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Crown, Flame, SlidersHorizontal, ChevronDown, ChevronUp, ChevronRight, User } from "lucide-react-native";
import { HADES } from "@/constants/hades";
import Avatar from "@/components/ui/Avatar";

const OURO = "#f2b03d";
const PRATA = "#cbd5e1";
const BRONZE = "#fb923c";

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

type Props = {
    linhas: LinhaRanking[];
    filtros: { key: string; label: string }[];
    filtroAtivo: string;
    filtrosAbertos: boolean;
    rotuloFiltro: string;
    expandido: boolean;
    formatarMinutos: (m: number) => string;
    onToggleFiltros: () => void;
    onSelecionarFiltro: (key: string) => void;
    onToggleExpandir: () => void;
    onAbrirMembro: (linha: LinhaRanking, rank: number) => void;
};

export default function RankingGrupo({
    linhas,
    filtros,
    filtroAtivo,
    filtrosAbertos,
    rotuloFiltro,
    expandido,
    formatarMinutos,
    onToggleFiltros,
    onSelecionarFiltro,
    onToggleExpandir,
    onAbrirMembro,
}: Props) {
    const primeiro = linhas[0];
    // Sem expandir, mostra o pódio + até a 5ª posição. O resto entra sob demanda.
    const demais = expandido ? linhas.slice(1) : linhas.slice(1, 5);
    const temMais = linhas.length > 5;

    return (
        <>
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
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

            {/* 1º lugar em destaque, fora do card */}
            {primeiro && (
                <TouchableOpacity
                    onPress={() => onAbrirMembro(primeiro, 1)}
                    activeOpacity={0.85}
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        paddingVertical: 15,
                        paddingHorizontal: 13,
                        backgroundColor: "rgba(242,176,61,0.08)",
                        borderWidth: 2,
                        borderColor: "rgba(242,176,61,0.4)",
                        borderRadius: 15,
                        marginBottom: 10,
                        shadowColor: OURO,
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.12,
                        shadowRadius: 26,
                        elevation: 4,
                    }}
                >
                    <View style={{ position: "absolute", top: -11, left: 15 }}>
                        <Crown size={19} color={OURO} />
                    </View>

                    <Text
                        style={{ width: 18, textAlign: "center", fontSize: 16, fontWeight: "800", color: OURO }}
                    >
                        1
                    </Text>

                    <Avatar
                        foto={primeiro.foto}
                        nome={primeiro.nome}
                        size={42}
                        showOnlineDot={primeiro.online}
                    />

                    <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text
                                style={{ fontSize: 15, fontWeight: "700", color: OURO }}
                                numberOfLines={1}
                            >
                                {primeiro.nome}
                            </Text>
                            <Selo linha={primeiro} />
                        </View>
                        <Ofensiva valor={primeiro.ofensiva} tamanho={12} />
                    </View>

                    <Text style={{ fontSize: 15, fontWeight: "800", color: OURO }}>
                        {formatarMinutos(primeiro.minutos)}
                    </Text>
                </TouchableOpacity>
            )}

            {/* Demais posições */}
            {demais.length > 0 && (
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
                    {demais.map((linha, i) => {
                        const rank = i + 2;
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
                                    borderBottomWidth: i === demais.length - 1 ? 0 : 1,
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
                    onPress={onToggleExpandir}
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
                        {expandido ? "Mostrar menos" : "Ver ranking completo"}
                    </Text>
                    {expandido ? (
                        <ChevronUp size={15} color={HADES.textMuted} />
                    ) : (
                        <ChevronRight size={15} color={HADES.textMuted} />
                    )}
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
