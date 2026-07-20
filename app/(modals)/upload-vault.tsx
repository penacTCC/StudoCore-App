import { useState } from "react";
import { uploadArquivo } from "@/services/archives";

//Componentes do Native
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from "react-native";
import { Image as FileUp, X } from "lucide-react-native";

//Componentes do Projeto
import DocumentPickerVault from "@/components/ui/DocumentPickerVault";
import TabSelector from "@/components/ui/TabSelector";

//Componentes do Projeto
import { HADES } from "@/constants/hades";

//Funções do Projeto
import { useMeusGrupos } from "@/hooks/useMeusGrupos";
import { useAuth } from "@/hooks/useAuth";
import { selectedFile } from "@/types/upload";

//categorias de arquivo
type FileCategory = "pdf" | "imagem" | "outro";

const FILE_TYPE_TABS = [
    { key: "pdf", label: "PDF" },
    { key: "imagem", label: "Imagem" },
    { key: "outro", label: "Outro" },
];

//disciplinas
const disciplinas = ["matematica", "portugues", "historia", "geografia", "biologia", "fisica", "quimica", "ingles"];

/**
 * Modal responsável por fazer o upload de arquivos para o Backblaze.
 * @param onClose - Função para fechar o modal.
 * @param onRefresh - Função para atualizar os dados.
 * @returns Modal de upload de arquivos.
 */
export default function UploadVaultModal({ onClose, onRefresh }: { onClose: () => void; onRefresh?: () => void }) {
    //upload de arquivo
    const [uploadFileType, setUploadFileType] = useState<FileCategory>("pdf"); //Controla o tipo de arquivo que você vai escolher
    const [selectedFile, setSelectedFile] = useState<selectedFile | null>(null); //Guarda o arquivo que você vai escolher

    //carregamento
    const [isUploading, setIsUploading] = useState(false); // Avisa o app se o upload está acontecendo para mostrar a bolinha de carregamento.

    //seleção da disciplina
    const [selectedDiscipline, setSelectedDiscipline] = useState<string>("outro");

    //Pega o usuário logado para poder buscar os arquivos dele
    const { user } = useAuth();

    //grupos
    const { grupos } = useMeusGrupos();
    const [gruposSelecionados, setGruposSelecionados] = useState<string[]>([]);

    /**
     * função adiciona o grupo se ele não estiver na lista ou remove se já estiver.
     * @param groupId id do grupo
     */
    const alternarGrupo = (grupoId: string) => {
        setGruposSelecionados((prev) =>
            prev.includes(grupoId) ? prev.filter((g) => g !== grupoId) : [...prev, grupoId]
        );
    };

    /**
     * Função que faz o upload do arquivo para o Backblaze
     */
    const handleUpload = async () => {
        if (!selectedFile || !user) return;

        setIsUploading(true);

        try {
            await uploadArquivo({
                userId: user.id,
                arquivo: selectedFile,
                disciplina: selectedDiscipline,
                gruposIds: gruposSelecionados,
            });

            Alert.alert("Sucesso", "Arquivo enviado com sucesso!");

            onRefresh?.();
            onClose();

            setSelectedFile(null);
        } catch (error: any) {
            console.error(error);
            Alert.alert("Erro", error.message || "Não foi possível enviar o arquivo.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, backgroundColor: "rgba(0,0,0,0.8)" }}>
            <View
                style={{
                    width: "100%",
                    backgroundColor: HADES.modalBg,
                    borderWidth: 1,
                    borderColor: HADES.border,
                    borderRadius: 24,
                    padding: 22,
                }}
            >
                {/* Header */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                    <Text style={{ fontSize: 17, fontWeight: "600", color: HADES.text }}>Envio de arquivos</Text>
                    <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <X size={20} color={HADES.textMuted} />
                    </TouchableOpacity>
                </View>

                {/* Upload Zone */}
                <DocumentPickerVault
                    category={uploadFileType}
                    selectedFile={selectedFile}
                    isUploading={isUploading}
                    onFileSelected={setSelectedFile}
                />

                {/* File Type Selector */}
                <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 12, color: HADES.textMuted, marginBottom: 8 }}>Categoria do arquivo</Text>
                    <TabSelector
                        tabs={FILE_TYPE_TABS}
                        active={uploadFileType}
                        onSelect={(k) => setUploadFileType(k as FileCategory)}
                        activeColor="brand"
                    />
                </View>

                {/* Discipline Selector */}
                <View style={{ marginBottom: 20 }}>
                    <Text style={{ fontSize: 12, color: HADES.textMuted, marginBottom: 8 }}>Escolha a disciplina</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {disciplinas.map((discipline) => {
                            const isSelected = selectedDiscipline === discipline;
                            return (
                                <TouchableOpacity
                                    key={discipline}
                                    onPress={() => setSelectedDiscipline(discipline)}
                                    activeOpacity={0.8}
                                    style={{
                                        paddingHorizontal: 16,
                                        paddingVertical: 8,
                                        borderRadius: 999,
                                        marginRight: 8,
                                        borderWidth: 1,
                                        backgroundColor: isSelected ? HADES.accentSolid : HADES.surfaceOverlay,
                                        borderColor: isSelected ? HADES.accentSolid : HADES.border,
                                    }}
                                >
                                    <Text style={{ fontSize: 12, fontWeight: "600", color: isSelected ? "#000" : HADES.textMuted }}>
                                        {discipline}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* Group Selector */}
                <View style={{ marginBottom: 20 }}>
                    <Text style={{ fontSize: 12, color: HADES.textMuted, marginBottom: 8 }}>
                        Escolha o grupo com quem deseja compartilhar
                    </Text>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {grupos.map((group) => {
                            const isSelected = gruposSelecionados.includes(group.id);

                            return (
                                <TouchableOpacity
                                    key={group.id}
                                    onPress={() => alternarGrupo(group.id)}
                                    activeOpacity={0.8}
                                    style={{
                                        paddingHorizontal: 16,
                                        paddingVertical: 8,
                                        borderRadius: 999,
                                        marginRight: 8,
                                        borderWidth: 1,
                                        backgroundColor: isSelected ? HADES.accentSolid : HADES.surfaceOverlay,
                                        borderColor: isSelected ? HADES.accentSolid : HADES.border,
                                    }}
                                >
                                    <Text style={{ fontSize: 12, fontWeight: "600", color: isSelected ? "#000" : HADES.textMuted }}>
                                        {group.nome_grupo}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* Upload Button */}
                {selectedFile && (
                    <TouchableOpacity
                        onPress={handleUpload}
                        disabled={isUploading}
                        activeOpacity={0.85}
                        style={{
                            height: 54,
                            borderRadius: 15,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 9,
                            backgroundColor: HADES.accentSolid,
                            opacity: isUploading ? 0.7 : 1,
                        }}
                    >
                        {isUploading ? (
                            <ActivityIndicator color="#000" size="small" />
                        ) : (
                            <FileUp size={20} color="#000" />
                        )}
                        <Text style={{ color: "#000", fontWeight: "700", fontSize: 16 }}>
                            {isUploading ? "Enviando..." : "Confirmar envio"}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}
