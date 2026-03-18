import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Switch, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Plus, Brain } from "lucide-react-native";
import { router } from "expo-router";
import { COLORS } from "@/constants/colors";
import ShareLink from "@/components/ShareLink";
import { supabase } from "../supabase";
import ImagePickerAvatar from "@/components/ui/ImagePickerAvatar";

export default function CreateGroupScreen() {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [isPublic, setIsPublic] = useState(true);
    const [weeklyTarget, setWeeklyTarget] = useState(10);
    const [imageUrl, setImageUrl] = useState("");
    const [isLoading, setIsLoading] = useState(false);



    const handleCreateGroup = async () => {
        try {
            if (!name.trim() || !description.trim() || isLoading) return;

            const { data: { user } } = await supabase.auth.getUser();

            const { data: NewGroup, error: NewGroupError } = await supabase
                .from('grupos')
                .upsert({ //upsert é uma função que insere ou atualiza um registro
                    nome_grupo: name.trim(),
                    descricao: description.trim(),
                    publico: isPublic,
                    meta_horas: weeklyTarget,
                    codigo_convite: inviteLink,
                    foto_grupo: imageUrl,
                })
                .select()
                .single()//retorna apenas um registro, nesse caso, o id do grupo, utilizado na tabela membros

            if (NewGroupError) {
                Alert.alert('Erro ao criar grupo', NewGroupError.message);
            }

            const { data: NewMember, error: MemberError } = await supabase
                .from('membros')
                .upsert({
                    user_id: user?.id,
                    grupo_id: NewGroup.id,
                    administrador: true
                })
                .select()
                .single()

            if (MemberError) {
                Alert.alert('Erro ao criar membro', MemberError.message);
            }

            console.log(NewMember)
            Alert.alert('Sucesso!', 'Grupo criado com sucesso!');
            router.push("/(tabs)");

        } catch (error) {
            Alert.alert('Erro ao criar grupo', JSON.stringify(error));
        }

    };

    //codigo de convite

    // Adicione isso lá nos seus states
    const [pin] = useState(() => Math.floor(1000 + Math.random() * 9000));

    // E mude a criação do link para usar o PIN fixo
    const cleanName = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    // O if ternário (cleanName ? ...) evita que o link fique com um hífen solto se o nome estiver vazio
    const inviteLink = `studocore://join/${cleanName ? cleanName + '-' : ''}${pin}`;

    return (
        <SafeAreaView className="flex-1 bg-navy-950" edges={["top"]}>
            {/* Header */}
            <View className="px-4 py-3 flex-row items-center justify-between border-b border-navy-800">
                <Text className="text-xl font-bold text-slate-200">Create Group</Text>
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center"
                >
                    <X size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
                {/* Group Image */}
                <ImagePickerAvatar
                    bucket="images"
                    onImageUploaded={(url) => setImageUrl(url)}
                />

                {/* Form Fields */}
                <View className="gap-4 mb-6">
                    <View>
                        <Text className="text-sm font-medium text-slate-400 mb-2">Group Name</Text>
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder="e.g., Late Night Coders"
                            placeholderTextColor={COLORS.textMuted}
                            className="bg-navy-900 border border-navy-800 rounded-xl px-4 py-3 text-slate-200 text-base"
                        />
                    </View>

                    <View>
                        <Text className="text-sm font-medium text-slate-400 mb-2">Description</Text>
                        <TextInput
                            value={description}
                            onChangeText={setDescription}
                            placeholder="What's this group about?"
                            placeholderTextColor={COLORS.textMuted}
                            multiline
                            numberOfLines={3}
                            textAlignVertical="top"
                            className="bg-navy-900 border border-navy-800 rounded-xl px-4 py-3 text-slate-200 text-base"
                        />
                    </View>
                </View>

                {/* Settings */}
                <View className="bg-navy-900 border border-navy-800 rounded-3xl p-4 mb-6">
                    <Text className="text-sm font-medium text-slate-400 mb-4">Settings</Text>

                    <View className="flex-row items-center justify-between mb-4">
                        <View className="flex-1 pr-4">
                            <Text className="text-base font-medium text-slate-200">Public Group</Text>
                            <Text className="text-xs text-slate-500 mt-1">
                                {isPublic ? "Anyone can find and join" : "Only invited members can join"}
                            </Text>
                        </View>
                        <Switch
                            value={isPublic}
                            onValueChange={setIsPublic}
                            trackColor={{ false: COLORS.bgQuaternary, true: COLORS.primary }}
                            thumbColor={COLORS.white}
                        />
                    </View>

                    <View className="border-t border-navy-800 pt-4">
                        <View className="flex-row items-center justify-between mb-2">
                            <Text className="text-base font-medium text-slate-200">Weekly Target</Text>
                            <Text className="text-sm font-bold text-brand-500">{weeklyTarget}h</Text>
                        </View>
                        <View className="flex-row items-center gap-2 mt-2">
                            <Text className="text-xs text-slate-500 w-8">1h</Text>
                            <View className="flex-1 flex-row gap-1 h-2">
                                {[...Array(20)].map((_, i) => (
                                    <TouchableOpacity
                                        key={i}
                                        onPress={() => setWeeklyTarget((i + 1) * 2)}
                                        className="h-full flex-1 rounded-full"
                                        style={{ backgroundColor: (i + 1) * 2 <= weeklyTarget ? COLORS.primary : COLORS.bgQuaternary }}
                                    />
                                ))}
                            </View>
                            <Text className="text-xs text-slate-500 w-8 text-right">40h</Text>
                        </View>
                        {/* AI Age info banner */}
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "flex-start",
                                gap: 10,
                                backgroundColor: COLORS.violet + "18",
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: COLORS.violet + "35",
                                paddingHorizontal: 14,
                                paddingVertical: 12,
                                marginTop: 10,
                            }}
                        >
                            <Brain size={16} color={COLORS.violet} style={{ marginTop: 1 }} />
                            <Text
                                style={{
                                    flex: 1,
                                    fontSize: 12.5,
                                    color: "rgba(167, 139, 250, 0.85)",
                                    lineHeight: 18,
                                }}
                            >
                                <Text style={{ fontWeight: "700", color: COLORS.violetLight }}>
                                    Como funciona a meta semanal?{"\n"}
                                </Text>
                                A meta semanal é a quantidade de horas que cada membro do seu grupo deverá estudar.
                                A meta total do grupo inteiro é a multiplicação da meta semanal pelo número de membros.
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Invite Link Section */}
                <ShareLink inviteLink={inviteLink} />

            </ScrollView>

            {/* Bottom Button */}
            <View className="px-4 pb-6 pt-2 border-t border-navy-800" style={{ backgroundColor: COLORS.bgPrimary }}>
                <TouchableOpacity
                    disabled={!name.trim() || !description.trim() || isLoading}
                    onPress={handleCreateGroup}
                    className={`py-4 rounded-2xl flex-row items-center justify-center gap-2 ${name.trim() && description.trim() && !isLoading ? "bg-brand-500" : "bg-navy-800"
                        }`}
                >
                    <Plus size={20} color={name.trim() && description.trim() && !isLoading ? COLORS.white : COLORS.textMuted} />
                    <Text className={`font-semibold text-lg ${name.trim() && description.trim() && !isLoading ? "text-white" : "text-slate-500"}`}>
                        {isLoading ? "Creating..." : "Create Group"}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
