import { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "@/components/ui/TelaSegura";
import { router, useLocalSearchParams } from "expo-router";
import { Bell, Menu } from "@/components/ui/icons";

import AbaExplorar from "@/components/comunidade/AbaExplorar";
import AbaMeuGrupo from "@/components/comunidade/AbaMeuGrupo";
import PainelComunidade, {
    PaginaDeslizante,
    usePainelComunidade,
} from "@/components/comunidade/PainelComunidade";
import BadgeContagem from "@/components/ui/BadgeContagem";
import FotoDoGrupo from "@/components/ui/FotoDoGrupo";
import { HADES } from "@/constants/hades";
import { useMeusGrupos } from "@/hooks/useMeusGrupos";
import { useContagemDeNotificacoes } from "@/hooks/useNotificacoesNaoLidas";
import type { EscopoComunidade } from "@/types/comunidade";

const TITULO: Record<EscopoComunidade, string> = {
    "meu-grupo": "Meu grupo",
    explorar: "Explorar",
};

/**
 * Aba Comunidade — substitui a antiga aba Grupos.
 *
 * A casca é só o título, a busca e o alternador de escopo; o conteúdo de cada escopo vive
 * em seu próprio componente. "Meu grupo" é a home de grupo de sempre; "Explorar" é o feed
 * público (fotos de sessão, arquivos e planos — ver `services/comunidade.ts`).
 *
 * Quem chega sem grupo abre direto no Explorar: é o lado da aba que tem o que mostrar
 * antes de a pessoa entrar em algum grupo.
 */
export default function ComunidadeScreen() {
    const { groupId } = useLocalSearchParams();
    const temGrupo = !!groupId;

    const escopoInicial: EscopoComunidade = temGrupo ? "meu-grupo" : "explorar";
    const [escopo, setEscopo] = useState<EscopoComunidade>(escopoInicial);
    // O escopo que nunca foi aberto não é montado: assim o feed público só vai à rede
    // quando alguém pede por ele. Depois de visitado, fica montado.
    const [visitados, setVisitados] = useState<EscopoComunidade[]>([escopoInicial]);

    // Só lê o contador; quem o mantém em dia é o hook da tab bar (ver useNotificacoesNaoLidas).
    const naoLidas = useContagemDeNotificacoes();

    // O mesmo hook que o painel lateral usa, com a mesma chave de cache: ler a foto do grupo
    // aqui em cima não custa requisição nenhuma.
    const { grupos } = useMeusGrupos();
    const grupoAtual = grupos.find((g) => String(g.id) === String(groupId));

    const painel = usePainelComunidade();

    const trocarEscopo = (novo: EscopoComunidade) => {
        setEscopo(novo);
        setVisitados((atuais) => (atuais.includes(novo) ? atuais : [...atuais, novo]));
    };

    return (
        <View style={{ flex: 1, backgroundColor: HADES.bg }}>
            {/* Camada de baixo, parada: quem se move é a página, que sai da frente dela. */}
            <PainelComunidade
                controle={painel}
                escopo={escopo}
                onSelecionarEscopo={trocarEscopo}
                grupoId={groupId as string | undefined}
            />

            <PaginaDeslizante controle={painel}>
                <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
                    {/*
                      Uma faixa de casca só. O alternador de escopo que ficava aqui virou o
                      painel do hambúrguer — duas pílulas ocupando a linha inteira só pra
                      dizer qual lado está aberto era casca demais numa tela que ainda tem o
                      cabeçalho do grupo e os filtros por baixo. O título assumiu esse papel.
                    */}
                    <View
                        style={{
                            paddingTop: 4,
                            paddingHorizontal: 18,
                            paddingBottom: 12,
                            flexDirection: "row",
                            alignItems: "center",
                            minHeight: 44,
                        }}
                    >
                        <TouchableOpacity
                            onPress={painel.abrir}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            accessibilityLabel="Abrir menu"
                        >
                            <Menu size={23} color={HADES.text} />
                        </TouchableOpacity>

                        {/*
                          O miolo é uma camada absoluta, não um item da linha: centralizado por
                          `flex`, ele ficaria no meio do espaço *entre* os dois ícones — e como
                          o hambúrguer e o sino não têm a mesma largura, a foto encostaria
                          alguns pixels fora do eixo da tela. Aqui ela cai no centro de verdade.

                          `pointerEvents="none"` deixa os dois ícones receberem o toque mesmo
                          quando a camada passa por cima deles.
                        */}
                        <View
                            pointerEvents="none"
                            style={{
                                position: "absolute",
                                left: 0,
                                right: 0,
                                top: 4,
                                bottom: 12,
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            {escopo === "meu-grupo" && groupId ? (
                                <FotoDoGrupo foto={grupoAtual?.foto_grupo} size={44} />
                            ) : (
                                <Text
                                    style={{
                                        fontSize: 17,
                                        fontWeight: "700",
                                        color: HADES.text,
                                        letterSpacing: -0.3,
                                    }}
                                    numberOfLines={1}
                                >
                                    {TITULO[escopo]}
                                </Text>
                            )}
                        </View>

                        <View style={{ flex: 1 }} />

                        {/* O badge da tab bar avisa que tem novidade; o sino é como se chega nela. */}
                        <TouchableOpacity
                            onPress={() => router.push("/(modals)/notificacoes")}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <BadgeContagem contagem={naoLidas}>
                                <Bell size={21} color={HADES.textSecondary} />
                            </BadgeContagem>
                        </TouchableOpacity>
                    </View>

                    {/*
                      Escopo já visitado continua montado: alternar não pode custar uma recarga
                      do grupo nem perder a posição do feed. O que sai de cena é só escondido.
                    */}
                    {visitados.includes("meu-grupo") && (
                        <View style={{ flex: 1, display: escopo === "meu-grupo" ? "flex" : "none" }}>
                            <AbaMeuGrupo />
                        </View>
                    )}
                    {visitados.includes("explorar") && (
                        <View style={{ flex: 1, display: escopo === "explorar" ? "flex" : "none" }}>
                            <AbaExplorar temGrupo={temGrupo} />
                        </View>
                    )}
                </SafeAreaView>
            </PaginaDeslizante>
        </View>
    );
}
