import { View, Text } from "react-native";

interface StatCardProps {
    value: string | number;
    label: string;
    /** Cor do valor. Padrão: text-slate-200 */
    valueColor?: string;
}

/**
 * Card de métrica compacto: número grande + label pequeno.
 * Reutilizado em: group-details.tsx, brain.tsx, profile.tsx
 */
export default function StatCard({ value, label, valueColor }: StatCardProps) {
    return (
        <View className="flex-1 bg-[#151515] border border-white/10 rounded-2xl p-4 items-center">
            <Text
                className={`text-2xl font-bold text-center ${!valueColor ? "text-slate-200" : ""}`}
                style={valueColor ? { color: valueColor } : undefined}
            >
                {value}
            </Text>
            <Text className="text-xs text-slate-400 text-center">{label}</Text>
        </View>
    );
}
