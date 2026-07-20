import { useState } from "react";

//Componentes do Native
import { View, Text, TextInput, TouchableOpacity, ScrollView, Switch, Alert, DeviceEventEmitter } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Brain } from "lucide-react-native";

//Componentes do expo-router
import { router } from "expo-router";

//Componentes do Projeto
import { HADES } from "@/constants/hades";
import ShareLink from "@/components/ShareLink";
import { ImagePickerAvatar } from "@/components/ui/";

//Serviços
import { buscarUsuarioLogado } from "@/services/auth";
import { inserirGrupo, inserirMembro } from "@/services/grupos";

export default function CreateGroupScreen() {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [isPublic, setIsPublic] = useState(true);
    const [weeklyTarget, setWeeklyTarget] = useState(10);
    const [imageUrl, setImageUrl] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleCreateGroup = async () => {
        if (!name.trim() || !description.trim() || isLoading) return;

        setIsLoading(true);

        try {
            //Busca o usuário logado
            const {
                data: { user },
            } = await buscarUsuarioLogado();

            if (!user) {
                Alert.alert("Erro", "Usuário não autenticado.");
                return;
            }

            //Insere o grupo na tabela grupos
            const { data: novoGrupo, error: erroNovoGrupo } = await inserirGrupo(
                name,
                description,
                isPublic,
                weeklyTarget,
                inviteLink,
                imageUrl || null
            );

            if (erroNovoGrupo) {
                Alert.alert("Erro ao criar grupo", erroNovoGrupo.message);
                return;
            }

            if (!novoGrupo) {
                Alert.alert("Erro ao criar grupo", "O grupo não foi retornado pelo banco de dados.");
                return;
            }

            //Insere o usuário na tabela membros
            const { error: erroNovoMembro } = await inserirMembro(user.id, novoGrupo);

            if (erroNovoMembro) {
                Alert.alert("Erro ao criar membro", erroNovoMembro.message);
                return;
            }

            Alert.alert("Sucesso!", "Grupo criado com sucesso!");
            DeviceEventEmitter.emit("groupMembershipChanged");
            router.replace("/(groups)");
        } catch (error) {
            Alert.alert("Erro ao criar grupo", JSON.stringify(error));
        } finally {
            setIsLoading(false);
        }
    };

    //codigo de convite

    // Adicione isso lá nos seus states
    const [pin] = useState(() => Math.floor(1000 + Math.random() * 9000));

    // E mude a criação do link para usar o PIN fixo
    const cleanName = name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase();

    // O if ternário (cleanName ? ...) evita que o link fique com um hífen solto se o nome estiver vazio
    const inviteLink = `join/${cleanName ? cleanName + "-" : ""}${pin}`;

    const podeCriar = name.trim().length > 0 && description.trim().length > 0 && !isLoading;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top"]}>
            {/* Header */}
            <View
                style={{
                    paddingTop: 6,
                    paddingHorizontal: 20,
                    paddingBottom: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <Text style={{ fontSize: 20, fontWeight: "700", color: HADES.text }}>Criar Grupo</Text>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: HADES.surfaceRaised,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <X size={18} color={HADES.textSecondary} />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Group Image */}
                <ImagePickerAvatar bucket="images" onImageUploaded={(url) => setImageUrl(url)} hades />

                {/* Form Fields */}
                <View style={{ gap: 16, marginBottom: 24 }}>
                    <View>
                        <Text style={estilos.rotulo}>Nome do Grupo</Text>
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder="ex.: Coders da Madrugada"
                            placeholderTextColor={HADES.textFaint}
                            style={estilos.campo}
                        />
                    </View>

                    <View>
                        <Text style={estilos.rotulo}>Descrição</Text>
                        <TextInput
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Sobre o que é esse grupo?"
                            placeholderTextColor={HADES.textFaint}
                            multiline
                            numberOfLines={3}
                            textAlignVertical="top"
                            style={[estilos.campo, { minHeight: 88 }]}
                        />
                    </View>
                </View>

                {/* Settings */}
                <View
                    style={{
                        backgroundColor: HADES.surface,
                        borderWidth: 1,
                        borderColor: HADES.border,
                        borderRadius: 20,
                        padding: 16,
                        marginBottom: 24,
                    }}
                >
                    <Text style={{ fontSize: 14, fontWeight: "500", color: HADES.textMuted, marginBottom: 16 }}>
                        Configurações
                    </Text>

                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                        <View style={{ flex: 1, paddingRight: 16 }}>
                            <Text style={{ fontSize: 15, fontWeight: "500", color: HADES.text }}>Grupo Público</Text>
                            <Text style={{ fontSize: 12, color: HADES.textDim, marginTop: 2 }}>
                                {isPublic
                                    ? "Qualquer pessoa pode encontrar e entrar"
                                    : "Apenas membros convidados podem entrar"}
                            </Text>
                        </View>
                        <Switch
                            value={isPublic}
                            onValueChange={setIsPublic}
                            trackColor={{ false: HADES.settingsSwitchOff, true: HADES.accentSolid }}
                            thumbColor="#ffffff"
                        />
                    </View>

                    <View style={{ borderTopWidth: 1, borderTopColor: HADES.border, paddingTop: 16 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                            <Text style={{ fontSize: 15, fontWeight: "500", color: HADES.text }}>Meta Semanal</Text>
                            <Text style={{ fontSize: 14, fontWeight: "700", color: HADES.accentSolid }}>{weeklyTarget}h</Text>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Text style={{ fontSize: 12, color: HADES.textDim, width: 28 }}>1h</Text>
                            <View style={{ flex: 1, flexDirection: "row", gap: 4, height: 8 }}>
                                {[...Array(20)].map((_, i) => (
                                    <TouchableOpacity
                                        key={i}
                                        onPress={() => setWeeklyTarget((i + 1) * 2)}
                                        style={{
                                            flex: 1,
                                            height: "100%",
                                            borderRadius: 999,
                                            backgroundColor: (i + 1) * 2 <= weeklyTarget ? HADES.accentSolid : HADES.surfaceOverlay,
                                        }}
                                    />
                                ))}
                            </View>
                            <Text style={{ fontSize: 12, color: HADES.textDim, width: 28, textAlign: "right" }}>40h</Text>
                        </View>

                        {/* Banner explicativo */}
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "flex-start",
                                gap: 10,
                                backgroundColor: HADES.groupVioletTint,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: "rgba(124,92,252,0.28)",
                                paddingHorizontal: 14,
                                paddingVertical: 12,
                                marginTop: 12,
                            }}
                        >
                            <Brain size={16} color={HADES.groupViolet} style={{ marginTop: 1 }} />
                            <Text style={{ flex: 1, fontSize: 12.5, color: HADES.textSecondary, lineHeight: 18 }}>
                                <Text style={{ fontWeight: "700", color: HADES.groupViolet }}>
                                    Como funciona a meta semanal?{"\n"}
                                </Text>
                                A meta semanal é a quantidade de horas que cada membro do seu grupo deverá estudar. A meta
                                total do grupo inteiro é a multiplicação da meta semanal pelo número de membros.
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Invite Link Section */}
                <ShareLink inviteLink={inviteLink} />
            </ScrollView>

            {/* Bottom Button */}
            <View style={{ paddingHorizontal: 20, paddingBottom: 24, paddingTop: 8, borderTopWidth: 1, borderTopColor: HADES.border }}>
                <TouchableOpacity
                    disabled={!podeCriar}
                    onPress={handleCreateGroup}
                    activeOpacity={0.85}
                    style={{
                        height: 54,
                        borderRadius: 15,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 9,
                        backgroundColor: podeCriar ? HADES.accentSolid : HADES.surfaceOverlay,
                    }}
                >
                    <Text style={{ fontWeight: "700", fontSize: 16, color: podeCriar ? "#000" : HADES.textFaint }}>
                        {isLoading ? "Criando..." : "Criar Grupo"}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const estilos = {
    rotulo: {
        fontSize: 14,
        fontWeight: "500" as const,
        color: HADES.textMuted,
        marginBottom: 8,
    },
    campo: {
        backgroundColor: HADES.surfaceRaised,
        borderWidth: 1,
        borderColor: HADES.border,
        borderRadius: 13,
        paddingHorizontal: 16,
        paddingVertical: 13,
        color: HADES.text,
        fontSize: 15,
    },
};
