import { createContext, useContext, useState } from "react";
import { View, Text, Pressable, TouchableOpacity, ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SafeAreaView } from "@/components/ui/TelaSegura";
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { router } from "expo-router";
import { Bell, Compass, FolderOpen, Plus, Settings, UserPlus, Users } from "@/components/ui/icons";

import BadgeContagem from "@/components/ui/BadgeContagem";
import FotoDoGrupo from "@/components/ui/FotoDoGrupo";
import { ALTURA_TAB_BAR, HADES } from "@/constants/hades";
import { useAuth } from "@/hooks/useAuth";
import { useMembrosGrupo } from "@/hooks/useMembrosGrupo";
import { useMeusGrupos } from "@/hooks/useMeusGrupos";
import { useContagemDeNotificacoes } from "@/hooks/useNotificacoesNaoLidas";
import { salvarUltimoGrupoLocalmente } from "@/services/armazenamentoOffline";
import type { EscopoComunidade } from "@/types/comunidade";
import type { Grupo } from "@/types/grupos";

/*
  O movimento, medido quadro a quadro na gravação de referência (Threads, 576×1280).

  Três coisas que a medição desfez de palpites plausíveis:

  1. A página NÃO encolhe. Correlacionando o mesmo trecho de conteúdo entre o estado
     fechado e o aberto, o pico de correlação cai exatamente em escala 1.00 — é
     translação horizontal pura, sem `scale` e sem cantos arredondados.
  2. O painel NÃO desliza. O texto dele está na mesma coluna em todos os quadros da
     transição: ele fica parado embaixo e é *descoberto* pela página que sai da frente.
     Por isso só existe um transform aqui, e ele é do conteúdo — não do painel.
  3. Não é `withTiming`. A curva chega a 50% em 60ms, 95% em 230ms e 99% em 310ms, sem
     nenhum overshoot, e o decaimento assintótico do resto do caminho é de ~18/s. Isso é
     uma mola criticamente amortecida com ω≈18,5 rad/s — daí `stiffness = ω² ≈ 340` e
     `damping = 2ω ≈ 37` com massa 1.

  O deslocamento final medido foi 469 de 576 px, ou 81,4% da largura da tela.
*/
const MOVIMENTO = {
    fracaoLargura: 0.814,
    /** Teto pra não virar uma faixa larga demais em tela grande. */
    larguraMaxima: 360,
    mola: { mass: 1, stiffness: 340, damping: 37 },
} as const;

/** Faixa da borda esquerda que aceita o arrasto de abertura, com o painel fechado. */
const BORDA_DE_ABERTURA = 28;
/** Quanto do caminho (0–1) basta ter percorrido pra completar o gesto ao soltar. */
const LIMIAR_ARRASTO = 0.4;
/** Velocidade (px/s) que decide o gesto sozinha, antes do limiar. */
const VELOCIDADE_DECISIVA = 550;

export type ControlePainel = ReturnType<typeof useControlePainel>;

const ContextoPainel = createContext<ControlePainel | null>(null);

/**
 * Estado, movimento e gesto do painel lateral da Comunidade.
 *
 * Vive fora do componente porque quem se move é a *página*, não o painel (ver a medição
 * acima): a tela é que precisa aplicar `estiloConteudo` e embrulhar o conteúdo no
 * `GestureDetector`. O painel em si é uma camada parada lá embaixo.
 */
function useControlePainel() {
    const { width } = useWindowDimensions();
    const largura = Math.min(width * MOVIMENTO.fracaoLargura, MOVIMENTO.larguraMaxima);

    const progresso = useSharedValue(0);
    const [aberto, setAberto] = useState(false);

    const abrir = () => {
        setAberto(true);
        progresso.value = withSpring(1, MOVIMENTO.mola);
    };

    const fechar = () => {
        progresso.value = withSpring(0, MOVIMENTO.mola, (concluiu) => {
            // Só desmonta a camada que intercepta os toques quando a página realmente
            // voltou: tirá-la antes devolveria o feed ao dedo com o painel ainda à mostra.
            if (concluiu) runOnJS(setAberto)(false);
        });
    };

    /*
      Arrastar: fecha puxando a página de volta, e abre puxando da borda esquerda.

      `activeOffsetX` segura o gesto até haver intenção horizontal e `failOffsetY` o
      entrega de vez pra rolagem vertical — sem isso, cada rolada no feed disputaria com
      a gaveta. `podeArrastar` é o que impede que um arrasto horizontal no meio do feed
      (num carrossel, por exemplo) comece a abrir o painel.
    */
    const inicio = useSharedValue(0);
    const podeArrastar = useSharedValue(false);

    const gesto = Gesture.Pan()
        .activeOffsetX([-15, 15])
        .failOffsetY([-20, 20])
        .onBegin((evento) => {
            podeArrastar.value = progresso.value > 0 || evento.x <= BORDA_DE_ABERTURA;
            inicio.value = progresso.value;
            // Abrir arrastando precisa da camada de toque no ar desde o primeiro pixel.
            if (podeArrastar.value && progresso.value === 0) runOnJS(setAberto)(true);
        })
        .onUpdate((evento) => {
            if (!podeArrastar.value) return;
            const bruto = inicio.value + evento.translationX / largura;
            progresso.value = Math.min(Math.max(bruto, 0), 1);
        })
        .onEnd((evento) => {
            if (!podeArrastar.value) return;

            const abrindo =
                evento.velocityX > VELOCIDADE_DECISIVA ||
                (evento.velocityX >= -VELOCIDADE_DECISIVA && progresso.value > LIMIAR_ARRASTO);

            // `abrir`/`fechar` já cuidam da mola e da camada de toque; o gesto só escolhe
            // o destino.
            runOnJS(abrindo ? abrir : fechar)();
        });

    const estiloConteudo = useAnimatedStyle(() => ({
        transform: [{ translateX: progresso.value * largura }],
    }));

    return { progresso, largura, aberto, abrir, fechar, gesto, estiloConteudo };
}

/**
 * Põe o controle do painel ao alcance da tab bar.
 *
 * A barra de abas é desenhada pelo navegador, acima da Comunidade na árvore, então ela não
 * enxergaria um estado criado dentro da tela — e sem enxergar, ficaria parada enquanto a
 * página desliza por baixo dela. Este provedor fica em `app/(tabs)/_layout.tsx`, de onde
 * os dois lados leem o mesmo valor animado e se movem juntos.
 */
export function ProvedorPainel({ children }: { children: React.ReactNode }) {
    // Sem memorizar de propósito: o valor animado é um shared value, então este provedor
    // não re-renderiza a cada frame — só quando `aberto` vira, que é exatamente quando a
    // árvore abaixo precisa mesmo saber.
    const controle = useControlePainel();

    return <ContextoPainel.Provider value={controle}>{children}</ContextoPainel.Provider>;
}

/** Controle do painel lateral. Só vale debaixo de `ProvedorPainel`. */
export function usePainelComunidade(): ControlePainel {
    const controle = useContext(ContextoPainel);
    if (!controle) {
        throw new Error("usePainelComunidade precisa de <ProvedorPainel> acima na árvore.");
    }
    return controle;
}

/**
 * Painel lateral da Comunidade — o que abre no hambúrguer do cabeçalho.
 *
 * Substitui o antigo alternador de escopo do topo (uma faixa fixa acima do conteúdo) e o
 * menu do grupo (um bottom sheet à parte): os dois faziam a mesma classe de coisa — dizer
 * *o que* a aba está mostrando — em dois lugares diferentes, empilhando casca sobre o
 * feed. Aqui a troca de feed, a troca de grupo e as ações do grupo dividem uma gaveta só.
 *
 * O que deliberadamente NÃO entra: os filtros do Explorar (Tudo/Galeria/Arquivos/Planos).
 * Aqueles alternam várias vezes dentro do mesmo scroll, e enterrá-los custaria dois toques
 * por troca — seguem inline, em `ChipsFiltro`.
 *
 * Renderiza embaixo do conteúdo da tela e nunca se move. Com o painel fechado ele está
 * lá, coberto pela página; abrir é a página sair da frente.
 */
export default function PainelComunidade({
    controle,
    escopo,
    onSelecionarEscopo,
    grupoId,
}: {
    controle: ControlePainel;
    escopo: EscopoComunidade;
    onSelecionarEscopo: (escopo: EscopoComunidade) => void;
    grupoId?: string;
}) {
    const { largura, aberto, fechar } = controle;
    const bordas = useSafeAreaInsets();

    const { userId } = useAuth();
    const { grupos } = useMeusGrupos();
    const naoLidas = useContagemDeNotificacoes();

    // Os dois hooks já estão montados pela aba "Meu grupo" com a mesma chave de cache, então
    // o painel lê da memória — abrir a gaveta não dispara requisição nenhuma.
    const { membros } = useMembrosGrupo({ grupoId: grupoId ?? "" });

    const grupoAtual = grupos.find((g) => String(g.id) === String(grupoId));
    const outrosGrupos = grupos.filter((g) => String(g.id) !== String(grupoId));

    /*
      Convidar é do administrador (e de quem ele autorizou, membro a membro, nas
      configurações). A regra de verdade está na RPC `definir_codigo_convite`; aqui é só o
      que a gaveta mostra.
    */
    const meuVinculo = membros.find((membro) => membro.user_id === userId);
    const podeConvidar = !!meuVinculo && (meuVinculo.administrador || !!meuVinculo.pode_convidar);

    const irPara = (acao: () => void) => {
        fechar();
        acao();
    };

    const escolherEscopo = (novo: EscopoComunidade) => {
        onSelecionarEscopo(novo);
        fechar();
    };

    const trocarPara = async (grupo: Grupo) => {
        fechar();
        await salvarUltimoGrupoLocalmente(grupo.id);
        // `replace`, não `push`: a Comunidade já está na tela, só troca de grupo. Empilhar
        // outra cópia dela faria o "voltar" percorrer os grupos visitados um a um.
        router.replace({
            pathname: "/(tabs)",
            params: {
                groupId: grupo.id,
                groupName: grupo.nome_grupo,
                groupPhoto: grupo.foto_grupo,
                groupCode: grupo.codigo_convite,
                groupGoal: grupo.meta_horas,
            },
        });
    };

    return (
        <View
            // Nada de toque enquanto está coberto: fechado, o painel continua montado
            // debaixo da página, e um alvo invisível ali roubaria toques do feed.
            pointerEvents={aberto ? "auto" : "none"}
            style={{
                position: "absolute",
                top: 0,
                // Para na borda da tela e pronto. Descer por baixo da tab bar não adianta: o
                // navegador recorta o conteúdo da rota nessa altura. Quem continua a cor do
                // painel na faixa da barra é a própria barra — ver `BarraDeAbas`, em
                // `app/(tabs)/_layout.tsx`.
                bottom: 0,
                left: 0,
                width: largura,
                // Um degrau acima do preto da página. Na referência é o contrário — lá o
                // painel é mais escuro que o feed —, mas aqui o feed já é #000 e não há
                // como descer mais; então quem recua no tom é o painel.
                backgroundColor: HADES.surface,
            }}
        >
            <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
                <ScrollView
                    contentContainerStyle={{
                        // O painel encosta na barra, mas a lista não pode terminar embaixo
                        // dela: o último item ficaria inalcançável enquanto a barra está lá.
                        paddingHorizontal: 14,
                        paddingBottom: 20 + ALTURA_TAB_BAR + bordas.bottom,
                    }}
                    showsVerticalScrollIndicator={false}
                >
                    <Text
                        style={{
                            fontSize: 26,
                            fontWeight: "800",
                            color: "#fff",
                            letterSpacing: -0.6,
                            paddingHorizontal: 6,
                            paddingTop: 10,
                            paddingBottom: 16,
                        }}
                    >
                        Comunidade
                    </Text>

                    {/* Atalhos — o par de pílulas do topo. Dois destinos que não são feed. */}
                    <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
                        <Pilula
                            Icone={Bell}
                            contagem={naoLidas}
                            onPress={() => irPara(() => router.push("/(modals)/notificacoes"))}
                        />
                        <Pilula
                            Icone={FolderOpen}
                            onPress={() => irPara(() => router.push("/(tabs)/vault"))}
                        />
                    </View>

                    {/* Feeds: o que era o alternador de escopo no topo da tela. */}
                    <Cartao>
                        <ItemFeed
                            label="Meu grupo"
                            ativo={escopo === "meu-grupo"}
                            onPress={() => escolherEscopo("meu-grupo")}
                        />
                        <ItemFeed
                            label="Explorar"
                            ativo={escopo === "explorar"}
                            separador
                            onPress={() => escolherEscopo("explorar")}
                        />
                    </Cartao>

                    {/* Grupos: trocar sem passar pela lista inteira. */}
                    {outrosGrupos.length > 0 && (
                        <>
                            <Rotulo>Trocar de grupo</Rotulo>
                            <Cartao>
                                {outrosGrupos.map((grupo, i) => (
                                    <TouchableOpacity
                                        key={grupo.id}
                                        onPress={() => trocarPara(grupo)}
                                        activeOpacity={0.7}
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            gap: 11,
                                            paddingHorizontal: 14,
                                            paddingVertical: 11,
                                            borderTopWidth: i === 0 ? 0 : 1,
                                            borderTopColor: HADES.border,
                                        }}
                                    >
                                        <FotoDoGrupo foto={grupo.foto_grupo} size={32} />
                                        <Text
                                            style={{ flex: 1, fontSize: 14, fontWeight: "600", color: "#fff" }}
                                            numberOfLines={1}
                                        >
                                            {grupo.nome_grupo}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </Cartao>
                        </>
                    )}

                    {/* Ações do grupo aberto — o que era o bottom sheet `MenuDoGrupo`. */}
                    {grupoId && (
                        <>
                            <Rotulo>{grupoAtual?.nome_grupo ?? "Grupo atual"}</Rotulo>
                            <Cartao>
                                {podeConvidar && (
                                    <Acao
                                        Icone={UserPlus}
                                        titulo="Convidar membros"
                                        onPress={() =>
                                            irPara(() =>
                                                router.push({
                                                    pathname: "/invite",
                                                    params: {
                                                        grupoId,
                                                        grupoCode: grupoAtual?.codigo_convite,
                                                    },
                                                })
                                            )
                                        }
                                    />
                                )}
                                {/*
                                  Sem gate de administrador: é por aqui que se chega a "Sair do
                                  grupo", e esconder de quem não é admin prendia o membro comum.
                                */}
                                <Acao
                                    Icone={Settings}
                                    titulo="Configurações do grupo"
                                    separador={podeConvidar}
                                    onPress={() =>
                                        irPara(() =>
                                            router.push({
                                                pathname: "/(groups)/settings",
                                                params: { groupId: grupoId },
                                            })
                                        )
                                    }
                                />
                            </Cartao>
                        </>
                    )}

                    <Rotulo>Mais</Rotulo>
                    <Cartao>
                        <Acao
                            Icone={Users}
                            titulo="Todos os meus grupos"
                            onPress={() => irPara(() => router.push("/(groups)"))}
                        />
                        <Acao
                            Icone={Compass}
                            titulo="Procurar grupos públicos"
                            separador
                            onPress={() => irPara(() => router.push("/(groups)/browse-groups"))}
                        />
                        <Acao
                            Icone={Plus}
                            titulo="Criar um grupo"
                            separador
                            onPress={() => irPara(() => router.push("/(modals)/create-group"))}
                        />
                    </Cartao>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

/**
 * A página da Comunidade enquanto o painel existe: desliza para a direita e volta.
 *
 * Embrulha o conteúdo da tela porque o transform e o gesto são dela — o painel fica
 * parado. A sombra na borda esquerda é o que separa as duas camadas: sem ela, preto
 * deslizando sobre quase-preto não lê como uma folha saindo da frente.
 */
export function PaginaDeslizante({
    controle,
    children,
}: {
    controle: ControlePainel;
    children: React.ReactNode;
}) {
    const { aberto, fechar, gesto, estiloConteudo } = controle;

    return (
        <GestureDetector gesture={gesto}>
            <Animated.View
                style={[
                    {
                        flex: 1,
                        backgroundColor: HADES.bg,
                        shadowColor: "#000",
                        shadowOffset: { width: -6, height: 0 },
                        shadowOpacity: 0.55,
                        shadowRadius: 14,
                        elevation: 16,
                    },
                    estiloConteudo,
                ]}
            >
                {children}

                {/* Com o painel aberto, tocar na página é fechá-la — e nada mais nela responde. */}
                {aberto && <Pressable style={StyleSheet.absoluteFill} onPress={fechar} />}
            </Animated.View>
        </GestureDetector>
    );
}

/** Bloco agrupado do painel — o "cartão" de cantos arredondados do layout de referência. */
function Cartao({ children }: { children: React.ReactNode }) {
    return (
        <View
            style={{
                backgroundColor: HADES.surfaceRaised,
                borderWidth: 1,
                borderColor: HADES.border,
                borderRadius: 16,
                overflow: "hidden",
                marginBottom: 4,
            }}
        >
            {children}
        </View>
    );
}

function Rotulo({ children }: { children: React.ReactNode }) {
    return (
        <Text
            style={{
                fontSize: 11,
                fontWeight: "700",
                color: HADES.textFaint,
                letterSpacing: 0.8,
                textTransform: "uppercase",
                paddingHorizontal: 8,
                paddingTop: 18,
                paddingBottom: 7,
            }}
            numberOfLines={1}
        >
            {children}
        </Text>
    );
}

/** Atalho quadrado do topo — só ícone, como as pílulas de ♡ e 🔖 da referência. */
function Pilula({
    Icone,
    contagem,
    onPress,
}: {
    Icone: typeof Bell;
    contagem?: number;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.75}
            style={{
                flex: 1,
                height: 52,
                borderRadius: 15,
                backgroundColor: HADES.surfaceRaised,
                borderWidth: 1,
                borderColor: HADES.border,
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <BadgeContagem contagem={contagem ?? 0}>
                <Icone size={20} color={HADES.textSecondary} />
            </BadgeContagem>
        </TouchableOpacity>
    );
}

/**
 * Linha de feed. O feed aberto é marcado pelo texto em laranja, não por um fundo
 * preenchido: o painel inteiro já é uma superfície escura e a pílula laranja cheia
 * competiria com o destaque do próprio cartão.
 */
function ItemFeed({
    label,
    ativo,
    separador,
    onPress,
}: {
    label: string;
    ativo: boolean;
    separador?: boolean;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingVertical: 17,
                borderTopWidth: separador ? 1 : 0,
                borderTopColor: HADES.border,
            }}
        >
            <Text
                style={{
                    flex: 1,
                    fontSize: 17,
                    fontWeight: ativo ? "700" : "600",
                    color: ativo ? HADES.accentSolid : "#fff",
                    letterSpacing: -0.2,
                }}
            >
                {label}
            </Text>
            {ativo && (
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: HADES.accentSolid }} />
            )}
        </TouchableOpacity>
    );
}

function Acao({
    Icone,
    titulo,
    separador,
    onPress,
}: {
    Icone: typeof Users;
    titulo: string;
    separador?: boolean;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingHorizontal: 14,
                paddingVertical: 13,
                borderTopWidth: separador ? 1 : 0,
                borderTopColor: HADES.border,
            }}
        >
            <Icone size={17} color={HADES.textMuted} />
            <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: HADES.textSecondary }}>
                {titulo}
            </Text>
        </TouchableOpacity>
    );
}
