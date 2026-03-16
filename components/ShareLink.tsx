import { COLORS } from "@/constants/colors";
import { Check, Copy } from "lucide-react-native";
import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native"

const ShareLink = ({ inviteLink }: { inviteLink: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    // In a real app, use Clipboard.setStringAsync(inviteLink)
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View className="bg-navy-900 border border-navy-800 p-4 rounded-xl mb-6">
      <Text className="text-sm text-slate-400 mb-3">Share invite link</Text>
      <View className="flex-row items-center gap-2">
        <View className="flex-1 bg-navy-800 border border-navy-700 rounded-lg px-3 py-3">
          <Text className="text-slate-200 text-sm" numberOfLines={1}>
            {inviteLink}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleCopy}
          className={`p-3 rounded-lg ${copied ? "bg-emerald-600" : "bg-brand-500"}`}
        >
          {copied ? (
            <Check size={18} color={COLORS.white} />
          ) : (
            <Copy size={18} color={COLORS.white} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default ShareLink