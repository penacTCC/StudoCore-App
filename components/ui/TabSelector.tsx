import { View, Text, TouchableOpacity } from "react-native";
import { HADES } from "@/constants/hades";

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
 * Barra de abas estilo pill com destaque na aba ativa, no visual HADES.
 * Reutilizado em: vault.tsx (modal Upload)
 */
export default function TabSelector({ tabs, active, onSelect, activeColor = "brand" }: TabSelectorProps) {
    const activeBg = activeColor === "brand" ? HADES.accentSolid : HADES.violet;
    const activeTextColor = activeColor === "brand" ? "#000" : "#fff";

    return (
        <View style={{ flexDirection: "row", gap: 6 }}>
            {tabs.map((tab) => {
                const isActive = tab.key === active;
                return (
                    <TouchableOpacity
                        key={tab.key}
                        onPress={() => onSelect(tab.key)}
                        activeOpacity={0.8}
                        style={{
                            paddingHorizontal: 14,
                            paddingVertical: 7,
                            borderRadius: 9,
                            backgroundColor: isActive ? activeBg : HADES.surfaceOverlay,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 12.5,
                                fontWeight: "600",
                                color: isActive ? activeTextColor : HADES.textFaint,
                            }}
                        >
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}
