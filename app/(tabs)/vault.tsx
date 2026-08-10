import { Fragment, useState, useMemo, useCallback, useEffect } from "react";

import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    Modal,
    RefreshControl,
    FlatList,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "@/components/ui/TelaSegura";
import {
    FileText,
    Image as ImageIcon,
    ChevronRight,
    Search,
    Folder,
    User,
    Users,
    Plus,
    Ellipsis,
    Bookmark,
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
import UploadVaultModal from "@/app/(modals)/upload-vault";
import FileDetailModal from "@/app/(modals)/archive-details";
import { Skeleton } from "@/components/ui/Skeleton";

import { useArchives } from "@/hooks/useArchives";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Book } from "lucide-react-native";

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
        showAvatar && file.profiles?.nome_usuario
            ? `enviado por ${file.profiles.nome_usuario}`
            : "";

    const sub = showAvatar ? nomeUploader : meta;

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
    const [buscando, setBuscando] = useState(false);

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
            filteredFiles.filter(
                (f) =>
                    f.user_id !== userId &&
                    f.arquivos_grupos &&
                    f.arquivos_grupos.length > 0
            ),
        [filteredFiles, userId]
    );

    const mostrarMeus = filtro === "todos" || filtro === "meus";
    const mostrarGrupo = filtro === "todos" || filtro === "grupo";

    // Filtros de origem, seguindo a navegação entre seções do design.
    const FILTROS_ARQUIVOS: { key: FiltroArquivo; label: string; Icone: typeof User }[] = [
        { key: "todos", label: "Todos", Icone: Folder },
        { key: "meus", label: "Meus", Icone: User },
        { key: "grupo", label: "Do grupo", Icone: Users },
    ];

    const renderArquivos = () => (
        <>
            {buscando && (
                <View style={{ paddingHorizontal: 18, paddingBottom: 12 }}>
                    <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Buscar arquivos..." />
                </View>
            )}

            {/* Switch de origem dos arquivos, igual ao alternador Calendário/Blocos */}
            <View style={{ paddingHorizontal: 18, paddingBottom: 12 }}>
                <View
                    style={{
                        alignSelf: "flex-start",
                        flexDirection: "row",
                        backgroundColor: HADES.surfaceRaised,
                        borderRadius: 19,
                        padding: 3,
                        gap: 2,
                    }}
                >
                    {FILTROS_ARQUIVOS.map(({ key, label, Icone }) => {
                        const ativo = filtro === key;
                        return (
                            <TouchableOpacity
                                key={key}
                                onPress={() => setFiltro(key)}
                                activeOpacity={0.8}
                                accessibilityRole="button"
                                accessibilityLabel={label}
                                accessibilityState={{ selected: ativo }}
                                style={{
                                    width: 36,
                                    height: 32,
                                    borderRadius: 16,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    backgroundColor: ativo ? HADES.accentTint : "transparent",
                                }}
                            >
                                <Icone size={16} color={ativo ? HADES.accentSolid : HADES.textFaint} />
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={carregandoArquivos || atualizandoGrupos}
                        onRefresh={handleRefresh}
                        tintColor={HADES.accentSolid}
                    />
                }
            >
                {mostrarMeus && (
                    <>
                        {/* Cabeçalho: título + contagem + "Ver tudo" */}
                        <View
                            style={{
                              width: 'auto',
                              flexDirection: "row",
                              alignItems: "baseline",
                              justifyContent: "space-between",
                              marginVertical: 8,
                              paddingHorizontal: 4,
                          }}
                        >
                            <Text style={{ fontSize: 16, fontWeight: "700", color: HADES.text, letterSpacing: -0.2 }}>
                                Meus arquivos{" "}
                            </Text>
                            <Text style={{ color: HADES.textFaint, fontWeight: "600", fontSize: 12.5 }}>{myFiles.length}</Text>
                        </View>

                        {/* Linhas de arquivo, só com divisórias entre elas */}
                        {myFiles.length > 0 ? (
                            myFiles.map((file, i) => (
                                <Fragment key={file.id}>
                                    {i > 0 && <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.05)" }} />}
                                    <FileRow file={file} onPress={() => setSelectedFileForDetail(file)} />
                                </Fragment>
                            ))
                        ) : (
                            <View style={{ paddingVertical: 18, alignItems: "center" }}>
                                <Text style={{ fontSize: 12.5, color: HADES.textDim }}>
                                    Você ainda não enviou nenhum arquivo
                                </Text>
                            </View>
                        )}
                    </>
                )}

                {mostrarGrupo && (
                    <>
                        {/* Cabeçalho "Do grupo" com o selo de cada grupo */}
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 8,
                                marginTop: 18,
                                marginBottom: 8,
                                paddingHorizontal: 4,
                                flexWrap: "wrap",
                            }}
                        >
                            <Text style={{ fontSize: 16, fontWeight: "700", color: HADES.text, letterSpacing: -0.2 }}>
                                Do grupo
                            </Text>
                            {grupos
                                .filter((g: any) => getGroupFiles(g.id).length > 0)
                                .map((g: any) => (
                                    <View
                                        key={g.id}
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            gap: 5,
                                            backgroundColor: "rgba(77,148,255,0.10)",
                                            borderRadius: 7,
                                            paddingHorizontal: 8,
                                            paddingVertical: 3,
                                        }}
                                    >
                                        <Users size={11} color={HADES.subjectBlue} />
                                        <Text style={{ fontSize: 10.5, color: HADES.subjectBlue, fontWeight: "600" }}>
                                            {g.nome_grupo}
                                        </Text>
                                    </View>
                                ))}
                        </View>

                        {/* Linhas de arquivo do grupo, só com divisórias entre elas */}
                        {arquivosDosGrupos.length > 0 ? (
                            arquivosDosGrupos.map((file, i) => (
                                <Fragment key={file.id}>
                                    {i > 0 && <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.05)" }} />}
                                    <FileRow file={file} showAvatar onPress={() => setSelectedFileForDetail(file)} />
                                </Fragment>
                            ))
                        ) : (
                            <View style={{ paddingVertical: 18, alignItems: "center" }}>
                                <Text style={{ fontSize: 12.5, color: HADES.textDim }}>
                                    Nenhum arquivo compartilhado no grupo ainda
                                </Text>
                            </View>
                        )}
                    </>
                )}

                {!carregandoArquivos && filteredFiles.length === 0 && (
                    <View style={{ alignItems: "center", paddingVertical: 32 }}>
                        <Text style={{ color: HADES.textMuted, fontWeight: "600" }}>Nenhum arquivo encontrado</Text>
                        <Text style={{ fontSize: 13, color: HADES.textDim, marginTop: 4 }}>
                            Tente buscar por outro nome
                        </Text>
                    </View>
                )}
            </ScrollView>

            {/* FAB de upload */}
            <TouchableOpacity
                onPress={() => setShowUploadModal(true)}
                activeOpacity={0.85}
                style={{
                    position: "absolute",
                    bottom: 20,
                    right: 20,
                    width: 54,
                    height: 54,
                    borderRadius: 27,
                    backgroundColor: HADES.accentSolid,
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: "rgba(255,154,0,0.35)",
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 1,
                    shadowRadius: 24,
                    elevation: 8,
                }}
            >
                <Plus size={24} color="#000" />
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
                    onPress={() => setBuscando((v) => !v)}
                    style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: buscando ? HADES.accentSolid : HADES.surfaceRaised,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Search size={18} color={buscando ? "#000" : HADES.textSecondary} />
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
