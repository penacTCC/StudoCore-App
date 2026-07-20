import { HADES } from "@/constants/hades";
import { Check, Copy } from "lucide-react-native";
import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import * as Clipboard from "expo-clipboard";

const ShareLink = ({ inviteLink }: { inviteLink: string }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        Clipboard.setStringAsync(inviteLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <View
            style={{
                backgroundColor: HADES.surface,
                borderWidth: 1,
                borderColor: HADES.border,
                padding: 14,
                borderRadius: 16,
                marginBottom: 20,
            }}
        >
            <Text style={{ fontSize: 13, color: HADES.textMuted, marginBottom: 10 }}>
                Compartilhar link de convite
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View
                    style={{
                        flex: 1,
                        backgroundColor: HADES.surfaceOverlay,
                        borderWidth: 1,
                        borderColor: HADES.border,
                        borderRadius: 11,
                        paddingHorizontal: 12,
                        paddingVertical: 12,
                    }}
                >
                    <Text style={{ color: HADES.textSecondary, fontSize: 13 }} numberOfLines={1}>
                        {inviteLink}
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={handleCopy}
                    activeOpacity={0.85}
                    style={{ padding: 12, borderRadius: 11, backgroundColor: copied ? HADES.green : HADES.accentSolid }}
                >
                    {copied ? <Check size={18} color="#000" /> : <Copy size={18} color="#000" />}
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default ShareLink;
