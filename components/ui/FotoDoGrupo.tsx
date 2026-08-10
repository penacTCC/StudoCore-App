import { View, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Users } from "@/components/ui/icons";

import { HADES } from "@/constants/hades";

/** `foto_grupo` chega como string do banco, mas como array quando veio pelos params da rota. */
export function urlDaFoto(foto: unknown): string | undefined {
    const valor = Array.isArray(foto) ? foto[0] : foto;
    return typeof valor === "string" && valor.length > 0 ? valor : undefined;
}

/**
 * Foto do grupo, com o mesmo degradê azul de sempre quando o grupo não tem imagem.
 *
 * É o equivalente do `Avatar` para grupos: nasceu no cabeçalho da Comunidade e virou
 * componente quando o acervo (`app/(tabs)/vault.tsx`) passou a identificar cada seção
 * pela foto do grupo em vez de repetir o mesmo ícone de pasta.
 */
export default function FotoDoGrupo({ foto, size = 40 }: { foto?: string | null; size?: number }) {
    const uri = urlDaFoto(foto);
    return (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: size * 0.28,
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            {uri ? (
                <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            ) : (
                <LinearGradient
                    colors={["#1c2a4a", "#0e1730"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}
                >
                    <Users size={size * 0.5} color={HADES.subjectBlue} />
                </LinearGradient>
            )}
        </View>
    );
}
