import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { GripVertical, Coffee, AlertTriangle, Plus } from "lucide-react-native";
import { HADES, CORES_PLANO } from "@/constants/hades";
import { blocosDoEditor } from "@/constants/cronograma-mock";

function formatarDuracao(min: number) {
    if (min < 60) return `${min}m`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, "0")}`;
}

export default function PlanoEditorScreen() {
    const router = useRouter();
    const { planoId } = useLocalSearchParams<{ planoId?: string }>();

    const [nome, setNome] = useState(planoId ? "Reta final ENEM" : "");
    const [cor, setCor] = useState<string>(CORES_PLANO[0]);
    // Sem backend ainda: blocos vêm do mock e as ações são só de UI.
    const [blocos, setBlocos] = useState(blocosDoEditor);

    const alternarNotificacao = (id: string) =>
        setBlocos((atual) =>
            atual.map((b) => (b.id === id ? { ...b, notificar: !b.notificar } : b))
        );

    const minutosEstudo = blocos
        .filter((b) => b.tipo === "estudo")
        .reduce((total, b) => total + b.duracaoMin, 0);
    const minutosDescanso = blocos
        .filter((b) => b.tipo === "descanso")
        .reduce((total, b) => total + b.duracaoMin, 0);

    return (
        <View style={{ flex: 1, backgroundColor: HADES.surface }}>
            <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
                {/* Alça */}
                <View style={{ paddingTop: 12, paddingBottom: 4, alignItems: "center" }}>
                    <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: HADES.dot }} />
                </View>

                {/* Cabeçalho */}
                <View
                    style={{
                        paddingTop: 8,
                        paddingBottom: 14,
                        paddingHorizontal: 20,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}
                >
                    <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Text style={{ fontSize: 14, color: HADES.textMuted }}>Cancelar</Text>
                    </TouchableOpacity>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: HADES.text }}>
                        {planoId ? "Editar plano" : "Novo plano"}
                    </Text>
                    <View style={{ width: 56 }} />
                </View>

                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Nome + cor */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 }}>
                        <View
                            style={{
                                flex: 1,
                                backgroundColor: HADES.bg,
                                borderWidth: 1,
                                borderColor: HADES.borderStrong,
                                borderRadius: 12,
                                padding: 14,
                            }}
                        >
                            <TextInput
                                value={nome}
                                onChangeText={setNome}
                                placeholder="Nome do plano"
                                placeholderTextColor={HADES.textFaint}
                                style={{
                                    padding: 0,
                                    color: HADES.text,
                                    fontSize: 15,
                                    fontWeight: "600",
                                }}
                            />
                        </View>

                        <View style={{ flexDirection: "row", gap: 7 }}>
                            {CORES_PLANO.slice(0, 3).map((c) => (
                                <TouchableOpacity
                                    key={c}
                                    onPress={() => setCor(c)}
                                    style={{
                                        width: 26,
                                        height: 26,
                                        borderRadius: 13,
                                        backgroundColor: c,
                                        borderWidth: cor === c ? 2.5 : 0,
                                        borderColor: HADES.text,
                                    }}
                                />
                            ))}
                        </View>
                    </View>

                    <Text
                        style={{
                            fontSize: 12,
                            color: HADES.textFaint,
                            fontWeight: "600",
                            letterSpacing: 0.5,
                            marginBottom: 12,
                        }}
                    >
                        BLOCOS
                    </Text>

                    <View style={{ gap: 10 }}>
                        {blocos.map((bloco) =>
                            bloco.tipo === "descanso" ? (
                                <View
                                    key={bloco.id}
                                    style={{
                                        borderWidth: 1,
                                        borderStyle: "dashed",
                                        borderColor: HADES.borderDashed,
                                        borderRadius: 13,
                                        padding: 12,
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 11,
                                    }}
                                >
                                    <GripVertical size={16} color={HADES.grip} />
                                    <Coffee size={16} color={HADES.textMuted} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 14, fontWeight: "600", color: HADES.textSecondary }}>
                                            Descanso
                                        </Text>
                                        <Text style={{ fontSize: 12, color: HADES.textFaint, marginTop: 1 }}>
                                            {bloco.horaInicio} · {formatarDuracao(bloco.duracaoMin)}
                                        </Text>
                                    </View>
                                </View>
                            ) : (
                                <View
                                    key={bloco.id}
                                    style={{
                                        backgroundColor: HADES.bg,
                                        borderWidth: 1,
                                        borderColor: bloco.sobrepoeMin ? HADES.amberBorder : "rgba(255,255,255,0.08)",
                                        borderRadius: 13,
                                        paddingTop: 13,
                                        paddingBottom: bloco.sobrepoeMin ? 11 : 13,
                                        paddingHorizontal: 12,
                                    }}
                                >
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
                                        <GripVertical size={16} color={HADES.grip} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 14, fontWeight: "600", color: HADES.text }}>
                                                {bloco.materia}
                                            </Text>
                                            <Text style={{ fontSize: 12, color: HADES.textFaint, marginTop: 1 }}>
                                                {bloco.topico} · {bloco.horaInicio} · {formatarDuracao(bloco.duracaoMin)}
                                            </Text>
                                        </View>
                                        <Interruptor
                                            ligado={bloco.notificar}
                                            onPress={() => alternarNotificacao(bloco.id)}
                                        />
                                    </View>

                                    {bloco.sobrepoeMin !== undefined && (
                                        <View
                                            style={{
                                                flexDirection: "row",
                                                alignItems: "center",
                                                gap: 7,
                                                marginTop: 10,
                                                backgroundColor: HADES.amberTint,
                                                borderRadius: 8,
                                                paddingVertical: 7,
                                                paddingHorizontal: 10,
                                            }}
                                        >
                                            <AlertTriangle size={13} color={HADES.amber} />
                                            <Text style={{ fontSize: 12, color: HADES.amber, fontWeight: "500" }}>
                                                Sobrepõe o bloco anterior em {bloco.sobrepoeMin} min
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            )
                        )}
                    </View>

                    {/* Adicionar */}
                    <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                        <BotaoAdicionar Icone={Plus} rotulo="Bloco" corIcone={HADES.accent} corTexto={HADES.text} />
                        <BotaoAdicionar
                            Icone={Coffee}
                            rotulo="Descanso"
                            corIcone={HADES.textMuted}
                            corTexto={HADES.textSecondary}
                        />
                    </View>
                </ScrollView>

                {/* Rodapé */}
                <View
                    style={{
                        paddingTop: 12,
                        paddingBottom: 12,
                        paddingHorizontal: 20,
                        borderTopWidth: 1,
                        borderTopColor: "rgba(255,255,255,0.07)",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 14,
                    }}
                >
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, color: HADES.text, fontWeight: "600" }}>
                            {formatarDuracao(minutosEstudo)} de estudo
                        </Text>
                        <Text style={{ fontSize: 12, color: HADES.textFaint, marginTop: 1 }}>
                            {formatarDuracao(minutosDescanso)} de descanso
                        </Text>
                    </View>

                    <TouchableOpacity
                        onPress={() => router.back()}
                        activeOpacity={0.85}
                        style={{
                            height: 48,
                            paddingHorizontal: 28,
                            borderRadius: 13,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: HADES.accentSolid,
                        }}
                    >
                        <Text style={{ fontSize: 15, fontWeight: "700", color: "#000" }}>Salvar</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
}

function Interruptor({ ligado, onPress }: { ligado: boolean; onPress: () => void }) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
                width: 44,
                height: 27,
                borderRadius: 14,
                backgroundColor: ligado ? HADES.accentSolid : HADES.trackOff,
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
                    backgroundColor: ligado ? "#fff" : HADES.textMuted,
                }}
            />
        </TouchableOpacity>
    );
}

function BotaoAdicionar({
    Icone,
    rotulo,
    corIcone,
    corTexto,
}: {
    Icone: typeof Plus;
    rotulo: string;
    corIcone: string;
    corTexto: string;
}) {
    return (
        <TouchableOpacity
            activeOpacity={0.8}
            style={{
                flex: 1,
                height: 46,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.10)",
                backgroundColor: HADES.bg,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
            }}
        >
            <Icone size={16} color={corIcone} />
            <Text style={{ fontSize: 14, fontWeight: "600", color: corTexto }}>{rotulo}</Text>
        </TouchableOpacity>
    );
}
