import { useEffect, useState } from "react";

//Componentes do Native
import { View, Text, TouchableOpacity, ScrollView, Alert, Modal, TextInput, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";

//Componentes Lucide Native
import { ChevronLeft, Check, LogOut, Trash2 } from "lucide-react-native";

//Componente do expo-router
import { router, useLocalSearchParams } from "expo-router";

//Componentes do Projeto
import { HADES } from "@/constants/hades";
import Avatar from "@/components/ui/Avatar";
import ImagePickerAvatar from "@/components/ui/ImagePickerAvatar";
import { SecaoConfig, LinhaSwitch, LinhaEscolha, LinhaPerigo } from "@/components/cronograma/LinhasConfig";
import { useAuth } from "@/hooks/useAuth";
import {
    atualizarDadosGrupo,
    buscarGrupoPorId,
    buscarMembrosGrupo,
    contarMembrosGrupo,
    excluirGrupoAtual,
} from "@/services/grupos";
import type { Grupo, MembroGrupoComPerfil } from "@/types/grupos";

type ModalEdicao = "dados" | "meta" | "convite" | null;

export default function GroupSettingsScreen() {
    const { groupId } = useLocalSearchParams();
    const { userId } = useAuth();
    const [grupo, setGrupo] = useState<Grupo | null>(null);
    const [loading, setLoading] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [isPublic, setIsPublic] = useState(true);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [modalEdicao, setModalEdicao] = useState<ModalEdicao>(null);
    const [nomeGrupo, setNomeGrupo] = useState("");
    const [descricaoGrupo, setDescricaoGrupo] = useState("");
    const [metaHoras, setMetaHoras] = useState(10);
    const [qtdMembros, setQtdMembros] = useState<number | null>(0);
    const [membros, setMembros] = useState<MembroGrupoComPerfil[]>([]);
    const [modalTransferenciaAdmin, setModalTransferenciaAdmin] = useState(false);
    const [novoAdminId, setNovoAdminId] = useState<string | null>(null);

    //useEffect para buscar todas as informações do grupo
    useEffect(() => {
        if (!groupId) return;

        //Carrega os dados do grupo
        const carregarDados = async () => {
            setLoading(true);

            //Aqui a gente utiliza o Promise all para realizar duas funções, e retornar em duas variáveis
            const [grupoEncontrado, qtdMembros, membrosGrupo] = await Promise.all([
                buscarGrupoPorId(groupId as string),
                contarMembrosGrupo(groupId as string),
                buscarMembrosGrupo(groupId as string),
            ]);

            //Damos valor aos states, com a data retornada das funções
            setGrupo(grupoEncontrado);
            setQtdMembros(qtdMembros);
            setMembros(membrosGrupo);

            setLoading(false);
        };

        //roda a função
        carregarDados();
    }, [groupId]);

    useEffect(() => {
        if (!grupo) return;

        setNomeGrupo(grupo.nome_grupo ?? "");
        setDescricaoGrupo(grupo.descricao ?? "");
        setMetaHoras(grupo.meta_horas ?? 10);
        setImageUrl(grupo.foto_grupo);
        setIsPublic(grupo.publico);
    }, [grupo?.id]);

    //Quando abre o modal, os dados locais ficam vazios, para que possam ser editados
    const abrirModal = (modal: Exclude<ModalEdicao, null>) => {
        if (!grupo) return;
        setNomeGrupo(grupo.nome_grupo ?? "");
        setDescricaoGrupo(grupo.descricao ?? "");
        setMetaHoras(grupo.meta_horas ?? 10);
        setModalEdicao(modal);
    };

    //fecha o modal
    const fecharModal = () => {
        setModalEdicao(null);
    };

    const salvarGrupo = async (grupoAtualizado: Grupo) => {
        setSalvando(true);

        const { data, error } = await atualizarDadosGrupo(grupoAtualizado);

        setSalvando(false);

        if (error) {
            Alert.alert("Erro ao salvar", error.message);
            return false;
        }

        setGrupo(data);
        return true;
    };

    //salva alteração realizadas
    const salvarDadosLocais = async () => {
        if (!grupo) return;

        const salvo = await salvarGrupo({
            ...grupo,
            nome_grupo: nomeGrupo.trim() || grupo.nome_grupo,
            descricao: descricaoGrupo.trim() || null,
            foto_grupo: imageUrl,
        });

        if (salvo) fecharModal();
    };

    //Salva a meta local
    const salvarMetaLocal = async () => {
        if (!grupo) return;

        const salvo = await salvarGrupo({
            ...grupo,
            meta_horas: metaHoras,
            foto_grupo: imageUrl,
        });

        if (salvo) fecharModal();
    };

    const excluirGrupo = async () => {
        if (!groupId) return;
        const { error } = await excluirGrupoAtual(groupId as string);

        if (error) {
            Alert.alert("Erro ao excluir grupo", error.message);
            return;
        }
    };

    const alternarPrivacidadeLocal = (valor: boolean) => {
        setIsPublic(valor);
        setGrupo((grupoAtual) =>
            grupoAtual
                ? {
                      ...grupoAtual,
                      publico: valor,
                  }
                : grupoAtual
        );
    };

    const salvarAlterações = (salvar: () => void | Promise<void>) => {
        Alert.alert("Salvar alterações", `Tem certeza que deseja salvar as alterações?`, [
            { text: "Cancelar", style: "cancel" },
            { text: "Salvar", style: "default", onPress: salvar },
        ]);
    };

    const handleLeaveGroup = () => {
        if ((qtdMembros ?? 0) > 1) {
            setNovoAdminId(null);
            setModalTransferenciaAdmin(true);
            return;
        }

        Alert.alert(
            "Sair do Grupo",
            `Tem certeza que deseja sair do ${grupo?.nome_grupo}? O grupo será apagado após esta ação.`,
            [
                { text: "Cancelar", style: "cancel" },
                { text: "Sair", style: "destructive", onPress: () => router.push("/(groups)") },
            ]
        );
    };

    const confirmarSaidaComTransferencia = () => {
        if (!novoAdminId) {
            Alert.alert("Escolha um novo admin", "Selecione uma pessoa para assumir a administração do grupo.");
            return;
        }

        const novoAdmin = membros.find((membro) => membro.user_id === novoAdminId);

        Alert.alert(
            "Transferir administração",
            `${novoAdmin?.userData?.nome_usuario ?? "Este membro"} será o novo admin antes de você sair do grupo.`,
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Confirmar",
                    style: "destructive",
                    onPress: () => {
                        setModalTransferenciaAdmin(false);
                        // TODO: chamar backend para transferir admin e remover o usuário atual do grupo.
                        router.replace("/(groups)");
                    },
                },
            ]
        );
    };

    const handleDeleteGroup = () => {
        Alert.alert(
            "Excluir Grupo",
            "Esta ação é irreversível. Todos os dados, arquivos e histórico do grupo serão apagados.",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Excluir",
                    style: "destructive",
                    onPress: async () => {
                        await excluirGrupo();
                        router.push("/(groups)");
                    },
                },
            ]
        );
    };

    // Example output: "2026-06-10"
    const formatarData = (data: string) => {
        return new Date(data).toLocaleDateString("pt-BR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        });
    };

    const copiarConvite = async () => {
        if (!grupo?.codigo_convite) return;

        await Clipboard.setStringAsync(grupo.codigo_convite);
        Alert.alert("Código copiado", "O código de convite foi copiado para a área de transferência.");
    };

    //Como é tudo o mesmo modal, aqui a gente verifica de qual campo é, para mudar os textos
    const renderModal = () => {
        const titulo =
            modalEdicao === "dados" ? "Editar grupo" : modalEdicao === "meta" ? "Meta semanal" : "Convite do grupo";

        const descricao =
            modalEdicao === "dados"
                ? "Atualize o nome e a descrição que aparecem para os membros."
                : modalEdicao === "meta"
                    ? "Defina a quantidade de horas que o grupo quer bater por semana."
                    : "Este código é gerado pelo StudoCore e pode ser compartilhado com novos membros.";

        const salvar =
            modalEdicao === "dados" ? salvarDadosLocais : modalEdicao === "meta" ? salvarMetaLocal : copiarConvite;

        return (
            <Modal visible={modalEdicao !== null} transparent animationType="fade" onRequestClose={fecharModal}>
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" }}>
                    <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={fecharModal} />

                    <View
                        style={{
                            backgroundColor: HADES.modalBg,
                            borderWidth: 1,
                            borderColor: HADES.border,
                            borderTopLeftRadius: 28,
                            borderTopRightRadius: 28,
                            paddingHorizontal: 20,
                            paddingTop: 12,
                            paddingBottom: 28,
                        }}
                    >
                        <View
                            style={{
                                width: 44,
                                height: 4,
                                borderRadius: 2,
                                backgroundColor: HADES.grip,
                                alignSelf: "center",
                                marginBottom: 20,
                            }}
                        />

                        <Text style={{ fontSize: 20, fontWeight: "700", color: HADES.text }}>{titulo}</Text>
                        <Text style={{ fontSize: 13, color: HADES.textMuted, marginTop: 6, marginBottom: 20, lineHeight: 19 }}>
                            {descricao}
                        </Text>

                        {modalEdicao === "dados" && (
                            <View style={{ gap: 16 }}>
                                <View>
                                    <Text style={estilos.rotuloCampo}>NOME</Text>
                                    <TextInput
                                        value={nomeGrupo}
                                        onChangeText={setNomeGrupo}
                                        placeholder="Nome do grupo"
                                        placeholderTextColor={HADES.textFaint}
                                        style={estilos.campo}
                                    />
                                </View>

                                <View>
                                    <Text style={estilos.rotuloCampo}>DESCRIÇÃO</Text>
                                    <TextInput
                                        value={descricaoGrupo}
                                        onChangeText={setDescricaoGrupo}
                                        placeholder="Explique o objetivo do grupo"
                                        placeholderTextColor={HADES.textFaint}
                                        multiline
                                        textAlignVertical="top"
                                        style={[estilos.campo, { minHeight: 100 }]}
                                    />
                                </View>
                            </View>
                        )}

                        {modalEdicao === "meta" && (
                            <View>
                                <View
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        marginBottom: 12,
                                    }}
                                >
                                    <Text style={estilos.rotuloCampo}>HORAS POR SEMANA</Text>
                                    <Text style={{ fontSize: 17, fontWeight: "700", color: HADES.accentSolid }}>
                                        {metaHoras}h
                                    </Text>
                                </View>

                                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                    <Text style={{ fontSize: 12, color: HADES.textDim, width: 28 }}>1h</Text>
                                    <View style={{ flex: 1, flexDirection: "row", gap: 4, height: 8 }}>
                                        {[...Array(20)].map((_, i) => {
                                            const valor = (i + 1) * 2;
                                            return (
                                                <TouchableOpacity
                                                    key={valor}
                                                    onPress={() => setMetaHoras(valor)}
                                                    style={{
                                                        flex: 1,
                                                        height: "100%",
                                                        borderRadius: 999,
                                                        backgroundColor:
                                                            valor <= metaHoras ? HADES.accentSolid : HADES.surfaceOverlay,
                                                    }}
                                                />
                                            );
                                        })}
                                    </View>
                                    <Text style={{ fontSize: 12, color: HADES.textDim, width: 28, textAlign: "right" }}>
                                        40h
                                    </Text>
                                </View>

                                <View
                                    style={{
                                        marginTop: 16,
                                        borderRadius: 14,
                                        backgroundColor: HADES.accentTint,
                                        borderWidth: 1,
                                        borderColor: HADES.accentTintBorder,
                                        padding: 14,
                                    }}
                                >
                                    <Text style={{ color: HADES.accentText, fontSize: 13.5, fontWeight: "600" }}>
                                        Prévia: meta de {metaHoras || "0"}h por semana
                                    </Text>
                                </View>
                            </View>
                        )}

                        {modalEdicao === "convite" && (
                            <View>
                                <Text style={estilos.rotuloCampo}>CÓDIGO DE CONVITE</Text>
                                <View
                                    style={{
                                        backgroundColor: HADES.settingsInset,
                                        borderWidth: 1,
                                        borderColor: HADES.borderSettings,
                                        borderRadius: 14,
                                        paddingHorizontal: 16,
                                        paddingVertical: 16,
                                    }}
                                >
                                    <Text style={{ color: HADES.text, fontSize: 17, fontWeight: "700" }}>
                                        {grupo?.codigo_convite || "Nenhum código gerado"}
                                    </Text>
                                </View>
                                <Text style={{ fontSize: 12, color: HADES.textDim, marginTop: 10 }}>
                                    O código é criado automaticamente pelo aplicativo.
                                </Text>
                            </View>
                        )}

                        <View style={{ flexDirection: "row", gap: 10, marginTop: 24 }}>
                            <TouchableOpacity onPress={fecharModal} activeOpacity={0.8} style={estilos.botaoSecundario}>
                                <Text style={{ color: HADES.textSecondary, fontWeight: "600" }}>Cancelar</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => salvarAlterações(salvar)}
                                disabled={salvando}
                                activeOpacity={0.85}
                                style={[estilos.botaoPrimario, { opacity: salvando ? 0.6 : 1 }]}
                            >
                                <Text style={{ color: "#000", fontWeight: "700" }}>
                                    {salvando ? "Salvando..." : modalEdicao === "convite" ? "Copiar" : "Salvar"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        );
    };

    const renderModalTransferenciaAdmin = () => {
        const candidatosAdmin = membros.filter((membro) => membro.user_id !== userId);

        return (
            <Modal
                visible={modalTransferenciaAdmin}
                transparent
                animationType="fade"
                onRequestClose={() => setModalTransferenciaAdmin(false)}
            >
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" }}>
                    <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setModalTransferenciaAdmin(false)} />

                    <View
                        style={{
                            backgroundColor: HADES.modalBg,
                            borderWidth: 1,
                            borderColor: HADES.border,
                            borderTopLeftRadius: 28,
                            borderTopRightRadius: 28,
                            paddingHorizontal: 20,
                            paddingTop: 12,
                            paddingBottom: 28,
                            maxHeight: "78%",
                        }}
                    >
                        <View
                            style={{
                                width: 44,
                                height: 4,
                                borderRadius: 2,
                                backgroundColor: HADES.grip,
                                alignSelf: "center",
                                marginBottom: 20,
                            }}
                        />

                        <Text style={{ fontSize: 20, fontWeight: "700", color: HADES.text }}>Escolher novo admin</Text>
                        <Text style={{ fontSize: 13, color: HADES.textMuted, marginTop: 6, marginBottom: 20, lineHeight: 19 }}>
                            Antes de sair, escolha quem vai assumir a administração do grupo.
                        </Text>

                        {candidatosAdmin.length === 0 ? (
                            <View
                                style={{
                                    backgroundColor: HADES.surface,
                                    borderWidth: 1,
                                    borderColor: HADES.border,
                                    borderRadius: 16,
                                    padding: 14,
                                }}
                            >
                                <Text style={{ color: HADES.textSecondary, fontWeight: "600" }}>
                                    Nenhum membro disponível
                                </Text>
                                <Text style={{ color: HADES.textDim, fontSize: 13, marginTop: 4 }}>
                                    Se não houver outro membro, o grupo poderá ser apagado ao sair.
                                </Text>
                            </View>
                        ) : (
                            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                                <View style={{ gap: 10 }}>
                                    {candidatosAdmin.map((membro) => {
                                        const selecionado = novoAdminId === membro.user_id;

                                        return (
                                            <TouchableOpacity
                                                key={membro.id}
                                                onPress={() => setNovoAdminId(membro.user_id)}
                                                activeOpacity={0.82}
                                                style={{
                                                    flexDirection: "row",
                                                    alignItems: "center",
                                                    gap: 12,
                                                    borderRadius: 16,
                                                    borderWidth: 1,
                                                    padding: 12,
                                                    backgroundColor: selecionado ? HADES.accentTint : HADES.surface,
                                                    borderColor: selecionado ? HADES.accentTintBorder : HADES.border,
                                                }}
                                            >
                                                <Avatar
                                                    foto={membro.userData?.foto_usuario}
                                                    nome={membro.userData?.nome_usuario}
                                                    size={42}
                                                />

                                                <View style={{ flex: 1 }}>
                                                    <Text style={{ color: HADES.text, fontWeight: "600" }}>
                                                        {membro.userData?.nome_usuario ?? "Membro sem nome"}
                                                    </Text>
                                                    <Text style={{ color: HADES.textDim, fontSize: 12, marginTop: 2 }}>
                                                        {membro.administrador
                                                            ? "Já é admin do grupo"
                                                            : "Vai receber as permissões de admin"}
                                                    </Text>
                                                </View>

                                                <View
                                                    style={{
                                                        width: 26,
                                                        height: 26,
                                                        borderRadius: 13,
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        borderWidth: selecionado ? 0 : 1.5,
                                                        borderColor: HADES.grip,
                                                        backgroundColor: selecionado ? HADES.accentSolid : "transparent",
                                                    }}
                                                >
                                                    {selecionado && <Check size={16} color="#000" strokeWidth={3} />}
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </ScrollView>
                        )}

                        <View style={{ flexDirection: "row", gap: 10, marginTop: 24 }}>
                            <TouchableOpacity
                                onPress={() => setModalTransferenciaAdmin(false)}
                                activeOpacity={0.8}
                                style={estilos.botaoSecundario}
                            >
                                <Text style={{ color: HADES.textSecondary, fontWeight: "600" }}>Cancelar</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={confirmarSaidaComTransferencia}
                                disabled={!novoAdminId}
                                activeOpacity={0.85}
                                style={[estilos.botaoPrimario, { opacity: novoAdminId ? 1 : 0.5 }]}
                            >
                                <Text style={{ color: "#000", fontWeight: "700" }}>Continuar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.settingsBg }} edges={["top"]}>
            {/* Header */}
            <View
                style={{
                    paddingTop: 6,
                    paddingHorizontal: 20,
                    paddingBottom: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                }}
            >
                <TouchableOpacity
                    onPress={() => router.back()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <ChevronLeft size={22} color={HADES.textSecondary} />
                </TouchableOpacity>
                <Text style={{ fontSize: 20, fontWeight: "700", color: HADES.text }}>Configurações do Grupo</Text>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
            >
                {loading ? (
                    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 80 }}>
                        <ActivityIndicator size="large" color={HADES.accentSolid} />
                        <Text style={{ color: HADES.textMuted, marginTop: 16 }}>Carregando configurações...</Text>
                    </View>
                ) : (
                    <>
                        {/* Identidade do grupo */}
                        <View style={{ alignItems: "center", marginBottom: 8, marginTop: 2 }}>
                            <ImagePickerAvatar
                                bucket="images"
                                defaultImage={imageUrl ?? undefined}
                                onImageUploaded={(url) => setImageUrl(url)}
                                hades
                            />
                            <Text style={{ fontSize: 20, fontWeight: "700", color: HADES.text }}>
                                {grupo?.nome_grupo ?? "Grupo"}
                            </Text>
                            <Text style={{ fontSize: 13, color: HADES.textMuted, marginTop: 2 }}>
                                Criado por você em {grupo?.created_at ? formatarData(grupo.created_at) : "-"}
                            </Text>
                        </View>

                        <SecaoConfig titulo="GERAL">
                            <LinhaEscolha
                                rotulo="Nome e descrição"
                                valor={grupo?.nome_grupo ?? "—"}
                                onPress={() => abrirModal("dados")}
                            />
                            <LinhaEscolha
                                rotulo="Meta semanal"
                                valor={`${grupo?.meta_horas ?? 0}h`}
                                onPress={() => abrirModal("meta")}
                                ultima
                            />
                        </SecaoConfig>

                        <SecaoConfig titulo="PRIVACIDADE E ACESSO">
                            <LinhaSwitch
                                rotulo="Grupo público"
                                descricao="Qualquer pessoa pode encontrar"
                                ligado={isPublic}
                                onToggle={() => alternarPrivacidadeLocal(!isPublic)}
                            />
                            <LinhaEscolha
                                rotulo="Link de convite"
                                valor={grupo?.codigo_convite || "Nenhum código"}
                                onPress={() => abrirModal("convite")}
                                ultima
                            />
                        </SecaoConfig>

                        <SecaoConfig titulo="ZONA DE PERIGO">
                            <LinhaPerigo
                                rotulo="Sair do grupo"
                                icone={<LogOut size={16} color={HADES.red} />}
                                onPress={handleLeaveGroup}
                            />
                            <LinhaPerigo
                                rotulo="Excluir grupo"
                                icone={<Trash2 size={16} color={HADES.red} />}
                                onPress={handleDeleteGroup}
                                ultima
                            />
                        </SecaoConfig>
                    </>
                )}
            </ScrollView>

            {renderModal()}
            {renderModalTransferenciaAdmin()}
        </SafeAreaView>
    );
}

const estilos = {
    rotuloCampo: {
        fontSize: 12,
        color: HADES.settingsTextMuted,
        fontWeight: "700" as const,
        letterSpacing: 0.8,
        marginBottom: 8,
    },
    campo: {
        backgroundColor: HADES.settingsInset,
        borderWidth: 1,
        borderColor: HADES.borderSettings,
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
        color: HADES.text,
        fontSize: 15,
    },
    botaoSecundario: {
        flex: 1,
        height: 52,
        borderRadius: 14,
        alignItems: "center" as const,
        justifyContent: "center" as const,
        backgroundColor: HADES.surfaceOverlay,
        borderWidth: 1,
        borderColor: HADES.border,
    },
    botaoPrimario: {
        flex: 1,
        height: 52,
        borderRadius: 14,
        alignItems: "center" as const,
        justifyContent: "center" as const,
        backgroundColor: HADES.accentSolid,
    },
};
