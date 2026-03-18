import { TouchableOpacity } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { router } from "expo-router";
import { COLORS } from "@/constants/colors";

interface BackButtonProps {
    /** Distância do topo. Padrão: 52 */
    top?: number;
    /** Chamado ao pressionar. Se não passado, chama router.back() */
    onPress?: () => void;
    /** Cor do ícone. Padrão: COLORS.bgPrimary */
    iconColor?: string;
    /** Cor de fundo. Padrão: rgba(16,24,43,0.06) */
    backgroundColor?: string;
}

/**
 * Botão de voltar posicionado absolutamente, padrão dos headers de auth.
 */
export default function BackButton({
    top = 52,
    onPress,
    iconColor = COLORS.bgPrimary,
    backgroundColor = "rgba(16,24,43,0.06)",
}: BackButtonProps) {
    return (
        <TouchableOpacity
            onPress={onPress ?? (() => router.back())}
            style={{
                position: "absolute",
                left: 20,
                top,
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor,
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <ArrowLeft size={20} color={iconColor} />
        </TouchableOpacity>
    );
}
