import { View, Text, ActivityIndicator, TouchableOpacity, Image } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { FileUp, FileText, Image as ImageIcon } from "lucide-react-native";
import { COLORS } from "@/constants/colors";

interface SelectedFileInfo {
    uri: string;
    name: string;
    mimeType: string;
    size: number; // Tamanho em bytes
}

interface DocumentPickerVaultProps {

    category?: string; /** Tipo de arquivo esperado ("pdf" | "image" | "all") */

    onFileSelected: (file: SelectedFileInfo) => void; /** Chamado quando um arquivo é selecionado para enviar os dados ao pai */

    selectedFile: SelectedFileInfo | null; /** Arquivo que está selecionado no momento para exibição na zona de upload */

    isUploading?: boolean; /** Status de carregamento vindo do componente pai */
}

/**
 * Componente que renderiza a zona de seleção (Dashed Box).
 * Ele apenas abre o seletor de arquivos e retorna os dados para o componente pai.
 */
export default function DocumentPickerVault({
    category = "image", // Valor padrão caso não seja informado
    onFileSelected,
    selectedFile,
    isUploading = false,
}: DocumentPickerVaultProps) {

    /**  Função que abre o seletor de documentos do celular*/
    const selectFile = async () => {
        try {
            // 1. Define quais tipos de arquivos podem ser selecionados
            const allowedTypes = category === "pdf" ? ["application/pdf"] :
                category === "image" ? ["image/*"] : ["*/*"];

            // 2. Abre a interface do sistema para escolher o arquivo
            const result = await DocumentPicker.getDocumentAsync({
                type: allowedTypes,
                copyToCacheDirectory: true, // Garante acesso ao arquivo via URI local
            });

            // Se o usuário fechar a tela sem escolher nada, interrompe o processo
            if (result.canceled) return;

            // 3. Pega o primeiro arquivo selecionado e avisa o pai (vault.tsx)
            const file = result.assets[0];
            onFileSelected({
                uri: file.uri,
                name: file.name,
                mimeType: file.mimeType || "application/octet-stream",
                size: file.size || 0, // Pega o tamanho real em bytes
            });

        } catch (error: any) {
            console.error("Erro ao selecionar arquivo:", error);
        }
    };

    return (
        <TouchableOpacity
            onPress={selectFile}
            disabled={isUploading}
            className="rounded-2xl p-8 items-center mb-4 border-2 border-dashed border-slate-700 bg-slate-900/50"
        >
            {isUploading ? (
                // Exibe carregamento enquanto o upload para o Supabase está em curso
                <View className="items-center py-4">
                    <ActivityIndicator color={COLORS.primary} size="large" />
                    <Text className="text-slate-400 mt-2">Enviando arquivo...</Text>
                </View>
            ) : selectedFile ? (
                // Exibe informações do arquivo após ele ser selecionado
                <View className="items-center">
                    {/* Verifica se o arquivo selecionado é uma imagem para exibir o preview */}
                    {selectedFile.mimeType.startsWith("image/") ? (
                        <Image 
                            source={{ uri: selectedFile.uri }} 
                            className="w-32 h-32 rounded-xl mb-4" 
                            resizeMode="cover" 
                        />
                    ) : (
                        // Caso não seja imagem (ex: PDF ou outros), renderiza apenas o ícone
                        <View
                            className="w-16 h-16 rounded-full items-center justify-center mb-4"
                            style={{ backgroundColor: "rgba(247, 152, 44, 0.15)" }}
                        >
                            {selectedFile.mimeType.includes("pdf") ? (
                                <FileText size={28} color={COLORS.primary} />
                            ) : (
                                <ImageIcon size={28} color={COLORS.primary} />
                            )}
                        </View>
                    )}
                    <Text className="text-slate-200 font-medium text-center" numberOfLines={1}>
                        {selectedFile.name}
                    </Text>
                    <Text className="text-xs text-slate-500 mt-1">
                        Arquivo selecionado • Toque para trocar
                    </Text>
                </View>
            ) : (
                // Estado inicial: convite para selecionar um arquivo
                <>
                    <View
                        className="w-16 h-16 rounded-full items-center justify-center mb-4"
                        style={{ backgroundColor: "rgba(247, 152, 44, 0.15)" }}
                    >
                        <FileUp size={28} color={COLORS.primary} />
                    </View>
                    <Text className="text-slate-200 font-medium mb-1 text-center">Selecionar arquivo</Text>
                    <Text className="text-sm text-slate-500 text-center">ou toque para navegar</Text>
                    <Text className="text-xs text-slate-600 mt-2">
                        {category === "pdf" ? "Somente PDF" : category === "image" ? "Imagens" : "Qualquer arquivo"} até 10MB
                    </Text>
                </>
            )}
        </TouchableOpacity>
    );
}
