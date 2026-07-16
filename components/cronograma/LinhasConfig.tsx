import { ReactNode } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { ChevronRight, Lock } from "lucide-react-native";
import { HADES } from "@/constants/hades";

export function SecaoConfig({ titulo, children }: { titulo: string; children: ReactNode }) {
    return (
        <>
            <Text
                style={{
                    fontSize: 12,
                    color: HADES.settingsTextMuted,
                    fontWeight: "700",
                    letterSpacing: 0.8,
                    marginTop: 20,
                    marginBottom: 10,
                    marginLeft: 4,
                }}
            >
                {titulo}
            </Text>
            <View
                style={{
                    backgroundColor: HADES.settingsCard,
                    borderWidth: 1,
                    borderColor: HADES.borderSettings,
                    borderRadius: 14,
                    overflow: "hidden",
                }}
            >
                {children}
            </View>
        </>
    );
}

function Linha({ children, ultima }: { children: ReactNode; ultima?: boolean }) {
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 14,
                borderBottomWidth: ultima ? 0 : 1,
                borderBottomColor: HADES.borderSettings,
            }}
        >
            {children}
        </View>
    );
}

export function LinhaStepper({
    rotulo,
    valor,
    onDiminuir,
    onAumentar,
    largura = 42,
    ultima,
}: {
    rotulo: string;
    valor: string;
    onDiminuir: () => void;
    onAumentar: () => void;
    largura?: number;
    ultima?: boolean;
}) {
    return (
        <Linha ultima={ultima}>
            <Text style={{ flex: 1, fontSize: 14, color: HADES.text }}>{rotulo}</Text>
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: HADES.settingsInset,
                    borderRadius: 9,
                }}
            >
                <TouchableOpacity
                    onPress={onDiminuir}
                    activeOpacity={0.6}
                    style={{ width: 30, height: 30, alignItems: "center", justifyContent: "center" }}
                >
                    <Text style={{ color: HADES.settingsTextSecondary, fontSize: 16 }}>−</Text>
                </TouchableOpacity>
                <Text
                    style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: HADES.text,
                        minWidth: largura,
                        textAlign: "center",
                    }}
                >
                    {valor}
                </Text>
                <TouchableOpacity
                    onPress={onAumentar}
                    activeOpacity={0.6}
                    style={{ width: 30, height: 30, alignItems: "center", justifyContent: "center" }}
                >
                    <Text style={{ color: HADES.accent, fontSize: 16 }}>+</Text>
                </TouchableOpacity>
            </View>
        </Linha>
    );
}

export function LinhaSwitch({
    rotulo,
    descricao,
    ligado,
    onToggle,
    travado,
    ultima,
}: {
    rotulo: string;
    descricao?: string;
    ligado: boolean;
    onToggle?: () => void;
    travado?: boolean;
    ultima?: boolean;
}) {
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: descricao ? "flex-start" : "center",
                padding: 14,
                borderBottomWidth: ultima ? 0 : 1,
                borderBottomColor: HADES.borderSettings,
                opacity: travado ? 0.5 : 1,
            }}
        >
            <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ fontSize: 14, color: HADES.text }}>{rotulo}</Text>
                    {travado && <Lock size={12} color={HADES.settingsTextMuted} />}
                </View>
                {descricao && (
                    <Text
                        style={{
                            fontSize: 12,
                            color: HADES.settingsTextMuted,
                            marginTop: 3,
                            lineHeight: 17,
                            maxWidth: 230,
                        }}
                    >
                        {descricao}
                    </Text>
                )}
            </View>

            <TouchableOpacity
                onPress={travado ? undefined : onToggle}
                disabled={travado}
                activeOpacity={0.8}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                    width: 44,
                    height: 27,
                    borderRadius: 14,
                    backgroundColor: ligado ? HADES.accentSolid : HADES.settingsSwitchOff,
                    justifyContent: "center",
                }}
            >
                <View
                    style={{
                        position: "absolute",
                        left: ligado ? 19 : 2.5,
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: "#fff",
                    }}
                />
            </TouchableOpacity>
        </View>
    );
}

export function LinhaEscolha({
    rotulo,
    valor,
    onPress,
    ultima,
}: {
    rotulo: string;
    valor: string;
    onPress?: () => void;
    ultima?: boolean;
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 14,
                borderBottomWidth: ultima ? 0 : 1,
                borderBottomColor: HADES.borderSettings,
            }}
        >
            <Text style={{ flex: 1, fontSize: 14, color: HADES.text }}>{rotulo}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 14, color: HADES.settingsTextSecondary }}>{valor}</Text>
                <ChevronRight size={16} color={HADES.settingsChevron} />
            </View>
        </TouchableOpacity>
    );
}
