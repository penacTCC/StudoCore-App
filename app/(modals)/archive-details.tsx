import { useState } from "react";
import { supabase } from "@/supabase";

//Componentes do Native
import { View, Text, TouchableOpacity, Alert, Linking, ActivityIndicator, Platform } from "react-native";
import { FileText, Image as ImageIcon, FileUp, Trash2 } from "lucide-react-native";
import { File, Paths } from "expo-file-system";
import * as IntentLauncher from "expo-intent-launcher";
import * as Sharing from "expo-sharing";

//Componentes do Projeto
import { COLORS } from "@/constants/colors";
import { deleteFileFromB2, getAuthenticatedDownloadUrl } from "@/services/backblaze";
import { useMyGroups } from "@/hooks/useMyGroups";


/**
 * Modal responsável por exibir os detalhes de um arquivo.
 * @param selectedFileForDetail - Arquivo selecionado para visualização.
 * @param onClose - Função para fechar o modal.
 * @param onRefresh - Função para atualizar os dados.
 * @param currentUser - Usuário logado.
 * @returns Modal de detalhes do arquivo.
 */
export default function FileDetailModal({
    selectedFileForDetail,
    onClose,
    onRefresh,
    currentUser
}: {
    selectedFileForDetail: any | null,
    onClose: () => void,
    onRefresh: () => void,
    currentUser: any | null
}) {

    //seleção da disciplina
    const [isOpening, setIsOpening] = useState(false);
    console.log(selectedFileForDetail);

    //grupos
    const { groups } = useMyGroups();
    const sentGroupsIds = selectedFileForDetail?.arquivos_grupos?.map((ag: any) => ag.grupo_id) || [];
    const sentGroupsNames = groups.filter((g: any) => sentGroupsIds.includes(g.id)).map((g: any) => g.nome_grupo);

    const fileType = selectedFileForDetail?.storage_path?.split('.').pop()?.toLowerCase();

    /**
     * Função responsável por deletar o arquivo do banco de dados.
     * Ela pede uma confirmação antes de realizar a exclusão.
     */
    const handleDelete = () => {
        // Exibe um alerta nativo pedindo confirmação do usuário
        Alert.alert(
            "Deletar Arquivo",
            "Tem certeza que deseja deletar este arquivo? Esta ação não pode ser desfeita.",
            [
                { text: "Cancelar", style: "cancel" }, // Botão de cancelar
                {
                    text: "Deletar",
                    style: "destructive", // Estilo vermelho no iOS
                    onPress: async () => {
                        try {
                            // Deleta o arquivo fisicamente do Backblaze primeiro.
                            // Se falhar no Backblaze, a execução para aqui e não deleta do Supabase.
                            if (selectedFileForDetail.backblaze_file_id && selectedFileForDetail.storage_path) {
                                await deleteFileFromB2(
                                    selectedFileForDetail.storage_path,
                                    selectedFileForDetail.backblaze_file_id
                                );
                            }

                            // Deleta o registro referente a este arquivo na tabela 'arquivos' do Supabase
                            const { error } = await supabase
                                .from("arquivos") // Nome da sua tabela
                                .delete() // Operação de deleção
                                .eq("id", selectedFileForDetail.id); // Condição: onde o ID for igual ao ID do arquivo atual

                            if (error) throw error; // Se a API retornar erro, cai no catch abaixo

                            // Mostra alerta de sucesso
                            Alert.alert("Sucesso", "Arquivo deletado com sucesso!");

                            onRefresh();

                            // Fecha o modal atualizando o estado no componente pai
                            onClose();
                        } catch (error: any) {
                            console.error(error);
                            Alert.alert("Erro", "Não foi possível deletar o arquivo.");
                        }
                    }
                }
            ]
        );
    };


    /**
     * Função responsável por baixar o arquivo temporariamente no cache e abrir o menu nativo.
     * No Android usa o IntentLauncher para mostrar o "Abrir com..." de visualização.
     * No iOS usa o Sharing como fallback.
     * O arquivo é deletado do celular assim que a visualização termina.
     */
    const handleOpen = async () => {
        if (isOpening) return;

        const filePath = selectedFileForDetail?.storage_path;
        if (!filePath) {
            Alert.alert("Erro", "Caminho do arquivo não encontrado.");
            return;
        }

        setIsOpening(true);

        try {
            // Obtém a URL autenticada do Backblaze
            const authenticatedUrl = await getAuthenticatedDownloadUrl(filePath);

            // Prepara o arquivo temporário no cache do celular
            const fileName = filePath.split('/').pop() || "arquivo";
            const localFile = new File(Paths.cache, fileName);

            // Baixa o arquivo (a URL já contém o token de acesso)
            const downloadedFile = await File.downloadFileAsync(
                authenticatedUrl,
                localFile,
                { idempotent: true } //Se o arquivo já existir no cache, sobrescreve sem dar erro.
            );

            if (!downloadedFile.exists) {
                throw new Error("Falha ao salvar o arquivo no cache.");
            }

            // Determina o tipo do arquivo (mimeType) baseado na extensão
            // Isso permite que o sistema saiba qual app usar para abrir
            const extension = fileName.split('.').pop()?.toLowerCase();
            const mimeType = extension === 'pdf'
                ? 'application/pdf'
                : extension === 'png'
                    ? 'image/png'
                    : extension === 'jpg' || extension === 'jpeg'
                        ? 'image/jpeg'
                        : 'application/octet-stream'; // Tipo genérico para arquivos desconhecidos

            // Abre o arquivo com o visualizador nativo do sistema
            if (Platform.OS === 'android') {
                // No Android, usa o IntentLauncher para disparar o menu "Abrir com..."
                // Usa a contentUri do arquivo (necessária para permissões no Android)
                await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
                    data: downloadedFile.contentUri, // Content URI gerada automaticamente pelo expo-file-system
                    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION — permite que o app externo leia o arquivo
                    type: mimeType,
                });
            } else {
                // No iOS, usa o Sharing como fallback (abre o menu de compartilhamento/visualização)
                await Sharing.shareAsync(downloadedFile.uri);
            }

        } catch (error: any) {
            console.error("Erro ao abrir arquivo:", error);
            Alert.alert("Erro", "Não foi possível abrir o documento no momento.");
        } finally {
            setIsOpening(false);

            // Garante que o arquivo seja removido do cache logo após o uso
            // Isso evita que o celular do usuário acumule arquivos temporários
            try {
                const fileName = filePath?.split('/').pop();
                if (fileName) {
                    const localFile = new File(Paths.cache, fileName);
                    if (localFile.exists) {
                        localFile.delete();
                    }
                }
            } catch (e) {
                console.warn("Erro ao limpar cache temporário:", e);
            }
        }
    };


    return (
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
            <View className="w-full bg-slate-900 border-t border-slate-800 rounded-t-[40px] p-8 pb-12">
                {/* Header com Ícone */}
                <View className="items-center mb-6">
                    <View className="w-16 h-1 bg-slate-700 rounded-full mb-6" />
                    <View
                        className="w-20 h-20 rounded-3xl items-center justify-center mb-4"
                        style={{ backgroundColor: "rgba(247, 152, 44, 0.15)" }}
                    >
                        {selectedFileForDetail?.storage_path?.endsWith(".pdf") ? (
                            <FileText size={40} color={COLORS.primary} />
                        ) : (
                            <ImageIcon size={40} color={COLORS.primary} />
                        )}
                    </View>
                    <Text className="text-xl font-bold text-slate-200 text-center">
                        {selectedFileForDetail?.titulo}
                    </Text>
                    <Text className="text-brand-500 font-medium mt-1 text-center">
                        {selectedFileForDetail?.disciplina}
                    </Text>
                </View>

                {/* Info List */}
                <View className="bg-slate-800/50 rounded-3xl p-6 gap-4 mb-8">
                    <View className="flex-row justify-between items-center">
                        <Text className="text-slate-400">Enviado por</Text>
                        <Text className="text-slate-200 font-medium">
                            {selectedFileForDetail?.profiles?.nome_usuario || "Você"}
                        </Text>
                    </View>
                    <View className="flex-row justify-between items-center border-t border-slate-700 pt-4">
                        <Text className="text-slate-400">Data de Upload</Text>
                        <Text className="text-slate-200 font-medium">
                            {selectedFileForDetail && new Date(selectedFileForDetail.created_at).toLocaleDateString()}
                        </Text>
                    </View>
                    <View className="flex-row justify-between items-center">
                        <Text className="text-slate-400">Tipo de Arquivo</Text>
                        <Text className="text-slate-200 font-medium uppercase">
                            {fileType}
                        </Text>
                    </View>
                    <View className="flex-row justify-between items-center border-t border-slate-700 pt-4">
                        <Text className="text-slate-400">ID do Documento</Text>
                        <Text className="text-slate-200 text-xs font-mono" numberOfLines={1}>
                            {selectedFileForDetail?.id?.substring(0, 18)}...
                        </Text>
                    </View>

                    {/* Exibe os grupos se o arquivo foi enviado pelo usuário atual e estiver em algum grupo */}
                    {currentUser?.id === selectedFileForDetail?.user_id && sentGroupsNames.length > 0 && (
                        <View className="flex-row justify-between items-center border-t border-slate-700 pt-4">
                            <Text className="text-slate-400">Enviado para</Text>
                            <Text className="flex-1 text-right ml-4 text-slate-200 font-medium" numberOfLines={2}>
                                {sentGroupsNames.join(", ")}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Actions */}
                <View className="flex-row gap-3 mt-2">
                    {/* Botão de Fechar */}
                    <TouchableOpacity
                        onPress={onClose}
                        className="flex-[1] py-4 bg-slate-800 rounded-2xl items-center border border-slate-700"
                    >
                        <Text className="text-slate-200 font-semibold">Fechar</Text>
                    </TouchableOpacity>

                    {/* Botão de Abrir Documento */}
                    <TouchableOpacity
                        onPress={handleOpen}
                        disabled={isOpening}
                        className={`flex-[2] py-4 rounded-2xl flex-row items-center justify-center gap-2 ${isOpening ? 'bg-brand-400' : 'bg-brand-500'}`}
                    >
                        {isOpening ? (
                            <ActivityIndicator color={COLORS.white} size="small" />
                        ) : (
                            <>
                                <FileUp size={20} color={COLORS.white} />
                                <Text className="text-white font-semibold">Abrir</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    {/* Botão de Deletar condicionalmente exibido */}
                    {currentUser?.id === selectedFileForDetail?.user_id && (
                        <TouchableOpacity
                            onPress={handleDelete} // Chama a função que criamos para deletar
                            className="flex-[1] py-4 bg-red-500/10 rounded-2xl items-center justify-center border border-red-500/20"
                        >
                            <Trash2 size={24} color={COLORS.rose} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
    );
}

