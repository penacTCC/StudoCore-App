import { useState } from "react";

//Componentes do Native
import { View, Text, TouchableOpacity, ScrollView, Modal, LayoutAnimation, Platform, UIManager } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FileText, Image as ImageIcon, ChevronRight, ChevronDown, FileUp, Folder } from "lucide-react-native";

//Componentes do Projeto
import { HADES } from "@/constants/hades";
import { useMeusGrupos } from "@/hooks/useMeusGrupos";

//Componentes gráficos
import SearchBar from "@/components/ui/SearchBar";
import UploadVaultModal from "@/app/(modals)/upload-vault";
import FileDetailModal from "@/app/(modals)/archive-details";

//Funções do Projeto
import { useArchives } from "@/hooks/useArchives";
import { useAuth } from "@/hooks/useAuth";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function VaultScreen() {
    //componentes graficos
    const [searchQuery, setSearchQuery] = useState(""); //Campo de busca
    const [showUploadModal, setShowUploadModal] = useState(false); //Controla se o modal está aberto ou fechado.

    //modal de detalhes
    const [selectedFileForDetail, setSelectedFileForDetail] = useState<any | null>(null);

    //Busca o usuário
    const { user, userId } = useAuth();

    // Chama o hook para buscar os arquivos reais do banco de dados de forma incondicional
    const { archives, refresh } = useArchives(userId || undefined);
    const { grupos } = useMeusGrupos();

    // Accordion state - stores IDs of open sections
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

    // Retorna nulo se o ID do usuário ainda não estiver carregado
    if (!userId) return null;

    /**
     * Função responsável por expandir ou recolher uma seção do accordion.
     * @param id - ID da seção a ser expandida ou recolhida.
     */
    const toggleSection = (id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    // Filter files across all sections
    const filteredFiles = (archives || []).filter((f) =>
        f.titulo?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Get files for a specific group
    const getGroupFiles = (groupId: string) => {
        return filteredFiles.filter(
            (file) =>
                file.arquivos_grupos?.some((ag: any) => ag.grupo_id === groupId) && file.user_id !== userId //todos os arquivos do grupo - os arquivos do próprio usuário
        );
    };

    // My files: especificamente aqueles enviados pelo usuário atual
    const myFiles = filteredFiles.filter((file) => file.user_id === userId);

    /**
     * Componente responsável por exibir um card de arquivo.
     * @param file - Arquivo a ser exibido.
     * @returns Card de arquivo.
     */
    const FileCard = ({ file }: { file: any }) => {
        const type = file.storage_path?.split(".").pop()?.toLowerCase();
        const isPdf = file.storage_path?.endsWith(".pdf");
        return (
            <TouchableOpacity
                onPress={() => setSelectedFileForDetail(file)}
                activeOpacity={0.7}
                style={{
                    backgroundColor: HADES.surfaceRaised,
                    borderWidth: 1,
                    borderColor: HADES.border,
                    borderRadius: 14,
                    padding: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 10,
                }}
            >
                <View
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: isPdf ? "rgba(240,85,107,0.14)" : HADES.groupVioletTint,
                    }}
                >
                    {type === "pdf" ? (
                        <FileText size={22} color={HADES.red} />
                    ) : (
                        <ImageIcon size={22} color={HADES.groupViolet} />
                    )}
                </View>

                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: HADES.text }} numberOfLines={1}>
                        {file.titulo}
                    </Text>
                    <Text style={{ fontSize: 12, color: HADES.textDim, marginTop: 2 }}>
                        {file.profiles?.nome_usuario || "Você"} • {new Date(file.created_at).toLocaleDateString()}
                    </Text>
                </View>
                <ChevronRight size={18} color={HADES.textFaint} />
            </TouchableOpacity>
        );
    };

    /**
     * Componente responsável por exibir uma seção do accordion.
     */
    const AccordionSection = ({
        id,
        title,
        subtitle,
        files,
        icon: SectionIcon = Folder,
        emptyText = "Nenhum arquivo enviado",
    }: {
        id: string;
        title: string;
        subtitle?: string;
        files: any[];
        icon?: any;
        emptyText?: string;
    }) => {
        const isExpanded = expandedSections[id];

        return (
            <View style={{ marginBottom: 12 }}>
                <TouchableOpacity
                    onPress={() => toggleSection(id)}
                    activeOpacity={0.7}
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: 14,
                        backgroundColor: HADES.surface,
                        borderWidth: 1,
                        borderColor: HADES.border,
                        borderRadius: 16,
                        borderBottomLeftRadius: isExpanded ? 0 : 16,
                        borderBottomRightRadius: isExpanded ? 0 : 16,
                        borderBottomWidth: isExpanded ? 0 : 1,
                    }}
                >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                        <View
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 12,
                                backgroundColor: HADES.accentTint,
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <SectionIcon size={20} color={HADES.accentSolid} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, fontWeight: "600", color: HADES.text }} numberOfLines={1}>
                                {title}
                            </Text>
                            {subtitle && (
                                <Text style={{ fontSize: 12, color: HADES.textDim, marginTop: 1 }}>{subtitle}</Text>
                            )}
                        </View>
                    </View>
                    {isExpanded ? (
                        <ChevronDown size={20} color={HADES.textFaint} />
                    ) : (
                        <ChevronRight size={20} color={HADES.textFaint} />
                    )}
                </TouchableOpacity>

                {isExpanded && (
                    <View
                        style={{
                            padding: 14,
                            backgroundColor: HADES.surface,
                            borderLeftWidth: 1,
                            borderRightWidth: 1,
                            borderBottomWidth: 1,
                            borderColor: HADES.border,
                            borderBottomLeftRadius: 16,
                            borderBottomRightRadius: 16,
                        }}
                    >
                        {files.length > 0 ? (
                            files.map((file) => <FileCard key={file.id} file={file} />)
                        ) : (
                            <View style={{ paddingVertical: 14, alignItems: "center" }}>
                                <Text style={{ fontSize: 13, color: HADES.textDim }}>{emptyText}</Text>
                            </View>
                        )}
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top"]}>
            {/* Header */}
            <View style={{ paddingTop: 6, paddingHorizontal: 20, paddingBottom: 12 }}>
                <Text style={{ fontSize: 23, fontWeight: "700", color: HADES.text, letterSpacing: -0.3 }}>
                    Meus Arquivos
                </Text>
                <Text style={{ fontSize: 13, color: HADES.textMuted, marginTop: 2 }}>
                    Seus materiais de estudo
                </Text>
            </View>

            {/* Search */}
            <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
                <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Buscar arquivos..." />
            </View>

            {/* Seções de arquivos */}
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Seções dos grupos */}
                {grupos.map((group: any) => (
                    <AccordionSection
                        key={group.id}
                        id={group.id}
                        title={group.nome_grupo}
                        subtitle="Arquivos compartilhados no grupo"
                        files={getGroupFiles(group.id)}
                        emptyText={`Nenhum arquivo enviado no ${group.nome_grupo}`}
                    />
                ))}

                {/* Meus arquivos */}
                <AccordionSection
                    id="meus_arquivos"
                    title="Meus arquivos"
                    subtitle="Arquivos que eu enviei"
                    files={myFiles}
                    icon={FileUp}
                    emptyText="Você ainda não enviou nenhum arquivo"
                />

                {filteredFiles.length === 0 && (
                    <View style={{ alignItems: "center", paddingVertical: 32 }}>
                        <Text style={{ color: HADES.textMuted, fontWeight: "600" }}>Nenhum arquivo encontrado</Text>
                        <Text style={{ fontSize: 13, color: HADES.textDim, marginTop: 4 }}>
                            Tente buscar por outro nome
                        </Text>
                    </View>
                )}
            </ScrollView>

            {/* FAB */}
            <TouchableOpacity
                onPress={() => setShowUploadModal(true)}
                activeOpacity={0.85}
                style={{
                    position: "absolute",
                    bottom: 96,
                    right: 20,
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: HADES.accentSolid,
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.35,
                    shadowRadius: 8,
                    elevation: 8,
                }}
            >
                <FileUp size={24} color="#000" />
            </TouchableOpacity>

            {/* Upload Modal */}
            <Modal visible={showUploadModal} transparent animationType="fade">
                <UploadVaultModal onClose={() => setShowUploadModal(false)} onRefresh={refresh} />
            </Modal>

            {/* Detail Modal */}
            <Modal visible={!!selectedFileForDetail} transparent animationType="slide">
                <FileDetailModal
                    detalheArquivo={selectedFileForDetail}
                    onClose={() => setSelectedFileForDetail(null)}
                    onRefresh={refresh}
                    currentUser={user}
                />
            </Modal>
        </SafeAreaView>
    );
}
