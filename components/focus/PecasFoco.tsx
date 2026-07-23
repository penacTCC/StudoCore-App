import { View, Text, TouchableOpacity } from "react-native";
import { Globe, Pause, CalendarClock, RotateCcw } from "lucide-react-native";
import { HADES } from "@/constants/hades";
import { CORES_AVATAR } from "@/constants/foco";
import type { ContextoBloco } from "@/types/foco";

/** Relógio grande. `tabular-nums` evita o número "pular" a cada segundo. */
export function Relogio({
    texto,
    tamanho = 72,
    cor = HADES.text,
}: {
    texto: string;
    tamanho?: number;
    cor?: string;
}) {
    return (
        <Text
            style={{
                fontSize: tamanho,
                fontWeight: "300",
                color: cor,
                lineHeight: tamanho,
                letterSpacing: -1,
                fontVariant: ["tabular-nums"],
            }}
        >
            {texto}
        </Text>
    );
}

export function EtiquetaEmFoco({ rotulo = "EM FOCO" }: { rotulo?: string }) {
    return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 14 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: HADES.accentSolid }} />
            <Text style={{ fontSize: 12, color: HADES.textMuted, fontWeight: "600", letterSpacing: 1 }}>
                {rotulo}
            </Text>
        </View>
    );
}

export function EtiquetaPublica() {
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 7,
                backgroundColor: "rgba(255,154,0,0.10)",
                borderWidth: 1,
                borderColor: "rgba(255,154,0,0.25)",
                borderRadius: 20,
                paddingVertical: 7,
                paddingHorizontal: 14,
            }}
        >
            <Globe size={14} color={HADES.accentSolid} />
            <Text style={{ fontSize: 12, color: HADES.accentSolid, fontWeight: "600" }}>Sessão pública</Text>
        </View>
    );
}

export function EtiquetaPausado() {
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 7,
                backgroundColor: HADES.surfaceOverlay,
                borderRadius: 20,
                paddingVertical: 7,
                paddingHorizontal: 14,
            }}
        >
            <Pause size={14} color={HADES.textMuted} />
            <Text style={{ fontSize: 12, color: HADES.textMuted, fontWeight: "600", letterSpacing: 0.5 }}>
                PAUSADO
            </Text>
        </View>
    );
}

export function FaixaBlocoCronograma({
    contexto,
    onTrocar,
}: {
    contexto: ContextoBloco;
    onTrocar: () => void;
}) {
    return (
        <View
            style={{
                marginTop: 4,
                marginHorizontal: 16,
                backgroundColor: "rgba(255,154,0,0.10)",
                borderWidth: 1,
                borderColor: "rgba(255,154,0,0.25)",
                borderRadius: 14,
                paddingVertical: 12,
                paddingHorizontal: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 11,
            }}
        >
            <CalendarClock size={18} color={HADES.accentSolid} />
            <View style={{ flex: 1 }}>
                <Text
                    style={{ fontSize: 11, color: HADES.accentSolid, fontWeight: "700", letterSpacing: 0.5 }}
                >
                    BLOCO DO CRONOGRAMA
                </Text>
                <Text style={{ fontSize: 13, color: HADES.text, marginTop: 2 }} numberOfLines={1}>
                    {contexto.materia} — {contexto.topico} · até as {contexto.fimEm}
                </Text>
            </View>
            <TouchableOpacity onPress={onTrocar} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ fontSize: 12, color: HADES.textMuted, fontWeight: "600" }}>Trocar</Text>
            </TouchableOpacity>
        </View>
    );
}

export function FaixaSessaoRestaurada() {
    return (
        <View
            style={{
                marginTop: 4,
                marginHorizontal: 16,
                backgroundColor: "rgba(52,199,89,0.10)",
                borderWidth: 1,
                borderColor: "rgba(52,199,89,0.3)",
                borderRadius: 14,
                paddingVertical: 12,
                paddingHorizontal: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
            }}
        >
            <RotateCcw size={17} color="#34c759" />
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: "#eafff2", fontWeight: "600" }}>Sessão retomada</Text>
                <Text style={{ fontSize: 12, color: "#7fae91", marginTop: 1 }}>
                    Continuou contando enquanto o app esteve fechado
                </Text>
            </View>
        </View>
    );
}

export function PontosDeCiclo({ total, concluidos }: { total: number; concluidos: number }) {
    return (
        <View style={{ flexDirection: "row", gap: 9, marginBottom: 6 }}>
            {Array.from({ length: total }).map((_, i) => (
                <View
                    key={i}
                    style={{
                        width: 9,
                        height: 9,
                        borderRadius: 5,
                        backgroundColor: i < concluidos ? HADES.accentSolid : HADES.trackOff,
                    }}
                />
            ))}
        </View>
    );
}

export function ColegasFocando({
    nomes,
    total,
    onPress,
}: {
    nomes: string[];
    total: number;
    onPress?: () => void;
}) {
    const visiveis = nomes.slice(0, 3);
    const extras = total - visiveis.length;

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={!onPress}
            activeOpacity={0.7}
            style={{
                width: "100%",
                backgroundColor: HADES.surface,
                borderWidth: 1,
                borderColor: HADES.border,
                borderRadius: 16,
                paddingVertical: 14,
                paddingHorizontal: 16,
                marginBottom: 6,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
            }}
        >
            <View style={{ flexDirection: "row" }}>
                {visiveis.map((nome, i) => (
                    <View
                        key={i}
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: CORES_AVATAR[i % CORES_AVATAR.length],
                            alignItems: "center",
                            justifyContent: "center",
                            borderWidth: 2,
                            borderColor: HADES.surface,
                            marginLeft: i === 0 ? 0 : -9,
                        }}
                    >
                        <Text style={{ fontSize: 13, fontWeight: "600", color: "#fff" }}>
                            {nome.charAt(0).toUpperCase()}
                        </Text>
                    </View>
                ))}
                {extras > 0 && (
                    <View
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: HADES.surfaceOverlay,
                            alignItems: "center",
                            justifyContent: "center",
                            borderWidth: 2,
                            borderColor: HADES.surface,
                            marginLeft: -9,
                        }}
                    >
                        <Text style={{ fontSize: 11, fontWeight: "600", color: HADES.textMuted }}>
                            +{extras}
                        </Text>
                    </View>
                )}
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#34c759" }} />
                <Text style={{ fontSize: 12, color: HADES.textMuted }}>{total} focando juntos</Text>
            </View>
        </TouchableOpacity>
    );
}
