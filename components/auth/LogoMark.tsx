import { Image, View } from "react-native";
import { COLORS } from "@/constants/colors";

interface LogoMarkProps {
    /** Tamanho do container quadrado. Padrão: 88 */
    size?: number;
    /** Raio da borda. Padrão: 24 */
    borderRadius?: number;
}

/**
 * Logo do StudoCore em um badge branco arredondado com sombra.
 * Usado no header das telas de auth.
 */
export default function LogoMark({ size = 88, borderRadius = 24 }: LogoMarkProps) {
    const imageSize = Math.round(size * 0.705);
    return (
        <View style={{ alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <View
                style={{
                    width: size,
                    height: size,
                    borderRadius,
                    backgroundColor: "#fff",
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: COLORS.bgPrimary,
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.18,
                    shadowRadius: 20,
                    elevation: 12,
                    borderWidth: 1.5,
                    borderColor: "rgba(16,24,43,0.07)",
                }}
            >
                <Image
                    source={require("../../assets/LogoStudoCore.png")}
                    style={{ width: imageSize, height: imageSize }}
                />
            </View>
        </View>
    );
}
