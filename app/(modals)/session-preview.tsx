import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react-native";

import { HADES } from "@/constants/hades";
import { getSubjectColor } from "@/constants/helpers";
import { buscarSessoesRecentes, fetchSessionById, fetchSessionMembers } from "@/services/sessions";
import { useIncentivos } from "@/hooks/useIncentivos";
import { useAuth } from "@/hooks/useAuth";
import type { MemberSession, SessionCardItem } from "@/types/sessions";

type Participante = {
    /** id do usuário: é quem recebe a força quando alguém torce por ele. */
    id: string;
    nome: string;
    inicial: string;
    cor: string;
    topico: string;
    tempoSegundos: number;
    /** Só quem está de fato focando tem o cronômetro correndo na tela. */
    ativo: boolean;
    host?: boolean;
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
    const { userId } = useAuth();
    const params = useLocalSearchParams<{ sessionId?: string; session?: string; variante?: string; isPublic?: string }>();
    const [sessao, setSessao] = useState<SessionCardItem | null>(null);
    const [participantes, setParticipantes] = useState<Participante[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState<string | null>(null);

    const sessionParam = useMemo(() => {
        const raw = Array.isArray(params.session) ? params.session[0] : params.session;
        return raw ? raw : null;
    }, [params.session]);

    const privada = sessao ? !sessao.is_public : params.isPublic === "false";
    const corMateria = getSubjectColor(sessao?.disciplina || "Estudo Geral");

    // Cronômetros locais para dar sensação de "ao vivo".
    const [tick, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 1000);
        return () => clearInterval(id);
    }, []);

    // Torcida da sessão inteira, com contagem por participante. Fica fora dos early
    // returns por causa das regras de hooks. Sessão privada é estudo solo e não tem
    // torcida, então nem consulta nem abre canal de realtime à toa.
    const {
        total: totalIncentivos,
        torcedores,
        enviandoPara,
        contarPara,
        euMandeiPara,
        podeTorcerPor,
        alternarPara,
    } = useIncentivos(privada ? null : sessao?.id);

    useEffect(() => {
        let ativo = true;

        const carregarSessao = async () => {
            setCarregando(true);
            setErro(null);
            setParticipantes([]);

            try {
                let sessaoEncontrada: SessionCardItem | null = null;

                if (sessionParam) {
                    try {
                        sessaoEncontrada = JSON.parse(sessionParam) as SessionCardItem;
                    } catch {
                        sessaoEncontrada = null;
                    }
                }

                if (!sessaoEncontrada && params.sessionId) {
                    const { data, error } = await fetchSessionById(params.sessionId);
                    if (error) throw error;
                    sessaoEncontrada = data as SessionCardItem | null;
                }

                if (!sessaoEncontrada) {
                    const { data, error } = await buscarSessoesRecentes(1);
                    if (error) throw error;
                    sessaoEncontrada = (data?.[0] as SessionCardItem | undefined) ?? null;
                }

                if (!ativo) return;
                setSessao(sessaoEncontrada);

                if (!sessaoEncontrada) {
                    setCarregando(false);
                    return;
                }

                const { data: membrosData, error: membrosError } = await fetchSessionMembers(sessaoEncontrada.id);
                if (!ativo) return;

                if (membrosError) {
                    setParticipantes([]);
                } else {
                    const participantesMapeados: Participante[] = (membrosData || []).map((membro: MemberSession, index: number) => {
                        const profile = membro.profiles as { nome_usuario?: string | null; nome_real?: string | null } | undefined;
                        const nome = profile?.nome_usuario || profile?.nome_real || "Usuário";
                        const inicial = nome.charAt(0).toUpperCase();
                        const cores = ["#1f9d63", "#7c5cfc", "#1f9aa8", "#e08a1e", "#d0455e"];

                        return {
                            id: membro.membro_id,
                            nome,
                            inicial,
                            cor: cores[index % cores.length],
                            topico: membro.sessoes_foco?.conteudo_especifico || sessaoEncontrada?.conteudo_especifico || "Foco",
                            tempoSegundos: membro.tempo_segundos ?? 0,
                            ativo: membro.status === "ativo",
                            host: membro.funcao === "anfitriao" || membro.membro_id === sessaoEncontrada?.user_id,
                        };
                    });
                    setParticipantes(participantesMapeados);
                }
            } catch (error) {
                console.warn("Erro ao carregar prévia da sessão:", error);
                if (ativo) {
                    setErro("Não foi possível carregar os dados dessa sessão.");
                    setSessao(null);
                }
            } finally {
                if (ativo) {
                    setCarregando(false);
                }
            }
        };

        carregarSessao();
        return () => {
            ativo = false;
        };
    }, [params.sessionId, sessionParam]);

    // Só as sessões públicas têm este CTA; nas privadas o footer mostra apenas o "Mandar força".
    const handleAcao = () => {
        if (!sessao) return;
        router.dismissAll();
        router.replace({
            pathname: "/(tabs)/focus",
            params: {
                session: JSON.stringify(sessao),
                sessionId: sessao.id,
                joinPublicSession: "true",
            },
        });
    };

    if (carregando) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top"]}>
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
                    <Text style={{ color: HADES.text, fontSize: 16, fontWeight: "600" }}>Carregando sessão…</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!sessao) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top"]}>
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
                    <Text style={{ color: HADES.text, fontSize: 16, fontWeight: "600" }}>{erro || "Nenhuma sessão disponível no momento."}</Text>
                </View>
            </SafeAreaView>
        );
    }

    const hostNome = sessao.profiles?.nome_usuario || sessao.profiles?.nome_real || "Usuário";
    const hostInicial = hostNome.charAt(0).toUpperCase();
    const hostCor = corMateria.text || "#1f9d63";
    const estaConcluida = Boolean(sessao.concluido_em || sessao.status === "concluido");
    const abertaHaMin = Math.max(1, Math.round((Date.now() - new Date(sessao.created_at).getTime()) / 60000));
    const duracaoMin = Math.max(1, Math.round(sessao.tempo_minutos || 0));
    const horaInicio = sessao.ultimo_inicio ? new Date(sessao.ultimo_inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : new Date(sessao.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const ofensiva = sessao.questoes_acertadas || 0;

    // A torcida vem dos incentivos de verdade — antes contava membros da sessão, que é outra coisa.
    const torcidaNomes = torcedores.length > 0 ? torcedores.slice(0, 3).join(", ") : "Ainda ninguém mandou força";
    const torcedoresRestantes = Math.max(0, torcedores.length - 2);
    const statusTexto = estaConcluida
        ? "Sessão concluída"
        : `${privada ? "está focando" : "abriu esta sessão"} · há ${abertaHaMin} min`;

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
                        <View style={[estilos.avatar, { width: 44, height: 44, borderRadius: 22, backgroundColor: hostCor }]}>
                            <Text style={{ color: "#fff", fontSize: 17, fontWeight: "600" }}>{hostInicial}</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                                <Text style={{ fontSize: 16, fontWeight: "700", color: HADES.text }}>{hostNome}</Text>
                                <BadgeCheck size={16} color={HADES.subjectBlue} />
                            </View>
                            <Text style={{ fontSize: 12.5, color: HADES.textMuted, marginTop: 1 }}>
                                {statusTexto}
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
                        <Text style={{ fontSize: 14, color: corMateria.text, marginTop: 3 }}>{sessao.conteudo_especifico || "Sessão sem conteúdo detalhado"}</Text>
                    </View>

                    {estaConcluida ? (
                        <View style={estilos.badgeConcluida}>
                            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: HADES.textMuted }} />
                            <Text style={{ fontSize: 12, color: HADES.textMuted, fontWeight: "600" }}>Sessão concluída</Text>
                        </View>
                    ) : null}

                    <View style={estilos.stats}>
                        <View style={{ flex: 1 }}>
                            <Text style={estilos.statValor}>{formatarDuracao(duracaoMin)}</Text>
                            <Text style={estilos.statRotulo}>DURAÇÃO</Text>
                        </View>
                        <View style={[estilos.statDivider, { flex: 1 }]}>
                            <Text style={estilos.statValor}>{horaInicio}</Text>
                            <Text style={estilos.statRotulo}>INÍCIO</Text>
                        </View>
                        <View style={[estilos.statDivider, { flex: 1 }]}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                                <Flame size={16} color={HADES.accentSolid} />
                                <Text style={estilos.statValor}>{ofensiva}</Text>
                            </View>
                            <Text style={estilos.statRotulo}>OFENSIVA</Text>
                        </View>
                    </View>
                </View>

                {privada ? (
                    <>
                        {/* Bloqueio suave. Sessão privada é estudo solo: não tem torcida. */}
                        <View style={estilos.avisoCard}>
                            <Lock size={19} color={HADES.textMuted} style={{ marginTop: 1 }} />
                            <Text style={estilos.avisoTexto}>
                                Esta sessão é <Text style={estilos.avisoDestaque}>privada</Text>. Você acompanha o progresso, mas não pode entrar para
                                focar junto.
                            </Text>
                        </View>
                    </>
                ) : (
                    <>
                        {/* Focando agora */}
                        <View style={estilos.secaoHeader}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                <Text style={estilos.secaoTitulo}>Focando agora</Text>
                                {participantes.length > 0 && (
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: HADES.green }} />
                                        <Text style={{ fontSize: 11, color: HADES.green, fontWeight: "600" }}>
                                            {participantes.length === 1 ? "1 pessoa" : `${participantes.length} pessoas`}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        {participantes.length > 0 ? (
                            <View style={{ gap: 9 }}>
                                {participantes.map((p) => {
                                    const forcasRecebidas = contarPara(p.id);
                                    const jaTorciPorEle = euMandeiPara(p.id);
                                    const posso = podeTorcerPor(p.id);

                                    return (
                                        <View key={p.id} style={estilos.participanteCard}>
                                            <View style={{ position: "relative" }}>
                                                <View style={[estilos.avatar, { width: 38, height: 38, borderRadius: 19, backgroundColor: p.cor }]}>
                                                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>{p.inicial}</Text>
                                                </View>
                                                {/* Verde só para quem está focando; pausado fica cinza. */}
                                                <View style={[estilos.pontoOnline, !p.ativo && { backgroundColor: HADES.textDim }]} />
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
                                                {/* O tick local só avança para quem está de fato focando: antes o
                                                    cronômetro de um membro pausado continuava subindo na tela. */}
                                                <Text style={estilos.cronometro}>
                                                    {formatarCronometro(p.tempoSegundos + (p.ativo ? tick : 0))}
                                                </Text>
                                                <Text style={{ fontSize: 11, color: p.ativo ? HADES.green : HADES.textMuted, marginTop: 1 }}>
                                                    {p.ativo ? "em foco" : "em pausa"}
                                                </Text>
                                            </View>

                                            {/* Cada participante recebe força individualmente; some no próprio card. */}
                                            {posso && (
                                                <TouchableOpacity
                                                    onPress={() => alternarPara(p.id)}
                                                    disabled={!!enviandoPara}
                                                    activeOpacity={0.7}
                                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                    style={[
                                                        estilos.botaoForcaMembro,
                                                        jaTorciPorEle && estilos.botaoForcaMembroAtivo,
                                                        !!enviandoPara && { opacity: 0.6 },
                                                    ]}
                                                >
                                                    <HandMetal
                                                        size={15}
                                                        color={HADES.accentSolid}
                                                        fill={jaTorciPorEle ? HADES.accentSolid : "none"}
                                                    />
                                                    {forcasRecebidas > 0 && (
                                                        <Text style={estilos.botaoForcaMembroTexto}>{forcasRecebidas}</Text>
                                                    )}
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    );
                                })}
                            </View>
                        ) : (
                            <View style={estilos.vazioCard}>
                                <View style={estilos.vazioIcone}>
                                    <UserPlus size={23} color={HADES.accentSolid} />
                                </View>
                                <Text style={estilos.vazioTitulo}>Ninguém entrou ainda</Text>
                                <Text style={estilos.vazioTexto}>Seja a primeira pessoa a focar junto com {hostNome}.</Text>
                            </View>
                        )}

                        {/* Torcida: quem está de fora acompanhando e mandando força. */}
                        <View style={estilos.secaoHeader}>
                            <Text style={estilos.secaoTitulo}>Torcida</Text>
                            <Text style={{ fontSize: 12.5, color: HADES.textMuted, fontWeight: "600" }}>
                                {totalIncentivos === 1 ? "1 força enviada" : `${totalIncentivos} forças enviadas`}
                            </Text>
                        </View>
                        <View style={estilos.torcidaCard}>
                            {torcedores.length > 0 && (
                                <View style={{ flexDirection: "row", alignItems: "center" }}>
                                    {torcedores.slice(0, 2).map((nome, index) => (
                                        <View
                                            key={`${nome}-${index}`}
                                            style={[
                                                estilos.avatarPilha,
                                                { backgroundColor: index === 0 ? "#e08a1e" : "#d0455e" },
                                                index > 0 && { marginLeft: -10 },
                                            ]}
                                        >
                                            <Text style={estilos.avatarPilhaTexto}>{nome.charAt(0).toUpperCase()}</Text>
                                        </View>
                                    ))}
                                    {torcedoresRestantes > 0 && (
                                        <View style={[estilos.avatarPilha, { backgroundColor: HADES.surfaceOverlay, marginLeft: -10 }]}>
                                            <Text style={[estilos.avatarPilhaTexto, { color: HADES.textMuted, fontSize: 11 }]}>
                                                +{torcedoresRestantes}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            )}
                            <Text style={{ flex: 1, fontSize: 13, color: HADES.textSecondary }} numberOfLines={1}>
                                {torcidaNomes}
                            </Text>
                            <HandMetal size={18} color={HADES.accentSolid} />
                        </View>

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

            {/* Footer CTA. Na privada não há ação: não dá para entrar nem torcer. */}
            {!privada && (
                <View style={estilos.footer}>
                    <TouchableOpacity
                        onPress={handleAcao}
                        activeOpacity={0.85}
                        disabled={estaConcluida}
                        style={[estilos.botaoEntrar, estaConcluida && { opacity: 0.7 }]}
                    >
                        <Play size={19} color="#000" />
                        <Text style={{ fontSize: 16, fontWeight: "700", color: "#000" }}>
                            {estaConcluida ? "Sessão concluída" : "Entrar e focar junto"}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}
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
    badgeConcluida: {
        flexDirection: "row",
        alignSelf: "flex-start",
        alignItems: "center",
        gap: 6,
        marginTop: 14,
        backgroundColor: HADES.surfaceOverlay,
        borderWidth: 1,
        borderColor: HADES.border,
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
    // Botão de força que fica dentro do card de cada participante.
    botaoForcaMembro: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginLeft: 4,
        paddingHorizontal: 9,
        paddingVertical: 7,
        borderRadius: 10,
        backgroundColor: HADES.surfaceRaised,
        borderWidth: 1,
        borderColor: HADES.borderStrong,
    },
    botaoForcaMembroAtivo: {
        backgroundColor: "rgba(255,154,0,0.12)",
        borderColor: "rgba(255,154,0,0.35)",
    },
    botaoForcaMembroTexto: {
        fontSize: 12,
        fontWeight: "700",
        color: HADES.accentSolid,
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
});
