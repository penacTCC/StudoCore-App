import { View, TextInput } from "react-native";
import { Search } from "lucide-react-native";
import { HADES } from "@/constants/hades";

interface SearchBarProps {
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    /** Mantido por compatibilidade de API; no HADES ambos usam a mesma superfície. */
    variant?: "dark" | "light";
}

/**
 * Campo de busca com ícone de lupa à esquerda, no visual HADES.
 * Reutilizado em: browse-groups.tsx, vault.tsx
 */
export default function SearchBar({
    value,
    onChangeText,
    placeholder = "Pesquisar...",
}: SearchBarProps) {
    return (
        <View style={{ position: "relative", justifyContent: "center" }}>
            <View style={{ position: "absolute", left: 14, zIndex: 10 }}>
                <Search size={18} color={HADES.textFaint} />
            </View>
            <TextInput
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={HADES.textFaint}
                style={{
                    backgroundColor: HADES.surfaceRaised,
                    borderWidth: 1,
                    borderColor: HADES.border,
                    borderRadius: 13,
                    paddingLeft: 42,
                    paddingRight: 16,
                    paddingVertical: 12,
                    color: HADES.text,
                    fontSize: 15,
                }}
            />
        </View>
    );
}
