import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "@/components/ui/TelaSegura";
import { router, useLocalSearchParams } from "expo-router";
import { CalendarPlus, ChevronLeft, Clock, Coffee, Layers } from "@/components/ui/icons";
import type { IconeComponente } from "@/components/ui/icons";

import Avatar from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { HADES } from "@/constants/hades";
import { buscarPreviaPlano, importarPlano } from "@/services/comunidade";
import { toast } from "@/services/toast";
import { formatarDuracao } from "@/utils/tempo";
import type { BlocoDaPrevia, PreviaPlano } from "@/types/comunidade";

/**
 * Prévia de um plano público, antes de importar.
 *
 * O card do Explorar diz "24 blocos · 6h no total" e três matérias — o suficiente para
 * despertar interesse, não para decidir. Esta tela é a decisão: mostra o dia inteiro na
 * ordem em que ele acontece, e o "Importar" mora aqui. É por isso que ela substituiu o
 * alerta de confirmação que existia no card: ver o plano confirma melhor que um texto
 * perguntando "tem certeza?".
 *
 * Leitura só. Nada aqui pode ser editado — a cópia é que vai para o editor, se a pessoa
 * quiser mexer depois.
 */
export default function PlanoPreviewScreen() {
    const { planoId, autorNome, autorFoto } = useLocalSearchParams<{
        planoId?: string;
        autorNome?: string;
        autorFoto?: string;
    }>();

    const [previa, setPrevia] = useState<PreviaPlano | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [importando, setImportando] = useState(false);

    useEffect(() => {
        let ativo = true;

        const carregar = async () => {
            if (!planoId) {
                setCarregando(false);
                return;
            }
            try {
                const encontrada = await buscarPreviaPlano(planoId);
                if (ativo) setPrevia(encontrada);
            } catch (erro) {
                console.warn("Erro ao carregar prévia do plano:", erro);
                if (ativo) setPrevia(null);
            } finally {
                if (ativo) setCarregando(false);
            }
        };

        carregar();
        return () => {
            ativo = false;
        };
    }, [planoId]);

    /**
     * Importar é copiar: o plano vira um plano seu, sem dias marcados, e não muda mais
     * junto com o original. O aviso acima do botão diz isso na tela — aqui só resta
     * fechar a prévia, porque quem importou volta para o feed, não para o cronograma.
     */
    const importar = useCallback(async () => {
        if (!previa) return;

        setImportando(true);
        try {
            await importarPlano(previa.id);
            toast.success("Plano copiado para os seus planos.");
            router.back();
        } catch {
            toast.error("Não deu para importar esse plano.");
        } finally {
            setImportando(false);
        }
    }, [previa]);

    if (carregando) {
        return <PlanoPreviewSkeleton />;
    }

    /*
      Sem plano: ou o id não veio, ou a RLS recusou a leitura porque o autor despublicou
      ou bloqueou quem abriu entre o card ser desenhado e o toque. As três dão na mesma
      para quem está olhando, e nenhuma delas tem "tentar de novo" que ajude.
    */
    if (!previa) {
        return (
            <View style={{ flex: 1, backgroundColor: HADES.bg }}>
                <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
                    <Cabecalho />
                    <View style={estilos.vazioTela}>
                        <Text style={estilos.vazioTitulo}>Plano indisponível</Text>
                        <Text style={estilos.vazioTexto}>
                            Quem publicou pode ter parado de compartilhar este plano.
                        </Text>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    const qtdEstudo = previa.blocos.filter((bloco) => bloco.tipo === "estudo").length;

    return (
        <View style={{ flex: 1, backgroundColor: HADES.bg }}>
            <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
                <Cabecalho />

                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 20 }}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Hero: a cor é a do plano, escolhida por quem o criou. */}
                    <View style={[estilos.hero, { borderColor: `${previa.cor}55` }]}>
                        <View
                            style={{
                                position: "absolute",
                                top: -40,
                                right: -30,
                                width: 150,
                                height: 150,
                                borderRadius: 75,
                                backgroundColor: previa.cor,
                                opacity: 0.14,
                            }}
                        />

                        <Text style={estilos.nomeDoPlano}>{previa.nome}</Text>

                        {!!autorNome && (
                            <View style={estilos.linhaAutor}>
                                <Avatar foto={autorFoto || null} nome={autorNome} size={24} />
                                <Text style={estilos.textoAutor} numberOfLines={1}>
                                    por <Text style={{ color: HADES.textSecondary, fontWeight: "600" }}>{autorNome}</Text>
                                </Text>
                            </View>
                        )}

                        {/* Os mesmos três números do rodapé do editor, para a pessoa comparar
                            com os planos que ela já tem. */}
                        <View style={estilos.stats}>
                            <Coluna Icone={Layers} valor={String(qtdEstudo)} rotulo={qtdEstudo === 1 ? "BLOCO" : "BLOCOS"} />
                            <Coluna
                                Icone={Clock}
                                valor={formatarDuracao(previa.minutosEstudo)}
                                rotulo="DE ESTUDO"
                                divisor
                            />
                            <Coluna
                                Icone={Coffee}
                                valor={formatarDuracao(previa.minutosDescanso)}
                                rotulo="DE DESCANSO"
                                divisor
                            />
                        </View>
                    </View>

                    <Text style={estilos.secaoTitulo}>O dia inteiro</Text>

                    {previa.blocos.length === 0 ? (
                        <View style={estilos.vazioCard}>
                            <Text style={{ fontSize: 13.5, color: HADES.textMuted, textAlign: "center" }}>
                                Este plano ainda não tem blocos.
                            </Text>
                            <Text style={{ fontSize: 12, color: HADES.textDim, marginTop: 4, textAlign: "center" }}>
                                Importar traria só o nome, sem nada dentro.
                            </Text>
                        </View>
                    ) : (
                        <View style={{ gap: 9 }}>
                            {previa.blocos.map((bloco) => (
                                <LinhaBloco key={bloco.id} bloco={bloco} />
                            ))}
                        </View>
                    )}

                    <View style={estilos.avisoCard}>
                        <CalendarPlus size={18} color={HADES.accentSolid} style={{ marginTop: 1 }} />
                        <Text style={estilos.avisoTexto}>
                            Importar cria uma <Text style={estilos.avisoDestaque}>cópia sua</Text>, sem dias marcados —
                            você escolhe depois quando ela vale, e nada muda no seu cronograma até lá.
                        </Text>
                    </View>
                </ScrollView>

                <View style={estilos.footer}>
                    <TouchableOpacity
                        onPress={importar}
                        disabled={importando || previa.blocos.length === 0}
                        activeOpacity={0.85}
                        style={[
                            estilos.botaoImportar,
                            (importando || previa.blocos.length === 0) && { opacity: 0.6 },
                        ]}
                    >
                        <CalendarPlus size={19} color="#000" />
                        <Text style={{ fontSize: 16, fontWeight: "700", color: "#000" }}>
                            {importando ? "Importando..." : "Importar para meu cronograma"}
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
}

function Cabecalho() {
    return (
        <View style={estilos.header}>
            <TouchableOpacity
                onPress={() => router.back()}
                style={estilos.botaoCircular}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
                <ChevronLeft size={20} color={HADES.textSecondary} />
            </TouchableOpacity>
            <Text style={estilos.headerTitulo}>Prévia do plano</Text>
            {/* Espelho do botão de voltar, só para o título ficar centralizado. */}
            <View style={{ width: 38 }} />
        </View>
    );
}

function Coluna({
    Icone,
    valor,
    rotulo,
    divisor = false,
}: {
    Icone: IconeComponente;
    valor: string;
    rotulo: string;
    divisor?: boolean;
}) {
    return (
        <View style={[{ flex: 1 }, divisor && estilos.statDivider]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Icone size={14} color={HADES.textMuted} />
                <Text style={estilos.statValor}>{valor}</Text>
            </View>
            <Text style={estilos.statRotulo}>{rotulo}</Text>
        </View>
    );
}

/**
 * Um bloco na lista. Mesma linguagem do editor — descanso tracejado e verde, estudo
 * sólido com a cor da matéria na barrinha da esquerda — mas sem nada tocável: aqui é
 * leitura.
 */
function LinhaBloco({ bloco }: { bloco: BlocoDaPrevia }) {
    if (bloco.tipo === "descanso") {
        return (
            <View style={estilos.linhaDescanso}>
                <Text style={estilos.hora}>{bloco.horaInicio}</Text>
                <Coffee size={15} color={HADES.green} />
                <Text style={{ flex: 1, fontSize: 13.5, fontWeight: "600", color: HADES.textSecondary }}>
                    Descanso
                </Text>
                <Text style={estilos.duracao}>{formatarDuracao(bloco.duracaoMin)}</Text>
            </View>
        );
    }

    // Matéria apagada pelo autor deixa `materia_id` NULL (ON DELETE SET NULL): o bloco
    // continua no plano e continua sendo copiado, só sem nome.
    const cor = bloco.materiaCor ?? HADES.textMuted;

    return (
        <View style={estilos.linhaEstudo}>
            <Text style={estilos.hora}>{bloco.horaInicio}</Text>
            <View style={[estilos.marcaMateria, { backgroundColor: cor }]} />
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: HADES.text }} numberOfLines={1}>
                    {bloco.materia ?? "Sem matéria"}
                </Text>
                {!!bloco.topico && (
                    <Text style={{ fontSize: 12, color: HADES.textFaint, marginTop: 1 }} numberOfLines={1}>
                        {bloco.topico}
                    </Text>
                )}
            </View>
            <Text style={estilos.duracao}>{formatarDuracao(bloco.duracaoMin)}</Text>
        </View>
    );
}

function PlanoPreviewSkeleton() {
    return (
        <View style={{ flex: 1, backgroundColor: HADES.bg }}>
            <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
                <Cabecalho />
                <View style={{ flex: 1, paddingHorizontal: 18 }}>
                    <Skeleton width="100%" height={148} borderRadius={20} hades />
                    <Skeleton width={96} height={16} hades style={{ marginTop: 24, marginBottom: 12, marginLeft: 2 }} />
                    <View style={{ gap: 9 }}>
                        {[0, 1, 2, 3].map((i) => (
                            <Skeleton key={i} width="100%" height={56} borderRadius={13} hades />
                        ))}
                    </View>
                    {/* Aviso de que importar cria uma cópia. */}
                    <Skeleton width="100%" height={78} borderRadius={14} hades style={{ marginTop: 20 }} />
                </View>

                {/* Rodapé fixo com o botão de importar */}
                <View style={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12 }}>
                    <Skeleton width="100%" height={54} borderRadius={15} hades />
                </View>
            </SafeAreaView>
        </View>
    );
}

const estilos = StyleSheet.create({
    header: {
        paddingTop: 6,
        paddingHorizontal: 18,
        paddingBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    headerTitulo: {
        flex: 1,
        textAlign: "center",
        fontSize: 16,
        fontWeight: "600",
        color: HADES.text,
        letterSpacing: 0.2,
    },
    botaoCircular: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: HADES.surfaceRaised,
        alignItems: "center",
        justifyContent: "center",
    },
    hero: {
        position: "relative",
        overflow: "hidden",
        borderRadius: 20,
        borderWidth: 1,
        backgroundColor: HADES.surface,
        padding: 17,
    },
    nomeDoPlano: {
        fontSize: 24,
        fontWeight: "700",
        color: HADES.text,
        letterSpacing: -0.5,
    },
    linhaAutor: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: 10,
    },
    textoAutor: {
        flex: 1,
        fontSize: 12.5,
        color: HADES.textMuted,
    },
    stats: {
        flexDirection: "row",
        marginTop: 18,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: HADES.border,
    },
    statDivider: {
        borderLeftWidth: 1,
        borderLeftColor: HADES.border,
        paddingLeft: 14,
    },
    statValor: {
        fontSize: 18,
        fontWeight: "700",
        color: HADES.text,
        letterSpacing: -0.3,
    },
    statRotulo: {
        fontSize: 10,
        color: HADES.textDim,
        fontWeight: "600",
        letterSpacing: 0.5,
        marginTop: 2,
    },
    secaoTitulo: {
        fontSize: 16,
        fontWeight: "700",
        color: HADES.text,
        marginTop: 24,
        marginBottom: 12,
        marginHorizontal: 2,
    },
    linhaEstudo: {
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        backgroundColor: HADES.surfaceRaised,
        borderWidth: 1,
        borderColor: HADES.borderStrong,
        borderRadius: 13,
        paddingVertical: 12,
        paddingHorizontal: 13,
    },
    linhaDescanso: {
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: "rgba(48,209,88,0.35)",
        backgroundColor: "rgba(48,209,88,0.06)",
        borderRadius: 13,
        paddingVertical: 12,
        paddingHorizontal: 13,
    },
    // Largura fixa: as horas de todos os blocos alinham numa coluna só, que é o que faz
    // a lista ser lida como uma linha do tempo em vez de cartões soltos.
    hora: {
        width: 42,
        fontSize: 12.5,
        fontWeight: "700",
        color: HADES.textMuted,
        fontVariant: ["tabular-nums"],
    },
    marcaMateria: {
        width: 3,
        alignSelf: "stretch",
        borderRadius: 2,
    },
    duracao: {
        fontSize: 13.5,
        fontWeight: "700",
        color: HADES.text,
    },
    avisoCard: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 11,
        marginTop: 20,
        backgroundColor: "rgba(255,154,0,0.07)",
        borderWidth: 1,
        borderColor: "rgba(255,154,0,0.18)",
        borderRadius: 14,
        padding: 14,
    },
    avisoTexto: {
        flex: 1,
        fontSize: 12.5,
        color: HADES.textSecondary,
        lineHeight: 18,
    },
    avisoDestaque: {
        color: HADES.text,
        fontWeight: "600",
    },
    footer: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 18,
        paddingTop: 12,
        paddingBottom: 12,
        borderTopWidth: 1,
        borderTopColor: HADES.border,
    },
    botaoImportar: {
        flex: 1,
        height: 54,
        borderRadius: 15,
        backgroundColor: HADES.accentSolid,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 9,
    },
    vazioTela: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
    },
    vazioTitulo: {
        fontSize: 16,
        fontWeight: "700",
        color: HADES.text,
    },
    vazioTexto: {
        fontSize: 13,
        color: HADES.textMuted,
        marginTop: 6,
        lineHeight: 19,
        textAlign: "center",
    },
    vazioCard: {
        borderWidth: 1.5,
        borderStyle: "dashed",
        borderColor: HADES.borderDashed,
        borderRadius: 14,
        paddingVertical: 22,
        paddingHorizontal: 18,
        alignItems: "center",
    },
});
