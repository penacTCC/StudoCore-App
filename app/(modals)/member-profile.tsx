import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
    ChevronLeft, Flame, GitCompareArrows, Trophy,
    ListChecks, Heart, Timer, Camera, Lock,
    Coffee, BookOpen, Sunrise, Library, PenLine, NotebookText,
    type LucideIcon,
} from "lucide-react-native";
import { HADES } from "@/constants/hades";
import { Skeleton, SkeletonCircle } from "@/components/ui/Skeleton";
import { buscarPerfil } from "@/services/auth";
import { buscarGamificacao } from "@/services/gamificacao";
import { useSessoesUsuario } from "@/hooks/useSessoesFoco";
import { APP_BADGES } from "@/constants/badges";
import { getSubjectColor, formatDuration, getIdentityColor, getInitials, getBioFromObjetivo } from "@/constants/helpers";
import { AvatarComOfensiva, BannerPerfil } from "@/components/profile/PerfilBanner";
import CardMedalhas, { CardMedalhasVazioOutro } from "@/components/profile/CardMedalhas";
import type { Profile } from "@/types/profile";
import type { Gamificacao } from "@/types/gamificacao";
import type { SessaoFocoRow } from "@/types/sessions";

const BANNER_H = 158;
const AVATAR_SIZE = 92;

type AbaKey = "estatisticas" | "sessoes" | "galeria";
const ABAS: { key: AbaKey; label: string }[] = [
    { key: "estatisticas", label: "Estatísticas" },
    { key: "sessoes", label: "Sessões" },
    { key: "galeria", label: "Galeria" },
];

const sechStyle = {
    fontSize: 11.5,
    fontWeight: "700" as const,
    color: HADES.textMuted,
    letterSpacing: 0.8,
    textTransform: "uppercase" as const,
};

// Placeholder da Galeria — recurso ainda não existe no app (sem posts/fotos reais salvos).
// Mostrado só quando o usuário já tem alguma atividade real, pra dar uma prévia do que vem por aí.
const GALERIA_MOCK: { Icone: LucideIcon; tag: string; likes: number; duracao?: string }[] = [
    { Icone: Coffee, tag: "setup do dia", likes: 24, duracao: "2h05" },
    { Icone: BookOpen, tag: "resumo de revisão", likes: 18 },
    { Icone: Sunrise, tag: "estudo cedo", likes: 31, duracao: "1h30" },
    { Icone: Library, tag: "biblioteca", likes: 12 },
    { Icone: PenLine, tag: "flashcards", likes: 9 },
    { Icone: NotebookText, tag: "caderno de resumos", likes: 15, duracao: "2h30" },
];

// Início da semana atual (segunda-feira), igual ao cálculo usado em profileStats/brain.
const getInicioDaSemana = () => {
    const hoje = new Date();
    const diaDaSemana = hoje.getDay();
    const offsetSegunda = diaDaSemana === 0 ? -6 : 1 - diaDaSemana;
    const inicio = new Date(hoje);
    inicio.setHours(0, 0, 0, 0);
    inicio.setDate(hoje.getDate() + offsetSegunda);
    return inicio;
};

function inicioDoDia(d: Date) {
    const copia = new Date(d);
    copia.setHours(0, 0, 0, 0);
    return copia;
}

/** Agrupa as sessões salvas em blocos por dia ("Hoje" / "Ontem" / data), pra virar a timeline da aba Sessões. */
function agruparSessoesPorDia(sessions: SessaoFocoRow[]) {
    const hoje = inicioDoDia(new Date());
    const ontem = new Date(hoje);
    ontem.setDate(hoje.getDate() - 1);

    const grupos: { chave: string; dia: Date; sessoes: SessaoFocoRow[] }[] = [];
    const indicePorChave = new Map<string, number>();

    for (const s of sessions) {
        const data = new Date(s.created_at || s.data_sessao);
        const chave = inicioDoDia(data).toDateString();
        let idx = indicePorChave.get(chave);
        if (idx === undefined) {
            idx = grupos.length;
            indicePorChave.set(chave, idx);
            grupos.push({ chave, dia: inicioDoDia(data), sessoes: [] });
        }
        grupos[idx].sessoes.push(s);
    }

    return grupos.map(({ dia, sessoes }) => {
        let label: string;
        if (dia.getTime() === hoje.getTime()) label = "Hoje";
        else if (dia.getTime() === ontem.getTime()) label = "Ontem";
        else label = dia.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short" }).replace(/^./, (c) => c.toUpperCase());

        const totalMin = sessoes.reduce((acc, s) => acc + (s.tempo_minutos || 0), 0);
        return { label, totalMin, sessoes };
    });
}

function formatarHorario(iso: string | null) {
    if (!iso) return null;
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function MemberProfileScreen() {
    const router = useRouter();
    const { userId, administrador, rank } = useLocalSearchParams<{
        userId: string;
        administrador?: string;
        rank?: string;
    }>();

    const [profile, setProfile] = useState<Profile | null>(null);
    const [gamificacao, setGamificacao] = useState<Gamificacao | null>(null);
    const [aba, setAba] = useState<AbaKey>("estatisticas");

    const { savedSessions, loading: loadingSessions, refresh: refreshSessions } = useSessoesUsuario(userId);

    //Controla o estado do pull-to-refresh
    const [atualizando, setAtualizando] = useState(false);

    const carregarPerfilEGamificacao = useCallback(async () => {
        if (!userId) return;
        await Promise.all([
            buscarPerfil(userId).then(({ data }) => setProfile(data)),
            buscarGamificacao(userId).then(setGamificacao),
        ]);
    }, [userId]);

    useEffect(() => {
        carregarPerfilEGamificacao();
    }, [carregarPerfilEGamificacao]);

    const handleRefresh = async () => {
        setAtualizando(true);
        try {
            await Promise.all([carregarPerfilEGamificacao(), refreshSessions()]);
        } finally {
            setAtualizando(false);
        }
    };

    const joinDate = profile?.created_at
        ? new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(profile.created_at))
        : "...";

    const unlockedBadges = APP_BADGES.filter((b) => profile?.medalhas_desbloqueadas?.includes(b.id));
    const medalhasRecentes = unlockedBadges.slice(-8);

    // Progresso da meta semanal a partir das sessões públicas já carregadas (RLS filtra as privadas de outro usuário).
    const inicioDaSemana = getInicioDaSemana();
    const minutosEstaSemana = savedSessions
        .filter((s) => new Date(s.created_at || s.data_sessao) >= inicioDaSemana)
        .reduce((total, s) => total + (s.tempo_minutos || 0), 0);
    const metaSemanaMinutos = profile?.minutos_semana ?? 720;
    const progressoSemanal = Math.min(Math.round((minutosEstaSemana / metaSemanaMinutos) * 100), 100);

    const diasDeSessoes = useMemo(() => agruparSessoesPorDia(savedSessions), [savedSessions]);

    // Sem nenhum sinal de atividade: mostra as variantes vazias das 3 abas em vez de zeros/placeholders soltos.
    const semAtividade = !loadingSessions && savedSessions.length === 0 && unlockedBadges.length === 0 && !profile?.horas_totais;

    if (!profile) {
        return <MemberProfileSkeleton />;
    }

    const nome = profile.nome_real || profile.nome_usuario || "Usuário";
    const primeiroNome = nome.split(" ")[0];
    const corIdentidade = getIdentityColor(profile.nome_usuario);
    const bio = profile.bio?.trim() || getBioFromObjetivo(profile.objetivo);
    const perfilPrivado = profile.perfil_publico === false;

    return (
        <View style={{ flex: 1, backgroundColor: HADES.bg }}>
            <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 32 }}
                refreshControl={
                    <RefreshControl refreshing={atualizando} onRefresh={handleRefresh} tintColor={HADES.accentSolid} />
                }
            >
                {/* Banner + avatar sobreposto, rolam junto com o conteúdo */}
                <View style={{ height: BANNER_H }}>
                    <BannerPerfil
                        altura={BANNER_H}
                        cor={corIdentidade}
                        iniciais={getInitials(profile.nome_usuario)}
                        foto={profile.foto_usuario}
                    />

                    <View style={{ position: "absolute", left: 0, right: 0, bottom: -(AVATAR_SIZE / 2 + 4), alignItems: "center" }}>
                        <AvatarComOfensiva
                            tamanho={AVATAR_SIZE}
                            foto={profile.foto_usuario}
                            nome={profile.nome_usuario}
                            ofensiva={gamificacao?.ofensiva ?? 0}
                            mostrarOfensiva={!semAtividade && (profile.mostrar_ofensiva ?? true)}
                        />
                    </View>
                </View>

                <View style={{ paddingTop: AVATAR_SIZE / 2 + 18 }}>
                {/* Nome & identidade */}
                <View style={{ alignItems: "center", paddingHorizontal: 32 }}>
                    <Text style={{ fontSize: 21, fontWeight: "700", color: HADES.text, letterSpacing: -0.3 }}>
                        {nome}
                    </Text>
                    <Text style={{ fontSize: 12.5, color: HADES.textFaint, marginTop: 4 }}>
                        Desde {joinDate}
                    </Text>
                    {bio ? (
                        <Text style={{ fontSize: 13, color: HADES.textSecondary, lineHeight: 19, marginTop: 10, textAlign: "center" }}>
                            {bio}
                        </Text>
                    ) : (
                        <Text style={{ fontSize: 13, color: HADES.textDim, fontStyle: "italic", marginTop: 10 }}>
                            Ainda sem bio.
                        </Text>
                    )}
                    {administrador === "true" && (
                        <View
                            style={{
                                backgroundColor: HADES.amberTint,
                                paddingHorizontal: 12,
                                paddingVertical: 4,
                                borderRadius: 999,
                                marginTop: 10,
                                borderWidth: 1,
                                borderColor: "rgba(242,176,61,0.25)",
                            }}
                        >
                            <Text style={{ color: HADES.amber, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 }}>
                                ADMINISTRADOR
                            </Text>
                        </View>
                    )}
                </View>

                {/* Abas */}
                <View style={{ flexDirection: "row", marginTop: 20, borderBottomWidth: 1, borderBottomColor: HADES.border, paddingHorizontal: 20 }}>
                    {ABAS.map((tab) => {
                        const ativa = tab.key === aba;
                        return (
                            <TouchableOpacity
                                key={tab.key}
                                onPress={() => setAba(tab.key)}
                                activeOpacity={0.7}
                                style={{
                                    flex: 1, alignItems: "center", paddingBottom: 11,
                                    borderBottomWidth: 2.5, borderBottomColor: ativa ? HADES.accentSolid : "transparent",
                                }}
                            >
                                <Text style={{ fontSize: 13.5, fontWeight: ativa ? "700" : "600", color: ativa ? HADES.accentSolid : HADES.textFaint }}>
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
                    {/* "Perfil público" desligado na edição de perfil: número nenhum aparece aqui. */}
                    {perfilPrivado ? (
                        <PerfilPrivado primeiroNome={primeiroNome} />
                    ) : (
                    <>
                    {aba === "estatisticas" && (
                        semAtividade ? (
                            <EstatisticasVazias primeiroNome={primeiroNome} />
                        ) : (
                            <EstatisticasConteudo
                                horasTotais={profile.horas_totais ?? 0}
                                melhorOfensiva={gamificacao?.melhor_ofensiva ?? 0}
                                rank={rank}
                                progressoSemanal={progressoSemanal}
                                minutosEstaSemana={minutosEstaSemana}
                                metaSemanaMinutos={metaSemanaMinutos}
                                medalhasRecentes={medalhasRecentes}
                                totalBadges={APP_BADGES.length}
                            />
                        )
                    )}

                    {aba === "sessoes" && (
                        loadingSessions ? (
                            <SessoesSkeleton />
                        ) : savedSessions.length === 0 ? (
                            <SessoesVazias primeiroNome={primeiroNome} />
                        ) : (
                            <SessoesTimeline dias={diasDeSessoes} />
                        )
                    )}

                    {aba === "galeria" && (
                        semAtividade ? <GaleriaVazia primeiroNome={primeiroNome} /> : <GaleriaConteudo />
                    )}
                    </>
                    )}
                </View>
                </View>
            </ScrollView>

            {/* Botões flutuantes: voltar e comparar, sempre acessíveis durante o scroll */}
            <SafeAreaView edges={["top"]} style={{ position: "absolute", top: 0, left: 0, right: 0 }} pointerEvents="box-none">
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 2 }}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={{
                            width: 38, height: 38, borderRadius: 19,
                            backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center",
                        }}
                    >
                        <ChevronLeft size={21} color="#fff" />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 14.5, fontWeight: "700", color: "#fff" }} numberOfLines={1}>
                        @{profile.nome_usuario}
                    </Text>
                    <TouchableOpacity
                        onPress={() => router.push({ pathname: "/(modals)/compare-profile", params: { userId } })}
                        style={{
                            width: 38, height: 38, borderRadius: 19,
                            backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center",
                        }}
                    >
                        <GitCompareArrows size={18} color="#fff" />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
}

function EstatisticasConteudo({
    horasTotais,
    melhorOfensiva,
    rank,
    progressoSemanal,
    minutosEstaSemana,
    metaSemanaMinutos,
    medalhasRecentes,
    totalBadges,
}: {
    horasTotais: number;
    melhorOfensiva: number;
    rank?: string;
    progressoSemanal: number;
    minutosEstaSemana: number;
    metaSemanaMinutos: number;
    medalhasRecentes: typeof APP_BADGES;
    totalBadges: number;
}) {
    return (
        <View>
            <View style={{ flexDirection: "row" }}>
                <View style={{ flex: 1, alignItems: "center" }}>
                    <Text style={{ fontSize: 26, fontWeight: "800", color: HADES.text, letterSpacing: -0.8 }}>{horasTotais}h</Text>
                    <Text style={{ fontSize: 11, color: HADES.textFaint, marginTop: 3 }}>horas totais</Text>
                </View>
                <View style={{ width: 1, backgroundColor: HADES.border }} />
                <View style={{ flex: 1, alignItems: "center" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }}>
                        <Flame size={18} color={HADES.accentSolid} />
                        <Text style={{ fontSize: 26, fontWeight: "800", color: HADES.text, letterSpacing: -0.8 }}>{melhorOfensiva}</Text>
                    </View>
                    <Text style={{ fontSize: 11, color: HADES.textFaint, marginTop: 3 }}>melhor ofensiva</Text>
                </View>
            </View>
            <View style={{ height: 1, backgroundColor: HADES.border, marginVertical: 20 }} />

            <Text style={sechStyle}>Ranking no grupo</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 13, marginTop: 14 }}>
                <View
                    style={{
                        width: 44, height: 44, borderRadius: 22,
                        backgroundColor: "rgba(255,210,74,0.12)", borderWidth: 1, borderColor: "rgba(255,210,74,0.3)",
                        alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}
                >
                    <Text style={{ fontSize: 16, fontWeight: "800", color: "#ffd24a" }}>{rank ? `${rank}º` : "—"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                        <Text style={{ fontSize: 12.5, color: HADES.textSecondary, fontWeight: "600" }}>Meta semanal</Text>
                        <Text style={{ fontSize: 12.5, color: HADES.text, fontWeight: "700" }}>
                            {Math.floor(minutosEstaSemana / 60)}h <Text style={{ color: HADES.textDim, fontWeight: "500" }}>/ {Math.round(metaSemanaMinutos / 60)}h</Text>
                        </Text>
                    </View>
                    <View style={{ height: 7, borderRadius: 4, backgroundColor: HADES.surfaceOverlay, overflow: "hidden" }}>
                        <View style={{ height: "100%", width: `${progressoSemanal}%`, borderRadius: 4, backgroundColor: HADES.accentSolid }} />
                    </View>
                </View>
            </View>
            <View style={{ height: 1, backgroundColor: HADES.border, marginVertical: 20 }} />

            <CardMedalhas recentes={medalhasRecentes} desbloqueadas={medalhasRecentes.length} total={totalBadges} colunas={4} />
        </View>
    );
}

/** Estado de perfil fechado: quem desligou "Perfil público" não expõe estatísticas nem sessões. */
function PerfilPrivado({ primeiroNome }: { primeiroNome: string }) {
    return (
        <View style={{ alignItems: "center", gap: 12, paddingVertical: 36 }}>
            <View
                style={{
                    width: 52, height: 52, borderRadius: 26,
                    backgroundColor: HADES.surfaceRaised, borderWidth: 1, borderStyle: "dashed", borderColor: HADES.borderDashed,
                    alignItems: "center", justifyContent: "center",
                }}
            >
                <Lock size={22} color={HADES.textDim} />
            </View>
            <Text style={{ fontSize: 15, fontWeight: "700", color: HADES.text }}>Perfil privado</Text>
            <Text style={{ fontSize: 13, color: HADES.textMuted, lineHeight: 19, textAlign: "center", maxWidth: 250 }}>
                {primeiroNome} preferiu não mostrar as estatísticas de estudo para outras pessoas.
            </Text>
        </View>
    );
}

function EstatisticasVazias({ primeiroNome }: { primeiroNome: string }) {
    return (
        <View>
            <View style={{ flexDirection: "row" }}>
                <View style={{ flex: 1, alignItems: "center" }}>
                    <Text style={{ fontSize: 26, fontWeight: "800", color: "#3a3d45", letterSpacing: -0.8 }}>0h</Text>
                    <Text style={{ fontSize: 11, color: HADES.textFaint, marginTop: 3 }}>horas totais</Text>
                </View>
                <View style={{ width: 1, backgroundColor: HADES.border }} />
                <View style={{ flex: 1, alignItems: "center" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }}>
                        <Flame size={18} color="#3a3d45" />
                        <Text style={{ fontSize: 26, fontWeight: "800", color: "#3a3d45", letterSpacing: -0.8 }}>0</Text>
                    </View>
                    <Text style={{ fontSize: 11, color: HADES.textFaint, marginTop: 3 }}>melhor ofensiva</Text>
                </View>
            </View>
            <View style={{ height: 1, backgroundColor: HADES.border, marginVertical: 20 }} />

            <Text style={sechStyle}>Ranking no grupo</Text>
            <View style={{ alignItems: "center", gap: 10, paddingVertical: 20 }}>
                <View
                    style={{
                        width: 48, height: 48, borderRadius: 24,
                        backgroundColor: HADES.surfaceRaised, borderWidth: 1, borderStyle: "dashed", borderColor: HADES.borderDashed,
                        alignItems: "center", justifyContent: "center",
                    }}
                >
                    <Trophy size={21} color={HADES.textDim} />
                </View>
                <Text style={{ fontSize: 13, color: HADES.textMuted, lineHeight: 19, textAlign: "center", maxWidth: 230 }}>
                    Ainda sem sessões suficientes para calcular o ranking de {primeiroNome}.
                </Text>
            </View>
            <View style={{ height: 1, backgroundColor: HADES.border, marginVertical: 20 }} />

            <CardMedalhasVazioOutro total={APP_BADGES.length} />
        </View>
    );
}

function SessoesTimeline({ dias }: { dias: { label: string; totalMin: number; sessoes: SessaoFocoRow[] }[] }) {
    return (
        <View>
            {dias.map((dia, i) => (
                <View key={dia.label + i}>
                    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: i === 0 ? 0 : 6, marginBottom: 4 }}>
                        <Text style={{ fontSize: 12, fontWeight: "700", color: HADES.textMuted, letterSpacing: 0.6, textTransform: "uppercase" }}>
                            {dia.label}
                        </Text>
                        <View style={{ flex: 1, height: 1, backgroundColor: HADES.border }} />
                        <Text style={{ fontSize: 11.5, color: HADES.textDim }}>{formatDuration(Math.floor(dia.totalMin / 60), dia.totalMin % 60)}</Text>
                    </View>

                    {dia.sessoes.map((s, idx) => {
                        const cor = getSubjectColor(s.disciplina).text;
                        const horaInicio = formatarHorario(s.ultimo_inicio);
                        const horaFim = formatarHorario(s.concluido_em);
                        const horario = horaInicio && horaFim ? `${horaInicio} – ${horaFim}` : null;
                        const ultimaDaLista = idx === dia.sessoes.length - 1;

                        return (
                            <View key={s.id} style={{ flexDirection: "row", gap: 13, paddingVertical: 13 }}>
                                <View style={{ alignItems: "center", width: 14, flexShrink: 0 }}>
                                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cor, marginTop: 4 }} />
                                    {!ultimaDaLista && <View style={{ flex: 1, width: 2, borderRadius: 1, backgroundColor: HADES.border, marginTop: 6 }} />}
                                </View>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
                                        <Text style={{ fontSize: 14.5, fontWeight: "700", color: HADES.text }} numberOfLines={1}>
                                            {s.disciplina}
                                        </Text>
                                        <Text style={{ fontSize: 15, fontWeight: "800", color: cor, letterSpacing: -0.3 }}>
                                            {formatDuration(Math.floor(s.tempo_minutos / 60), s.tempo_minutos % 60)}
                                        </Text>
                                    </View>
                                    {horario && <Text style={{ fontSize: 11.5, color: HADES.textFaint, marginTop: 3 }}>{horario}</Text>}
                                    <View style={{ flexDirection: "row", gap: 14, marginTop: 8 }}>
                                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                                            <ListChecks size={12} color={HADES.textDim} />
                                            <Text style={{ fontSize: 11.5, color: HADES.textMuted }}>{s.questoes_respondidas} questões</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </View>
            ))}
        </View>
    );
}

function SessoesVazias({ primeiroNome }: { primeiroNome: string }) {
    return (
        <View style={{ alignItems: "center", gap: 12, paddingVertical: 40 }}>
            <View
                style={{
                    width: 56, height: 56, borderRadius: 28,
                    backgroundColor: HADES.surfaceRaised, borderWidth: 1, borderStyle: "dashed", borderColor: HADES.borderDashed,
                    alignItems: "center", justifyContent: "center",
                }}
            >
                <Timer size={24} color={HADES.textDim} />
            </View>
            <Text style={{ fontSize: 14.5, fontWeight: "700", color: HADES.textSecondary }}>Nenhuma sessão pública</Text>
            <Text style={{ fontSize: 13, color: HADES.textFaint, lineHeight: 19, textAlign: "center", maxWidth: 240 }}>
                Quando {primeiroNome} compartilhar uma sessão de estudo, ela aparece aqui.
            </Text>
        </View>
    );
}

function SessoesSkeleton() {
    return (
        <View style={{ gap: 12 }}>
            {[0, 1].map((i) => (
                <View key={i}>
                    <Skeleton width={70} height={12} hades style={{ marginBottom: 12 }} />
                    <View style={{ flexDirection: "row", gap: 8, marginBottom: 4 }}>
                        <SkeletonCircle size={10} hades style={{ marginTop: 4 }} />
                        <View style={{ flex: 1, gap: 6 }}>
                            <Skeleton width="60%" height={14} hades />
                            <Skeleton width={90} height={11} hades />
                        </View>
                    </View>
                </View>
            ))}
        </View>
    );
}

function GaleriaConteudo() {
    return (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
            {GALERIA_MOCK.map((post, i) => (
                <View
                    key={i}
                    style={{
                        width: "32.3%", aspectRatio: 1, borderRadius: 10, overflow: "hidden",
                        backgroundColor: HADES.surfaceRaised, borderWidth: 1, borderColor: HADES.border,
                        alignItems: "center", justifyContent: "center", gap: 5, padding: 6,
                    }}
                >
                    <post.Icone size={20} color={HADES.textDim} />
                    <Text style={{ fontSize: 8, fontFamily: "monospace", color: HADES.textDim, textAlign: "center" }} numberOfLines={1}>
                        {post.tag}
                    </Text>
                    <View style={{ position: "absolute", bottom: 5, left: 6, flexDirection: "row", alignItems: "center", gap: 3 }}>
                        <Heart size={10} color={HADES.textSecondary} />
                        <Text style={{ fontSize: 9, fontWeight: "700", color: HADES.textSecondary }}>{post.likes}</Text>
                    </View>
                    {post.duracao && (
                        <View
                            style={{
                                position: "absolute", top: 5, right: 5, flexDirection: "row", alignItems: "center", gap: 3,
                                backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 6, paddingVertical: 2, paddingHorizontal: 6,
                            }}
                        >
                            <Timer size={9} color={HADES.accentSolid} />
                            <Text style={{ fontSize: 8.5, fontWeight: "700", color: "#fff" }}>{post.duracao}</Text>
                        </View>
                    )}
                </View>
            ))}
        </View>
    );
}

function GaleriaVazia({ primeiroNome }: { primeiroNome: string }) {
    return (
        <View style={{ alignItems: "center", gap: 12, paddingVertical: 40 }}>
            <View
                style={{
                    width: 56, height: 56, borderRadius: 28,
                    backgroundColor: HADES.surfaceRaised, borderWidth: 1, borderStyle: "dashed", borderColor: HADES.borderDashed,
                    alignItems: "center", justifyContent: "center",
                }}
            >
                <Camera size={24} color={HADES.textDim} />
            </View>
            <Text style={{ fontSize: 14.5, fontWeight: "700", color: HADES.textSecondary }}>Nenhuma foto ainda</Text>
            <Text style={{ fontSize: 13, color: HADES.textFaint, lineHeight: 19, textAlign: "center", maxWidth: 240 }}>
                Os registros do cantinho de estudo de {primeiroNome} vão aparecer aqui.
            </Text>
        </View>
    );
}

function MemberProfileSkeleton() {
    return (
        <View style={{ flex: 1, backgroundColor: HADES.bg }}>
            <View style={{ height: BANNER_H, backgroundColor: HADES.surfaceRaised }}>
                <View style={{ position: "absolute", left: 0, right: 0, bottom: -(AVATAR_SIZE / 2 + 4), alignItems: "center" }}>
                    <View style={{ borderRadius: 999, borderWidth: 4, borderColor: HADES.bg }}>
                        <SkeletonCircle size={AVATAR_SIZE} hades />
                    </View>
                </View>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingTop: AVATAR_SIZE / 2 + 18, paddingBottom: 32, paddingHorizontal: 20 }}
            >
                <View style={{ alignItems: "center", marginBottom: 16, gap: 8 }}>
                    <Skeleton width={150} height={18} hades />
                    <Skeleton width={100} height={13} hades />
                    <Skeleton width={110} height={11} hades />
                </View>

                <Skeleton width="100%" height={40} borderRadius={0} hades style={{ marginBottom: 20 }} />
                <View style={{ flexDirection: "row", gap: 16, marginBottom: 20 }}>
                    <Skeleton width="100%" height={40} hades style={{ flex: 1 }} />
                    <Skeleton width="100%" height={40} hades style={{ flex: 1 }} />
                </View>
                <Skeleton width="100%" height={80} borderRadius={16} hades />
            </ScrollView>
        </View>
    );
}
