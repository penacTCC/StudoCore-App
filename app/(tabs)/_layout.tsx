import { useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tabs } from "expo-router";
import Animated from "react-native-reanimated";
import { BottomTabBar, type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { ALTURA_TAB_BAR, HADES } from "@/constants/hades";
import BadgeContagem from "@/components/ui/BadgeContagem";
import BotaoAba from "@/components/ui/BotaoAba";
import IconeAba, { TAMANHO_ICONE_ABA } from "@/components/ui/IconeAba";
import {
    ProvedorPainel,
    usePainelComunidade,
} from "@/components/comunidade/PainelComunidade";
import { useAuth } from "@/hooks/useAuth";
import { useFormulariosPendentes } from "@/hooks/useFormulariosPendentes";
import { useNotificacoesNaoLidas } from "@/hooks/useNotificacoesNaoLidas";

// Cinza/branco no lugar do laranja: sem rótulos, a aba ativa se destaca só pelo
// ícone preenchido e pelo branco, como no Threads.
const ATIVO = "#ffffff";
const INATIVO = "#4a4a4a";

// O Foco ganha o quadrado arredondado que o Threads dá ao botão do meio: apagado
// ele é uma pastilha escura, aceso vira o laranja da marca com o cronômetro branco.
const QUADRADO_FOCO = {
    largura: 52,
    altura: 40,
    raio: 13,
    fundoApagado: "#1c1d22",
} as const;

// Comunidade, Cronograma, Foco, Análise e Perfil. O Vault tem `href: null`, então
// não ocupa lugar na barra.
const QTD_ABAS = 5;

/** Respiro embaixo dos ícones, já embutido em `ALTURA_TAB_BAR`. Ver `respiroInferior`. */
const PADDING_INFERIOR_BARRA = 12;

/**
 * Largura da célula do Foco.
 *
 * A barra divide a largura em fatias iguais e centra cada ícone na sua fatia. Como a
 * pastilha é bem mais larga que um ícone, com fatias iguais ela avança sobre o vão dos
 * vizinhos — era por isso que o Cronograma ficava mais perto do cronômetro do que da
 * casa. A fatia do Foco então recebe o que a pastilha tem a mais que um ícone,
 * descontada a parte que as outras quatro já absorvem. Igualando os dois vãos:
 *
 *     fatia − ícone = (fatia + fatiaFoco) / 2 − (ícone + pastilha) / 2
 *
 * o que resolve para o valor abaixo, e deixa todos os vãos do mesmo tamanho.
 */
function larguraCelulaFoco(larguraDaBarra: number) {
    const excedente = QUADRADO_FOCO.largura - TAMANHO_ICONE_ABA;
    return larguraDaBarra / QTD_ABAS + (excedente * (QTD_ABAS - 1)) / QTD_ABAS;
}

/**
 * A tab bar sai de cena junto com a página quando o painel da Comunidade abre.
 *
 * Ela usa o mesmo `estiloConteudo` da página — o mesmo `translateX`, no mesmo valor
 * animado —, então as duas andam coladas em vez de a barra ficar plantada embaixo de uma
 * tela que já saiu da frente. Some deslizando; não pisca.
 */
function BarraDeAbas(props: BottomTabBarProps) {
    const { aberto, estiloConteudo } = usePainelComunidade();

    return (
        // O contêiner não se move e é pintado com a cor do painel; quem desliza é a barra
        // dentro dele. Assim a faixa que ela desocupa já nasce da cor certa, e com a
        // largura certa: a barra anda exatamente a largura do painel, então o que sobra
        // à esquerda é a continuação dele.
        //
        // Pintar essa faixa a partir do painel não funciona — o navegador recorta o
        // conteúdo da rota na altura da barra, e nada que a Comunidade desenhe passa daqui.
        <View style={{ backgroundColor: HADES.surface }}>
            <Animated.View
                // Fora de cena ela não recebe toque: sem isso, um toque no canto inferior
                // esquerdo trocaria de aba com o painel aberto por cima.
                pointerEvents={aberto ? "none" : "auto"}
                style={estiloConteudo}
            >
                <BottomTabBar {...props} />
            </Animated.View>
        </View>
    );
}

/**
 * O ícone do Foco dentro da pastilha. Quem pulsa é só o cronômetro, lá dentro:
 * o quadrado fica parado, senão o bloco laranja inteiro daria o pulo a cada toque.
 */
function IconeFoco({ color, focused }: { color: string; focused: boolean }) {
    return (
        <View
            style={{
                width: QUADRADO_FOCO.largura,
                height: QUADRADO_FOCO.altura,
                borderRadius: QUADRADO_FOCO.raio,
                backgroundColor: focused ? HADES.accent : QUADRADO_FOCO.fundoApagado,
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <IconeAba nome="foco" color={color} focused={focused} size={24} />
        </View>
    );
}

export default function TabLayout() {
    const { userId } = useAuth();
    const { width } = useWindowDimensions();
    /*
      A barra do sistema, no rodapé, cabe *dentro* da nossa.

      O app desenha de ponta a ponta da tela, então a barra de abas nascia colada na borda
      de baixo — e o Android empilha a navegação dele por cima. Na navegação por gestos a
      faixa é fina e sobrava padding para os ícones respirarem; nos três botões ela tem uns
      48dp e cobria a barra inteira: dava para ver os ícones, não para tocá-los.

      `Math.max` em vez de somar: o padding de 12 que a barra já tinha é justamente esse
      respiro do rodapé. Somar empurraria os ícones para cima também na navegação por
      gestos, que hoje está do jeito certo — aqui a barra só cresce quando o sistema pede
      mais do que os 12 já dão.
    */
    const bordas = useSafeAreaInsets();
    const respiroInferior = Math.max(PADDING_INFERIOR_BARRA, bordas.bottom);
    // Formulários de sessão em aberto viram um badge no ícone do Análise, que é a aba
    // onde eles são respondidos.
    const formulariosPendentes = useFormulariosPendentes(userId);
    // A caixa de notificações inteira (curtida, comentário, força, grupo) vira badge no
    // ícone da Comunidade, que é a aba de onde se chega nela pelo sino do cabeçalho.
    const notificacoesNaoLidas = useNotificacoesNaoLidas(userId);

    return (
        <ProvedorPainel>
            <Tabs
                tabBar={(props) => <BarraDeAbas {...props} />}
                screenOptions={{
                    headerShown: false,
                    tabBarStyle: {
                        backgroundColor: HADES.bg,
                        borderTopColor: HADES.border,
                        borderTopWidth: 1,
                        height: ALTURA_TAB_BAR - PADDING_INFERIOR_BARRA + respiroInferior,
                        paddingTop: 11,
                        paddingBottom: respiroInferior,
                    },
                    tabBarActiveTintColor: ATIVO,
                    tabBarInactiveTintColor: INATIVO,
                    tabBarButton: (props) => <BotaoAba {...props} />,
                    // Sem rótulo: o desenho preenchido já diz qual aba está aberta. O
                    // `title` de cada tela continua valendo — é o que o leitor de tela lê.
                    tabBarShowLabel: false,
                    tabBarIconStyle: {
                        marginBottom: 0,
                    },
                }}
            >
                <Tabs.Screen
                    name="index"
                    options={{
                        title: "Comunidade",
                        tabBarIcon: ({ color, focused }) => (
                            <BadgeContagem contagem={notificacoesNaoLidas}>
                                <IconeAba nome="grupos" color={color} focused={focused} />
                            </BadgeContagem>
                        ),
                    }}
                />
                <Tabs.Screen
                    name="schedule"
                    options={{
                        title: "Cronograma",
                        tabBarIcon: ({ color, focused }) => (
                            <IconeAba nome="cronograma" color={color} focused={focused} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="focus"
                    options={{
                        title: "Foco",
                        tabBarItemStyle: { flex: 0, width: larguraCelulaFoco(width) },
                        tabBarIcon: ({ color, focused }) => (
                            <IconeFoco color={color} focused={focused} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="brain"
                    options={{
                        title: "Análise",
                        tabBarIcon: ({ color, focused }) => (
                            <BadgeContagem contagem={formulariosPendentes}>
                                <IconeAba nome="analise" color={color} focused={focused} />
                            </BadgeContagem>
                        ),
                    }}
                />
                {/* O Vault saiu da tab bar, mas a rota continua: é alcançado pelo header
                    da Home e pelo aviso de materiais antes de iniciar o foco. */}
                <Tabs.Screen name="vault" options={{ href: null }} />
                <Tabs.Screen
                    name="profile"
                    options={{
                        title: "Perfil",
                        tabBarIcon: ({ color, focused }) => (
                            <IconeAba nome="perfil" color={color} focused={focused} />
                        ),
                    }}
                />
            </Tabs>
        </ProvedorPainel>
    );
}
