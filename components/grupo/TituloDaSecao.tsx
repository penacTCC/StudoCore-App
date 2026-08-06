import { View, Text } from "react-native";
import { HADES } from "@/constants/hades";

/**
 * Cabeçalho de seção do feed.
 *
 * É ele que informa o estado das sessões abaixo — no lugar do selo de "concluída" que
 * ficava em cada card. Por isso vive fora do card e é compartilhado pela home e pela tela
 * de sessões: se as duas telas rotulassem o estado de formas diferentes, a economia de
 * selos se perderia.
 */
export default function TituloDaSecao({
    label,
    aoVivo,
    contagem,
}: {
    label: string;
    aoVivo?: boolean;
    contagem?: number;
}) {
    return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 2 }}>
            {aoVivo && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: HADES.green }} />}
            <Text
                style={{
                    fontSize: 11,
                    fontWeight: "700",
                    letterSpacing: 0.9,
                    color: aoVivo ? HADES.textMuted : HADES.textDim,
                }}
            >
                {label}
            </Text>
            {contagem !== undefined && (
                <Text style={{ fontSize: 11, fontWeight: "600", color: HADES.textDim }}>· {contagem}</Text>
            )}
        </View>
    );
}
