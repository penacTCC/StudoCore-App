import { Image, View } from "react-native";
import { COLORS } from "@/constants/colors";

interface LogoMarkProps {
    /** Tamanho do container quadrado. Padrão: 88 */
    size?: number;
    /** Raio da borda. Padrão: 24 */
    borderRadius?: number;
    /** Espaço abaixo do badge. Padrão: 20 */
    marginBottom?: number;
    /** Cor do brilho projetado. Padrão: o fundo escuro (sombra discreta). */
    shadowColor?: string;
}

/**
 * Logo do StudoCore em um badge preto arredondado com sombra.
 *
 * É o único lugar que aponta para o arquivo da logo: as quatro telas de auth passavam a
 * mesma `<Image>` copiada, e uma troca de marca deixava metade delas para trás.
 */
export default function LogoMark({
    size = 88,
    borderRadius = 24,
    marginBottom = 20,
    shadowColor = COLORS.bgPrimary,
}: LogoMarkProps) {
    const imageSize = Math.round(size * 0.66);
    return (
        <View style={{ alignItems: "center", justifyContent: "center", marginBottom }}>
            <View
                style={{
                    width: size,
                    height: size,
                    borderRadius,
                    backgroundColor: "#000",
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor,
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.18,
                    shadowRadius: 20,
                    elevation: 12,
                    borderWidth: 1.5,
                    borderColor: "rgba(255,255,255,0.06)",
                }}
            >
                <Image
                    source={require("../../assets/logo-studocore.png")}
                    style={{ width: imageSize, height: imageSize }}
                    resizeMode="contain"
                />
            </View>
        </View>
    );
}
