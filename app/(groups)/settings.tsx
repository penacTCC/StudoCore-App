import { useEffect, useState } from "react";

//Componentes do Native
import { View, Text, TouchableOpacity, ScrollView, Modal, TextInput, DeviceEventEmitter } from "react-native";
import { SafeAreaView } from "@/components/ui/TelaSegura";
import * as Clipboard from "expo-clipboard";

//Componentes Lucide Native
import { ChevronLeft, Check, LogOut, Trash2 } from "@/components/ui/icons";

//Componente do expo-router
import { router, useLocalSearchParams } from "expo-router";

//Componentes do Projeto
import { HADES } from "@/constants/hades";
import Avatar from "@/components/ui/Avatar";
import ImagePickerAvatar from "@/components/ui/ImagePickerAvatar";
import { SecaoConfig, LinhaSwitch, LinhaStepper, LinhaEscolha, LinhaPerigo } from "@/components/cronograma/LinhasConfig";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useDadosCache } from "@/hooks/useDadosCache";
import {
    atualizarDadosGrupo,
    buscarGrupoPorId,
    buscarMembrosGrupo,
    contarMembrosGrupo,
    definirParticipacaoNoGrupo,
    definirPermissaoConvite,
    excluirGrupoAtual,
    sairDoGrupo,
} from "@/services/grupos";
import type { Grupo, MembroGrupoComPerfil } from "@/types/grupos";
import { toast } from "@/services/toast";
import { confirm } from "@/services/confirm";
import { limparUltimoGrupoLocalmente } from "@/services/armazenamentoOffline";

type ModalEdicao = "dados" | "meta" | "convite" | null;

/* O tipo exato que `buscarMembrosGrupo` devolve — mais estreito que `MembroGrupoComPerfil`
   nas propriedades opcionais, e é ele que precisa casar com o que vai para o cache. */
type MembroConfig = Awaited<ReturnType<typeof buscarMembrosGrupo>>[number];

const SEM_MEMBROS: MembroConfig[] = [];

export default function GroupSettingsScreen() {
    const { groupId } = useLocalSearchParams();
    const { userId } = useAuth();
    const [salvando, setSalvando] = useState(false);
    const [isPublic, setIsPublic] = useState(true);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [modalEdicao, setModalEdicao] = useState<ModalEdicao>(null);
    const [nomeGrupo, setNomeGrupo] = useState("");
    const [descricaoGrupo, setDescricaoGrupo] = useState("");
    const [metaHoras, setMetaHoras] = useState(10);
    const [modalTransferenciaAdmin, setModalTransferenciaAdmin] = useState(false);
    const [novoAdminId, setNovoAdminId] = useState<string | null>(null);

    /*
      Grupo, contagem e membros vêm do cache — as três consultas já saíam em paralelo, o
      que faltava era não refazê-las a cada abertura da tela.

      As alterações otimistas (switch de permissão, privacidade, salvar dados) escrevem
      direto no cache com `alterarDados`, então a tela responde na hora e quem voltar para
      cá em seguida já encontra o valor novo, sem esperar o servidor.
    */
    const { dados, carregando: loading, definir } = useDadosCache(
        groupId ? `config-grupo:${groupId}` : null,
        async () => {
            const [grupoEncontrado, quantidade, membrosGrupo] = await Promise.all([
                buscarGrupoPorId(groupId as string),
                contarMembrosGrupo(groupId as string),
                buscarMembrosGrupo(groupId as string),
            ]);
            return { grupo: grupoEncontrado, qtdMembros: quantidade, membros: membrosGrupo };
        },
        { tempoFresco: 30_000 }
    );

    const grupo = dados?.grupo ?? null;
    const qtdMembros = dados?.qtdMembros ?? 0;
    const membros = dados?.membros ?? SEM_MEMBROS;

    type DadosConfig = NonNullable<typeof dados>;

    /** Aplica uma alteração local no que está em cache, sem ir à rede. */
    const alterarDados = (transformar: (atual: DadosConfig) => DadosConfig) => {
        if (dados) definir(transformar(dados));
    };

    const setGrupo = (valor: Grupo | null | ((atual: Grupo | null) => Grupo | null)) =>
        alterarDados((atual) => ({
            ...atual,
            grupo: typeof valor === "function" ? valor(atual.grupo) : valor,
        }));

    const setMembros = (transformar: (atuais: MembroConfig[]) => MembroConfig[]) =>
        alterarDados((atual) => ({ ...atual, membros: transformar(atual.membros) }));

    /*
      Membro comum também chega nesta tela — é por aqui que ele sai do grupo. Tudo que só o
      administrador pode fazer (trocar foto, editar nome/meta, mexer em privacidade, excluir
      o grupo) é escondido a partir daqui; sobra a identidade do grupo e o "Sair do grupo".
    */
    const souAdmin = membros.some((membro) => membro.user_id === userId && membro.administrador);

    /*
      A minha linha na tabela de membros. É dela que sai tudo o que a seção "Sua
      participação" edita — o que muda ali vale só para mim, nunca para o grupo.
    */
    const minhaParticipacao = membros.find((membro) => membro.user_id === userId) ?? null;

    // Admin convida sempre; o membro comum só quando o admin liberou.
    const possoConvidar = souAdmin || !!minhaParticipacao?.pode_convidar;

    const [silenciado, setSilenciado] = useState(false);
    // `null` = seguir a meta do grupo.
    const [metaPessoal, setMetaPessoal] = useState<number | null>(null);

    useEffect(() => {
        if (!minhaParticipacao) return;
        setSilenciado(!!minhaParticipacao.silenciar_notificacoes);
        setMetaPessoal(minhaParticipacao.meta_horas_pessoal ?? null);
    }, [minhaParticipacao?.id]);

    const alternarSilenciar = async () => {
        const novo = !silenciado;
        // Otimista, igual à permissão de convite: responde na hora, volta se o banco recusar.
        setSilenciado(novo);
        const sucesso = await definirParticipacaoNoGrupo(groupId as string, { silenciar: novo });
        if (!sucesso) setSilenciado(!novo);
    };

    /**
     * Liga/desliga a meta própria. Ligar parte da meta do grupo, que é o número que a
     * pessoa já tinha na frente — começar do zero faria parecer que ela perdeu o progresso.
     */
    const alternarMetaPessoal = async () => {
        if (metaPessoal === null) {
            const inicial = grupo?.meta_horas ?? 10;
            setMetaPessoal(inicial);
            await definirParticipacaoNoGrupo(groupId as string, { metaHorasPessoal: inicial });
            return;
        }
        setMetaPessoal(null);
        await definirParticipacaoNoGrupo(groupId as string, { limparMeta: true });
    };

    /*
      Salva a meta pessoal um tempo depois do último toque no stepper: sem isso, ajustar de
      10h para 20h seriam dez idas ao banco.
    */
    useEffect(() => {
        if (metaPessoal === null || !groupId) return;
        const timeout = setTimeout(() => {
            definirParticipacaoNoGrupo(groupId as string, { metaHorasPessoal: metaPessoal });
        }, 600);
        return () => clearTimeout(timeout);
    }, [metaPessoal, groupId]);

    const copiarCodigoConvite = async () => {
        if (!grupo?.codigo_convite) {
            toast.error("Este grupo ainda não tem um código de convite.");
            return;
        }
        await Clipboard.setStringAsync(grupo.codigo_convite);
        toast.success("Código copiado.");
    };

    /*
      Quem pode convidar: o admin sempre, e os membros a quem ele passar a permissão aqui.
      O outro admin da lista não entra — a permissão dele vem do cargo e não tem o que ligar.
    */
    const membrosParaPermissao = membros.filter((membro) => !membro.administrador);

    const alternarPermissaoConvite = async (membro: MembroGrupoComPerfil) => {
        const novoValor = !membro.pode_convidar;

        // Otimista: o switch responde na hora e volta sozinho se o banco recusar.
        setMembros((atuais) =>
            atuais.map((linha) =>
                linha.id === membro.id ? { ...linha, pode_convidar: novoValor } : linha
            )
        );

        const sucesso = await definirPermissaoConvite(groupId as string, membro.user_id, novoValor);

        if (!sucesso) {
            setMembros((atuais) =>
                atuais.map((linha) =>
                    linha.id === membro.id ? { ...linha, pode_convidar: !novoValor } : linha
                )
            );
            return;
        }

        const nome = membro.userData?.nome_usuario ?? "O membro";
        toast.success(
            novoValor
                ? `${nome} agora pode convidar pessoas para o grupo.`
                : `${nome} não pode mais convidar pessoas.`
        );
    };


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
            toast.error(error.message, "Erro ao salvar");
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

    /**
     * Avisa o resto do app de que a participação em grupos mudou.
     *
     * Só entrar em grupo emitia `groupMembershipChanged`; sair e excluir não emitiam nada.
     * O `useStatusMembroGrupo` seguia então com `membro: true` e com o id do grupo morto em
     * `@last_group_id`, e o guard mandava para as tabs de um grupo que não existe mais — era
     * de lá que vinha o "Erro ao buscar grupo".
     *
     * Limpando o id e emitindo o evento, o guard reavalia e escolhe o destino sozinho:
     * `no-group` para quem ficou sem grupo nenhum, e a lista para quem ainda tem outros.
     */
    const avisarMudancaDeParticipacao = async () => {
        await limparUltimoGrupoLocalmente();
        DeviceEventEmitter.emit("groupMembershipChanged");
    };

    /** Devolve `true` só quando o grupo foi mesmo apagado — a navegação depende disso. */
    const excluirGrupo = async () => {
        if (!groupId) return false;
        const { error } = await excluirGrupoAtual(groupId as string);

        if (error) {
            toast.error(error.message, "Erro ao excluir grupo");
            return false;
        }

        return true;
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
        confirm({
            title: "Salvar alterações",
            message: "Tem certeza que deseja salvar as alterações?",
            confirmText: "Salvar",
            onConfirm: salvar,
        });
    };

    /**
     * Tira o usuário do grupo de verdade (RPC `sair_do_grupo`) e só então navega.
     *
     * Antes daqui, nada disto acontecia: os dois caminhos de saída apenas fechavam o modal
     * e chamavam o router, então quem "saía" continuava no grupo e o sucessor escolhido
     * nunca virava administrador.
     */
    const executarSaida = async (sucessorId?: string | null) => {
        if (!groupId) return;

        setSalvando(true);
        const { error } = await sairDoGrupo(groupId as string, sucessorId);
        setSalvando(false);

        if (error) {
            toast.error(error.message, "Não foi possível sair do grupo");
            return;
        }

        setModalTransferenciaAdmin(false);
        await avisarMudancaDeParticipacao();
        /*
          `replace` porque o grupo pode ter deixado de existir (último membro saiu): manter
          esta tela na pilha deixaria o usuário voltar para as configurações de um grupo do
          qual ele não faz mais parte.

          Sai da tela imediatamente; se este era o último grupo, o guard leva daqui para o
          `no-group` assim que o `membro` reavaliado chegar.
        */
        router.replace("/(groups)");
    };

    const handleLeaveGroup = () => {
        // Só o administrador precisa passar o bastão; membro comum sai direto.
        if (souAdmin && (qtdMembros ?? 0) > 1) {
            setNovoAdminId(null);
            setModalTransferenciaAdmin(true);
            return;
        }

        const ehUltimoMembro = (qtdMembros ?? 0) <= 1;

        confirm({
            title: "Sair do Grupo",
            message: ehUltimoMembro
                ? `Tem certeza que deseja sair do ${grupo?.nome_grupo}? Como você é a última pessoa, o grupo será apagado após esta ação.`
                : `Tem certeza que deseja sair do ${grupo?.nome_grupo}?`,
            confirmText: "Sair",
            destructive: true,
            onConfirm: () => executarSaida(null),
        });
    };

    const confirmarSaidaComTransferencia = () => {
        if (!novoAdminId) {
            toast.warning("Selecione uma pessoa para assumir a administração do grupo.", "Escolha um novo admin");
            return;
        }

        const novoAdmin = membros.find((membro) => membro.user_id === novoAdminId);

        confirm({
            title: "Transferir administração",
            message: `${novoAdmin?.userData?.nome_usuario ?? "Este membro"} será o novo admin antes de você sair do grupo.`,
            confirmText: "Confirmar",
            destructive: true,
            onConfirm: () => executarSaida(novoAdminId),
        });
    };

    const handleDeleteGroup = () => {
        confirm({
            title: "Excluir Grupo",
            message: "Esta ação é irreversível. Todos os dados, arquivos e histórico do grupo serão apagados.",
            confirmText: "Excluir",
            destructive: true,
            onConfirm: async () => {
                // Navegar mesmo quando o delete falha era o que fazia o grupo "sumir" da
                // tela e reaparecer na lista logo depois.
                if (!(await excluirGrupo())) return;

                await avisarMudancaDeParticipacao();
                router.replace("/(groups)");
            },
        });
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
        toast.success("O código de convite foi copiado para a área de transferência.", "Código copiado");
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
                    <GroupSettingsSkeleton />
                ) : (
                    <>
                        {/* Identidade do grupo */}
                        <View style={{ alignItems: "center", marginBottom: 8, marginTop: 2 }}>
                            {souAdmin ? (
                                <ImagePickerAvatar
                                    bucket="images"
                                    defaultImage={imageUrl ?? undefined}
                                    onImageUploaded={(url) => setImageUrl(url)}
                                    hades
                                />
                            ) : (
                                /* Mesmo tamanho do seletor (w-32) e a margem que o wrapper dele traz. */
                                <View style={{ marginBottom: 32, marginTop: 8 }}>
                                    <Avatar foto={imageUrl} nome={grupo?.nome_grupo} size={128} />
                                </View>
                            )}
                            <Text style={{ fontSize: 20, fontWeight: "700", color: HADES.text }}>
                                {grupo?.nome_grupo ?? "Grupo"}
                            </Text>
                            <Text style={{ fontSize: 13, color: HADES.textMuted, marginTop: 2 }}>
                                {/* Dizia "Criado por você" para qualquer um: com membro comum na tela, viraria mentira. */}
                                Criado em {grupo?.created_at ? formatarData(grupo.created_at) : "-"}
                            </Text>
                        </View>

                        {souAdmin && (
                            <>
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

                                {/* Convidar é seu por padrão; aqui você estende para quem quiser. */}
                                <SecaoConfig titulo="QUEM PODE CONVIDAR">
                                    {membrosParaPermissao.length === 0 ? (
                                        <View style={{ padding: 14 }}>
                                            <Text style={{ fontSize: 13, color: HADES.settingsTextMuted, lineHeight: 18 }}>
                                                Só você no grupo por enquanto. Quando entrar mais gente, é aqui
                                                que você libera quem também pode convidar.
                                            </Text>
                                        </View>
                                    ) : (
                                        membrosParaPermissao.map((membro, indice) => (
                                            <LinhaPermissaoConvite
                                                key={membro.id}
                                                membro={membro}
                                                onToggle={() => alternarPermissaoConvite(membro)}
                                                ultima={indice === membrosParaPermissao.length - 1}
                                            />
                                        ))
                                    )}
                                </SecaoConfig>
                            </>
                        )}

                        {/*
                          Vale para todo mundo, inclusive o admin: administrar o grupo é uma
                          coisa, participar dele é outra, e até quem criou o grupo pode querer
                          silenciar os avisos ou ter uma meta menor que a coletiva.
                        */}
                        <SecaoConfig titulo="SUA PARTICIPAÇÃO">
                            <LinhaSwitch
                                rotulo="Silenciar este grupo"
                                descricao="Para de receber avisos deste grupo. Você continua membro e continua vendo tudo."
                                ligado={silenciado}
                                onToggle={alternarSilenciar}
                            />
                            <LinhaSwitch
                                rotulo="Usar meta própria"
                                descricao={`Desligado, vale a meta do grupo (${grupo?.meta_horas ?? 0}h por semana).`}
                                ligado={metaPessoal !== null}
                                onToggle={alternarMetaPessoal}
                                ultima={metaPessoal === null}
                            />
                            {metaPessoal !== null && (
                                <LinhaStepper
                                    rotulo="Minha meta semanal"
                                    valor={`${metaPessoal}h`}
                                    onDiminuir={() => setMetaPessoal(Math.max(1, metaPessoal - 1))}
                                    onAumentar={() => setMetaPessoal(Math.min(168, metaPessoal + 1))}
                                    ultima
                                />
                            )}
                        </SecaoConfig>

                        {/*
                          O que o admin edita nos modais acima, o membro comum vê aqui em modo
                          leitura. Antes ele não via nem a meta que precisava cumprir.
                        */}
                        {!souAdmin && (
                            <SecaoConfig titulo="SOBRE O GRUPO">
                                <LinhaEscolha rotulo="Descrição" valor={grupo?.descricao || "Sem descrição"} />
                                <LinhaEscolha rotulo="Meta do grupo" valor={`${grupo?.meta_horas ?? 0}h por semana`} />
                                <LinhaEscolha rotulo="Membros" valor={`${qtdMembros ?? 0}`} />
                                <LinhaEscolha
                                    rotulo="Administrador"
                                    valor={
                                        membros.find((membro) => membro.administrador)?.userData?.nome_usuario ??
                                        "Sem administrador"
                                    }
                                    ultima={!possoConvidar}
                                />
                                {/*
                                  A permissão de convidar não servia de nada nesta tela: quem a
                                  recebia continuava sem ver o código para passar adiante.
                                */}
                                {possoConvidar && (
                                    <LinhaEscolha
                                        rotulo="Código de convite"
                                        valor={grupo?.codigo_convite || "Nenhum código"}
                                        onPress={copiarCodigoConvite}
                                        ultima
                                    />
                                )}
                            </SecaoConfig>
                        )}

                        <SecaoConfig titulo="ZONA DE PERIGO">
                            {/* `ultima` migra para o "Sair" quando o excluir não renderiza, senão a
                                última linha da seção fica com a borda inferior sobrando. */}
                            <LinhaPerigo
                                rotulo="Sair do grupo"
                                icone={<LogOut size={16} color={HADES.red} />}
                                onPress={handleLeaveGroup}
                                ultima={!souAdmin}
                            />
                            {souAdmin && (
                                <LinhaPerigo
                                    rotulo="Excluir grupo"
                                    icone={<Trash2 size={16} color={HADES.red} />}
                                    onPress={handleDeleteGroup}
                                    ultima
                                />
                            )}
                        </SecaoConfig>
                    </>
                )}
            </ScrollView>

            {renderModal()}
            {renderModalTransferenciaAdmin()}
        </SafeAreaView>
    );
}

/** Um membro do grupo com o interruptor da permissão de convidar. */
function LinhaPermissaoConvite({
    membro,
    onToggle,
    ultima,
}: {
    membro: MembroGrupoComPerfil;
    onToggle: () => void;
    ultima?: boolean;
}) {
    const ligado = !!membro.pode_convidar;
    const nome = membro.userData?.nome_usuario ?? "Membro sem nome";

    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: 14,
                borderBottomWidth: ultima ? 0 : 1,
                borderBottomColor: HADES.borderSettings,
            }}
        >
            <Avatar foto={membro.userData?.foto_usuario} nome={nome} size={36} />

            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, color: HADES.text }} numberOfLines={1}>
                    {nome}
                </Text>
                <Text style={{ fontSize: 12, color: HADES.settingsTextMuted, marginTop: 2 }}>
                    {ligado ? "Pode convidar" : "Não pode convidar"}
                </Text>
            </View>

            <TouchableOpacity
                onPress={onToggle}
                activeOpacity={0.8}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                    width: 44,
                    height: 27,
                    borderRadius: 14,
                    backgroundColor: ligado ? HADES.accentSolid : HADES.settingsSwitchOff,
                    justifyContent: "center",
                }}
            >
                <View
                    style={{
                        position: "absolute",
                        left: ligado ? 19 : 2.5,
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: "#fff",
                    }}
                />
            </TouchableOpacity>
        </View>
    );
}

function LinhaSkeleton({ ultima }: { ultima?: boolean }) {
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 14,
                borderBottomWidth: ultima ? 0 : 1,
                borderBottomColor: HADES.borderSettings,
            }}
        >
            <Skeleton width="40%" height={14} hades />
            <View style={{ flex: 1 }} />
            <Skeleton width={70} height={14} hades />
        </View>
    );
}

function SecaoConfigSkeleton({ tituloWidth }: { tituloWidth: number }) {
    return (
        <>
            <Skeleton width={tituloWidth} height={12} hades style={{ marginTop: 20, marginBottom: 10, marginLeft: 4 }} />
            <View
                style={{
                    backgroundColor: HADES.settingsCard,
                    borderWidth: 1,
                    borderColor: HADES.borderSettings,
                    borderRadius: 14,
                    overflow: "hidden",
                }}
            >
                <LinhaSkeleton />
                <LinhaSkeleton ultima />
            </View>
        </>
    );
}

function GroupSettingsSkeleton() {
    return (
        <>
            <View style={{ alignItems: "center", marginBottom: 8, marginTop: 2 }}>
                {/* 128px + mt-2/mb-8: as mesmas medidas do ImagePickerAvatar/Avatar da tela pronta. */}
                <Skeleton
                    width={128}
                    height={128}
                    borderRadius={16}
                    hades
                    style={{ marginTop: 8, marginBottom: 32 }}
                />
                <Skeleton width={140} height={20} hades />
                <Skeleton width={190} height={13} hades style={{ marginTop: 4 }} />
            </View>

            <SecaoConfigSkeleton tituloWidth={60} />
            <SecaoConfigSkeleton tituloWidth={150} />
            <SecaoConfigSkeleton tituloWidth={110} />
            <SecaoConfigSkeleton tituloWidth={130} />
        </>
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
