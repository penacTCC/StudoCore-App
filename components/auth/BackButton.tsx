import { TouchableOpacity } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { router } from "expo-router";
import { HADES } from "@/constants/hades";

interface BackButtonProps {
    /** Distância do topo. Padrão: 52 */
    top?: number;
    /** Chamado ao pressionar. Se não passado, chama router.back() */
    onPress?: () => void;
    /** Cor do ícone. Padrão: HADES.textSecondary */
    iconColor?: string;
    /** Cor de fundo. Padrão: superfície elevada do HADES */
    backgroundColor?: string;
}

/**
 * Botão de voltar posicionado absolutamente, padrão dos headers de auth.
 */
export default function BackButton({
    top = 52,
    onPress,
    iconColor = HADES.textSecondary,
    backgroundColor = "rgba(255,255,255,0.06)",
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
