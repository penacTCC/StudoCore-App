import { View, Text } from "react-native";
import { HADES } from "@/constants/hades";

type Props = {
    /** Ícone da aba. O badge é posicionado por cima dele. */
    children: React.ReactNode;
    contagem: number;
};

/**
 * Envolve um ícone da tab bar com um contador vermelho no canto superior direito.
 * Com 0, some por completo — nada de bolinha vazia.
 */
export default function BadgeContagem({ children, contagem }: Props) {
    return (
        <View>
            {children}
            {contagem > 0 && (
                <View
                    style={{
                        position: "absolute",
                        top: -6,
                        right: -10,
                        minWidth: 17,
                        height: 17,
                        borderRadius: 9,
                        paddingHorizontal: 4.5,
                        backgroundColor: HADES.red,
                        alignItems: "center",
                        justifyContent: "center",
                        // O anel na cor do fundo separa o badge do ícone quando eles encostam.
                        borderWidth: 2,
                        borderColor: HADES.bg,
                    }}
                >
                    <Text
                        style={{
                            fontSize: 10,
                            fontWeight: "700",
                            color: "#ffffff",
                            includeFontPadding: false,
                        }}
                    >
                        {contagem > 9 ? "9+" : contagem}
                    </Text>
                </View>
            )}
        </View>
    );
}
