import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { Lock, Pause, Timer, LogIn, Wind } from "@/components/ui/icons";
import { router } from "expo-router";
import { HADES } from "@/constants/hades";
import { getSubjectColor } from "@/constants/helpers";
import { tempoAoVivoDaSessao } from "@/utils/tempo";
import { posicaoNaFila } from "@/utils/pomodoroSequence";
import Avatar from "@/components/ui/Avatar";
import { Skeleton, SkeletonCircle } from "@/components/ui/Skeleton";
import type { SessaoFocoRow } from "@/types/sessions";
import type { ParticipanteResumido } from "@/types/sala";

/*
  O feed tinha oito dimensões independentes disputando o mesmo card (estado, visibilidade,
  modo, solo/grupo, destaque, multi-matéria, origem no cronograma, foto) e cada uma queria
  virar um selo. Aqui elas viram DOIS layouts — em andamento e encerrada — e o resto só
  aparece quando foge do padrão do feed:

    privada      → cadeado ao lado do nome (pública não marca nada)
    pomodoro     → linha com o ciclo real (cronômetro não marca nada)
    grupo        → pilha de avatares no cabeçalho (nunca um chip)
    multi-matéria→ "+N" colado no nome da matéria
    destaque     → o placar fica em accent (sem selo separado)
    foto         → a própria miniatura (sem selo de "tem foto")
    origem       → não aparece no feed, só na prévia da sessão

  Encerrada é o padrão do feed, então não ganha selo de "concluída": quem diz isso é o
  cabeçalho da seção (AGORA / HOJE / ONTEM) montado pela tela.
*/

/** "1h 30m" para sessões encerradas; "12:34" enquanto a sessão ainda corre. */
function formatarDuracaoDoCard(segundos: number, aoVivo: boolean) {
    const totalSegundos = Math.max(0, Math.floor(segundos));

    if (aoVivo) {
        const h = Math.floor(totalSegundos / 3600);
        const m = Math.floor((totalSegundos % 3600) / 60);
        const s = totalSegundos % 60;
        const doisDigitos = (n: number) => n.toString().padStart(2, "0");
        return h > 0 ? `${h}:${doisDigitos(m)}:${doisDigitos(s)}` : `${doisDigitos(m)}:${doisDigitos(s)}`;
    }

    const minutosTotais = Math.round(totalSegundos / 60);
    const horas = Math.floor(minutosTotais / 60);
    const minutos = minutosTotais % 60;
    return horas === 0 ? `${minutos}m` : minutos === 0 ? `${horas}h` : `${horas}h ${minutos}m`;
}

const ehMesmoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * "há 2h" dentro do dia, "ontem, 19:40" no anterior, "03/08, 15:10" no resto.
 *
 * A tela já separa o feed por dia; o card só precisa desempatar dentro da seção — daí o
 * relativo no dia de hoje e a hora cheia quando a seção não é mais "hoje".
 */
function formatarMomento(iso: string) {
    const data = new Date(iso);
    const agora = new Date();
    const hora = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    if (ehMesmoDia(data, agora)) {
        const minutos = Math.floor((agora.getTime() - data.getTime()) / 60000);
        if (minutos < 1) return "agora";
        if (minutos < 60) return `há ${minutos}min`;
        return `há ${Math.floor(minutos / 60)}h`;
    }

    const ontem = new Date(agora);
    ontem.setDate(agora.getDate() - 1);
    if (ehMesmoDia(data, ontem)) return `ontem, ${hora}`;

    return `${data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}, ${hora}`;
}

/**
 * Separa a matéria principal do "+N" das outras.
 *
 * O contador sai de `materiasCompiladas`, não do texto: `compilarSessoesPorExecucao`
 * escreve "A e B" com duas matérias e "A +N" acima disso, e adivinhar pelo " e " quebraria
 * numa matéria que legitimamente tem "e" no nome.
 */
function separarDisciplina(sessao: Pick<SessaoFocoRow, "disciplina" | "materiasCompiladas">) {
    const total = sessao.materiasCompiladas ?? 1;
    if (total <= 1) return { principal: sessao.disciplina, extras: 0 };
    return { principal: sessao.disciplina.split(/ \+| e /)[0], extras: total - 1 };
}

/**
 * Texto do ciclo de um pomodoro em andamento, derivado do cronograma publicado.
 *
 * Não há campo de "ciclo atual" no banco de propósito: a posição sai do relógio sobre a
 * `fila` (ver utils/pomodoroSequence.ts), que é o mesmo cálculo que mantém todo mundo na
 * mesma fase numa sessão em grupo. Só os itens de estudo contam como ciclo — o descanso
 * pertence ao ciclo que acabou de terminar.
 */
function textoDoCiclo(sessao: SessaoFocoRow) {
    if (sessao.modo !== "pomodoro") return null;

    const fila = sessao.fila ?? [];
    const totalCiclos = fila.filter((item) => item.tipo === "estudo").length;

    if (!sessao.fila_inicio_em || totalCiclos === 0) return "Pomodoro";

    const { indice } = posicaoNaFila(fila, new Date(sessao.fila_inicio_em).getTime());
    const cicloAtual = Math.max(1, fila.slice(0, indice + 1).filter((item) => item.tipo === "estudo").length);
    const emDescanso = fila[indice]?.tipo === "descanso";

    return emDescanso
        ? `descanso · ciclo ${cicloAtual} de ${totalCiclos}`
        : `ciclo ${cicloAtual} de ${totalCiclos}`;
}

/** Pilha de avatares: a única marca de "isto foi em grupo" — sessão solo mostra um só. */
function PilhaAvatares({
    participantes,
    autor,
    tamanho,
    fundo,
}: {
    participantes: ParticipanteResumido[];
    autor: { nome: string; foto: string | null | undefined };
    tamanho: number;
    fundo: string;
}) {
    const lista =
        participantes.length > 0
            ? participantes
            : [{ membroId: "autor", funcao: "anfitriao" as const, nome: autor.nome, foto: autor.foto ?? null }];

    const visiveis = lista.slice(0, 3);
    const restantes = lista.length - visiveis.length;

    /*
      `row-reverse` com a lista invertida: o React Native pinta o último filho por cima, e
      o avatar do anfitrião precisa ficar à esquerda E na frente. Renderizar em ordem
      normal deixava ele por baixo de quem entrou depois.
    */
    const elementos = [
        ...visiveis.map((participante) => (
            <View
                key={participante.membroId}
                style={{ borderWidth: 2, borderColor: fundo, borderRadius: 999 }}
            >
                <Avatar foto={participante.foto} nome={participante.nome} size={tamanho - 2} />
            </View>
        )),
        ...(restantes > 0
            ? [
                  <View
                      key="restantes"
                      style={{
                          width: tamanho,
                          height: tamanho,
                          borderRadius: 999,
                          borderWidth: 2,
                          borderColor: fundo,
                          backgroundColor: HADES.surfaceOverlay,
                          alignItems: "center",
                          justifyContent: "center",
                      }}
                  >
                      <Text style={{ fontSize: 11, fontWeight: "700", color: HADES.textMuted }}>
                          +{restantes}
                      </Text>
                  </View>,
              ]
            : []),
    ];

    return (
        <View style={{ flexDirection: "row-reverse", alignItems: "center" }}>
            {elementos.reverse().map((elemento, indice) => (
                <View
                    key={elemento.key}
                    /*
                      `row-reverse` equivale a `row` com a ordem invertida: aqui o índice 0
                      é o elemento mais à DIREITA na tela, e é o único que não puxa ninguém
                      para cima de si. Os demais sobrepõem o vizinho da direita.
                    */
                    style={{ marginRight: indice === 0 ? 0 : -9 }}
                >
                    {elemento}
                </View>
            ))}
        </View>
    );
}

/** "NatVM" sozinho, "NatVM + 5 estudando" em grupo ao vivo, "NatVM + 1" em grupo encerrado. */
function rotuloDeAutoria(nome: string, participantes: number, aoVivo: boolean) {
    if (participantes <= 1) return { nome, complemento: "" };
    return { nome, complemento: aoVivo ? ` + ${participantes - 1} estudando` : ` + ${participantes - 1}` };
}

/** Nome da matéria na cor da disciplina + "+N" + conteúdo — o único colorido do card. */
function LinhaDaMateria({
    sessao,
    tamanho,
    corDoConteudo,
}: {
    sessao: SessaoFocoRow;
    tamanho: number;
    corDoConteudo: string;
}) {
    const { principal, extras } = separarDisciplina(sessao);

    /*
      A cor da matéria tinha sumido do feed inteiro e levava junto o "cadê minhas sessões
      de Matemática" no rolar — os avatares codificam pessoa, não disciplina. Ela volta só
      na palavra da matéria: sem fundo, sem borda, sem chip.
    */
    return (
        <Text style={{ fontSize: tamanho, color: corDoConteudo }} numberOfLines={1}>
            <Text style={{ fontWeight: "700", color: getSubjectColor(principal).text }}>{principal}</Text>
            {extras > 0 && <Text style={{ fontWeight: "600", color: HADES.textFaint }}> +{extras}</Text>}
            {sessao.conteudo_especifico ? ` · ${sessao.conteudo_especifico}` : ""}
        </Text>
    );
}

type PropsDoCard = {
    sessao: SessaoFocoRow;
    /** Vem em lote da tela (ver `useExtrasDoFeed`); vazio significa sessão solo. */
    participantes?: ParticipanteResumido[];
    /** URL assinada da foto da sessão, quando existe. Sem ela o card simplesmente não tem miniatura. */
    fotoUrl?: string | null;
    /** Esconde o "Entrar junto" na própria sessão de quem está olhando. */
    usuarioId?: string | null;
};

/**
 * Card de sessão no feed do grupo, no visual HADES.
 *
 * Despacha entre os dois layouts. O `components/groups/SessionCard` antigo foi removido:
 * a tela de detalhamento já usava este componente.
 */
export default function CardSessaoGrupo({ sessao, participantes = [], fotoUrl, usuarioId }: PropsDoCard) {
    const estaConcluida = Boolean(
        sessao.concluido_em || sessao.status === "concluido" || sessao.status === "salvo"
    );
    const emAndamento = !estaConcluida && (sessao.status === "ativo" || sessao.status === "pausado");

    const abrir = () =>
        router.push({
            pathname: "/session-preview",
            // Sem o id a prévia abria sempre a última sessão encerrada, não a que foi tocada.
            params: { sessionId: sessao.id, isPublic: String(sessao.is_public) },
        });

    if (emAndamento) {
        return (
            <CardEmAndamento
                sessao={sessao}
                participantes={participantes}
                usuarioId={usuarioId}
                onPress={abrir}
            />
        );
    }

    return (
        <CardEncerrado
            sessao={sessao}
            participantes={participantes}
            fotoUrl={fotoUrl}
            onPress={abrir}
        />
    );
}

/**
 * Estado 1 — em andamento. Borda accent e cronômetro grande fazem o trabalho que uma fila
 * de selos fazia antes.
 */
function CardEmAndamento({
    sessao,
    participantes,
    usuarioId,
    onPress,
}: {
    sessao: SessaoFocoRow;
    participantes: ParticipanteResumido[];
    usuarioId?: string | null;
    onPress: () => void;
}) {
    const focandoAgora = sessao.status === "ativo";
    const nome = sessao.profiles?.nome_real || sessao.profiles?.nome_usuario || "Usuário";

    /*
      Tick de 1s só para repintar enquanto a sessão corre — o tempo em si sempre sai de
      `tempoAoVivoDaSessao` (acumulado no banco + o que passou desde `ultimo_inicio`), nunca
      de um contador local. Numa sessão pausada o valor não muda, então não há intervalo
      rodando: um feed cheio de cards parados não fica repintando à toa.
    */
    const [, setTick] = useState(0);
    useEffect(() => {
        if (!focandoAgora) return;
        const id = setInterval(() => setTick((t) => t + 1), 1000);
        return () => clearInterval(id);
    }, [focandoAgora]);

    const autoria = rotuloDeAutoria(nome, Math.max(participantes.length, 1), true);
    const ciclo = textoDoCiclo(sessao);
    const inicio = sessao.ultimo_inicio ?? sessao.created_at;

    // O convite só faz sentido no que ainda corre, é público, tem grupo e não é meu.
    const podeEntrar =
        focandoAgora && sessao.is_public && Boolean(sessao.grupo_id) && sessao.user_id !== usuarioId;

    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={onPress}
            style={{
                backgroundColor: HADES.surface,
                borderWidth: 1.5,
                borderColor: focandoAgora ? "rgba(255,154,0,0.40)" : "rgba(255,154,0,0.22)",
                borderRadius: 20,
                paddingVertical: 18,
                paddingHorizontal: 16,
            }}
        >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <PilhaAvatares
                    participantes={participantes}
                    autor={{ nome, foto: sessao.profiles?.foto_usuario }}
                    tamanho={38}
                    fundo={HADES.surface}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <Text
                            style={{ fontSize: 13.5, fontWeight: "700", color: HADES.text, flexShrink: 1 }}
                            numberOfLines={1}
                        >
                            {autoria.nome}
                            <Text style={{ color: HADES.textFaint, fontWeight: "500" }}>
                                {autoria.complemento}
                            </Text>
                        </Text>
                        {/* Pública não marca nada: num feed de grupo, público é o esperado. */}
                        {!sessao.is_public && <Lock size={12} color={HADES.textFaint} />}
                    </View>
                    <Text style={{ fontSize: 11.5, color: HADES.textFaint, marginTop: 1 }}>
                        {new Date(inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: 15 }}>
                {/*
                  Sem rótulo "AO VIVO" ao lado do cronômetro: a borda accent e o próprio
                  relógio andando já dizem isso, e o texto competia com o número. O rótulo
                  fica só na pausada, onde não há movimento para denunciar o estado.
                */}
                <Text
                    style={{
                        fontSize: 38,
                        fontWeight: "800",
                        color: focandoAgora ? HADES.text : HADES.textMuted,
                        letterSpacing: -1.6,
                        lineHeight: 40,
                        fontVariant: ["tabular-nums"],
                    }}
                >
                    {formatarDuracaoDoCard(tempoAoVivoDaSessao(sessao), true)}
                </Text>
                {!focandoAgora && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingBottom: 4 }}>
                        <Pause size={12} color={HADES.amber} />
                        <Text style={{ fontSize: 11, fontWeight: "700", color: HADES.amber, letterSpacing: 0.4 }}>
                            PAUSADA
                        </Text>
                    </View>
                )}
            </View>

            <View style={{ marginTop: 10 }}>
                <LinhaDaMateria sessao={sessao} tamanho={13} corDoConteudo={HADES.textMuted} />
            </View>

            {ciclo && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 7 }}>
                    <Timer size={13} color={HADES.accentSolid} />
                    <Text style={{ fontSize: 12, color: HADES.textMuted }}>{ciclo}</Text>
                </View>
            )}

            {podeEntrar && (
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 7,
                        marginTop: 14,
                        height: 42,
                        borderRadius: 12,
                        backgroundColor: HADES.accentSolid,
                    }}
                >
                    <LogIn size={15} color="#000" />
                    <Text style={{ fontSize: 13.5, fontWeight: "700", color: "#000" }}>Entrar junto</Text>
                </View>
            )}
        </TouchableOpacity>
    );
}

/**
 * Estado 2 — encerrada. Card plano: matéria à esquerda, resultado à direita. Sem borda e
 * sem selo, porque é o que o feed mostra na maior parte do tempo.
 */
function CardEncerrado({
    sessao,
    participantes,
    fotoUrl,
    onPress,
}: {
    sessao: SessaoFocoRow;
    participantes: ParticipanteResumido[];
    fotoUrl?: string | null;
    onPress: () => void;
}) {
    const nome = sessao.profiles?.nome_real || sessao.profiles?.nome_usuario || "Usuário";
    const autoria = rotuloDeAutoria(nome, Math.max(participantes.length, 1), false);
    const duracao = formatarDuracaoDoCard(tempoAoVivoDaSessao(sessao), false);
    const temPlacar = sessao.questoes_respondidas > 0;

    const placar = (
        <Text
            style={{
                fontSize: 12,
                fontWeight: "800",
                // Destaque (>70% no quiz) é só isto: o placar em accent, nenhum selo.
                color: sessao.destaque ? HADES.accentSolid : HADES.textMuted,
            }}
        >
            {sessao.questoes_acertadas}/{sessao.questoes_respondidas}
        </Text>
    );

    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={onPress}
            style={{
                backgroundColor: HADES.surface,
                borderRadius: 18,
                paddingVertical: 18,
                paddingHorizontal: 16,
            }}
        >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <PilhaAvatares
                    participantes={participantes}
                    autor={{ nome, foto: sessao.profiles?.foto_usuario }}
                    tamanho={38}
                    fundo={HADES.surface}
                />

                <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <View style={{ flexShrink: 1 }}>
                            <LinhaDaMateria sessao={sessao} tamanho={13.5} corDoConteudo={HADES.textMuted} />
                        </View>
                        {!sessao.is_public && <Lock size={11} color={HADES.textDim} />}
                    </View>

                    <Text style={{ fontSize: 11.5, color: HADES.textDim, marginTop: 2 }} numberOfLines={1}>
                        {autoria.nome}
                        {autoria.complemento} · {formatarMomento(sessao.created_at)}
                    </Text>

                    {/*
                      Com foto, o resultado desce para cá: a miniatura ocupa a direita. Sem
                      foto ele fica na coluna da direita, alinhado, que lê mais rápido.
                    */}
                    {fotoUrl && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
                            <Text style={{ fontSize: 13, fontWeight: "800", color: HADES.textMuted }}>
                                {duracao}
                            </Text>
                            {temPlacar && (
                                <>
                                    <Text style={{ fontSize: 13, color: HADES.textDim }}>·</Text>
                                    {placar}
                                </>
                            )}
                        </View>
                    )}
                </View>

                {fotoUrl ? (
                    <Image
                        source={{ uri: fotoUrl }}
                        style={{ width: 58, height: 58, borderRadius: 12, backgroundColor: HADES.surfaceOverlay }}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={{ alignItems: "flex-end" }}>
                        <Text
                            style={{
                                fontSize: 15,
                                fontWeight: "800",
                                color: HADES.textSecondary,
                                letterSpacing: -0.3,
                                fontVariant: ["tabular-nums"],
                            }}
                        >
                            {duracao}
                        </Text>
                        {/* Sem quiz não existe placar: "0/0" era ruído puro. */}
                        {temPlacar && <View style={{ marginTop: 2 }}>{placar}</View>}
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
}

export function FeedVazio({ carregando }: { carregando?: boolean }) {
    if (carregando) {
        return (
            <>
                <CardSessaoGrupoSkeleton />
                <CardSessaoGrupoSkeleton style={{ marginTop: 10 }} />
            </>
        );
    }

    return (
        <View
            style={{
                backgroundColor: HADES.surface,
                borderWidth: 1,
                borderColor: HADES.border,
                borderRadius: 16,
                paddingVertical: 28,
                paddingHorizontal: 20,
                alignItems: "center",
            }}
        >
            <Wind size={26} color={HADES.dot} />
            <Text style={{ fontSize: 13.5, color: HADES.textMuted, marginTop: 12 }}>
                Nenhuma sessão registrada ainda.
            </Text>
            <Text style={{ fontSize: 12, color: HADES.textDim, marginTop: 4 }}>
                As sessões dos membros aparecem aqui.
            </Text>
        </View>
    );
}

export function CardSessaoGrupoSkeleton({ style }: { style?: object }) {
    return (
        <View
            style={[
                {
                    backgroundColor: HADES.surface,
                    borderRadius: 18,
                    paddingVertical: 18,
                    paddingHorizontal: 16,
                },
                style,
            ]}
        >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <SkeletonCircle size={38} hades />
                <View style={{ flex: 1, gap: 6 }}>
                    <Skeleton width="70%" height={13} hades />
                    <Skeleton width="40%" height={10} hades />
                </View>
                <Skeleton width={54} height={16} hades />
            </View>
        </View>
    );
}
