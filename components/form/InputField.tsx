import { useState } from "react";
import { View, Text, TextInput, TextInputProps } from "react-native";
import { COLORS } from "@/constants/colors";

interface InputFieldProps {
    /** Ícone exibido à esquerda */
    icon: React.ReactNode;
    value: string;
    onChangeText: (v: string) => void;
    placeholder: string;
    /** Label acima do campo (estilo onboarding). Se omitido, sem label. */
    label?: string;
    /** Texto de ajuda exibido abaixo do campo */
    helperText?: string;
    /** Prefixo exibido antes do input (ex: "@") */
    prefix?: string;
    /** Elemento exibido à direita (ex: botão olho da senha) */
    rightElement?: React.ReactNode;
    secureTextEntry?: boolean;
    keyboardType?: TextInputProps["keyboardType"];
    autoCapitalize?: TextInputProps["autoCapitalize"];
    maxLength?: number;
}

/**
 * Campo de input estilizado com ícone, foco animado, label e helper opcionais.
 * Suporta variante dark (onboarding) passando label, e variante compacta sem label.
 */
export default function InputField({
    icon,
    value,
    onChangeText,
    placeholder,
    label,
    helperText,
    prefix,
    rightElement,
    secureTextEntry,
    keyboardType = "default",
    autoCapitalize = "none",
    maxLength,
}: InputFieldProps) {
    const [focused, setFocused] = useState(false);

    const containerStyle = label
        ? {
              backgroundColor: focused ? COLORS.bgTertiary : COLORS.bgSecondary,
              borderColor: focused ? COLORS.primary + "80" : "rgba(255,255,255,0.07)",
          }
        : {
              backgroundColor: focused ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)",
              borderColor: focused ? COLORS.primary + "80" : "rgba(255,255,255,0.07)",
          };

    return (
        <View style={label ? { marginBottom: 20 } : undefined}>
            {label && (
                <Text
                    style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: focused ? COLORS.primary : "rgba(255,255,255,0.45)",
                        letterSpacing: 0.8,
                        marginBottom: 8,
                        textTransform: "uppercase",
                    }}
                >
                    {label}
                </Text>
            )}
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    borderRadius: 14,
                    borderWidth: 1.5,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    gap: label ? 10 : 12,
                    ...containerStyle,
                }}
            >
                <View style={{ opacity: focused ? 1 : label ? 0.4 : 0.45 }}>{icon}</View>
                {prefix && (
                    <Text style={{ color: COLORS.textSecondary, fontSize: 15, fontWeight: "600" }}>
                        {prefix}
                    </Text>
                )}
                <TextInput
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={COLORS.textFaint}
                    secureTextEntry={secureTextEntry}
                    keyboardType={keyboardType}
                    autoCapitalize={autoCapitalize}
                    maxLength={maxLength}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    style={{
                        flex: 1,
                        fontSize: 15,
                        color: COLORS.textPrimary,
                        fontWeight: "500",
                    }}
                />
                {rightElement}
            </View>
            {helperText && (
                <Text
                    style={{
                        fontSize: 11.5,
                        color: COLORS.textMuted,
                        marginTop: 6,
                        lineHeight: 16,
                        paddingHorizontal: 2,
                    }}
                >
                    {helperText}
                </Text>
            )}
        </View>
    );
}
