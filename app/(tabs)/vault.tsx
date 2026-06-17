import { useState } from "react";

//Componentes do Native
import { View, Text, TouchableOpacity, ScrollView, Modal, LayoutAnimation, Platform, UIManager } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FileText, Image as ImageIcon, ChevronRight, ChevronDown, FileUp, Folder } from "lucide-react-native";

//Componentes do Projeto
import { COLORS } from "@/constants/colors";
import { useMeusGrupos } from "@/hooks/useMeusGrupos";

//Componentes gráficos
import SearchBar from "@/components/ui/SearchBar";
import UploadVaultModal from "@/app/(modals)/upload-vault";
import FileDetailModal from "@/app/(modals)/archive-details";

//Funções do Projeto
import { useArchives } from "@/hooks/useArchives";
import { useAuth } from "@/hooks/useAuth";


if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
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
        setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Filter files across all sections
    const filteredFiles = (archives || []).filter((f) =>
        f.titulo?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Get files for a specific group
    
    const getGroupFiles = (groupId: string) => {
        return filteredFiles.filter(file =>
            file.arquivos_grupos?.some((ag: any) => ag.grupo_id === groupId) && file.user_id !== userId //todos os arquivos do grupo - os arquivos do próprio usuário
        );
    };

    // My files: especificamente aqueles enviados pelo usuário atual
    const myFiles = filteredFiles.filter(file => file.user_id === userId);


    /**
     * Componente responsável por exibir um card de arquivo.
     * @param file - Arquivo a ser exibido.
     * @returns Card de arquivo.
     */
    const FileCard = ({ file }: { file: any }) => {
        const type = file.storage_path?.split('.').pop()?.toLowerCase();
        return (
            <TouchableOpacity
                onPress={() => setSelectedFileForDetail(file)}
                className="bg-black/30 border border-white/10 rounded-2xl p-4 flex-row items-center gap-4 mb-3"
            >
                <View
                    className="w-12 h-12 rounded-xl items-center justify-center"
                    style={{
                        backgroundColor:
                            file.storage_path?.endsWith('.pdf')
                                ? "rgba(244, 63, 94, 0.2)"
                                : "rgba(247, 152, 44, 0.15)",
                    }}
                >
                    {type === "pdf" ? (
                        <FileText size={24} color={COLORS.rose} />
                    ) : (
                        <ImageIcon size={24} color={COLORS.primary} />
                    )}
                </View>

                <View className="flex-1">
                    <Text className="text-sm font-medium text-slate-200" numberOfLines={1}>
                        {file.titulo}
                    </Text>
                    <Text className="text-xs text-slate-500">
                        {file.profiles?.nome_usuario || "Você"} • {new Date(file.created_at).toLocaleDateString()}
                    </Text>
                </View>
                <ChevronRight size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
        );
    };


    /**
     * Componente responsável por exibir uma seção do accordion.
     * @param id - ID da seção.
     * @param title - Título da seção.
     * @param subtitle - Subtítulo da seção.
     * @param files - Arquivos da seção.
     * @param icon - Ícone da seção.
     * @param emptyText - Texto exibido quando não há arquivos.
     * @returns Seção do accordion.
     */
    const AccordionSection = ({
        id,
        title,
        subtitle,
        files,
        icon: SectionIcon = Folder,
        emptyText = "Nenhum arquivo enviado"
    }: {
        id: string,
        title: string,
        subtitle?: string,
        files: any[],
        icon?: any,
        emptyText?: string
    }) => {
        const isExpanded = expandedSections[id];

        return (
            <View className="mb-4">
                <TouchableOpacity
                    onPress={() => toggleSection(id)}
                    activeOpacity={0.7}
                    className={`flex-row items-center justify-between p-4 bg-[#151515] border border-white/10 rounded-2xl ${isExpanded ? 'rounded-b-none border-b-0' : ''}`}
                >
                    <View className="flex-row items-center gap-3">
                        <View className="w-10 h-10 rounded-full bg-brand-500/10 items-center justify-center">
                            <SectionIcon size={20} color={COLORS.primary} />
                        </View>
                        <View>
                            <Text className="text-base font-semibold text-slate-200">{title}</Text>
                            {subtitle && <Text className="text-xs text-slate-500">{subtitle}</Text>}
                        </View>
                    </View>
                    {isExpanded ? (
                        <ChevronDown size={20} color={COLORS.textMuted} />
                    ) : (
                        <ChevronRight size={20} color={COLORS.textMuted} />
                    )}
                </TouchableOpacity>

                {isExpanded && (
                    <View className="p-4 bg-[#151515] border-x border-b border-white/10 rounded-b-2xl">
                        {files.length > 0 ? (
                            files.map(file => <FileCard key={file.id} file={file} />)
                        ) : (
                            <View className="py-4 items-center">
                                <Text className="text-sm text-slate-500">{emptyText}</Text>
                            </View>
                        )}
                    </View>
                )}
            </View>
        );
    };


    return (
        <SafeAreaView className="flex-1 bg-black" edges={["top"]}>
            {/* Header */}
            <View className="bg-black border-b border-white/10 px-5 py-4">
                <Text className="text-3xl font-black text-slate-100">Arquivos</Text>
                <Text className="text-sm text-slate-400">Seus materiais de estudo</Text>
            </View>

            {/* Search */}
            <View className="px-4 py-3">
                <SearchBar
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Buscar arquivos..."
                    variant="light"
                />
            </View>

            {/* Files Sections */}
            <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
                <View className="pb-24">
                    {/* Groups Sections */}
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

                    {/* My Archives Section */}
                    <AccordionSection
                        id="meus_arquivos"
                        title="Meus arquivos"
                        subtitle="Arquivos que eu enviei"
                        files={myFiles}
                        icon={FileUp}
                        emptyText="Você ainda não enviou nenhum arquivo"
                    />

                    {filteredFiles.length === 0 && (
                        <View className="items-center py-8">
                            <Text className="text-slate-400 font-medium mt-3">Nenhum arquivo encontrado</Text>
                            <Text className="text-sm text-slate-500">Tente buscar por outro nome</Text>
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
                <UploadVaultModal
                    onClose={() => setShowUploadModal(false)}
                    onRefresh={refresh}
                />
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
