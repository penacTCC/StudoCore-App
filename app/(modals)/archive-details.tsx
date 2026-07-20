import { useState } from "react";

//Componentes do Native
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, Platform } from "react-native";
import { FileText, Image as ImageIcon, FileUp, Trash2 } from "lucide-react-native";
import { File, Paths } from "expo-file-system";
import * as IntentLauncher from "expo-intent-launcher";
import * as Sharing from "expo-sharing";

//Componentes do Projeto
import { HADES } from "@/constants/hades";
import { deleteFileFromB2, getAuthenticatedDownloadUrl } from "@/services/backblaze";
import { useMeusGrupos } from "@/hooks/useMeusGrupos";
import { deletaRegistro } from "@/services/archives";
import { detalheArquivoProps } from "@/types/archives";

/**
 * Modal (bottom sheet) responsável por exibir os detalhes de um arquivo.
 * @param detalheArquivo - Arquivo selecionado para visualização.
 * @param onClose - Função para fechar o modal.
 * @param onRefresh - Função para atualizar os dados.
 * @param currentUser - Usuário logado.
 */
export default function FileDetailModal({
    detalheArquivo,
    onClose,
    onRefresh,
    currentUser,
}: detalheArquivoProps) {
    //seleção da disciplina
    const [isOpening, setIsOpening] = useState(false);

    //grupos
    const { grupos } = useMeusGrupos();

    if (!detalheArquivo) return null;

    const sentGroupsIds = detalheArquivo.arquivos_grupos?.map((ag) => ag.grupo_id) || [];
    const sentGroupsNames = grupos
        .filter((g: any) => sentGroupsIds.includes(g.id))
        .map((g: any) => g.nome_grupo);

    const fileType = detalheArquivo?.storage_path?.split(".").pop()?.toLowerCase();
    const isPdf = detalheArquivo?.storage_path?.endsWith(".pdf");

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
                            if (detalheArquivo.backblaze_file_id && detalheArquivo.storage_path) {
                                await deleteFileFromB2(
                                    detalheArquivo.storage_path,
                                    detalheArquivo.backblaze_file_id
                                );
                            }

                            // Deleta o registro referente a este arquivo na tabela 'arquivos' do Supabase
                            const { error } = await deletaRegistro({ arquivoId: detalheArquivo.id });
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
                    },
                },
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

        const filePath = detalheArquivo?.storage_path;
        if (!filePath) {
            Alert.alert("Erro", "Caminho do arquivo não encontrado.");
            return;
        }

        setIsOpening(true);

        try {
            // Obtém a URL autenticada do Backblaze
            const authenticatedUrl = await getAuthenticatedDownloadUrl(filePath);

            // Prepara o arquivo temporário no cache do celular
            const fileName = filePath.split("/").pop() || "arquivo";
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
            const extension = fileName.split(".").pop()?.toLowerCase();
            const mimeType =
                extension === "pdf"
                    ? "application/pdf"
                    : extension === "png"
                        ? "image/png"
                        : extension === "jpg" || extension === "jpeg"
                            ? "image/jpeg"
                            : "application/octet-stream"; // Tipo genérico para arquivos desconhecidos

            // Abre o arquivo com o visualizador nativo do sistema
            if (Platform.OS === "android") {
                // No Android, usa o IntentLauncher para disparar o menu "Abrir com..."
                // Usa a contentUri do arquivo (necessária para permissões no Android)
                await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
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
                const fileName = filePath?.split("/").pop();
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
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.7)" }}>
            <View
                style={{
                    width: "100%",
                    backgroundColor: HADES.modalBg,
                    borderTopWidth: 1,
                    borderColor: HADES.border,
                    borderTopLeftRadius: 32,
                    borderTopRightRadius: 32,
                    paddingHorizontal: 24,
                    paddingTop: 12,
                    paddingBottom: 40,
                }}
            >
                {/* Header com Ícone */}
                <View style={{ alignItems: "center", marginBottom: 24 }}>
                    <View
                        style={{
                            width: 44,
                            height: 4,
                            borderRadius: 2,
                            backgroundColor: HADES.grip,
                            marginBottom: 24,
                        }}
                    />
                    <View
                        style={{
                            width: 72,
                            height: 72,
                            borderRadius: 20,
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: 16,
                            backgroundColor: HADES.accentTint,
                        }}
                    >
                        {isPdf ? (
                            <FileText size={38} color={HADES.accentSolid} />
                        ) : (
                            <ImageIcon size={38} color={HADES.accentSolid} />
                        )}
                    </View>
                    <Text style={{ fontSize: 20, fontWeight: "700", color: HADES.text, textAlign: "center" }}>
                        {detalheArquivo?.titulo}
                    </Text>
                    <Text style={{ fontSize: 14, color: HADES.accentSolid, fontWeight: "600", marginTop: 4, textAlign: "center" }}>
                        {detalheArquivo?.disciplina}
                    </Text>
                </View>

                {/* Info List */}
                <View
                    style={{
                        backgroundColor: HADES.surface,
                        borderWidth: 1,
                        borderColor: HADES.border,
                        borderRadius: 20,
                        padding: 18,
                        marginBottom: 24,
                    }}
                >
                    <InfoRow label="Enviado por" value={detalheArquivo?.profiles?.nome_usuario || "Você"} />
                    <InfoRow
                        label="Data de envio"
                        value={detalheArquivo ? new Date(detalheArquivo.created_at).toLocaleDateString() : ""}
                        divider
                    />
                    <InfoRow label="Tipo de Arquivo" value={(fileType || "").toUpperCase()} divider />
                    <InfoRow label="ID do Documento" value={`${detalheArquivo?.id?.substring(0, 18)}...`} divider mono />

                    {/* Exibe os grupos se o arquivo foi enviado pelo usuário atual e estiver em algum grupo */}
                    {currentUser?.id === detalheArquivo?.user_id && sentGroupsNames.length > 0 && (
                        <InfoRow label="Enviado para" value={sentGroupsNames.join(", ")} divider />
                    )}
                </View>

                {/* Actions */}
                <View style={{ flexDirection: "row", gap: 10 }}>
                    {/* Botão de Fechar */}
                    <TouchableOpacity
                        onPress={onClose}
                        activeOpacity={0.8}
                        style={{
                            flex: 1,
                            height: 52,
                            borderRadius: 14,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: HADES.surfaceOverlay,
                            borderWidth: 1,
                            borderColor: HADES.border,
                        }}
                    >
                        <Text style={{ color: HADES.textSecondary, fontWeight: "600" }}>Fechar</Text>
                    </TouchableOpacity>

                    {/* Botão de Abrir Documento */}
                    <TouchableOpacity
                        onPress={handleOpen}
                        disabled={isOpening}
                        activeOpacity={0.85}
                        style={{
                            flex: 2,
                            height: 52,
                            borderRadius: 14,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            backgroundColor: HADES.accentSolid,
                            opacity: isOpening ? 0.7 : 1,
                        }}
                    >
                        {isOpening ? (
                            <ActivityIndicator color="#000" size="small" />
                        ) : (
                            <>
                                <FileUp size={20} color="#000" />
                                <Text style={{ color: "#000", fontWeight: "700" }}>Abrir</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    {/* Botão de Deletar condicionalmente exibido */}
                    {currentUser?.id === detalheArquivo?.user_id && (
                        <TouchableOpacity
                            onPress={handleDelete}
                            activeOpacity={0.8}
                            style={{
                                flex: 1,
                                height: 52,
                                borderRadius: 14,
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: "rgba(240,85,107,0.10)",
                                borderWidth: 1,
                                borderColor: "rgba(240,85,107,0.30)",
                            }}
                        >
                            <Trash2 size={22} color={HADES.red} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
    );
}

/** Linha de informação (rótulo à esquerda, valor à direita) do sheet de detalhes. */
function InfoRow({
    label,
    value,
    divider,
    mono,
}: {
    label: string;
    value: string;
    divider?: boolean;
    mono?: boolean;
}) {
    return (
        <View
            style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingTop: divider ? 14 : 0,
                marginTop: divider ? 14 : 0,
                borderTopWidth: divider ? 1 : 0,
                borderTopColor: HADES.border,
            }}
        >
            <Text style={{ fontSize: 14, color: HADES.textMuted }}>{label}</Text>
            <Text
                style={{
                    flex: 1,
                    textAlign: "right",
                    marginLeft: 16,
                    fontSize: mono ? 12 : 14,
                    color: HADES.textSecondary,
                    fontWeight: "500",
                    fontFamily: mono ? (Platform.OS === "ios" ? "Menlo" : "monospace") : undefined,
                }}
                numberOfLines={2}
            >
                {value}
            </Text>
        </View>
    );
}
