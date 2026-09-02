import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Share, RefreshControl } from "react-native";
import { SafeAreaView } from "@/components/ui/TelaSegura";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ChevronLeft, Share2, Crown, Clock, ListChecks, Trophy, Medal, Flame, BookOpen, Swords, Lock } from "@/components/ui/icons";
import { HADES } from "@/constants/hades";
import { useAuth } from "@/hooks/useAuth";
import { useDadosCache } from "@/hooks/useDadosCache";
import { EstadoDeErro } from "@/components/ui/EstadoDeErro";
import Avatar from "@/components/ui/Avatar";
import { Skeleton, SkeletonCircle } from "@/components/ui/Skeleton";
import { buscarEstatisticasParaDuelo } from "@/services/profileStats";
import { ofensivaVigente } from "@/services/gamificacao";
import { APP_BADGES } from "@/constants/badges";
import { getAvatarColor } from "@/constants/helpers";
import type { Profile } from "@/types/profile";
import type { Gamificacao } from "@/types/gamificacao";
import type { IconeComponente } from "@/components/ui/icons";
import { usePlano } from "@/hooks/usePlano";
import { toast } from "@/services/toast";

type PerfilComparavel = {
    profile: Profile;
    gamificacao: Gamificacao | null;
};

// Mesma fórmula usada dentro do componente Avatar pra colorir o fallback de iniciais —
// repetida aqui pra usar a "cor do usuário" também nas barras e nos destaques deste duelo.
const corDoUsuario = (nome?: string | null) => getAvatarColor(nome ? nome.charCodeAt(0) % 5 : 0);

type Lado = "eu" | "ele" | "empate";
const decidirLado = (meu: number, dele: number): Lado => (meu > dele ? "eu" : dele > meu ? "ele" : "empate");

const formatarNumero = (valor: number) => valor.toLocaleString("pt-BR");

export default function CompareProfileScreen() {
    const router = useRouter();
    const { userId } = useLocalSearchParams<{ userId: string }>();
    const { userId: meuId } = useAuth();
    const { limites, avisarLimite } = usePlano();

    //Controla o estado do pull-to-refresh
    const [atualizando, setAtualizando] = useState(false);

    /*
      Uma RPC só, em vez de `buscarPerfil` + `buscarGamificacao`.

      As duas leituras diretas ignoravam `perfil_publico` — e não adiantaria só esconder os
      números aqui, porque `gamificacoes` libera SELECT para qualquer usuário logado e a
      linha de `profiles` vinha inteira. Quem corta agora é o banco (migration
      20260806200000): de perfil fechado chegam nome e foto, e número nenhum.
    */
    const carregarLado = async (id: string): Promise<PerfilComparavel | null> => {
        const dados = await buscarEstatisticasParaDuelo(id);
        if (!dados) return null;

        return {
            profile: {
                id: dados.id,
                nome_usuario: dados.nome_usuario,
                nome_real: dados.nome_real,
                foto_usuario: dados.foto_usuario,
                perfil_publico: dados.perfil_publico,
                horas_totais: dados.horas_totais,
                questoes_feitas: dados.questoes_feitas,
                medalhas_desbloqueadas: dados.medalhas_desbloqueadas,
                materia_favorita: dados.materia_favorita,
            },
            // Sem ofensiva não há gamificação a mostrar — é o perfil fechado, ou alguém
            // que ainda não tem linha em `gamificacoes`.
            gamificacao:
                dados.ofensiva === null
                    ? null
                    : {
                          user_id: dados.id ?? id,
                          // O banco guarda a ofensiva do último dia estudado e nunca a zera
                          // sozinho; quem diz se ela ainda vale hoje é `ofensivaVigente`.
                          ofensiva: ofensivaVigente(dados),
                          melhor_ofensiva: dados.melhor_ofensiva ?? 0,
                          ultima_data_estudo: dados.ultima_data_estudo,
                      },
        };
    };

    /*
      Cada lado do duelo tem a própria chave, então o "eu" já está em memória quando se
      compara com um segundo colega — só o lado dele é buscado de fato.
    */
    const { dados: eu, erro: erroEu, recarregar: recarregarEu } = useDadosCache(
        meuId ? `duelo:${meuId}` : null,
        () => carregarLado(meuId!),
        { tempoFresco: 60_000 }
    );

    const { dados: ele, erro: erroEle, recarregar: recarregarEle } = useDadosCache(
        userId ? `duelo:${userId}` : null,
        () => carregarLado(userId),
        { tempoFresco: 60_000 }
    );

    const handleRefresh = async () => {
        if (!meuId || !userId) return;
        setAtualizando(true);
        try {
            await Promise.all([recarregarEu(), recarregarEle()]);
        } finally {
            setAtualizando(false);
        }
    };

    if ((!eu || !ele) && (erroEu || erroEle)) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg, alignItems: "center", justifyContent: "center" }}>
                <EstadoDeErro
                    erro={erroEu ?? erroEle}
                    onTentarNovamente={() => {
                        recarregarEu();
                        recarregarEle();
                    }}
                    style={{ marginHorizontal: 20 }}
                />
            </SafeAreaView>
        );
    }

    if (!eu || !ele) {
        return <CompareProfileSkeleton />;
    }

    /*
      Perfil fechado não duela. Os números já chegaram nulos do banco, então isto é só
      dizer o motivo — sem esta tela, o duelo apareceria com zero em tudo e daria a
      entender que a pessoa nunca estudou.
    */
    if (ele.profile.perfil_publico === false) {
        return <DueloIndisponivel nome={ele.profile.nome_usuario} onVoltar={() => router.back()} />;
    }

    const corEu = corDoUsuario(eu.profile.nome_usuario);
    const corEle = corDoUsuario(ele.profile.nome_usuario);

    const minhasMedalhas = APP_BADGES.filter((b) => eu.profile.medalhas_desbloqueadas?.includes(b.id)).length;
    const medalhasDele = APP_BADGES.filter((b) => ele.profile.medalhas_desbloqueadas?.includes(b.id)).length;

    /*
      Comparação completa (Pro) x básica (Grátis).

      No Grátis ficam horas e ofensiva atual — as duas que o usuário já vê no ranking do
      grupo, então travá-las não esconderia nada de novo. Questões, melhor ofensiva e
      medalhas são o que o Pro abre. O placar conta só as métricas visíveis, senão o
      "3 x 2" não fecharia com o que está na tela.
    */
    const todasAsMetricas: {
        label: string;
        icon: IconeComponente;
        meu: number;
        dele: number;
        sufixo?: string;
        soNoPro?: boolean;
    }[] = [
        { label: "Horas Totais", icon: Clock, meu: eu.profile.horas_totais ?? 0, dele: ele.profile.horas_totais ?? 0, sufixo: "h" },
        { label: "Questões", icon: ListChecks, meu: eu.profile.questoes_feitas ?? 0, dele: ele.profile.questoes_feitas ?? 0, soNoPro: true },
        { label: "Melhor Ofensiva", icon: Trophy, meu: eu.gamificacao?.melhor_ofensiva ?? 0, dele: ele.gamificacao?.melhor_ofensiva ?? 0, sufixo: " dias", soNoPro: true },
        { label: "Medalhas", icon: Medal, meu: minhasMedalhas, dele: medalhasDele, soNoPro: true },
        { label: "Ofensiva Atual", icon: Flame, meu: eu.gamificacao?.ofensiva ?? 0, dele: ele.gamificacao?.ofensiva ?? 0, sufixo: " dias" },
    ];

    const comparacaoCompleta = limites?.comparacaoPerfilCompleta ?? false;
    const metricas = comparacaoCompleta ? todasAsMetricas : todasAsMetricas.filter((m) => !m.soNoPro);
    const metricasTravadas = comparacaoCompleta ? 0 : todasAsMetricas.length - metricas.length;

    const vitoriasEu = metricas.filter((m) => decidirLado(m.meu, m.dele) === "eu").length;
    const vitoriasEle = metricas.filter((m) => decidirLado(m.meu, m.dele) === "ele").length;
    const liderante: Lado = vitoriasEu > vitoriasEle ? "eu" : vitoriasEle > vitoriasEu ? "ele" : "empate";

    const compartilhar = () => {
        Share.share({
            message: `Duelo no StudoCore: Você ${vitoriasEu} x ${vitoriasEle} ${ele.profile.nome_usuario} 🔥`,
        });
    };

    const desafiar = () => {
        toast.info("O modo Desafio (1x1) ainda está em desenvolvimento.", "Em breve");
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top", "bottom"]}>
            {/* Header */}
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: 20,
                    paddingTop: 6,
                    paddingBottom: 12,
                }}
            >
                <TouchableOpacity onPress={() => router.back()} style={estilos.botaoCircular}>
                    <ChevronLeft size={20} color={HADES.textSecondary} />
                </TouchableOpacity>
                <Text style={{ fontSize: 16, fontWeight: "600", color: HADES.text }}>Duelo</Text>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
                refreshControl={
                    <RefreshControl refreshing={atualizando} onRefresh={handleRefresh} tintColor={HADES.accentSolid} />
                }
            >
                {/* VS hero */}
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingVertical: 24 }}>
                    {/* Eu */}
                    <View style={{ width: 110, alignItems: "center", gap: 10 }}>
                        <View>
                            {liderante === "eu" && (
                                <Crown size={18} color={HADES.amber} style={{ position: "absolute", top: -16, left: 0, right: 0, alignSelf: "center" }} />
                            )}
                            <View style={{ borderRadius: 999, padding: 3, backgroundColor: corEu }}>
                                <View style={{ borderWidth: 3, borderColor: HADES.bg, borderRadius: 999 }}>
                                    <Avatar foto={eu.profile.foto_usuario} nome={eu.profile.nome_usuario} size={78} />
                                </View>
                            </View>
                        </View>
                        <View style={{ alignItems: "center" }}>
                            <Text style={{ fontSize: 16, fontWeight: "700", color: HADES.text }} numberOfLines={1}>
                                {eu.profile.nome_usuario}
                            </Text>
                            <Text style={{ fontSize: 12, fontWeight: "600", marginTop: 1, color: corEu }}>Você</Text>
                        </View>
                    </View>

                    {/* Placar central */}
                    <View style={{ flex: 1, alignItems: "center", paddingTop: 20 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                            <Text style={{ fontSize: 36, fontWeight: "800", color: corEu }}>{vitoriasEu}</Text>
                            <Text style={{ fontSize: 14, fontWeight: "700", color: HADES.textFaint }}>VS</Text>
                            <Text style={{ fontSize: 36, fontWeight: "800", color: corEle }}>{vitoriasEle}</Text>
                        </View>
                        <Text style={{ fontSize: 11, fontWeight: "600", color: HADES.textFaint, letterSpacing: 2, marginTop: 8 }}>
                            VITÓRIAS
                        </Text>
                    </View>

                    {/* Ele */}
                    <View style={{ width: 110, alignItems: "center", gap: 10 }}>
                        <View>
                            {liderante === "ele" && (
                                <Crown size={18} color={HADES.amber} style={{ position: "absolute", top: -16, left: 0, right: 0, alignSelf: "center" }} />
                            )}
                            <View style={{ borderRadius: 999, padding: 3, backgroundColor: corEle }}>
                                <View style={{ borderWidth: 3, borderColor: HADES.bg, borderRadius: 999 }}>
                                    <Avatar foto={ele.profile.foto_usuario} nome={ele.profile.nome_usuario} size={78} />
                                </View>
                            </View>
                        </View>
                        <View style={{ alignItems: "center" }}>
                            <Text style={{ fontSize: 16, fontWeight: "700", color: HADES.text }} numberOfLines={1}>
                                {ele.profile.nome_usuario}
                            </Text>
                            <Text style={{ fontSize: 12, fontWeight: "600", marginTop: 1, color: corEle }}>Rival</Text>
                        </View>
                    </View>
                </View>

                {/* Linhas de comparação, uma barra por métrica */}
                <View style={{ gap: 20, paddingTop: 4 }}>
                    {metricas.map((m) => {
                        const lado = decidirLado(m.meu, m.dele);
                        const Icon = m.icon;
                        const total = Math.max(m.meu + m.dele, 0.0001);
                        const pctEu = (m.meu / total) * 100;
                        const pctEle = 100 - pctEu;
                        return (
                            <View key={m.label}>
                                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                                        {m.label === "Ofensiva Atual" && lado === "eu" && <Flame size={14} color={HADES.amber} />}
                                        <Text style={{ fontSize: 18, fontWeight: "700", color: lado === "eu" ? corEu : HADES.textMuted }}>
                                            {formatarNumero(m.meu)}
                                            {m.sufixo || ""}
                                        </Text>
                                    </View>
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8 }}>
                                        <Icon size={13} color={HADES.textFaint} />
                                        <Text style={{ fontSize: 10, fontWeight: "600", color: HADES.textFaint, letterSpacing: 0.8 }} numberOfLines={1}>
                                            {m.label.toUpperCase()}
                                        </Text>
                                    </View>
                                    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                                        <Text style={{ fontSize: 18, fontWeight: "700", color: lado === "ele" ? corEle : HADES.textMuted }}>
                                            {formatarNumero(m.dele)}
                                            {m.sufixo || ""}
                                        </Text>
                                        {m.label === "Ofensiva Atual" && lado === "ele" && <Flame size={14} color={HADES.amber} />}
                                    </View>
                                </View>
                                <View style={{ flexDirection: "row", gap: 4, height: 8 }}>
                                    <View style={{ height: "100%", width: `${pctEu}%`, backgroundColor: corEu, opacity: lado === "ele" ? 0.3 : 1, borderRadius: 4 }} />
                                    <View style={{ height: "100%", width: `${pctEle}%`, backgroundColor: corEle, opacity: lado === "eu" ? 0.3 : 1, borderRadius: 4 }} />
                                </View>
                            </View>
                        );
                    })}

                    {/* Mostra o que está faltando em vez de simplesmente encurtar a lista. */}
                    {metricasTravadas > 0 && (
                        <TouchableOpacity
                            onPress={() => avisarLimite("comparacao_perfil")}
                            activeOpacity={0.8}
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 8,
                                marginTop: 14,
                                paddingVertical: 12,
                                paddingHorizontal: 14,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: HADES.border,
                                borderStyle: "dashed",
                            }}
                        >
                            <Lock size={14} color={HADES.textMuted} />
                            <Text style={{ flex: 1, fontSize: 12, color: HADES.textMuted, lineHeight: 17 }}>
                                Mais {metricasTravadas} comparações (questões, melhor ofensiva e medalhas) no Pro.
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Matéria favorita (neutro, cor de cada lado) */}
                <View style={{ marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: HADES.border }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 12 }}>
                        <BookOpen size={13} color={HADES.textFaint} />
                        <Text style={{ fontSize: 10, fontWeight: "600", color: HADES.textFaint, letterSpacing: 0.8 }}>
                            MATÉRIA FAVORITA
                        </Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                        <View style={{ flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center", backgroundColor: `${corEu}1a`, borderWidth: 1, borderColor: `${corEu}40` }}>
                            <Text style={{ fontSize: 14, fontWeight: "600", color: corEu }} numberOfLines={1}>
                                {eu.profile.materia_favorita || "—"}
                            </Text>
                        </View>
                        <View style={{ flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center", backgroundColor: `${corEle}1a`, borderWidth: 1, borderColor: `${corEle}40` }}>
                            <Text style={{ fontSize: 14, fontWeight: "600", color: corEle }} numberOfLines={1}>
                                {ele.profile.materia_favorita || "—"}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={{ height: 20 }} />
            </ScrollView>

            {/* CTA */}
            <View style={{ paddingHorizontal: 20, paddingBottom: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: HADES.border }}>
                <TouchableOpacity
                    onPress={desafiar}
                    activeOpacity={0.85}
                    style={{ height: 54, borderRadius: 15, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, backgroundColor: corEu }}
                >
                    <Swords size={18} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Desafiar {ele.profile.nome_usuario}</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

/** Perfil fechado do outro lado: explica em vez de mostrar um duelo zerado. */
function DueloIndisponivel({ nome, onVoltar }: { nome?: string | null; onVoltar: () => void }) {
    const primeiroNome = nome?.split(" ")[0] ?? "Esta pessoa";

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top", "bottom"]}>
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: 20,
                    paddingTop: 6,
                    paddingBottom: 12,
                }}
            >
                <TouchableOpacity onPress={onVoltar} style={estilos.botaoCircular}>
                    <ChevronLeft size={20} color={HADES.textSecondary} />
                </TouchableOpacity>
                <Text style={{ fontSize: 16, fontWeight: "600", color: HADES.text }}>Duelo</Text>
                <View style={estilos.botaoCircular} />
            </View>

            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 14 }}>
                <View
                    style={{
                        width: 64,
                        height: 64,
                        borderRadius: 32,
                        backgroundColor: HADES.surfaceRaised,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Lock size={26} color={HADES.textMuted} />
                </View>
                <Text style={{ fontSize: 17, fontWeight: "700", color: HADES.text, textAlign: "center" }}>
                    Perfil fechado
                </Text>
                <Text style={{ fontSize: 13.5, color: HADES.textMuted, textAlign: "center", lineHeight: 20 }}>
                    {primeiroNome} escolheu não mostrar as estatísticas. Sem os números dos dois lados
                    não dá para montar o duelo.
                </Text>
            </View>
        </SafeAreaView>
    );
}

function CompareProfileSkeleton() {
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top", "bottom"]}>
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: 20,
                    paddingTop: 6,
                    paddingBottom: 12,
                }}
            >
                <View style={estilos.botaoCircular} />
                <Skeleton width={50} height={16} hades />
            </View>

            <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
            >
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingVertical: 24 }}>
                    {/* 78 de avatar + o anel de 3px e a borda de 3px = 90 na tela pronta. */}
                    <View style={{ width: 110, alignItems: "center", gap: 10 }}>
                        <SkeletonCircle size={90} hades />
                        <View style={{ alignItems: "center" }}>
                            <Skeleton width={80} height={16} hades />
                            <Skeleton width={40} height={12} hades style={{ marginTop: 1 }} />
                        </View>
                    </View>

                    <View style={{ flex: 1, alignItems: "center", paddingTop: 20 }}>
                        <Skeleton width={110} height={36} hades />
                        <Skeleton width={60} height={11} hades style={{ marginTop: 8 }} />
                    </View>

                    <View style={{ width: 110, alignItems: "center", gap: 10 }}>
                        <SkeletonCircle size={90} hades />
                        <View style={{ alignItems: "center" }}>
                            <Skeleton width={80} height={16} hades />
                            <Skeleton width={40} height={12} hades style={{ marginTop: 1 }} />
                        </View>
                    </View>
                </View>

                <View style={{ gap: 20, paddingTop: 4 }}>
                    {[0, 1, 2, 3, 4].map((i) => (
                        <View key={i}>
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                <Skeleton width={44} height={18} hades />
                                <Skeleton width={80} height={10} hades />
                                <Skeleton width={44} height={18} hades />
                            </View>
                            <Skeleton width="100%" height={8} borderRadius={4} hades />
                        </View>
                    ))}
                </View>

                <View style={{ marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: HADES.border }}>
                    <View style={{ alignItems: "center", marginBottom: 12 }}>
                        <Skeleton width={130} height={10} hades />
                    </View>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                        <Skeleton width="100%" height={44} borderRadius={12} hades style={{ flex: 1 }} />
                        <Skeleton width="100%" height={44} borderRadius={12} hades style={{ flex: 1 }} />
                    </View>
                </View>
            </ScrollView>

            <View style={{ paddingHorizontal: 20, paddingBottom: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: HADES.border }}>
                <Skeleton width="100%" height={54} borderRadius={15} hades />
            </View>
        </SafeAreaView>
    );
}

const estilos = {
    botaoCircular: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: HADES.surfaceRaised,
        alignItems: "center" as const,
        justifyContent: "center" as const,
    },
};
