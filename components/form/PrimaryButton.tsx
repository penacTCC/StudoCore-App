import { TouchableOpacity, Text, ActivityIndicator, StyleProp, ViewStyle } from "react-native";
import { COLORS } from "@/constants/colors";
import { HADES } from "@/constants/hades";

interface PrimaryButtonProps {
    label: string;
    onPress: () => void;
    isLoading?: boolean;
    disabled?: boolean;
    style?: StyleProp<ViewStyle>;
    /** Aplica o visual HADES (laranja sólido, texto preto). Padrão: false (tema legado, usado no onboarding). */
    hades?: boolean;
}

/**
 * Botão primário com sombra, suporte a estado de loading e disabled.
 * Padrão visual de todas as telas de auth e modals.
 */
export default function PrimaryButton({
    label,
    onPress,
    isLoading = false,
    disabled = false,
    style,
    hades = false,
}: PrimaryButtonProps) {
    const bg = hades ? HADES.accentSolid : COLORS.primary;
    const fg = hades ? "#000000" : "#ffffff";

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={isLoading || disabled}
            style={[
                {
                    backgroundColor: bg,
                    borderRadius: 14,
                    paddingVertical: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: bg,
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: hades ? 0.25 : 0.4,
                    shadowRadius: 14,
                    elevation: 10,
                    opacity: isLoading || disabled ? 0.8 : 1,
                },
                style,
            ]}
        >
            {isLoading ? (
                <ActivityIndicator size="small" color={fg} />
            ) : (
                <Text
                    style={{
                        color: fg,
                        fontWeight: "800",
                        fontSize: 15,
                        letterSpacing: 2.5,
                    }}
                >
                    {label}
                </Text>
            )}
        </TouchableOpacity>
    );
}
