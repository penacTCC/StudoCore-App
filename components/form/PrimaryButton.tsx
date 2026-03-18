import { TouchableOpacity, Text, ActivityIndicator, StyleProp, ViewStyle } from "react-native";
import { COLORS } from "@/constants/colors";

interface PrimaryButtonProps {
    label: string;
    onPress: () => void;
    isLoading?: boolean;
    disabled?: boolean;
    style?: StyleProp<ViewStyle>;
}

/**
 * Botão primário azul com sombra, suporte a estado de loading e disabled.
 * Padrão visual de todas as telas de auth e modals.
 */
export default function PrimaryButton({
    label,
    onPress,
    isLoading = false,
    disabled = false,
    style,
}: PrimaryButtonProps) {
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={isLoading || disabled}
            style={[
                {
                    backgroundColor: COLORS.primary,
                    borderRadius: 14,
                    paddingVertical: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: COLORS.primary,
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.4,
                    shadowRadius: 14,
                    elevation: 10,
                    opacity: isLoading || disabled ? 0.8 : 1,
                },
                style,
            ]}
        >
            {isLoading ? (
                <ActivityIndicator size="small" color="#ffffff" />
            ) : (
                <Text
                    style={{
                        color: "#ffffff",
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
