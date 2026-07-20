import { View, Text, TextInput, TouchableOpacity } from "react-native";

//Componentes do react native
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Link as LinkIcon } from "lucide-react-native";

//Componentes do expo router
import { router } from "expo-router";

//Constantes
import { HADES } from "@/constants/hades";

//Componentes do projeto
import { useState } from "react";

export default function JoinByCodeScreen() {
    const [code, setCode] = useState("");
    const ativo = code.trim().length > 0;

    const handleJoin = () => {
        // Implement join logic here
        // For now, we will just go back
        if (code.trim()) {
            router.push(`/(groups)/group-details?groupId=${code.split("=")[1]}`);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top"]}>
            <View
                style={{
                    paddingTop: 6,
                    paddingHorizontal: 20,
                    paddingBottom: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                }}
            >
                <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <ArrowLeft size={22} color={HADES.textSecondary} />
                </TouchableOpacity>
                <Text style={{ fontSize: 20, fontWeight: "700", color: HADES.text }}>Entrar com Código</Text>
            </View>

            <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 40 }}>
                <View style={{ alignItems: "center", marginBottom: 32 }}>
                    <View
                        style={{
                            width: 64,
                            height: 64,
                            borderRadius: 32,
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: 16,
                            backgroundColor: HADES.accentTint,
                            borderWidth: 1,
                            borderColor: HADES.accentTintBorder,
                        }}
                    >
                        <LinkIcon size={28} color={HADES.accentSolid} />
                    </View>
                    <Text style={{ fontSize: 22, fontWeight: "700", color: HADES.text, textAlign: "center", marginBottom: 8 }}>
                        Possui um código ou link?
                    </Text>
                    <Text style={{ fontSize: 15, color: HADES.textMuted, textAlign: "center" }}>
                        Insira abaixo para entrar em um grupo privado.
                    </Text>
                </View>

                <View style={{ marginBottom: 24 }}>
                    <Text style={{ fontSize: 14, fontWeight: "500", color: HADES.textSecondary, marginBottom: 8, marginLeft: 4 }}>
                        Código do Grupo ou Link
                    </Text>
                    <TextInput
                        value={code}
                        onChangeText={setCode}
                        placeholder="Ex: abc-defg-hij ou https://..."
                        placeholderTextColor={HADES.textFaint}
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={{
                            backgroundColor: HADES.surfaceRaised,
                            borderWidth: 1,
                            borderColor: HADES.border,
                            borderRadius: 13,
                            paddingHorizontal: 16,
                            paddingVertical: 15,
                            color: HADES.text,
                            fontSize: 15,
                        }}
                    />
                </View>

                <TouchableOpacity
                    onPress={handleJoin}
                    disabled={!ativo}
                    activeOpacity={0.85}
                    style={{
                        height: 54,
                        borderRadius: 15,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: ativo ? HADES.accentSolid : HADES.surfaceOverlay,
                    }}
                >
                    <Text style={{ fontSize: 16, fontWeight: "700", color: ativo ? "#000" : HADES.textFaint }}>
                        Entrar no Grupo
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
