import { View, Text } from "react-native";
import { COLORS } from "@/constants/colors";

interface PasswordStrengthProps {
    password: string;
}

/**
 * Indicador visual de força de senha com 4 barrinhas coloridas.
 * Retorna null se a senha estiver vazia.
 */
export default function PasswordStrength({ password }: PasswordStrengthProps) {
    const len = password.length;
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    const score =
        (len >= 8 ? 1 : 0) +
        (hasUpper ? 1 : 0) +
        (hasNumber ? 1 : 0) +
        (hasSpecial ? 1 : 0);

    if (!password) return null;

    const labels = ["Fraca", "Razoável", "Boa", "Forte"];
    const barColors = [COLORS.rose, COLORS.amber, COLORS.primary, COLORS.emerald];
    const label = labels[score - 1] ?? "Fraca";
    const color = barColors[score - 1] ?? COLORS.rose;

    return (
        <View style={{ marginTop: 8, gap: 6 }}>
            <View style={{ flexDirection: "row", gap: 4 }}>
                {[0, 1, 2, 3].map((i) => (
                    <View
                        key={i}
                        style={{
                            flex: 1,
                            height: 3,
                            borderRadius: 2,
                            backgroundColor: i < score ? color : "rgba(255,255,255,0.1)",
                        }}
                    />
                ))}
            </View>
            <Text style={{ fontSize: 11.5, color, fontWeight: "600" }}>Senha {label}</Text>
        </View>
    );
}
