import { forwardRef } from "react";
import {
    SafeAreaView as SafeAreaViewNativa,
    type SafeAreaViewProps,
} from "react-native-safe-area-context";

/**
 * Folga que toda tela ganha acima do próprio conteúdo, além do recorte do sistema.
 *
 * A área segura para de onde a barra de status termina — matematicamente correto e
 * visualmente colado: o título nascia rente ao relógio e à ilha da câmera, sem ar
 * nenhum entre os dois. Isso é o respiro que faltava, num número só.
 */
export const FOLGA_TOPO = 12;

/**
 * A `SafeAreaView` do app: a da biblioteca, com `FOLGA_TOPO` a mais no topo.
 *
 * Existe para essa folga ser um número só, ajustável de um lugar, em vez de um
 * `paddingTop` repetido no cabeçalho de cada tela — eram trinta e poucos, e telas novas
 * nasceriam sem ele. As telas importam este componente com o mesmo nome de sempre, então
 * o uso não muda em lugar nenhum.
 *
 * A folga só entra quando a tela pede a borda de cima; quem usa `edges={["bottom"]}`
 * (as gavetas do rodapé, por exemplo) fica exatamente como estava. O recorte do sistema
 * é somado ao padding do estilo, não substituído — é o modo `additive` da biblioteca —,
 * então os dois convivem sem um comer o outro.
 */
export const SafeAreaView = forwardRef<
    React.ComponentRef<typeof SafeAreaViewNativa>,
    SafeAreaViewProps
>(function SafeAreaView({ edges, style, ...resto }, ref) {
    // `edges` vem em duas formas na biblioteca: a lista (`["top"]`) e o objeto por borda
    // (`{ top: "additive" }`). Sem nada, valem as quatro — e o topo está entre elas.
    const pegaOTopo =
        edges == null
            ? true
            : Array.isArray(edges)
              ? edges.includes("top")
              : (edges as Record<string, string | undefined>).top !== undefined &&
                (edges as Record<string, string | undefined>).top !== "off";

    return (
        <SafeAreaViewNativa
            ref={ref}
            edges={edges}
            style={[style, pegaOTopo ? { paddingTop: FOLGA_TOPO } : null]}
            {...resto}
        />
    );
});
