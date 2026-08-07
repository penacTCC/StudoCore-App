import { ScrollView, Text, TouchableOpacity } from "react-native";
import { CalendarRange, FileText, Image as ImageIcon } from "lucide-react-native";
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

/** Chips horizontais que recortam o feed público por tipo de publicação. */
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
            contentContainerStyle={{ gap: 8, paddingHorizontal: 18, paddingBottom: 12 }}
        >
            {FILTROS.map(({ key, label, Icone }) => {
                const ativo = key === filtro;
                return (
                    <TouchableOpacity
                        key={key}
                        onPress={() => onSelecionar(key)}
                        activeOpacity={0.85}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            paddingHorizontal: 13,
                            paddingVertical: 7,
                            borderRadius: 10,
                            backgroundColor: ativo ? HADES.accentSolid : HADES.surfaceRaised,
                            borderWidth: 1,
                            borderColor: ativo ? "transparent" : "rgba(255,255,255,0.07)",
                        }}
                    >
                        {Icone && <Icone size={13} color={ativo ? "#000" : HADES.textSecondary} />}
                        <Text
                            style={{
                                fontSize: 12.5,
                                fontWeight: ativo ? "700" : "600",
                                color: ativo ? "#000" : HADES.textSecondary,
                            }}
                        >
                            {label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );
}
