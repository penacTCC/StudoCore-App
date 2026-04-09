import { useState, useEffect } from "react";
import { supabase } from "@/supabase";

//Componentes do Native
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from "react-native";
import { FileText, Image as ImageIcon, ChevronRight, FileUp, X } from "lucide-react-native";

//Componentes do Projeto
import DocumentPickerVault from "@/components/ui/DocumentPickerVault";
import TabSelector from "@/components/ui/TabSelector";

//Componentes do Projeto
import { COLORS } from "@/constants/colors";
import { File as FileClass } from "expo-file-system";
import { decode } from "base64-arraybuffer";

//Funções do Projeto
import { useMyGroups } from "@/hooks/useMyGroups";
import { uploadFileToB2 } from "@/services/backblaze";

//categorias de arquivo
type FileCategory = "pdf" | "imagem" | "outro";
const FILE_TYPE_TABS = [
    { key: "pdf", label: "PDF" },
    { key: "imagem", label: "Imagem" },
    { key: "outro", label: "Outro" },
];

//disciplinas
const DISCIPLINES = ["matematica", "portugues", "historia", "geografia", "biologia", "fisica", "quimica", "ingles"];



/**
 * Modal responsável por fazer o upload de arquivos para o Backblaze.
 * @param onClose - Função para fechar o modal.
 * @param onRefresh - Função para atualizar os dados.
 * @returns Modal de upload de arquivos.
 */
export default function UploadVaultModal({ onClose, onRefresh }: { onClose: () => void, onRefresh?: () => void }) {

    const [showUploadModal, setShowUploadModal] = useState(false); //Controla se o modal está aberto ou fechado.

    //upload de arquivo
    const [uploadFileType, setUploadFileType] = useState<FileCategory>("pdf"); //Controla o tipo de arquivo que você vai escolher
    const [selectedFile, setSelectedFile] = useState<{ uri: string; name: string; mimeType: string; size: number } | null>(null); //Guarda o arquivo que você vai escolher

    //carregamento
    const [isUploading, setIsUploading] = useState(false); // Avisa o app se o upload está acontecendo para mostrar a bolinha de carregamento.

    //seleção da disciplina
    const [selectedDiscipline, setSelectedDiscipline] = useState<string>("outro");

    //usuário
    const [user, setUser] = useState<any>(null);
    // Pega o usuário logado para poder buscar os arquivos dele
    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user);
        });
    }, []);

    //grupos
    const { groups, refreshing } = useMyGroups();
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);


    /**
     * função adiciona o grupo se ele não estiver na lista ou remove se já estiver.
     * @param groupId id do grupo
     */
    const toggleGroup = (groupId: string) => {
        setSelectedGroups((prev) =>
            prev.includes(groupId)
                ? prev.filter((g) => g !== groupId)
                : [...prev, groupId]
        );
    };


    /**
     * Função que faz o upload do arquivo para o Backblaze
     */
    const handleUpload = async () => {
        if (!selectedFile || !user) return; // Se não houver arquivo ou usuário, não faz nada
        setIsUploading(true); // Inicia o carregamento
        try {
            const fileObject = new FileClass(selectedFile.uri); // Cria o objeto do arquivo
            const base64 = await fileObject.base64Sync(); // Lê o arquivo em base64

            const safeName = selectedFile.name.replace(/[^a-zA-Z0-9.]/g, '_'); // Limpa o nome
            const grupo =
                selectedGroups.length > 0
                    ? selectedGroups.join(",")
                    : "private";

            // coloca a disciplina como uma PASTA no bucket.
            const filePath = `${selectedDiscipline}/${grupo}/${safeName}`;

            //Faz o upload para o bucket com o novo caminho (Pasta/Arquivo)
            const uploadResponse = await uploadFileToB2(
                filePath,
                selectedFile.mimeType,
                decode(base64),
            );

            // O fetch do Backblaze retorna uma Response. Precisamos extrair o JSON dela:
            const uploadData = await uploadResponse.json();

            Alert.alert("Sucesso", "Arquivo enviado com sucesso!"); // Sucesso

            const { data: newFile, error: dbError } = await supabase.from("arquivos").insert({
                user_id: user.id,
                titulo: safeName,
                disciplina: selectedDiscipline,
                storage_path: filePath,
                backblaze_file_id: uploadData.fileId, // Agora pegamos direto do JSON retornado pelo Backblaze
            }).select().single();

            if (dbError) throw dbError;

            // Relaciona o arquivo aos grupos selecionados
            if (selectedGroups.length > 0) {
                const groupRelations = selectedGroups.map(groupId => ({
                    arquivo_id: newFile.id,
                    grupo_id: groupId,
                }));

                const { error: groupRelError } = await supabase
                    .from("arquivos_grupos")
                    .insert(groupRelations);

                if (groupRelError) throw groupRelError;
            }

            if (onRefresh) {
                onRefresh();
            }

            onClose();

            setSelectedFile(null); // Limpa seleção
            setShowUploadModal(false); // Fecha modal
        } catch (error: any) {
            console.error(error);
            Alert.alert("Erro", error.message || "Não foi possível enviar o arquivo.");
        } finally {
            setIsUploading(false); // Fim do carregamento
        }
    };


    return (
        <View className="flex-1 items-center justify-center px-4" style={{ backgroundColor: "rgba(0,0,0,0.8)" }}>
            <View className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-6">
                {/* Header */}
                <View className="flex-row items-center justify-between mb-6">
                    <Text className="text-lg font-semibold text-slate-200">Upload de arquivos</Text>
                    <TouchableOpacity onPress={onClose}>
                        <X size={20} color={COLORS.textMuted} />
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
                <View className="mb-4">
                    <Text className="text-xs text-slate-400 mb-2">Categoria do arquivo</Text>
                    <TabSelector
                        tabs={FILE_TYPE_TABS}
                        active={uploadFileType}
                        onSelect={(k) => setUploadFileType(k as FileCategory)}
                        activeColor="brand"
                    />
                </View>

                {/* Discipline Selector */}
                <View className="mb-6">
                    <Text className="text-xs text-slate-400 mb-2">Escolha a disciplina</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                        {DISCIPLINES.map((discipline) => (
                            <TouchableOpacity
                                key={discipline}
                                onPress={() => setSelectedDiscipline(discipline)}
                                className={`px-4 py-2 rounded-full mr-2 border ${selectedDiscipline === discipline ? 'bg-brand-500 border-brand-500' : 'bg-slate-800 border-slate-700'}`}
                            >
                                <Text className={`text-xs font-medium ${selectedDiscipline === discipline ? 'text-white' : 'text-slate-400'}`}>
                                    {discipline}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Group Selector */}
                <View className="mb-6">
                    <Text className="text-xs text-slate-400 mb-2">
                        Escolha o grupo com quem deseja compartilhar
                    </Text>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                        {groups.map((group) => {
                            const isSelected = selectedGroups.includes(group.id);

                            return (
                                <TouchableOpacity
                                    key={group.id}
                                    onPress={() => toggleGroup(group.id)}
                                    className={`px-4 py-2 rounded-full mr-2 border ${isSelected
                                        ? 'bg-brand-500 border-brand-500'
                                        : 'bg-slate-800 border-slate-700'
                                        }`}
                                >
                                    <Text
                                        className={`text-xs font-medium ${isSelected ? 'text-white' : 'text-slate-400'
                                            }`}
                                    >
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
                        className={`py-4 rounded-2xl flex-row items-center justify-center gap-2 ${isUploading ? 'bg-brand-600 opacity-70' : 'bg-brand-500'}`}
                    >
                        {isUploading ? (
                            <ActivityIndicator color={COLORS.white} size="small" />
                        ) : (
                            <FileUp size={20} color={COLORS.white} />
                        )}
                        <Text className="text-white font-semibold text-lg">
                            {isUploading ? "Enviando..." : "Confirmar Upload"}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}