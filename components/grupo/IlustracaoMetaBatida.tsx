import Svg, { Circle, G, Path } from "react-native-svg";

import { HADES } from "@/constants/hades";

const VERDE = HADES.green;

/**
 * Desenho da meta da semana batida: a bandeira no alto do morro, com a trilha pontilhada
 * de quem subiu até lá.
 *
 * Existe porque o cartão de meta batida era um ícone de confete ao lado de um título, e
 * um cartão comemorativo montado com a mesma peça de ícone que o resto do app usa em
 * botões não comemora nada — lê como aviso. Um traço só, feito para este momento, é o que
 * diferencia essa semana das outras.
 *
 * Tudo em `stroke`, sem preenchimento chapado: no fundo preto do HADES, área sólida em
 * verde vira mancha; contorno fino mantém o desenho leve ao lado do texto.
 */
export default function IlustracaoMetaBatida({ size = 108 }: { size?: number }) {
    // O desenho é largo (4:3); a altura acompanha para o viewBox nunca distorcer.
    const altura = size * 0.75;

    return (
        <Svg width={size} height={altura} viewBox="0 0 120 90" fill="none">
            {/* Morro do fundo, mais apagado — é o que dá profundidade sem virar segundo assunto. */}
            <Path
                d="M62 70 L84 40 L106 70"
                stroke={VERDE}
                strokeOpacity={0.28}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Morro principal, com o cume à esquerda do centro para a bandeira caber no ar. */}
            <Path
                d="M14 70 L46 22 L70 56 L82 42 L100 70"
                stroke={VERDE}
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Bandeira fincada no cume. */}
            <G>
                <Path d="M46 22 L46 5" stroke={VERDE} strokeWidth={2.4} strokeLinecap="round" />
                <Path
                    d="M46 6.5 L66 11.5 L46 17.5 Z"
                    stroke={VERDE}
                    strokeWidth={2.2}
                    strokeLinejoin="round"
                    fill={VERDE}
                    fillOpacity={0.18}
                />
            </G>

            {/* A trilha: sobe pela encosta até o pé da bandeira. Pontilhada porque é percurso, não relevo. */}
            <Path
                d="M20 78 C 34 78, 30 66, 38 58 C 42 54, 44 44, 45 26"
                stroke={VERDE}
                strokeOpacity={0.5}
                strokeWidth={2}
                strokeLinecap="round"
                strokeDasharray="1 7"
            />

            {/* Chão: uma linha curta e uma longa, só para o morro não flutuar. */}
            <Path d="M6 78 L14 78" stroke={VERDE} strokeOpacity={0.22} strokeWidth={2} strokeLinecap="round" />
            <Path d="M52 78 L108 78" stroke={VERDE} strokeOpacity={0.22} strokeWidth={2} strokeLinecap="round" />

            {/* Faíscas soltas — a única licença comemorativa do desenho. */}
            <Path d="M86 18 L86 26 M82 22 L90 22" stroke={VERDE} strokeOpacity={0.45} strokeWidth={2} strokeLinecap="round" />
            <Path d="M22 34 L22 40 M19 37 L25 37" stroke={VERDE} strokeOpacity={0.3} strokeWidth={2} strokeLinecap="round" />
            <Circle cx={104} cy={34} r={2.2} stroke={VERDE} strokeOpacity={0.35} strokeWidth={2} />
            <Circle cx={12} cy={54} r={1.6} fill={VERDE} fillOpacity={0.3} />
        </Svg>
    );
}
