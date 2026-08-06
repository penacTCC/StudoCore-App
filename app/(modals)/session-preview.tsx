import { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import {
    ChevronLeft,
    Share2,
    BadgeCheck,
    Globe,
    CalendarDays,
    Timer,
    Users,
    UserPlus,
    Lock,
    HandMetal,
    Play,
} from "lucide-react-native";

import { HADES } from "@/constants/hades";
import { getSubjectColor } from "@/constants/helpers";
import Avatar from "@/components/ui/Avatar";
import { fetchSessionById, buscarSessoesPorExecucao, compilarSessoesPorExecucao } from "@/services/sessions";
import { tempoAoVivoDoMembro } from "@/utils/tempo";
import { totalAcertos, totalQuestoes } from "@/utils/estatisticasSessao";
import { useIncentivos } from "@/hooks/useIncentivos";
import { useParticipantesDaSala } from "@/hooks/useParticipantesDaSala";
import { buscarSala } from "@/services/salas";
import { assinarCaminhosDeFoto } from "@/services/fotosSessao";
import { buscarNomeDoPlano } from "@/services/planos";
import type { SalaFoco } from "@/types/sala";
import type { SessionCardItem } from "@/types/sessions";

type Participante = {
    /** id do usuário: é quem recebe a força quando alguém torce por ele. */
    id: string;
    nome: string;
    foto: string | null;
    topico: string;
    tempoSegundos: number;
    /** Só quem está de fato focando tem o cronômetro correndo na tela. */
    ativo: boolean;
    host?: boolean;
};

/** Uma matéria da sessão, já somada quando a execução encadeou vários blocos dela. */
type BlocoDeMateria = {
    disciplina: string;
    conteudo: string;
    minutos: number;
};

/** Acima disso a régua de tracinhos vira sujeira visual e cede lugar a uma barra cheia. */
const MAX_TRACOS = 24;

function formatarDuracao(min: number) {
    if (min < 60) return `${min}m`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${h}h`;
}

function formatarHora(iso?: string | null) {
    if (!iso) return null;
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** "hoje", "ontem" ou a data — o cabeçalho da prévia não precisa de mais que isso. */
function rotuloDoDia(iso: string) {
    const data = new Date(iso);
    const hoje = new Date();
    const mesmoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();

    if (mesmoDia(data, hoje)) return "hoje";

    const ontem = new Date(hoje);
    ontem.setDate(hoje.getDate() - 1);
    if (mesmoDia(data, ontem)) return "ontem";

    return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/** Distância até agora em linguagem de gente: "há 40min", "há 2h", "há 3d". */
function haQuanto(iso: string) {
    const minutos = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (minutos < 60) return `há ${minutos}min`;
    const horas = Math.round(minutos / 60);
    if (horas < 24) return `há ${horas}h`;
    return `há ${Math.round(horas / 24)}d`;
}

function formatarCronometro(totalSegundos: number) {
    const h = Math.floor(totalSegundos / 3600);
    const m = Math.floor((totalSegundos % 3600) / 60);
    const s = totalSegundos % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** mm:ss do cooldown restante — nunca passa de 20min, então minutos sempre cabem em 2 dígitos. */
function formatarCooldown(segundos: number) {
    const m = Math.floor(segundos / 60);
    const s = segundos % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function SessionPreviewScreen() {
    const params = useLocalSearchParams<{ sessionId?: string; session?: string; variante?: string; isPublic?: string }>();
    const [sessao, setSessao] = useState<SessionCardItem | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState<string | null>(null);

    /*
      As linhas cruas da execução (uma por matéria estudada). O `sessao` acima é a compilação
      delas — o total que o hero mostra; estas ficam para a seção "Por matéria", que só existe
      quando houve de fato mais de uma.
    */
    const [linhas, setLinhas] = useState<SessionCardItem[]>([]);

    // Extras opcionais: cada um some da tela quando não existe (ver `blocos`, `fotoUrl`).
    const [fotoUrl, setFotoUrl] = useState<string | null>(null);
    const [fotoLegenda, setFotoLegenda] = useState<string | null>(null);
    const [nomePlano, setNomePlano] = useState<string | null>(null);

    /*
      A tela mostra DUAS coisas que antes eram uma só (ver a migration `20260806140000`):

        `sessao` — o registro pessoal de estudo de quem abriu (matéria, duração, placar);
        `sala`   — o encontro, com os participantes e o próprio ciclo de vida.

      A sala é quem diz se dá para entrar. Enquanto as duas eram a mesma linha, a tela se
      contradizia: exibia "Sessão concluída" e, logo abaixo, gente em "Focando agora" com
      cronômetro de 142h correndo.
    */
    const [sala, setSala] = useState<SalaFoco | null>(null);

    const { participantes: membrosDaSala } = useParticipantesDaSala(sala?.id);
    const salaAberta = Boolean(sala && !sala.encerrada_em);

    // Tick de 1s só para repintar: o tempo vem sempre de tempoAoVivoDoMembro.
    const [tick, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 1000);
        return () => clearInterval(id);
    }, []);

    const participantes = useMemo<Participante[]>(() => {
        return membrosDaSala.map((membro) => {
            const profile = membro.profiles;
            const nome = profile?.nome_usuario || profile?.nome_real || "Usuário";

            return {
                id: membro.membro_id,
                nome,
                foto: profile?.foto_usuario ?? null,
                topico: sessao?.conteudo_especifico || "Foco",
                /*
                  Acumulado + tempo desde o último início, travado pelo fechamento da SALA —
                  não pelo `concluido_em` do registro pessoal de quem abriu. Essa distinção é
                  o ponto: o anfitrião encerrar o estudo dele não para o cronômetro de quem
                  continua na sala (ver utils/tempo.ts).
                */
                tempoSegundos: tempoAoVivoDoMembro(membro, { sessaoConcluidaEm: sala?.encerrada_em }),
                // Com a sala fechada ninguém está focando, por mais que a linha diga.
                ativo: membro.status === "ativo" && salaAberta,
                host: membro.funcao === "anfitriao" || membro.membro_id === sala?.anfitriao_id,
            };
        });
        // `tick` entra de propósito: força o recálculo do tempo ao vivo a cada segundo.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [membrosDaSala, sessao?.conteudo_especifico, sala?.anfitriao_id, sala?.encerrada_em, salaAberta, tick]);

    /*
      As matérias da sessão, somadas. Uma execução que encadeou dois blocos da MESMA matéria
      vira um bloco só: repetir "Matemática" duas vezes na lista não informa nada. É esta
      lista que decide se a seção "Por matéria" existe (ver `temVariasMaterias`).
    */
    const blocos = useMemo<BlocoDeMateria[]>(() => {
        const porMateria = new Map<string, BlocoDeMateria>();

        for (const linha of linhas) {
            const conteudo = linha.conteudo_especifico?.trim() || "";
            const atual = porMateria.get(linha.disciplina);

            if (!atual) {
                porMateria.set(linha.disciplina, {
                    disciplina: linha.disciplina,
                    conteudo,
                    minutos: linha.tempo_minutos ?? 0,
                });
                continue;
            }

            atual.minutos += linha.tempo_minutos ?? 0;
            if (conteudo && !atual.conteudo.includes(conteudo)) {
                atual.conteudo = atual.conteudo ? `${atual.conteudo} · ${conteudo}` : conteudo;
            }
        }

        return [...porMateria.values()].sort((a, b) => b.minutos - a.minutos);
    }, [linhas]);

    const sessionParam = useMemo(() => {
        const raw = Array.isArray(params.session) ? params.session[0] : params.session;
        return raw ? raw : null;
    }, [params.session]);

    const privada = sessao ? !sessao.is_public : params.isPublic === "false";

    // Torcida da sessão inteira, com contagem por participante. Fica fora dos early
    // returns por causa das regras de hooks. Sessão privada é estudo solo e não tem
    // torcida, então nem consulta nem abre canal de realtime à toa.
    const {
        total: totalIncentivos,
        torcedores,
        enviandoPara,
        contarPara,
        podeTorcerPor,
        cooldownRestante,
        enviarForca,
    } = useIncentivos(privada ? null : sala?.id);

    useEffect(() => {
        let ativo = true;

        const carregarSessao = async () => {
            setCarregando(true);
            setErro(null);

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

                /*
                  Execução de plano com mais de uma matéria: a linha encontrada acima é só a
                  ÚLTIMA matéria estudada (cada uma vira sua própria linha, ver
                  app/(tabs)/focus.tsx). Busca o grupo inteiro e compila, senão a prévia
                  mostraria só um pedaço da sessão (a última matéria, não o total).
                */
                let linhasDaSessao: SessionCardItem[] = sessaoEncontrada ? [sessaoEncontrada] : [];

                if (sessaoEncontrada?.execucao_id) {
                    const { data: linhasDaExecucao, error: erroExecucao } = await buscarSessoesPorExecucao(
                        sessaoEncontrada.execucao_id
                    );
                    if (!erroExecucao && linhasDaExecucao.length > 0) {
                        linhasDaSessao = linhasDaExecucao;
                        sessaoEncontrada = compilarSessoesPorExecucao(linhasDaExecucao)[0] ?? sessaoEncontrada;
                    }
                }

                if (!ativo) return;

                /*
                  Antes, sem id, a tela caía em `buscarSessoesRecentes(1)` e abria uma sessão
                  qualquer — o que escondeu por muito tempo o fato de que os cards do feed nunca
                  passavam o `sessionId`. Agora, sem id, é erro explícito.
                */
                if (!sessaoEncontrada) {
                    setErro("Não foi possível abrir essa sessão.");
                }

                setSessao(sessaoEncontrada);
                setLinhas(linhasDaSessao);

                if (!sessaoEncontrada) {
                    setCarregando(false);
                    return;
                }

                /*
                  Foto e plano são enfeites: entram na tela só se existirem e se quem abriu
                  puder vê-los. Falha em qualquer um dos dois some com a seção, nunca derruba
                  a prévia — daí não estarem no try/catch principal do carregamento.
                */
                const linhaComFoto = linhasDaSessao.find((linha) => linha.foto_path);
                if (linhaComFoto?.foto_path) {
                    const urls = await assinarCaminhosDeFoto([linhaComFoto.foto_path]);
                    if (ativo) {
                        setFotoUrl(urls.get(linhaComFoto.foto_path) ?? null);
                        setFotoLegenda(linhaComFoto.foto_legenda ?? null);
                    }
                }

                if (sessaoEncontrada.plano_id) {
                    const nome = await buscarNomeDoPlano(sessaoEncontrada.plano_id);
                    if (ativo) setNomePlano(nome);
                }

                /*
                  A sala é opcional: estudo solo não tem uma, e sessões anteriores à
                  separação sala/registro têm a sala com o MESMO id da linha de origem (ver o
                  backfill da migration `20260806140000`). Sem sala, a tela vira só o
                  registro pessoal — sem participantes, sem torcida, sem "entrar junto".
                */
                if (sessaoEncontrada.sala_id) {
                    const { sala: salaEncontrada } = await buscarSala(sessaoEncontrada.sala_id);
                    if (ativo) setSala(salaEncontrada);
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

    /*
      Só as sessões públicas têm este CTA; nas privadas o footer mostra apenas o "Mandar
      força". Quem entra vai para a SALA — a `session` segue junto só para pré-preencher
      matéria e conteúdo na tela de foco.
    */
    const handleAcao = () => {
        if (!sessao || !sala) return;
        router.dismissAll();
        router.replace({
            pathname: "/(tabs)/focus",
            params: {
                session: JSON.stringify(sessao),
                salaId: sala.id,
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
    /*
      Duas perguntas diferentes, que antes tinham a mesma resposta:
        `registroEncerrado` — o estudo de quem abriu já acabou (vale para o hero e o placar);
        `salaAberta`        — ainda dá para entrar e focar junto.
      Uma sala pode seguir aberta com o registro do criador já encerrado — é exatamente o
      caso que a separação sala/sessão veio permitir.
    */
    const registroEncerrado = Boolean(sessao.concluido_em || sessao.status === "concluido");
    const duracaoMin = Math.max(1, Math.round(sessao.tempo_minutos || 0));

    /*
      A prévia é montada por partes, e cada parte só aparece se a sessão tiver o que mostrar:
      sessão de uma matéria não ganha "Por matéria", sessão sem quiz não ganha "Questões",
      sessão sem foto não ganha "Registro". Encerrada não ganha convite para entrar.
    */
    const materiaPrincipal = blocos[0]?.disciplina || sessao.disciplina;
    const outrasMaterias = blocos.slice(1).map((bloco) => bloco.disciplina);
    const temVariasMaterias = blocos.length > 1;
    const corMateria = getSubjectColor(materiaPrincipal || "Estudo Geral");

    const conteudoPrincipal = blocos[0]?.conteudo || sessao.conteudo_especifico?.trim() || "";
    const legendaOutras =
        outrasMaterias.length === 0
            ? ""
            : `também ${outrasMaterias.length === 1 ? outrasMaterias[0] : `${outrasMaterias.slice(0, -1).join(", ")} e ${outrasMaterias[outrasMaterias.length - 1]}`}`;
    const subtitulo = [conteudoPrincipal, legendaOutras].filter(Boolean).join(" · ");

    const questoes = totalQuestoes(sessao);
    const acertos = totalAcertos(sessao);
    const taxaAcerto = questoes > 0 ? Math.round((acertos / questoes) * 100) : 0;

    // Ciclos vêm do cronograma publicado da sala; no cronômetro simples a fila é vazia e a
    // coluna some da faixa em vez de mostrar "0".
    const fila = sala?.fila ?? sessao.fila ?? [];
    const ciclos = fila.filter((item) => item.tipo === "estudo").length;

    const horaInicio = formatarHora(sessao.ultimo_inicio) ?? formatarHora(sessao.created_at);
    const horaTermino = formatarHora(sessao.concluido_em);

    const estadoTexto = registroEncerrado
        ? `encerrada ${haQuanto(sessao.concluido_em || sessao.created_at)}`
        : `${privada ? "focando" : "aberta"} ${haQuanto(sessao.created_at)}`;
    const statusTexto = `${rotuloDoDia(sessao.created_at)} · ${estadoTexto}`;

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
                        {/* Foto de perfil de verdade: antes era sempre a inicial numa bolinha
                            colorida, mesmo para quem tem avatar. */}
                        <Avatar foto={sessao.profiles?.foto_usuario} nome={hostNome} size={44} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 5 }}>
                                <Text style={{ fontSize: 16, fontWeight: "700", color: HADES.text }}>{hostNome}</Text>
                                {/* Privacidade coube num ícone ao lado do nome: o chip antigo
                                    disputava espaço com o "encerrada há 2h" logo abaixo. */}
                                {privada ? (
                                    <Lock size={14} color={HADES.textMuted} />
                                ) : (
                                    <Globe size={14} color={HADES.accentSolid} />
                                )}
                            </View>
                            <Text style={{ fontSize: 12.5, color: HADES.textMuted, marginTop: 2 }} numberOfLines={1}>
                                {statusTexto}
                            </Text>
                        </View>
                    </View>

                    <View style={{ marginTop: 18 }}>
                        <Text style={{ fontSize: 26, fontWeight: "700", color: HADES.text, letterSpacing: -0.5 }}>{materiaPrincipal}</Text>
                        {!!subtitulo && (
                            <Text style={{ fontSize: 14, color: corMateria.text, marginTop: 3, lineHeight: 20 }}>{subtitulo}</Text>
                        )}
                    </View>

                    {/* Números grandes: duração sempre; placar só quando houve questões. */}
                    <View style={estilos.destaques}>
                        <View style={{ flex: 1 }}>
                            <Text style={estilos.destaqueValor}>{formatarDuracao(duracaoMin)}</Text>
                            <Text style={estilos.statRotulo}>{temVariasMaterias ? "DURAÇÃO TOTAL" : "DURAÇÃO"}</Text>
                        </View>
                        {questoes > 0 && (
                            <View style={{ alignItems: "flex-end" }}>
                                <Text style={[estilos.destaqueValor, { color: HADES.accentSolid }]}>
                                    {acertos}/{questoes}
                                </Text>
                                <Text style={estilos.statRotulo}>QUESTÕES</Text>
                            </View>
                        )}
                    </View>

                    {/* Faixa de detalhes do relógio. Cada coluna só entra se tiver valor —
                        sessão em andamento não tem término, cronômetro não tem ciclos. */}
                    <View style={estilos.stats}>
                        <View style={{ flex: 1 }}>
                            <Text style={estilos.statValor}>{horaInicio}</Text>
                            <Text style={estilos.statRotulo}>INÍCIO</Text>
                        </View>
                        {!!horaTermino && (
                            <View style={[estilos.statDivider, { flex: 1 }]}>
                                <Text style={estilos.statValor}>{horaTermino}</Text>
                                <Text style={estilos.statRotulo}>TÉRMINO</Text>
                            </View>
                        )}
                        {ciclos > 0 && (
                            <View style={[estilos.statDivider, { flex: 1 }]}>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                                    <Timer size={15} color={HADES.accentSolid} />
                                    <Text style={estilos.statValor}>{ciclos}</Text>
                                </View>
                                <Text style={estilos.statRotulo}>{ciclos === 1 ? "CICLO" : "CICLOS"}</Text>
                            </View>
                        )}
                    </View>

                    {/* Só quem consegue ler o plano vê de onde a sessão veio (ver buscarNomeDoPlano). */}
                    {!!nomePlano && (
                        <View style={estilos.linhaCronograma}>
                            <CalendarDays size={13} color={HADES.textFaint} />
                            <Text style={{ fontSize: 12, color: HADES.textMuted }} numberOfLines={1}>
                                Do cronograma · <Text style={{ color: HADES.textSecondary, fontWeight: "600" }}>{nomePlano}</Text>
                            </Text>
                        </View>
                    )}
                </View>

                {/* Por matéria — só quando a sessão passou por mais de uma. */}
                {temVariasMaterias && (
                    <>
                        <Text style={estilos.secaoTituloSolto}>Por matéria</Text>
                        <View style={{ gap: 9 }}>
                            {blocos.map((bloco) => (
                                <View key={bloco.disciplina} style={estilos.linhaMateria}>
                                    <View
                                        style={[
                                            estilos.marcaMateria,
                                            { backgroundColor: getSubjectColor(bloco.disciplina).text },
                                        ]}
                                    />
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                        <Text style={{ fontSize: 14.5, fontWeight: "600", color: HADES.text }}>{bloco.disciplina}</Text>
                                        {!!bloco.conteudo && (
                                            <Text style={{ fontSize: 12, color: HADES.textMuted, marginTop: 2 }} numberOfLines={1}>
                                                {bloco.conteudo}
                                            </Text>
                                        )}
                                    </View>
                                    <Text style={{ fontSize: 14, fontWeight: "700", color: HADES.text }}>
                                        {formatarDuracao(Math.max(1, Math.round(bloco.minutos)))}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </>
                )}

                {/* Questões — some inteira quando a sessão não teve quiz nem formulário. */}
                {questoes > 0 && (
                    <>
                        <View style={estilos.secaoHeaderSolto}>
                            <Text style={estilos.secaoTitulo}>Questões</Text>
                            <Text style={{ fontSize: 12, color: HADES.textMuted }}>
                                {acertos} de {questoes} certas
                            </Text>
                        </View>
                        <View style={estilos.cartaoQuestoes}>
                            {questoes <= MAX_TRACOS ? (
                                <View style={{ flexDirection: "row", gap: 5 }}>
                                    {Array.from({ length: questoes }).map((_, indice) => (
                                        <View
                                            key={indice}
                                            style={[
                                                estilos.traco,
                                                { backgroundColor: indice < acertos ? HADES.accentSolid : HADES.trackOff },
                                            ]}
                                        />
                                    ))}
                                </View>
                            ) : (
                                // Muita questão: tracinho por questão viraria poeira, então vira barra.
                                <View style={estilos.barraTrilho}>
                                    <View style={[estilos.barraCheia, { width: `${taxaAcerto}%` }]} />
                                </View>
                            )}
                            <Text style={{ fontSize: 12.5, color: HADES.textMuted, marginTop: 10 }}>
                                {taxaAcerto}% de acerto
                            </Text>
                        </View>
                    </>
                )}

                {/* Registro — a foto do momento de estudo, quando existe uma. */}
                {!!fotoUrl && (
                    <>
                        <Text style={estilos.secaoTituloSolto}>Registro</Text>
                        <Image source={{ uri: fotoUrl }} style={estilos.foto} resizeMode="cover" />
                        {!!fotoLegenda && (
                            <Text style={{ fontSize: 12.5, color: HADES.textMuted, marginTop: 8, lineHeight: 18 }}>
                                {fotoLegenda}
                            </Text>
                        )}
                    </>
                )}

                {privada ? (
                    <>
                        {/* Bloqueio suave, e só enquanto entrar ainda seria uma opção: numa sessão
                            privada já encerrada, explicar que não dá pra entrar é ruído. */}
                        {!registroEncerrado && (
                            <View style={estilos.avisoCard}>
                                <Lock size={19} color={HADES.textMuted} style={{ marginTop: 1 }} />
                                <Text style={estilos.avisoTexto}>
                                    Esta sessão é <Text style={estilos.avisoDestaque}>privada</Text>. Você acompanha o progresso, mas não pode entrar para
                                    focar junto.
                                </Text>
                            </View>
                        )}
                    </>
                ) : (
                    <>
                        {/*
                          A seção inteira some quando a sala já fechou e ninguém ficou
                          registrado nela: "Ninguém entrou ainda — seja a primeira pessoa a
                          focar junto" era um convite para uma sessão que acabou horas atrás.
                        */}
                        {(salaAberta || participantes.length > 0) && (
                        <>
                        <View style={estilos.secaoHeader}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                {/* Numa sessão encerrada isto é histórico, não "agora" — o título
                                    antigo era o que fazia a tela se contradizer na cara do usuário. */}
                                <Text style={estilos.secaoTitulo}>
                                    {salaAberta ? "Focando agora" : "Quem participou"}
                                </Text>
                                {participantes.length > 0 && (
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                                        {salaAberta && (
                                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: HADES.green }} />
                                        )}
                                        <Text
                                            style={{
                                                fontSize: 11,
                                                color: salaAberta ? HADES.green : HADES.textMuted,
                                                fontWeight: "600",
                                            }}
                                        >
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
                                    const cooldownSegundos = cooldownRestante(p.id);
                                    // Torcer só faz sentido com a sessão rolando: mandar força para
                                    // quem terminou de estudar há horas não incentiva ninguém.
                                    const posso = podeTorcerPor(p.id) && salaAberta;

                                    return (
                                        <View key={p.id} style={estilos.participanteCard}>
                                            <View style={{ position: "relative" }}>
                                                <Avatar foto={p.foto} nome={p.nome} size={38} />
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
                                                {/* Já é o tempo ao vivo: quem está pausado fica congelado no
                                                    acumulado dele, quem está focando conta desde o último início. */}
                                                <Text style={estilos.cronometro}>
                                                    {formatarCronometro(p.tempoSegundos)}
                                                </Text>
                                                <Text style={{ fontSize: 11, color: p.ativo ? HADES.green : HADES.textMuted, marginTop: 1 }}>
                                                    {!salaAberta ? "encerrou" : p.ativo ? "em foco" : "em pausa"}
                                                </Text>
                                            </View>

                                            {/* Cada participante recebe força individualmente; some no próprio card. */}
                                            {posso && (
                                                <TouchableOpacity
                                                    onPress={() => enviarForca(p.id)}
                                                    disabled={!!enviandoPara || cooldownSegundos > 0}
                                                    activeOpacity={0.7}
                                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                    style={[
                                                        estilos.botaoForcaMembro,
                                                        (!!enviandoPara || cooldownSegundos > 0) && { opacity: 0.6 },
                                                    ]}
                                                >
                                                    {cooldownSegundos > 0 ? (
                                                        <Text style={{ fontSize: 11, fontWeight: "700", color: HADES.textMuted, fontVariant: ["tabular-nums"] }}>
                                                            {formatarCooldown(cooldownSegundos)}
                                                        </Text>
                                                    ) : (
                                                        <>
                                                            <HandMetal size={15} color={HADES.accentSolid} />
                                                            {forcasRecebidas > 0 && (
                                                                <Text style={estilos.botaoForcaMembroTexto}>{forcasRecebidas}</Text>
                                                            )}
                                                        </>
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
                        </>
                        )}

                        {/* Explicação da ação — só faz sentido enquanto dá para entrar. */}
                        {salaAberta && (
                            <View style={estilos.avisoCardAccent}>
                                <Users size={19} color={HADES.accentSolid} style={{ marginTop: 1 }} />
                                <Text style={estilos.avisoTexto}>
                                    Ao entrar você começa a <Text style={estilos.avisoDestaqueBranco}>focar junto</Text> — escolhe seu conteúdo e o tempo
                                    conta pro <Text style={estilos.avisoDestaqueBranco}>seu</Text> ranking.
                                </Text>
                            </View>
                        )}
                    </>
                )}
            </ScrollView>

            {/*
              Footer CTA. Na privada não há ação, e com a sala fechada também não: um botão
              desabilitado escrito "Sessão encerrada" só ocupava a barra inteira repetindo o
              que o cabeçalho já diz.
            */}
            {!privada && salaAberta && (
                <View style={estilos.footer}>
                    <TouchableOpacity onPress={handleAcao} activeOpacity={0.85} style={estilos.botaoEntrar}>
                        <Play size={19} color="#000" />
                        <Text style={{ fontSize: 16, fontWeight: "700", color: "#000" }}>Entrar e focar junto</Text>
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
    destaques: {
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        marginTop: 20,
    },
    destaqueValor: {
        fontSize: 32,
        fontWeight: "700",
        color: HADES.text,
        letterSpacing: -1,
    },
    stats: {
        flexDirection: "row",
        marginTop: 16,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: HADES.border,
    },
    linhaCronograma: {
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        marginTop: 14,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: HADES.border,
    },
    secaoTituloSolto: {
        fontSize: 16,
        fontWeight: "700",
        color: HADES.text,
        marginTop: 24,
        marginBottom: 12,
        marginHorizontal: 2,
    },
    secaoHeaderSolto: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 24,
        marginBottom: 12,
        marginHorizontal: 2,
    },
    linhaMateria: {
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        backgroundColor: HADES.surface,
        borderWidth: 1,
        borderColor: HADES.border,
        borderRadius: 13,
        paddingVertical: 12,
        paddingHorizontal: 13,
    },
    marcaMateria: {
        width: 3,
        alignSelf: "stretch",
        borderRadius: 2,
    },
    cartaoQuestoes: {
        backgroundColor: HADES.surface,
        borderWidth: 1,
        borderColor: HADES.border,
        borderRadius: 13,
        paddingVertical: 13,
        paddingHorizontal: 14,
    },
    traco: {
        flex: 1,
        height: 5,
        borderRadius: 3,
    },
    barraTrilho: {
        height: 6,
        borderRadius: 3,
        backgroundColor: HADES.trackOff,
        overflow: "hidden",
    },
    barraCheia: {
        height: "100%",
        borderRadius: 3,
        backgroundColor: HADES.accentSolid,
    },
    foto: {
        width: "100%",
        aspectRatio: 4 / 3,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: HADES.border,
        backgroundColor: HADES.surfaceRaised,
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
