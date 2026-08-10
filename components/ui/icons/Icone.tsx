import { memo } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Circle, Ellipse, Line, Path, Polygon, Rect, Svg } from "react-native-svg";
import { COR, ICONES, type NomeIcone } from "./dados";

/**
 * O desenhista dos ícones Solar do app.
 *
 * A API é a mesma que o app usava com o lucide (`size`, `color`, e o `strokeWidth`
 * / `fill` de vez em quando), porque a migração pro Solar foi feita trocando só o
 * caminho do import em cada tela — quanto menos a chamada muda, menos chance de
 * uma tela ficar pra trás.
 *
 * Cada ícone vem em dois desenhos: `outline`, o contorno do dia a dia, e `bold`,
 * a versão preenchida pra quando o ícone está "ligado" (aba ativa, botão de play).
 */

export type VarianteIcone = "outline" | "bold";

export type IconeProps = {
    size?: number;
    color?: string;
    /**
     * Só vale para os poucos ícones desenhados a traço (check, x, mais, menos);
     * o resto do Solar é forma preenchida, onde espessura não existe.
     */
    strokeWidth?: number;
    variante?: VarianteIcone;
    /**
     * Herdado das chamadas do lucide, onde `fill` era o jeito de pedir o ícone
     * cheio. Aqui ele vira a variante `bold`, que é como o Solar preenche.
     */
    fill?: string;
    style?: StyleProp<ViewStyle>;
};

export type IconeComponente = ReturnType<typeof criarIcone>;

const FORMAS = { path: Path, circle: Circle, ellipse: Ellipse, rect: Rect, line: Line, polygon: Polygon } as const;

/** Sem cor definida o ícone acompanha o texto claro do tema escuro. */
const COR_PADRAO = "#ffffff";

export function criarIcone(nome: NomeIcone) {
    function Icone({
        size = 24,
        color = COR_PADRAO,
        strokeWidth,
        variante,
        fill,
        style,
    }: IconeProps) {
        const cheio = variante ?? (fill && fill !== "none" ? "bold" : "outline");
        return (
            <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
                {ICONES[nome][cheio].map((forma, indice) => {
                    const Forma = FORMAS[forma.tag as keyof typeof FORMAS] ?? Path;
                    const props: Record<string, string> = {};
                    for (const [chave, valor] of Object.entries(forma.props)) {
                        props[chave] = valor === COR ? color : valor;
                    }
                    if (strokeWidth !== undefined && props.stroke) {
                        props.strokeWidth = String(strokeWidth);
                    }
                    return <Forma key={indice} {...props} />;
                })}
            </Svg>
        );
    }
    Icone.displayName = nome;
    return memo(Icone);
}
