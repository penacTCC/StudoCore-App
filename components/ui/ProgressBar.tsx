import { View } from "react-native";
import { COLORS } from "@/constants/colors";

interface ProgressBarProps {
    /** Progresso de 0 a 1. Ex: 0.75 = 75% */
    progress: number;
    /** Cor da barra. Padrão: COLORS.emerald */
    color?: string;
    /** Altura em px. Padrão: 8 */
    height?: number;
    /** Cor do fundo da trilha. Padrão: bg-slate-800 */
    trackClassName?: string;
}

/**
 * Barra de progresso horizontal.
 * Reutilizado em: index.tsx, group-details.tsx, profile.tsx
 */
export default function ProgressBar({
    progress,
    color = COLORS.emerald,
    height = 8,
    trackClassName = "bg-slate-800",
}: ProgressBarProps) {
    const clampedProgress = Math.min(1, Math.max(0, progress));
    return (
        <View
            className={`w-full ${trackClassName} rounded-full overflow-hidden`}
            style={{ height }}
        >
            <View
                className="h-full rounded-full"
                style={{
                    width: `${clampedProgress * 100}%`,
                    backgroundColor: color,
                }}
            />
        </View>
    );
}
