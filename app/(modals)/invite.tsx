import { useEffect, useState } from "react";

//Componentes do react native
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { Ionicons } from "@expo/vector-icons";


//Componentes do expo router
import { router, useLocalSearchParams } from "expo-router";
import * as Linking from 'expo-linking';

//Constantes
import { COLORS } from "@/constants/colors";

//Componentes do projeto
import ShareLink from "@/components/ShareLink";
import { insereCodigoConvite } from "@/services/groups";

//Mock
const mockPendingInvites = [
    { id: 1, email: "sarah.j@university.edu" },
    { id: 2, email: "mike.chen@student.io" },
];

export default function InviteScreen() {
    const [zapNumber, setZapNumber] = useState("");

    const { groupId, groupName } = useLocalSearchParams();

    //Nome do grupo tudo em minúsculo, sem espaços e sem caracteres especiais, depois os 6 primeiros números do id do grupo

    //Esse link será utilizado quando estivermos na cloud, pois o supabase não consegue criar links profundos localmente
    // const inviteLink = `https://studocore.app/${groupName?.toString().toLowerCase().replace(/\s/g, "")}-${groupId?.toString().replace(/\D/g, "").slice(0, 6)}`;

    //Link provisório para testes
    const inviteLink = Linking.createURL(`group-details?groupId=${groupId}`);

    //Insere o código de convite na tabela grupos
    useEffect(() => {
        insereCodigoConvite(groupId as string, inviteLink);
    }, []);

    //Formata o número de telefone
    const formatPhoneNumber = (value: string) => {
        // Remove todos os caracteres não numéricos
        const cleaned = value.replace(/\D/g, '');
        return cleaned;
    };

    const handleSendInvite = () => {
        if (zapNumber.trim().length === 11) {
            const phoneNumber = formatPhoneNumber(zapNumber);
            const url = `https://wa.me/55${phoneNumber}?text=Venha estudar comigo no *StudoCore*! \n\n${inviteLink}`;
            Linking.openURL(url);
        } else {
            Alert.alert("Número de telefone inválido");
        }
    }

    return (
        <SafeAreaView className="flex-1 bg-navy-950" edges={["top"]}>
            {/* Header */}
            <View className="px-4 py-3 flex-row items-center justify-between border-b border-navy-800">
                <Text className="text-xl font-bold text-slate-200">Convites</Text>
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center"
                >
                    <X size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>

                {/* Invite Link Section */}
                <ShareLink inviteLink={inviteLink} />

                {/* Email Invite Section */}
                <View className="mb-6">
                    <Text className="text-sm text-slate-400 mb-3">Or invite by whatsapp</Text>
                    <View className="flex-row items-center gap-2">
                        <TextInput
                            value={zapNumber}
                            onChangeText={(value) => setZapNumber(formatPhoneNumber(value))}
                            maxLength={11}
                            placeholder="(15) 99123-4567"
                            placeholderTextColor={COLORS.textMuted}
                            autoCapitalize="none"
                            keyboardType="phone-pad"
                            className="flex-1 bg-navy-900 border border-navy-800 rounded-xl px-4 py-3 text-slate-200 text-base"
                        />
                        <TouchableOpacity
                            onPress={handleSendInvite}
                            className={`px-4 py-3 rounded-xl ${zapNumber.trim() ? "bg-brand-500" : "bg-navy-800"}`}
                        >
                            <Ionicons name="logo-whatsapp" size={18} color={zapNumber.trim() ? COLORS.white : COLORS.textMuted} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Pending Invites */}
                <View className="border-t border-navy-800 pt-6">
                    <Text className="text-sm font-medium text-slate-400 mb-4">Pending invitations</Text>
                    <View className="gap-2">
                        {mockPendingInvites.map((invite) => (
                            <View
                                key={invite.id}
                                className="flex-row items-center justify-between bg-navy-900 border border-navy-800 p-4 rounded-xl"
                            >
                                <Text className="text-sm text-slate-300">{invite.email}</Text>
                                <Text className="text-xs font-medium text-amber-400">Pending</Text>
                            </View>
                        ))}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
