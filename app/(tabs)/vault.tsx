import { useState, useMemo, useCallback, useEffect, type ReactNode } from "react";

import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    Modal,
    LayoutAnimation,
    Platform,
    UIManager,
    RefreshControl,
    FlatList,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "@/components/ui/TelaSegura";
import {
    FileText,
    Image as ImageIcon,
    ChevronRight,
    ChevronDown,
    FileUp,
    Folder,
    Search,
    User,
    Users,
    Plus,
    Bookmark,
    LayoutGrid,
    CalendarClock,
    Download,
    Pencil,
    Sparkles,
    Check,
} from "@/components/ui/icons";

import { HADES } from "@/constants/hades";
import { useMeusGrupos } from "@/hooks/useMeusGrupos";
import SearchBar from "@/components/ui/SearchBar";
import Avatar from "@/components/ui/Avatar";
import CardPublicacao from "@/components/comunidade/CardPublicacao";
import MenuPublicacao from "@/components/comunidade/MenuPublicacao";
import SheetComentarios from "@/components/comunidade/SheetComentarios";
import {
    alternarCurtida,
    alternarSalvo,
    bloquearAutor,
    buscarSalvos,
    denunciar,
} from "@/services/comunidade";
import { abrirArquivoDoBucket } from "@/services/visualizarArquivo";
import { confirm } from "@/services/confirm";
import { toast } from "@/services/toast";
import { usePlanos } from "@/hooks/usePlanos";
import type { Plano } from "@/types/cronograma";
import type { Publicacao } from "@/types/comunidade";
import FotoDoGrupo from "@/components/ui/FotoDoGrupo";
import UploadVaultModal from "@/app/(modals)/upload-vault";
import FileDetailModal from "@/app/(modals)/archive-details";
import { Skeleton } from "@/components/ui/Skeleton";

import { useArchives } from "@/hooks/useArchives";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

type AbaVault = "arquivos" | "roadmaps" | "salvos";
type FiltroArquivo = "todos" | "meus" | "grupo";

function formatarTamanho(bytes: number | null | undefined): string {
    if (bytes == null) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function tempoRelativo(dataISO: string): string {
    const agora = Date.now();
    const entao = new Date(dataISO).getTime();
    const diffMs = agora - entao;
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return "agora";
    if (diffMin < 60) return `há ${diffMin} min`;
    const diffHoras = Math.floor(diffMin / 60);
    if (diffHoras < 24) return `há ${diffHoras}h`;
    const diffDias = Math.floor(diffHoras / 24);
    if (diffDias < 7) return `há ${diffDias} dia${diffDias > 1 ? "s" : ""}`;
    const diffSemanas = Math.floor(diffDias / 7);
    if (diffSemanas < 5) return `há ${diffSemanas} semana${diffSemanas > 1 ? "s" : ""}`;
    if (diffDias < 365) return new Date(dataISO).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    return new Date(dataISO).toLocaleDateString("pt-BR");
}

function extensao(path: string | null): string {
    if (!path) return "";
    return path.split(".").pop()?.toLowerCase() ?? "";
}

interface FileRowProps {
    file: any;
    showAvatar?: boolean;
    onPress: () => void;
}

function FileRow({ file, showAvatar, onPress }: FileRowProps) {
    const ext = extensao(file.storage_path);
    const isPdf = ext === "pdf";
    const isImage = ["png", "jpg", "jpeg", "gif", "webp", "bmp"].includes(ext);
    const tamanho = formatarTamanho(file.tamanho_bytes);

    const icone = isImage
        ? { Icon: ImageIcon, cor: HADES.blue, fundo: "rgba(77,148,255,0.12)" as const }
        : isPdf
          ? { Icon: FileText, cor: HADES.red, fundo: "rgba(208,69,94,0.14)" as const }
          : { Icon: FileText, cor: HADES.green, fundo: "rgba(31,157,99,0.14)" as const };

    const meta = [ext.toUpperCase(), tamanho, tempoRelativo(file.created_at)]
        .filter(Boolean)
        .join(" · ");

    const nomeUploader =
        !showAvatar && file.profiles?.nome_usuario
            ? `enviado por ${file.profiles.nome_usuario}`
            : "";

    const sub = [meta, nomeUploader].filter(Boolean).join(" · ");

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 12,
                paddingHorizontal: 14,
            }}
        >
            <View
                style={{
                    width: 40,
                    height: 40,
                    borderRadius: 11,
                    backgroundColor: icone.fundo,
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                }}
            >
                <icone.Icon size={19} color={icone.cor} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                    style={{ fontSize: 13.5, fontWeight: "600", color: HADES.text }}
                    numberOfLines={1}
                >
                    {file.titulo}
                </Text>
                <Text
                    style={{ fontSize: 11.5, color: HADES.textFaint, marginTop: 2 }}
                    numberOfLines={1}
                >
                    {sub}
                </Text>
            </View>
            {showAvatar && (
                <Avatar
                    foto={file.profiles?.foto_usuario}
                    nome={file.profiles?.nome_usuario ?? "?"}
                    size={26}
                />
            )}
        </TouchableOpacity>
    );
}

function FileRowSkeleton() {
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 12,
                paddingHorizontal: 14,
            }}
        >
            <Skeleton width={40} height={40} borderRadius={11} hades />
            <View style={{ flex: 1 }}>
                <Skeleton width="55%" height={13} hades />
                <Skeleton width="40%" height={11} hades style={{ marginTop: 2 }} />
            </View>
            <Skeleton width={17} height={17} borderRadius={3} hades />
        </View>
    );
}

/**
 * Origem do plano, em ordem de prioridade pro badge do card: importado > roadmap de
 * grupo > gerado por IA > criado manualmente. Um roadmap de grupo pode também ter sido
 * "gerado por IA" (é como ele nasce), mas o que importa mostrar é que é de grupo.
 */
function origemDoPlano(plano: Plano): { Icone: typeof Users; texto: string; cor: string } {
    if (plano.importadoDeNome) {
        return { Icone: Download, texto: `Importado de ${plano.importadoDeNome}`, cor: HADES.accentSolid };
    }
    if (plano.roadmapDeGrupo) {
        return { Icone: Users, texto: "Roadmap de grupo", cor: HADES.subjectBlue };
    }
    if (plano.geradoPorIA) {
        return { Icone: Sparkles, texto: "Gerado por IA", cor: HADES.accentSolid };
    }
    return { Icone: Pencil, texto: "Criado por você", cor: HADES.textFaint };
}

function RoadmapCard({ plano, onPress }: { plano: Plano; onPress: () => void }) {
    const origem = origemDoPlano(plano);
    const concluido = plano.blocosEstudoTotal > 0 && plano.blocosConcluidos >= plano.blocosEstudoTotal;
    const pct =
        plano.blocosEstudoTotal > 0 ? Math.round((plano.blocosConcluidos / plano.blocosEstudoTotal) * 100) : 0;
    const materiasExtras = Math.max(0, plano.materias.length - 3);

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.85}
            style={{
                backgroundColor: HADES.surface,
                borderWidth: 1,
                borderColor: HADES.border,
                borderRadius: 16,
                padding: 16,
                marginBottom: 12,
                opacity: concluido ? 0.75 : 1,
            }}
        >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text
                    style={{
                        fontSize: 15.5,
                        fontWeight: "700",
                        color: concluido ? HADES.textFaint : HADES.text,
                        letterSpacing: -0.2,
                        flex: 1,
                    }}
                    numberOfLines={1}
                >
                    {plano.nome}
                </Text>
                {concluido ? (
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                            backgroundColor: "rgba(48,209,88,0.12)",
                            borderRadius: 7,
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                        }}
                    >
                        <Check size={11} color={HADES.green} />
                        <Text style={{ fontSize: 10.5, color: HADES.green, fontWeight: "600" }}>Concluído</Text>
                    </View>
                ) : (
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                            backgroundColor: `${origem.cor}1a`,
                            borderRadius: 7,
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                        }}
                    >
                        <origem.Icone size={11} color={origem.cor} />
                        <Text
                            style={{ fontSize: 10.5, color: origem.cor, fontWeight: "600" }}
                            numberOfLines={1}
                        >
                            {origem.texto}
                        </Text>
                    </View>
                )}
            </View>

            {plano.blocosEstudoTotal > 0 && (
                <>
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "baseline",
                            justifyContent: "space-between",
                            marginTop: 13,
                            marginBottom: 8,
                        }}
                    >
                        <Text style={{ fontSize: 12.5, color: HADES.textFaint, fontWeight: "600" }}>
                            {plano.blocosConcluidos} de {plano.blocosEstudoTotal} blocos
                        </Text>
                        <Text
                            style={{
                                fontSize: 13,
                                fontWeight: "700",
                                color: concluido ? HADES.green : HADES.accentSolid,
                            }}
                        >
                            {pct}%
                        </Text>
                    </View>
                    <View
                        style={{
                            height: 9,
                            borderRadius: 5,
                            backgroundColor: HADES.surfaceOverlay,
                            overflow: "hidden",
                        }}
                    >
                        <View
                            style={{
                                height: "100%",
                                width: `${pct}%`,
                                borderRadius: 5,
                                backgroundColor: concluido ? HADES.green : HADES.accentSolid,
                            }}
                        />
                    </View>
                </>
            )}

            {plano.materias.length > 0 && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                    {plano.materias.slice(0, 3).map((materia) => (
                        <Text
                            key={materia.nome}
                            style={{
                                fontSize: 11,
                                fontWeight: "600",
                                color: materia.cor,
                                backgroundColor: `${materia.cor}1f`,
                                borderRadius: 6,
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                overflow: "hidden",
                            }}
                        >
                            {materia.nome}
                        </Text>
                    ))}
                    {materiasExtras > 0 && (
                        <Text
                            style={{
                                fontSize: 11,
                                fontWeight: "600",
                                color: HADES.textMuted,
                                backgroundColor: HADES.surfaceOverlay,
                                borderRadius: 6,
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                overflow: "hidden",
                            }}
                        >
                            +{materiasExtras}
                        </Text>
                    )}
                </View>
            )}

            {plano.proximoBloco && (
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        marginTop: 13,
                        paddingTop: 12,
                        borderTopWidth: 1,
                        borderTopColor: "rgba(255,255,255,0.05)",
                    }}
                >
                    <CalendarClock size={16} color={HADES.textFaint} />
                    <Text style={{ fontSize: 12.5, color: HADES.textSecondary, flex: 1 }} numberOfLines={1}>
                        <Text style={{ fontWeight: "600", color: plano.proximoBloco.materiaCor }}>
                            {plano.proximoBloco.materia}
                        </Text>
                        {plano.proximoBloco.topico ? ` · ${plano.proximoBloco.topico}` : ""} —{" "}
                        {plano.proximoBloco.quando}
                    </Text>
                    <ChevronRight size={16} color={HADES.textFaint} />
                </View>
            )}
        </TouchableOpacity>
    );
}

export default function VaultScreen() {
    const [aba, setAba] = useState<AbaVault>("arquivos");
    const [filtro, setFiltro] = useState<FiltroArquivo>("todos");
    const [searchQuery, setSearchQuery] = useState("");
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedFileForDetail, setSelectedFileForDetail] = useState<any | null>(null);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

    const { user, userId } = useAuth();
    const { archives, isLoading: carregandoArquivos, refresh } = useArchives(userId || undefined);
    const { grupos, atualizando: atualizandoGrupos, atualizar: atualizarGrupos } = useMeusGrupos();
    const { profile } = useProfile(userId ?? "");
    const { planos, carregando: carregandoPlanos, recarregarPlanos } = usePlanos(userId);

    // ───── Salvos ─────
    const [salvosItens, setSalvosItens] = useState<Publicacao[]>([]);
    const [salvosCursor, setSalvosCursor] = useState<string | null>(null);
    const [salvosCarregando, setSalvosCarregando] = useState(true);
    const [salvosCarregandoMais, setSalvosCarregandoMais] = useState(false);
    const [menuSalvo, setMenuSalvo] = useState<Publicacao | null>(null);
    const [comentariosDe, setComentariosDe] = useState<Publicacao | null>(null);
    const [salvosErro, setSalvosErro] = useState<unknown>(null);

    const viewAberta = aba === "salvos";

    const carregarSalvos = useCallback(async () => {
        setSalvosCarregando(true);
        setSalvosErro(null);
        try {
            const pagina = await buscarSalvos({});
            setSalvosItens(pagina.itens);
            setSalvosCursor(pagina.proximoCursor);
        } catch (e) {
            setSalvosErro(e);
        } finally {
            setSalvosCarregando(false);
        }
    }, []);

    useEffect(() => {
        if (viewAberta) carregarSalvos();
    }, [viewAberta, carregarSalvos]);

    const carregarMaisSalvos = useCallback(async () => {
        if (!salvosCursor || salvosCarregandoMais || salvosCarregando) return;
        setSalvosCarregandoMais(true);
        try {
            const pagina = await buscarSalvos({ cursor: salvosCursor });
            setSalvosItens((atuais) => {
                const vistos = new Set(atuais.map((item) => item.id));
                return [...atuais, ...pagina.itens.filter((item) => !vistos.has(item.id))];
            });
            setSalvosCursor(pagina.proximoCursor);
        } catch {
        } finally {
            setSalvosCarregandoMais(false);
        }
    }, [salvosCursor, salvosCarregandoMais, salvosCarregando]);

    /** Só existe pra Galeria — é a única origem que aparece na aba Salvos. */
    const salvarPublicacao = useCallback((publicacao: Publicacao) => {
        if (publicacao.tipo !== "galeria") return;

        const passaASalvar = !publicacao.salvoPorMim;
        setSalvosItens((atuais) =>
            atuais.map((item) =>
                item.id === publicacao.id ? { ...item, salvoPorMim: passaASalvar } : item
            )
        );
        alternarSalvo(publicacao.referenciaId, passaASalvar)
            .then(() => {
                if (!passaASalvar) {
                    setSalvosItens((atuais) => atuais.filter((item) => item.id !== publicacao.id));
                }
            })
            .catch(() => {
                setSalvosItens((atuais) =>
                    atuais.map((item) =>
                        item.id === publicacao.id ? { ...item, salvoPorMim: !passaASalvar } : item
                    )
                );
                toast.error("Não deu para salvar a publicação.");
            });
    }, []);

    const curtirPublicacao = useCallback((publicacao: Publicacao) => {
        const anterior = { curtidoPorMim: publicacao.curtidoPorMim, curtidas: publicacao.curtidas };
        const passaACurtir = !publicacao.curtidoPorMim;
        setSalvosItens((atuais) =>
            atuais.map((item) =>
                item.id === publicacao.id
                    ? { ...item, curtidoPorMim: passaACurtir, curtidas: Math.max(0, item.curtidas + (passaACurtir ? 1 : -1)) }
                    : item
            )
        );
        alternarCurtida(
            { origem: publicacao.origem, referenciaId: publicacao.referenciaId },
            passaACurtir
        ).catch(() => {
            setSalvosItens((atuais) =>
                atuais.map((item) => (item.id === publicacao.id ? { ...item, ...anterior } : item))
            );
            toast.error("Não deu para registrar sua curtida.");
        });
    }, []);

    const denunciarPublicacao = useCallback(async (publicacao: Publicacao) => {
        setMenuSalvo(null);
        try {
            await denunciar({ ref: { origem: publicacao.origem, referenciaId: publicacao.referenciaId } });
            toast.success("Denúncia enviada. Vamos analisar.");
        } catch {
            toast.error("Não deu para enviar a denúncia.");
        }
    }, []);

    const bloquearAutorPublicacao = useCallback((publicacao: Publicacao) => {
        setMenuSalvo(null);
        confirm({
            title: `Bloquear ${publicacao.autor.nome}?`,
            message: "Nada publicado por essa pessoa vai aparecer no seu feed.",
            confirmText: "Bloquear",
            destructive: true,
            onConfirm: async () => {
                try {
                    await bloquearAutor(publicacao.autor.id);
                    setSalvosItens((atuais) => atuais.filter((item) => item.autor.id !== publicacao.autor.id));
                    toast.success(`${publicacao.autor.nome} foi bloqueado.`);
                } catch {
                    toast.error("Não deu para bloquear agora.");
                }
            },
        });
    }, []);

    const baixarArquivo = useCallback(async (publicacao: Publicacao) => {
        if (publicacao.tipo !== "arquivo") return;
        if (!publicacao.storagePath) {
            toast.error("Esse arquivo não está mais disponível.");
            return;
        }
        await abrirArquivoDoBucket(publicacao.storagePath);
    }, []);

    if (!userId) return null;

    const handleRefresh = () => {
        refresh();
        atualizarGrupos();
        recarregarPlanos();
    };

    const toggleSection = (id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const filteredFiles = (archives || []).filter((f) =>
        f.titulo?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getGroupFiles = (groupId: string) => {
        return filteredFiles.filter(
            (file) =>
                file.arquivos_grupos?.some((ag: any) => ag.grupo_id === groupId) &&
                file.user_id !== userId
        );
    };

    const myFiles = filteredFiles.filter((file) => file.user_id === userId);

    const meusArquivos = useMemo(
        () => (archives || []).filter((f) => f.user_id === userId),
        [archives, userId]
    );

    const arquivosDosGrupos = useMemo(
        () =>
            (archives || []).filter(
                (f) =>
                    f.user_id !== userId &&
                    f.arquivos_grupos &&
                    f.arquivos_grupos.length > 0
            ),
        [archives, userId]
    );


    const mostrarMeus = filtro === "todos" || filtro === "meus";
    const mostrarGrupo = filtro === "todos" || filtro === "grupo";

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

    const FileCardSkeleton = () => (
        <View
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
            <Skeleton width={44} height={44} borderRadius={12} hades />
            <View style={{ flex: 1 }}>
                <Skeleton width="60%" height={14} hades />
                <Skeleton width="40%" height={12} hades style={{ marginTop: 2 }} />
            </View>
            <ChevronRight size={18} color={HADES.dot} />
        </View>
    );

    const AccordionSection = ({
        id,
        title,
        subtitle,
        files,
        icon: SectionIcon = Folder,
        visual,
        emptyText = "Nenhum arquivo enviado",
        carregando = false,
    }: {
        id: string;
        title: string;
        subtitle?: string;
        files: any[];
        icon?: any;
        visual?: ReactNode;
        emptyText?: string;
        carregando?: boolean;
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
                        {visual ?? (
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
                        )}
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
                        {carregando && files.length === 0 ? (
                            <>
                                <FileCardSkeleton />
                                <FileCardSkeleton />
                            </>
                        ) : files.length > 0 ? (
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

    const renderArquivos = () => (
        <>
            <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
                <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Buscar arquivos..." />
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={carregandoArquivos || atualizandoGrupos}
                        onRefresh={handleRefresh}
                        tintColor={HADES.accentSolid}
                    />
                }
            >
                {grupos.map((group: any) => (
                    <AccordionSection
                        key={group.id}
                        id={group.id}
                        title={group.nome_grupo}
                        subtitle="Arquivos compartilhados no grupo"
                        files={getGroupFiles(group.id)}
                        visual={<FotoDoGrupo foto={group.foto_grupo} size={40} />}
                        emptyText={`Nenhum arquivo enviado no ${group.nome_grupo}`}
                        carregando={carregandoArquivos}
                    />
                ))}

                <AccordionSection
                    id="meus_arquivos"
                    title="Meus arquivos"
                    subtitle="Arquivos que eu enviei"
                    files={myFiles}
                    icon={FileUp}
                    visual={<Avatar foto={profile?.foto_usuario} nome={profile?.nome_usuario} size={40} />}
                    emptyText="Você ainda não enviou nenhum arquivo"
                    carregando={carregandoArquivos}
                />

                {!carregandoArquivos && filteredFiles.length === 0 && (
                    <View style={{ alignItems: "center", paddingVertical: 32 }}>
                        <Text style={{ color: HADES.textMuted, fontWeight: "600" }}>Nenhum arquivo encontrado</Text>
                        <Text style={{ fontSize: 13, color: HADES.textDim, marginTop: 4 }}>
                            Tente buscar por outro nome
                        </Text>
                    </View>
                )}
            </ScrollView>

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
        </>
    );

    const renderRoadmaps = () => (
        <>
            {carregandoPlanos && planos.length === 0 ? (
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 7 }}
                >
                    <FileRowSkeleton />
                    <FileRowSkeleton />
                </ScrollView>
            ) : planos.length === 0 ? (
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{
                        flex: 1,
                        alignItems: "center",
                        justifyContent: "center",
                        paddingHorizontal: 40,
                    }}
                    refreshControl={
                        <RefreshControl
                            refreshing={carregandoPlanos}
                            onRefresh={handleRefresh}
                            tintColor={HADES.accentSolid}
                        />
                    }
                >
                    <CalendarClock size={48} color={HADES.dot} />
                    <Text
                        style={{
                            fontSize: 16,
                            fontWeight: "700",
                            color: HADES.textMuted,
                            marginTop: 16,
                            textAlign: "center",
                        }}
                    >
                        Nenhum plano ainda
                    </Text>
                    <Text
                        style={{
                            fontSize: 13,
                            color: HADES.textDim,
                            marginTop: 6,
                            textAlign: "center",
                            lineHeight: 20,
                        }}
                    >
                        Crie e importe planos de estudo personalizados com acompanhamento de progresso.
                    </Text>
                    <TouchableOpacity
                        onPress={() =>
                            router.push({ pathname: "/(modals)/gerar-roadmap", params: { escopo: "pessoal" } })
                        }
                        activeOpacity={0.85}
                        style={{
                            marginTop: 20,
                            paddingHorizontal: 22,
                            paddingVertical: 11,
                            borderRadius: 10,
                            backgroundColor: HADES.accentSolid,
                        }}
                    >
                        <Text style={{ fontSize: 13.5, fontWeight: "700", color: "#000" }}>
                            Gerar com IA
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            ) : (
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 11, paddingBottom: 80 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={carregandoPlanos}
                            onRefresh={handleRefresh}
                            tintColor={HADES.accentSolid}
                        />
                    }
                >
                    {planos.map((plano) => (
                        <RoadmapCard
                            key={plano.id}
                            plano={plano}
                            onPress={() =>
                                router.push({
                                    pathname: "/(modals)/plano-editor",
                                    params: { planoId: plano.id },
                                })
                            }
                        />
                    ))}

                    <TouchableOpacity
                        onPress={() =>
                            router.push({ pathname: "/(modals)/gerar-roadmap", params: { escopo: "pessoal" } })
                        }
                        activeOpacity={0.8}
                        style={{
                            borderWidth: 1.5,
                            borderStyle: "dashed",
                            borderColor: "rgba(255,163,72,0.45)",
                            borderRadius: 16,
                            padding: 16,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                        }}
                    >
                        <Plus size={17} color={HADES.accentSolid} />
                        <Text style={{ fontSize: 13.5, fontWeight: "700", color: HADES.accentSolid }}>
                            Novo roadmap
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            )}
        </>
    );

    const renderSalvos = () => (
        <>
            {salvosCarregando && salvosItens.length === 0 ? (
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 7 }}
                    refreshControl={
                        <RefreshControl
                            refreshing={salvosCarregando}
                            onRefresh={carregarSalvos}
                            tintColor={HADES.accentSolid}
                        />
                    }
                >
                    <FileRowSkeleton />
                    <FileRowSkeleton />
                    <FileRowSkeleton />
                </ScrollView>
            ) : salvosErro && salvosItens.length === 0 ? (
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{
                        flex: 1,
                        alignItems: "center",
                        justifyContent: "center",
                        paddingHorizontal: 40,
                    }}
                >
                    <Bookmark size={48} color={HADES.dot} />
                    <Text
                        style={{
                            fontSize: 16,
                            fontWeight: "700",
                            color: HADES.textMuted,
                            marginTop: 16,
                            textAlign: "center",
                        }}
                    >
                        Algo deu errado
                    </Text>
                    <Text
                        style={{
                            fontSize: 13,
                            color: HADES.textDim,
                            marginTop: 6,
                            textAlign: "center",
                            lineHeight: 20,
                        }}
                    >
                        Não foi possível carregar seus salvos.
                    </Text>
                </ScrollView>
            ) : (
                <FlatList
                    data={salvosItens}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={salvosCarregando}
                            onRefresh={carregarSalvos}
                            tintColor={HADES.accentSolid}
                        />
                    }
                    onEndReached={carregarMaisSalvos}
                    onEndReachedThreshold={0.4}
                    ListEmptyComponent={
                        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, paddingTop: 80 }}>
                            <Bookmark size={48} color={HADES.dot} />
                            <Text
                                style={{
                                    fontSize: 16,
                                    fontWeight: "700",
                                    color: HADES.textMuted,
                                    marginTop: 16,
                                    textAlign: "center",
                                }}
                            >
                                Nada salvo ainda
                            </Text>
                            <Text
                                style={{
                                    fontSize: 13,
                                    color: HADES.textDim,
                                    marginTop: 6,
                                    textAlign: "center",
                                    lineHeight: 20,
                                }}
                            >
                                Toque no ícone de salvar em qualquer publicação da Comunidade para guardá-la aqui.
                            </Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <CardPublicacao
                            publicacao={item}
                            onCurtir={() => curtirPublicacao(item)}
                            onSalvar={() => salvarPublicacao(item)}
                            onAdicionarArquivo={() => {}}
                            onComentar={() => setComentariosDe(item)}
                            onAbrirMenu={() => setMenuSalvo(item)}
                            onVerPlano={() =>
                                router.push({
                                    pathname: "/(modals)/plano-preview",
                                    params: {
                                        planoId: item.referenciaId,
                                        autorNome: item.autor.nome,
                                        autorFoto: item.autor.foto ?? "",
                                    },
                                })
                            }
                            onBaixarArquivo={() => baixarArquivo(item)}
                        />
                    )}
                />
            )}
            <MenuPublicacao
                publicacao={menuSalvo}
                onFechar={() => setMenuSalvo(null)}
                onVerPerfil={(publicacao) => {
                    setMenuSalvo(null);
                    router.push({
                        pathname: "/(modals)/member-profile",
                        params: { userId: publicacao.autor.id, administrador: "false" },
                    });
                }}
                onDenunciar={denunciarPublicacao}
                onBloquear={bloquearAutorPublicacao}
            />
            <SheetComentarios
                publicacao={comentariosDe}
                eu={{
                    id: userId,
                    nome: profile?.nome_usuario ?? null,
                    foto: profile?.foto_usuario ?? null,
                }}
                onFechar={() => setComentariosDe(null)}
                onContagemMudou={(delta) => {
                    if (comentariosDe) {
                        setSalvosItens((atuais) =>
                            atuais.map((item) =>
                                item.id === comentariosDe.id
                                    ? { ...item, comentarios: Math.max(0, item.comentarios + delta) }
                                    : item
                            )
                        );
                    }
                }}
            />
        </>
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top"]}>
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 18,
                    paddingBottom: 12,
                    gap: 12,
                }}
            >
                <Text
                    style={{
                        fontSize: 22,
                        fontWeight: "700",
                        color: HADES.text,
                        letterSpacing: -0.3,
                        flex: 1,
                    }}
                >
                    Vault
                </Text>
                <TouchableOpacity
                    activeOpacity={0.7}
                    style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: HADES.surfaceRaised,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Search size={18} color={HADES.textSecondary} />
                </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 18, paddingBottom: 14 }}>
                <View
                    style={{
                        flexDirection: "row",
                        backgroundColor: HADES.surface,
                        borderWidth: 1,
                        borderColor: HADES.border,
                        borderRadius: 12,
                        padding: 4,
                    }}
                >
                    {(
                        [
                            { key: "arquivos", label: "Arquivos" },
                            { key: "roadmaps", label: "Roadmaps" },
                            { key: "salvos", label: "Salvos" },
                        ] as const
                    ).map(({ key, label }) => {
                        const selecionada = aba === key;
                        return (
                            <TouchableOpacity
                                key={key}
                                activeOpacity={0.7}
                                onPress={() => {
                                    setAba(key as AbaVault);
                                    if (key !== "arquivos") setFiltro("todos");
                                }}
                                style={{
                                    flex: 1,
                                    alignItems: "center",
                                    paddingVertical: 9,
                                    borderRadius: 9,
                                    backgroundColor: selecionada
                                        ? HADES.surfaceOverlay
                                        : "transparent",
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 13,
                                        fontWeight: "600",
                                        color: selecionada
                                            ? HADES.text
                                            : HADES.textFaint,
                                    }}
                                >
                                    {label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {aba === "arquivos" && renderArquivos()}
            {aba === "roadmaps" && renderRoadmaps()}
            {aba === "salvos" && renderSalvos()}

            <Modal visible={showUploadModal} transparent animationType="fade">
                <UploadVaultModal onClose={() => setShowUploadModal(false)} onRefresh={refresh} />
            </Modal>
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
