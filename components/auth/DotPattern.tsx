import { Dimensions, View } from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const DOT_GAP = 26;
const DOT_R = 2.2;
const COLS = Math.ceil(SCREEN_WIDTH / DOT_GAP) + 1;
const ROWS = 10;

/**
 * Padrão decorativo de pontos usado no header das telas de auth (login, forgot-password).
 */
export default function DotPattern() {
    const dots: { key: string; x: number; y: number }[] = [];
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            dots.push({ key: `${r}-${c}`, x: c * DOT_GAP, y: r * DOT_GAP });
        }
    }
    return (
        <View
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            pointerEvents="none"
        >
            {dots.map((d) => (
                <View
                    key={d.key}
                    style={{
                        position: "absolute",
                        left: d.x,
                        top: d.y,
                        width: DOT_R * 2,
                        height: DOT_R * 2,
                        borderRadius: DOT_R,
                        backgroundColor: "rgba(16,24,43,0.10)",
                    }}
                />
            ))}
        </View>
    );
}
