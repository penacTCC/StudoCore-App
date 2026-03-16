import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
    Search,
    FileText,
    Image as ImageIcon,
    ChevronRight,
    FileUp,
    X,
} from "lucide-react-native";
import { COLORS } from "@/constants/colors";
import { mockFiles } from "@/constants/mock-data";

export default function VaultScreen() {
    const [searchQuery, setSearchQuery] = useState("");
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadFileType, setUploadFileType] = useState<"pdf" | "image" | "other">("pdf");
    const [uploadFileName, setUploadFileName] = useState("");

    const filteredFiles = mockFiles.filter((f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <SafeAreaView className="flex-1 bg-slate-950" edges={["top"]}>
            {/* Header */}
            <View className="bg-slate-950 border-b border-slate-800 px-4 py-3">
                <Text className="text-xl font-bold text-slate-200">Vault</Text>
                <Text className="text-sm text-slate-400">Your study materials</Text>
            </View>

            {/* Search */}
            <View className="px-4 py-3">
                <View className="relative">
                    <View className="absolute left-4 top-0 bottom-0 justify-center z-10">
                        <Search size={18} color={COLORS.textMuted} />
                    </View>
                    <TextInput
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Search files..."
                        placeholderTextColor={COLORS.textMuted}
                        className="bg-slate-900 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-slate-200 text-base"
                    />
                </View>
            </View>

            {/* Files */}
            <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
                <View className="gap-3 pb-24">
                    {filteredFiles.map((file) => (
                        <TouchableOpacity
                            key={file.id}
                            className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex-row items-center gap-4"
                        >
                            <View
                                className="w-12 h-12 rounded-xl items-center justify-center"
                                style={{
                                    backgroundColor: file.type === "pdf"
                                        ? "rgba(244, 63, 94, 0.2)"
                                        : "rgba(247, 152, 44, 0.15)",
                                }}
                            >
                                {file.type === "pdf" ? (
                                    <FileText size={24} color={COLORS.rose} />
                                ) : (
                                    <ImageIcon size={24} color={COLORS.violetLight} />
                                )}
                            </View>
                            <View className="flex-1">
                                <Text className="text-sm font-medium text-slate-200" numberOfLines={1}>
                                    {file.name}
                                </Text>
                                <Text className="text-xs text-slate-500">
                                    {file.author} • {file.date} • {file.size}
                                </Text>
                            </View>
                            <ChevronRight size={20} color={COLORS.textMuted} />
                        </TouchableOpacity>
                    ))}

                    {filteredFiles.length === 0 && (
                        <View className="items-center py-8">
                            <Search size={48} color={COLORS.textFaint} />
                            <Text className="text-slate-400 font-medium mt-3">No files found</Text>
                            <Text className="text-sm text-slate-500">Try a different search term</Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* FAB */}
            <TouchableOpacity
                onPress={() => setShowUploadModal(true)}
                className="absolute bottom-24 right-4 w-14 h-14 bg-brand-500 rounded-full items-center justify-center"
                style={{
                    shadowColor: COLORS.primary,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 8,
                }}
            >
                <FileUp size={24} color={COLORS.white} />
            </TouchableOpacity>

            {/* Upload Modal */}
            <Modal visible={showUploadModal} transparent animationType="fade">
                <View className="flex-1 items-center justify-center px-4" style={{ backgroundColor: "rgba(0,0,0,0.8)" }}>
                    <View className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-6">
                        {/* Header */}
                        <View className="flex-row items-center justify-between mb-6">
                            <Text className="text-lg font-semibold text-slate-200">Upload to Vault</Text>
                            <TouchableOpacity onPress={() => setShowUploadModal(false)}>
                                <X size={20} color={COLORS.textMuted} />
                            </TouchableOpacity>
                        </View>

                        {/* Upload Zone */}
                        <View
                            className="rounded-2xl p-8 items-center mb-4"
                            style={{ borderWidth: 2, borderStyle: "dashed", borderColor: COLORS.borderLight }}
                        >
                            <View
                                className="w-16 h-16 rounded-full items-center justify-center mb-4"
                                style={{ backgroundColor: "rgba(247, 152, 44, 0.15)" }}
                            >
                                <FileUp size={28} color={COLORS.primary} />
                            </View>
                            <Text className="text-slate-200 font-medium mb-1">Drop your file here</Text>
                            <Text className="text-sm text-slate-500">or tap to browse</Text>
                            <Text className="text-xs text-slate-600 mt-2">PDF, PNG, JPG up to 10MB</Text>
                        </View>

                        {/* File Type Selector */}
                        <View className="mb-4">
                            <Text className="text-xs text-slate-400 mb-2">File category</Text>
                            <View className="flex-row gap-2">
                                {(["pdf", "image", "other"] as const).map((type) => (
                                    <TouchableOpacity
                                        key={type}
                                        onPress={() => setUploadFileType(type)}
                                        className={`flex-1 py-2 rounded-lg items-center ${uploadFileType === type ? "bg-brand-500" : "bg-slate-800"
                                            }`}
                                    >
                                        <Text
                                            className={`text-sm font-medium ${uploadFileType === type ? "text-white" : "text-slate-400"
                                                }`}
                                        >
                                            {type === "pdf" ? "PDF" : type.charAt(0).toUpperCase() + type.slice(1)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* File Name */}
                        <View className="mb-6">
                            <Text className="text-xs text-slate-400 mb-2">File name (optional)</Text>
                            <TextInput
                                value={uploadFileName}
                                onChangeText={setUploadFileName}
                                placeholder="My study notes..."
                                placeholderTextColor={COLORS.textMuted}
                                className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 text-base"
                            />
                        </View>

                        {/* Upload Button */}
                        <TouchableOpacity
                            onPress={() => setShowUploadModal(false)}
                            className="bg-brand-500 py-4 rounded-2xl flex-row items-center justify-center gap-2"
                        >
                            <FileUp size={20} color={COLORS.white} />
                            <Text className="text-white font-semibold text-lg">Upload File</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
