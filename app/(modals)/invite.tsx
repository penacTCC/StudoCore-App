import { useState } from "react";

//Componentes do react native
import { View, Text, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Send } from "lucide-react-native";

//Componentes do expo router
import { router } from "expo-router";

//Constantes
import { COLORS } from "@/constants/colors";

//Componentes do projeto
import ShareLink from "@/components/ShareLink";

//Mock
const mockPendingInvites = [
    { id: 1, email: "sarah.j@university.edu" },
    { id: 2, email: "mike.chen@student.io" },
];

export default function InviteScreen() {
    const [inviteEmail, setInviteEmail] = useState("");

    return (
        <SafeAreaView className="flex-1 bg-navy-950" edges={["top"]}>
            {/* Header */}
            <View className="px-4 py-3 flex-row items-center justify-between border-b border-navy-800">
                <Text className="text-xl font-bold text-slate-200">Invite Members</Text>
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center"
                >
                    <X size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>

                {/* Invite Link Section */}
                <ShareLink inviteLink="https://studocore.app/join/abc123" />

                {/* Email Invite Section */}
                <View className="mb-6">
                    <Text className="text-sm text-slate-400 mb-3">Or invite by email</Text>
                    <View className="flex-row items-center gap-2">
                        <TextInput
                            value={inviteEmail}
                            onChangeText={setInviteEmail}
                            placeholder="friend@email.com"
                            placeholderTextColor={COLORS.textMuted}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            className="flex-1 bg-navy-900 border border-navy-800 rounded-xl px-4 py-3 text-slate-200 text-base"
                        />
                        <TouchableOpacity
                            className={`px-4 py-3 rounded-xl ${inviteEmail.trim() ? "bg-brand-500" : "bg-navy-800"}`}
                        >
                            <Send size={18} color={inviteEmail.trim() ? COLORS.white : COLORS.textMuted} />
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
