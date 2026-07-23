import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import {
    ChevronLeft,
    Share2,
    BadgeCheck,
    Globe,
    Flame,
    Users,
    UserPlus,
    Lock,
    HandMetal,
    Play,
    ChevronRight,
} from "lucide-react-native";

import { HADES } from "@/constants/hades";
import { getSubjectColor } from "@/constants/helpers";

type Participante = {
    nome: string;
    inicial: string;
    cor: string;
    topico: string;
    tempoSegundos: number;
    host?: boolean;
};

type SessaoPreviewMock = {
    hostNome: string;
    hostInicial: string;
    hostCor: string;
    hostVerificado?: boolean;
    abertaHaMin: number;
    disciplina: string;
    conteudo: string;
    duracaoMin: number;
    horaInicio: string;
    ofensiva: number;
    participantes: Participante[];
    maisPessoas: number;
    torcidaNomes?: string;
    torcidaTotal?: number;
};

// Mock: ainda não existe sessão pública em tempo real no backend (ver docs/project-context.md).
const MOCKS: Record<"entrar" | "primeiro" | "privada", SessaoPreviewMock> = {
    entrar: {
        hostNome: "NatVM",
        hostInicial: "N",
        hostCor: "#1f9d63",
        hostVerificado: true,
        abertaHaMin: 39,
        disciplina: "Cálculo II",
        conteudo: "Integrais definidas",
        duracaoMin: 80,
        horaInicio: "09:15",
        ofensiva: 9,
        participantes: [
            { nome: "NatVM", inicial: "N", cor: "#1f9d63", topico: "Integrais definidas", tempoSegundos: 4804, host: true },
            { nome: "toulhe", inicial: "T", cor: "#7c5cfc", topico: "Integração por partes", tempoSegundos: 2832 },
        ],
        maisPessoas: 3,
    },
    primeiro: {
        hostNome: "toulhe",
        hostInicial: "T",
        hostCor: "#7c5cfc",
        abertaHaMin: 4,
        disciplina: "Física",
        conteudo: "Cinemática · MRUV",
        duracaoMin: 4,
        horaInicio: "10:40",
        ofensiva: 3,
        participantes: [
            { nome: "toulhe", inicial: "T", cor: "#7c5cfc", topico: "Cinemática · MRUV", tempoSegundos: 252, host: true },
        ],
        maisPessoas: 0,
    },
    privada: {
        hostNome: "penac",
        hostInicial: "P",
        hostCor: "#1f9aa8",
        abertaHaMin: 62,
        disciplina: "Anatomia",
        conteudo: "Sistema nervoso central",
        duracaoMin: 62,
        horaInicio: "09:42",
        ofensiva: 21,
        participantes: [],
        maisPessoas: 0,
        torcidaNomes: "NatVM, h e mais 6",
        torcidaTotal: 8,
    },
};

function formatarDuracao(min: number) {
    if (min < 60) return `${min}m`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatarCronometro(totalSegundos: number) {
    const h = Math.floor(totalSegundos / 3600);
    const m = Math.floor((totalSegundos % 3600) / 60);
    const s = totalSegundos % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function SessionPreviewScreen() {
    const params = useLocalSearchParams<{ variante?: "entrar" | "primeiro" | "privada"; isPublic?: string }>();

    const variante: "entrar" | "primeiro" | "privada" =
        params.variante && MOCKS[params.variante]
            ? params.variante
            : params.isPublic === "false"
            ? "privada"
            : "entrar";

    const sessao = MOCKS[variante];
    const privada = variante === "privada";
    const corMateria = getSubjectColor(sessao.disciplina);

    // Cronômetros locais ticando a partir do mock, só para dar sensação de "ao vivo".
    const [tick, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 1000);
        return () => clearInterval(id);
    }, []);

    const handleAcao = () => {
        if (privada) return; // "Mandar força" ainda não tem efeito colateral real
        router.dismissAll();
        router.replace("/(tabs)/focus");
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top"]}>
            {/* Header */}
            <View style={estilos.header}>
                <TouchableOpacity onPress={() => router.back()} style={estilos.botaoCircular} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <ChevronLeft size={20} color={HADES.textSecondary} />
                </TouchableOpacity>
                <Text style={estilos.headerTitulo}>Prévia da sessão</Text>
                <TouchableOpacity style={estilos.botaoCircular} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Share2 size={18} color={HADES.textSecondary} />
                </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
                {/* Hero */}
                <View
                    style={[
                        estilos.hero,
                        {
                            backgroundColor: HADES.surface,
                            borderColor: corMateria.border,
                        },
                    ]}
                >
                    <View
                        style={{
                            position: "absolute",
                            top: -40,
                            right: -30,
                            width: 150,
                            height: 150,
                            borderRadius: 75,
                            backgroundColor: corMateria.text,
                            opacity: 0.35,
                        }}
                    />

                    <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
                        <View style={[estilos.avatar, { width: 44, height: 44, borderRadius: 22, backgroundColor: sessao.hostCor }]}>
                            <Text style={{ color: "#fff", fontSize: 17, fontWeight: "600" }}>{sessao.hostInicial}</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                                <Text style={{ fontSize: 16, fontWeight: "700", color: HADES.text }}>{sessao.hostNome}</Text>
                                {sessao.hostVerificado && <BadgeCheck size={16} color={HADES.subjectBlue} />}
                            </View>
                            <Text style={{ fontSize: 12.5, color: HADES.textMuted, marginTop: 1 }}>
                                {privada ? "está focando" : "abriu esta sessão"} · há {sessao.abertaHaMin} min
                            </Text>
                        </View>
                        {privada ? (
                            <View style={estilos.badgePrivada}>
                                <Lock size={12} color={HADES.textMuted} />
                                <Text style={estilos.badgePrivadaTexto}>Privada</Text>
                            </View>
                        ) : (
                            <View style={estilos.badgePublica}>
                                <Globe size={12} color={HADES.accentSolid} />
                                <Text style={estilos.badgePublicaTexto}>Pública</Text>
                            </View>
                        )}
                    </View>

                    <View style={{ marginTop: 18 }}>
                        <Text style={{ fontSize: 24, fontWeight: "700", color: HADES.text, letterSpacing: -0.4 }}>{sessao.disciplina}</Text>
                        <Text style={{ fontSize: 14, color: corMateria.text, marginTop: 3 }}>{sessao.conteudo}</Text>
                    </View>

                    <View style={estilos.aoVivo}>
                        <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: HADES.green }} />
                        <Text style={{ fontSize: 12, color: HADES.green, fontWeight: "600" }}>ao vivo agora</Text>
                    </View>

                    <View style={estilos.stats}>
                        <View style={{ flex: 1 }}>
                            <Text style={estilos.statValor}>{formatarDuracao(sessao.duracaoMin)}</Text>
                            <Text style={estilos.statRotulo}>DURAÇÃO</Text>
                        </View>
                        <View style={[estilos.statDivider, { flex: 1 }]}>
                            <Text style={estilos.statValor}>{sessao.horaInicio}</Text>
                            <Text style={estilos.statRotulo}>INÍCIO</Text>
                        </View>
                        <View style={[estilos.statDivider, { flex: 1 }]}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                                <Flame size={16} color={HADES.accentSolid} />
                                <Text style={estilos.statValor}>{sessao.ofensiva}</Text>
                            </View>
                            <Text style={estilos.statRotulo}>OFENSIVA</Text>
                        </View>
                    </View>
                </View>

                {privada ? (
                    <>
                        {/* Bloqueio suave */}
                        <View style={estilos.avisoCard}>
                            <Lock size={19} color={HADES.textMuted} style={{ marginTop: 1 }} />
                            <Text style={estilos.avisoTexto}>
                                Esta sessão é <Text style={estilos.avisoDestaque}>privada</Text>. Você acompanha o progresso, mas não pode entrar para
                                focar junto.
                            </Text>
                        </View>

                        {/* Torcida */}
                        <View style={estilos.secaoHeader}>
                            <Text style={estilos.secaoTitulo}>Torcida</Text>
                            <Text style={{ fontSize: 12.5, color: HADES.textMuted, fontWeight: "600" }}>{sessao.torcidaTotal} mandaram força</Text>
                        </View>
                        <View style={estilos.torcidaCard}>
                            <View style={{ flexDirection: "row", alignItems: "center" }}>
                                <View style={[estilos.avatarPilha, { backgroundColor: "#e08a1e" }]}>
                                    <Text style={estilos.avatarPilhaTexto}>H</Text>
                                </View>
                                <View style={[estilos.avatarPilha, { backgroundColor: "#d0455e", marginLeft: -10 }]}>
                                    <Text style={estilos.avatarPilhaTexto}>M</Text>
                                </View>
                                <View style={[estilos.avatarPilha, { backgroundColor: HADES.surfaceOverlay, marginLeft: -10 }]}>
                                    <Text style={[estilos.avatarPilhaTexto, { color: HADES.textMuted, fontSize: 11 }]}>+5</Text>
                                </View>
                            </View>
                            <Text style={{ flex: 1, fontSize: 13, color: HADES.textSecondary }} numberOfLines={1}>
                                {sessao.torcidaNomes}
                            </Text>
                            <HandMetal size={18} color={HADES.accentSolid} />
                        </View>
                    </>
                ) : (
                    <>
                        {/* Focando agora */}
                        <View style={estilos.secaoHeader}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                <Text style={estilos.secaoTitulo}>Focando agora</Text>
                                {sessao.participantes.length > 0 && (
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: HADES.green }} />
                                        <Text style={{ fontSize: 11, color: HADES.green, fontWeight: "600" }}>
                                            {sessao.participantes.length + sessao.maisPessoas} pessoas
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        {sessao.participantes.length > 0 ? (
                            <View style={{ gap: 9 }}>
                                {sessao.participantes.map((p) => (
                                    <View key={p.nome} style={estilos.participanteCard}>
                                        <View style={{ position: "relative" }}>
                                            <View style={[estilos.avatar, { width: 38, height: 38, borderRadius: 19, backgroundColor: p.cor }]}>
                                                <Text style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>{p.inicial}</Text>
                                            </View>
                                            <View style={estilos.pontoOnline} />
                                        </View>
                                        <View style={{ flex: 1, minWidth: 0 }}>
                                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                                <Text style={{ fontSize: 14, fontWeight: "600", color: HADES.text }}>{p.nome}</Text>
                                                {p.host && (
                                                    <View style={estilos.tagHost}>
                                                        <Text style={estilos.tagHostTexto}>HOST</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={{ fontSize: 12, color: HADES.textMuted, marginTop: 2 }} numberOfLines={1}>
                                                {p.topico}
                                            </Text>
                                        </View>
                                        <View style={{ alignItems: "flex-end" }}>
                                            <Text style={estilos.cronometro}>{formatarCronometro(p.tempoSegundos + tick)}</Text>
                                            <Text style={{ fontSize: 11, color: HADES.green, marginTop: 1 }}>em foco</Text>
                                        </View>
                                    </View>
                                ))}
                                {sessao.maisPessoas > 0 && (
                                    <View style={estilos.participanteCard}>
                                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                                            <View style={[estilos.avatarPilha, { backgroundColor: "#e08a1e" }]}>
                                                <Text style={estilos.avatarPilhaTexto}>H</Text>
                                            </View>
                                            <View style={[estilos.avatarPilha, { backgroundColor: "#d0455e", marginLeft: -10 }]}>
                                                <Text style={estilos.avatarPilhaTexto}>M</Text>
                                            </View>
                                            <View style={[estilos.avatarPilha, { backgroundColor: HADES.surfaceOverlay, marginLeft: -10 }]}>
                                                <Text style={[estilos.avatarPilhaTexto, { color: HADES.textMuted, fontSize: 11 }]}>
                                                    +{sessao.maisPessoas - 2 > 0 ? sessao.maisPessoas - 2 : 1}
                                                </Text>
                                            </View>
                                        </View>
                                        <Text style={{ flex: 1, fontSize: 13.5, color: HADES.textSecondary }}>e mais {sessao.maisPessoas} focando</Text>
                                        <ChevronRight size={17} color={HADES.textDim} />
                                    </View>
                                )}
                            </View>
                        ) : (
                            <View style={estilos.vazioCard}>
                                <View style={estilos.vazioIcone}>
                                    <UserPlus size={23} color={HADES.accentSolid} />
                                </View>
                                <Text style={estilos.vazioTitulo}>Ninguém entrou ainda</Text>
                                <Text style={estilos.vazioTexto}>Seja a primeira pessoa a focar junto com {sessao.hostNome}.</Text>
                            </View>
                        )}

                        {/* Explicação da ação */}
                        <View style={estilos.avisoCardAccent}>
                            <Users size={19} color={HADES.accentSolid} style={{ marginTop: 1 }} />
                            <Text style={estilos.avisoTexto}>
                                Ao entrar você começa a <Text style={estilos.avisoDestaqueBranco}>focar junto</Text> — escolhe seu conteúdo e o tempo conta
                                pro <Text style={estilos.avisoDestaqueBranco}>seu</Text> ranking.
                            </Text>
                        </View>
                    </>
                )}
            </ScrollView>

            {/* Footer CTA */}
            <View style={estilos.footer}>
                {privada ? (
                    <TouchableOpacity onPress={handleAcao} activeOpacity={0.85} style={estilos.botaoTorcer}>
                        <HandMetal size={19} color={HADES.accentSolid} />
                        <Text style={{ fontSize: 16, fontWeight: "700", color: HADES.text }}>Mandar força</Text>
                    </TouchableOpacity>
                ) : (
                    <>
                        <TouchableOpacity style={estilos.botaoTorcerPequeno}>
                            <HandMetal size={20} color={HADES.accentSolid} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleAcao} activeOpacity={0.85} style={estilos.botaoEntrar}>
                            <Play size={19} color="#000" />
                            <Text style={{ fontSize: 16, fontWeight: "700", color: "#000" }}>Entrar e focar junto</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>
        </SafeAreaView>
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
        padding: 17,
    },
    avatar: {
        alignItems: "center",
        justifyContent: "center",
    },
    badgePublica: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        backgroundColor: "rgba(255,154,0,0.12)",
        borderWidth: 1,
        borderColor: "rgba(255,154,0,0.28)",
        borderRadius: 8,
        paddingHorizontal: 9,
        paddingVertical: 4,
    },
    badgePublicaTexto: {
        fontSize: 10.5,
        color: HADES.accentSolid,
        fontWeight: "700",
    },
    badgePrivada: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        backgroundColor: HADES.surfaceOverlay,
        borderWidth: 1,
        borderColor: HADES.border,
        borderRadius: 8,
        paddingHorizontal: 9,
        paddingVertical: 4,
    },
    badgePrivadaTexto: {
        fontSize: 10.5,
        color: HADES.textMuted,
        fontWeight: "700",
    },
    aoVivo: {
        flexDirection: "row",
        alignSelf: "flex-start",
        alignItems: "center",
        gap: 6,
        marginTop: 14,
        backgroundColor: HADES.greenTint,
        borderWidth: 1,
        borderColor: "rgba(48,209,88,0.3)",
        borderRadius: 999,
        paddingHorizontal: 11,
        paddingVertical: 5,
    },
    stats: {
        flexDirection: "row",
        marginTop: 18,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: HADES.border,
    },
    statDivider: {
        borderLeftWidth: 1,
        borderLeftColor: HADES.border,
        paddingLeft: 16,
    },
    statValor: {
        fontSize: 19,
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
    secaoHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 24,
        marginBottom: 12,
        marginHorizontal: 2,
    },
    secaoTitulo: {
        fontSize: 16,
        fontWeight: "700",
        color: HADES.text,
    },
    participanteCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: HADES.surface,
        borderWidth: 1,
        borderColor: HADES.border,
        borderRadius: 13,
        paddingVertical: 11,
        paddingHorizontal: 13,
    },
    pontoOnline: {
        position: "absolute",
        right: -1,
        bottom: -1,
        width: 11,
        height: 11,
        borderRadius: 6,
        backgroundColor: HADES.green,
        borderWidth: 2.5,
        borderColor: HADES.surface,
    },
    tagHost: {
        backgroundColor: HADES.surfaceOverlay,
        borderRadius: 5,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    tagHostTexto: {
        fontSize: 9.5,
        fontWeight: "700",
        color: HADES.textMuted,
    },
    cronometro: {
        fontSize: 14,
        fontWeight: "700",
        color: HADES.text,
        fontVariant: ["tabular-nums"],
    },
    avatarPilha: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: HADES.surface,
    },
    avatarPilhaTexto: {
        fontSize: 13,
        fontWeight: "600",
        color: "#fff",
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
    vazioIcone: {
        width: 46,
        height: 46,
        borderRadius: 14,
        backgroundColor: "rgba(255,154,0,0.12)",
        alignItems: "center",
        justifyContent: "center",
    },
    vazioTitulo: {
        fontSize: 15,
        fontWeight: "700",
        color: HADES.text,
        marginTop: 12,
    },
    vazioTexto: {
        fontSize: 12.5,
        color: HADES.textMuted,
        marginTop: 5,
        lineHeight: 18,
        textAlign: "center",
    },
    avisoCard: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 11,
        marginTop: 16,
        backgroundColor: HADES.surface,
        borderWidth: 1,
        borderColor: HADES.border,
        borderRadius: 14,
        padding: 14,
    },
    avisoCardAccent: {
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
    avisoDestaqueBranco: {
        color: HADES.text,
        fontWeight: "600",
    },
    torcidaCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: HADES.surface,
        borderWidth: 1,
        borderColor: HADES.border,
        borderRadius: 13,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    footer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 18,
        paddingTop: 12,
        paddingBottom: 26,
        borderTopWidth: 1,
        borderTopColor: HADES.border,
    },
    botaoTorcerPequeno: {
        width: 54,
        height: 54,
        borderRadius: 15,
        backgroundColor: HADES.surfaceRaised,
        borderWidth: 1,
        borderColor: HADES.borderStrong,
        alignItems: "center",
        justifyContent: "center",
    },
    botaoEntrar: {
        flex: 1,
        height: 54,
        borderRadius: 15,
        backgroundColor: HADES.accentSolid,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 9,
    },
    botaoTorcer: {
        flex: 1,
        height: 54,
        borderRadius: 15,
        backgroundColor: HADES.surfaceRaised,
        borderWidth: 1,
        borderColor: HADES.borderStrong,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 9,
    },
});
