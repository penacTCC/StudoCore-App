import { View, Text, ActivityIndicator, TouchableOpacity, Image } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { FileUp, FileText, Image as ImageIcon } from "lucide-react-native";
import { HADES } from "@/constants/hades";

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
 * Componente que renderiza a zona de seleção (Dashed Box), no visual HADES.
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
            const allowedTypes =
                category === "pdf" ? ["application/pdf"] : category === "image" ? ["image/*"] : ["*/*"];

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
            activeOpacity={0.8}
            style={{
                borderRadius: 16,
                padding: 28,
                alignItems: "center",
                marginBottom: 16,
                borderWidth: 2,
                borderStyle: "dashed",
                borderColor: HADES.borderDashed,
                backgroundColor: HADES.surface,
            }}
        >
            {isUploading ? (
                // Exibe carregamento enquanto o upload para o Supabase está em curso
                <View style={{ alignItems: "center", paddingVertical: 16 }}>
                    <ActivityIndicator color={HADES.accentSolid} size="large" />
                    <Text style={{ color: HADES.textMuted, marginTop: 8 }}>Enviando arquivo...</Text>
                </View>
            ) : selectedFile ? (
                // Exibe informações do arquivo após ele ser selecionado
                <View style={{ alignItems: "center" }}>
                    {/* Verifica se o arquivo selecionado é uma imagem para exibir o preview */}
                    {selectedFile.mimeType.startsWith("image/") ? (
                        <Image
                            source={{ uri: selectedFile.uri }}
                            style={{ width: 128, height: 128, borderRadius: 14, marginBottom: 16 }}
                            resizeMode="cover"
                        />
                    ) : (
                        // Caso não seja imagem (ex: PDF ou outros), renderiza apenas o ícone
                        <View
                            style={{
                                width: 64,
                                height: 64,
                                borderRadius: 32,
                                alignItems: "center",
                                justifyContent: "center",
                                marginBottom: 16,
                                backgroundColor: HADES.accentTint,
                            }}
                        >
                            {selectedFile.mimeType.includes("pdf") ? (
                                <FileText size={28} color={HADES.accentSolid} />
                            ) : (
                                <ImageIcon size={28} color={HADES.accentSolid} />
                            )}
                        </View>
                    )}
                    <Text style={{ color: HADES.text, fontWeight: "500", textAlign: "center" }} numberOfLines={1}>
                        {selectedFile.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: HADES.textDim, marginTop: 4 }}>
                        Arquivo selecionado • Toque para trocar
                    </Text>
                </View>
            ) : (
                // Estado inicial: convite para selecionar um arquivo
                <>
                    <View
                        style={{
                            width: 64,
                            height: 64,
                            borderRadius: 32,
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: 16,
                            backgroundColor: HADES.accentTint,
                        }}
                    >
                        <FileUp size={28} color={HADES.accentSolid} />
                    </View>
                    <Text style={{ color: HADES.text, fontWeight: "500", marginBottom: 4, textAlign: "center" }}>
                        Selecionar arquivo
                    </Text>
                    <Text style={{ fontSize: 13, color: HADES.textDim, textAlign: "center" }}>
                        ou toque para navegar
                    </Text>
                    <Text style={{ fontSize: 12, color: HADES.textDim, marginTop: 8 }}>
                        {category === "pdf" ? "Somente PDF" : category === "image" ? "Imagens" : "Qualquer arquivo"} até 10MB
                    </Text>
                </>
            )}
        </TouchableOpacity>
    );
}
