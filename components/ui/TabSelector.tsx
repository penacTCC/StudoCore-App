import { View, Text, TouchableOpacity } from "react-native";

interface Tab {
    key: string;
    label: string;
}

interface TabSelectorProps {
    tabs: Tab[];
    active: string;
    onSelect: (key: string) => void;
    /** Cor da aba ativa. "brand" = laranja, "violet" = roxo. Padrão: "brand" */
    activeColor?: "brand" | "violet";
}

/**
 * Barra de abas estilo pill com destaque na aba ativa.
 * Reutilizado em: index.tsx (Leaderboard), brain.tsx, vault.tsx (modal Upload)
 */
export default function TabSelector({
    tabs,
    active,
    onSelect,
    activeColor = "brand",
}: TabSelectorProps) {
    const activeBg = activeColor === "brand" ? "bg-brand-500" : "bg-violet-600";
    const activeText = "text-white";
    const inactiveText = "text-slate-400";

    return (
        <View className="flex-row gap-1">
            {tabs.map((tab) => {
                const isActive = tab.key === active;
                return (
                    <TouchableOpacity
                        key={tab.key}
                        onPress={() => onSelect(tab.key)}
                        className={`px-3 py-1 rounded-lg ${isActive ? activeBg : "bg-slate-800"}`}
                    >
                        <Text
                            className={`text-xs font-medium ${
                                isActive ? activeText : inactiveText
                            }`}
                        >
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}
