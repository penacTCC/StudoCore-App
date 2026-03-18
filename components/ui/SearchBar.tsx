import { View, TextInput } from "react-native";
import { Search } from "lucide-react-native";
import { COLORS } from "@/constants/colors";

interface SearchBarProps {
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    /** Estilo do container (bg/border). dark = navy, light = slate. Padrão: "dark" */
    variant?: "dark" | "light";
}

/**
 * Campo de busca com ícone de lupa à esquerda.
 * Reutilizado em: browse-groups.tsx, vault.tsx
 */
export default function SearchBar({
    value,
    onChangeText,
    placeholder = "Search...",
    variant = "dark",
}: SearchBarProps) {
    const bgClass =
        variant === "dark"
            ? "bg-navy-900 border-navy-800"
            : "bg-slate-900 border-slate-800";

    return (
        <View className="relative">
            <View className="absolute left-4 top-0 bottom-0 justify-center z-10">
                <Search size={18} color={COLORS.textMuted} />
            </View>
            <TextInput
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={COLORS.textMuted}
                className={`${bgClass} border rounded-xl pl-11 pr-4 py-3 text-slate-200 text-base`}
            />
        </View>
    );
}
