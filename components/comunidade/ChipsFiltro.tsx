import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { CalendarRange, FileText, Image as ImageIcon } from "@/components/ui/icons";
import { HADES } from "@/constants/hades";
import type { FiltroComunidade } from "@/types/comunidade";

const FILTROS: {
    key: FiltroComunidade;
    label: string;
    Icone?: typeof ImageIcon;
}[] = [
    { key: "tudo", label: "Tudo" },
    { key: "galeria", label: "Galeria", Icone: ImageIcon },
    { key: "arquivo", label: "Arquivos", Icone: FileText },
    { key: "plano", label: "Planos", Icone: CalendarRange },
];

/**
 * Abas horizontais que recortam o feed público por tipo de publicação.
 *
 * Marcadas por um sublinhado laranja, e não por uma pílula preenchida: logo acima delas
 * está o alternador de escopo da Comunidade, que já usa a pílula laranja para dizer onde
 * se está. Duas pílulas laranja empilhadas competiam pelo mesmo papel — o sublinhado
 * mantém a marcação hierarquicamente abaixo do escopo.
 */
export default function ChipsFiltro({
    filtro,
    onSelecionar,
}: {
    filtro: FiltroComunidade;
    onSelecionar: (filtro: FiltroComunidade) => void;
}) {
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 22, paddingHorizontal: 18, paddingBottom: 12, marginTop: 12 }}
        >
            {FILTROS.map(({ key, label, Icone }) => {
                const ativo = key === filtro;
                const cor = ativo ? HADES.accentSolid : HADES.textMuted;
                return (
                    <TouchableOpacity
                        key={key}
                        onPress={() => onSelecionar(key)}
                        activeOpacity={0.7}
                        style={{ alignItems: "center", gap: 6 }}
                    >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 2 }}>
                            {Icone && <Icone size={13} color={cor} />}
                            <Text style={{ fontSize: 13, fontWeight: ativo ? "700" : "600", color: cor }}>
                                {label}
                            </Text>
                        </View>

                        {/* A barra existe sempre, transparente quando inativa: se ela só fosse
                            montada na aba ativa, a linha inteira subiria e desceria 2px a cada
                            troca de filtro. */}
                        <View
                            style={{
                                height: 2,
                                alignSelf: "stretch",
                                borderRadius: 1,
                                backgroundColor: ativo ? HADES.accentSolid : "transparent",
                            }}
                        />
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );
}
