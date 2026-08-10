import { View, Text, TouchableOpacity, StyleProp, ViewStyle } from "react-native";
import type { IconeComponente } from "@/components/ui/icons";
import { HADES } from "@/constants/hades";

type EmptyStateProps = {
    icon: IconeComponente;
    title: string;
    subtitle?: string;
    actionLabel?: string;
    onAction?: () => void;
    compact?: boolean;
    style?: StyleProp<ViewStyle>;
};

/**
 * Card genérico de "nada por aqui ainda", no mesmo estilo do `FeedVazio`
 * (components/grupo/CardSessaoGrupo.tsx). Reservado pra listas menores; telas
 * inteiras (uma aba, uma tela cheia) merecem um estado próprio e mais rico.
 */
export function EmptyState({ icon: Icon, title, subtitle, actionLabel, onAction, compact, style }: EmptyStateProps) {
    return (
        <View
            style={[
                {
                    backgroundColor: HADES.surface,
                    borderWidth: 1,
                    borderColor: HADES.border,
                    borderRadius: 16,
                    paddingVertical: compact ? 18 : 28,
                    paddingHorizontal: 20,
                    alignItems: "center",
                },
                style,
            ]}
        >
            <Icon size={compact ? 20 : 26} color={HADES.dot} />
            <Text
                style={{
                    fontSize: 13.5,
                    color: HADES.textMuted,
                    marginTop: compact ? 8 : 12,
                    textAlign: "center",
                }}
            >
                {title}
            </Text>
            {subtitle ? (
                <Text style={{ fontSize: 12, color: HADES.textDim, marginTop: 4, textAlign: "center" }}>
                    {subtitle}
                </Text>
            ) : null}
            {actionLabel && onAction ? (
                <TouchableOpacity
                    onPress={onAction}
                    activeOpacity={0.85}
                    style={{
                        marginTop: 16,
                        height: 40,
                        paddingHorizontal: 18,
                        borderRadius: 10,
                        backgroundColor: HADES.accentSolid,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Text style={{ fontSize: 13.5, fontWeight: "700", color: "#000" }}>{actionLabel}</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}
