import { useEffect, useState } from "react";

//Componentes do Native
import { View, Text, TouchableOpacity, ScrollView, Switch, Alert, Modal, TextInput, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";

//Componentes Lucide Native
import {
  ArrowLeft,
  Check,
  Pencil,
  Globe,
  Lock,
  Target,
  Link as LinkIcon,
  LogOut,
  Trash2,
  ChevronRight,
} from "lucide-react-native";

//Componente do expo-router
import { router, useLocalSearchParams } from "expo-router";

//Componentes do Projeto
import { COLORS } from "@/constants/colors";
import Avatar from "@/components/ui/Avatar";
import ImagePickerAvatar from "@/components/ui/ImagePickerAvatar";
import { useAuth } from "@/hooks/useAuth";
import { atualizarDadosGrupo, buscarGrupoPorId, buscarMembrosGrupo, contarMembrosGrupo, excluirGrupoAtual } from "@/services/grupos";
import type { Grupo, MembroGrupoComPerfil } from "@/types/grupos";

type ModalEdicao = "dados" | "meta" | "convite" | null;

export default function GroupSettingsScreen() {
  const { groupId } = useLocalSearchParams()
  const { userId } = useAuth();
  const [grupo, setGrupo] = useState<Grupo | null>(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [isPublic, setIsPublic] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [modalEdicao, setModalEdicao] = useState<ModalEdicao>(null);
  const [nomeGrupo, setNomeGrupo] = useState("");
  const [descricaoGrupo, setDescricaoGrupo] = useState("");
  const [metaHoras, setMetaHoras] = useState(10);
  const [qtdMembros, setQtdMembros] = useState<number | null>(0)
  const [membros, setMembros] = useState<MembroGrupoComPerfil[]>([]);
  const [modalTransferenciaAdmin, setModalTransferenciaAdmin] = useState(false);
  const [novoAdminId, setNovoAdminId] = useState<string | null>(null);

  //useEffect para buscar todas as informações do grupo
  useEffect(() => {
    if (!groupId) return

    //Carrega os dados do grupo
    const carregarDados = async () => {
      setLoading(true)

      //Aqui a gente utiliza o Promise all para realizar duas funções, e retornar em duas variáveis
      const [grupoEncontrado, qtdMembros, membrosGrupo] = await Promise.all([
        buscarGrupoPorId(groupId as string),
        contarMembrosGrupo(groupId as string),
        buscarMembrosGrupo(groupId as string)
      ])

      //Damos valor aos states, com a data retornada das funções
      setGrupo(grupoEncontrado)
      setQtdMembros(qtdMembros)
      setMembros(membrosGrupo)

      setLoading(false)
    }

    //roda a função
    carregarDados()
  }, [groupId])

  useEffect(() => {
    if (!grupo) return;

    setNomeGrupo(grupo.nome_grupo ?? "");
    setDescricaoGrupo(grupo.descricao ?? "");
    setMetaHoras(grupo.meta_horas ?? 10);
    setImageUrl(grupo.foto_grupo);
    setIsPublic(grupo.publico);
  }, [grupo?.id])

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
  }

  const alternarPrivacidadeLocal = (valor: boolean) => {
    setIsPublic(valor);
    setGrupo((grupoAtual) => grupoAtual ? {
      ...grupoAtual,
      publico: valor,
    } : grupoAtual);
  };

  const salvarAlterações = (salvar: () => void | Promise<void>) => {
    Alert.alert(
      "Salvar alterações",
      `Tem certeza que deseja salvar as alterações?`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Salvar", style: "default", onPress: salvar }
      ]
    );
  }

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
        { text: "Sair", style: "destructive", onPress: () => router.push("/(groups)") }
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
          }
        }
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
          }
        }
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
      modalEdicao === "dados" ? "Editar grupo" :
        modalEdicao === "meta" ? "Meta semanal" :
          "Convite do grupo";

    const descricao =
      modalEdicao === "dados" ? "Atualize o nome e a descrição que aparecem para os membros." :
        modalEdicao === "meta" ? "Defina a quantidade de horas que o grupo quer bater por semana." :
          "Este código é gerado pelo StudoCore e pode ser compartilhado com novos membros.";

    const salvar =
      modalEdicao === "dados" ? salvarDadosLocais :
        modalEdicao === "meta" ? salvarMetaLocal :
          copiarConvite;

    return (
      <Modal
        visible={modalEdicao !== null}
        transparent
        animationType="fade"
        onRequestClose={fecharModal}
      >
        <View className="flex-1 bg-black/70 justify-end">
          <TouchableOpacity className="flex-1" activeOpacity={1} onPress={fecharModal} />

          <View className="bg-slate-950 border border-slate-800 rounded-t-[28px] px-5 pt-5 pb-7">
            <View className="w-12 h-1.5 rounded-full bg-slate-700 self-center mb-5" />

            <Text className="text-xl font-bold text-slate-100">{titulo}</Text>
            <Text className="text-sm text-slate-400 mt-2 mb-5 leading-5">{descricao}</Text>

            {modalEdicao === "dados" && (
              <View className="gap-4">
                <View>
                  <Text className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Nome</Text>
                  <TextInput
                    value={nomeGrupo}
                    onChangeText={setNomeGrupo}
                    placeholder="Nome do grupo"
                    placeholderTextColor="#64748b"
                    className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-4 text-slate-100"
                  />
                </View>

                <View>
                  <Text className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Descrição</Text>
                  <TextInput
                    value={descricaoGrupo}
                    onChangeText={setDescricaoGrupo}
                    placeholder="Explique o objetivo do grupo"
                    placeholderTextColor="#64748b"
                    multiline
                    textAlignVertical="top"
                    className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-4 text-slate-100 min-h-28"
                  />
                </View>
              </View>
            )}

            {modalEdicao === "meta" && (
              <View>
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-xs font-bold uppercase tracking-wider text-slate-500">Horas por semana</Text>
                  <Text className="text-lg font-bold text-brand-500">{metaHoras}h</Text>
                </View>

                <View className="flex-row items-center gap-2 mt-2">
                  <Text className="text-xs text-slate-500 w-8">1h</Text>
                  <View className="flex-1 flex-row gap-1 h-2">
                    {[...Array(20)].map((_, i) => {
                      const valor = (i + 1) * 2;

                      return (
                        <TouchableOpacity
                          key={valor}
                          onPress={() => setMetaHoras(valor)}
                          className="h-full flex-1 rounded-full"
                          style={{ backgroundColor: valor <= metaHoras ? COLORS.primary : COLORS.bgQuaternary }}
                        />
                      );
                    })}
                  </View>
                  <Text className="text-xs text-slate-500 w-8 text-right">40h</Text>
                </View>

                <View className="mt-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4">
                  <Text className="text-emerald-300 text-sm font-semibold">
                    Preview: meta de {metaHoras || "0"}h por semana
                  </Text>
                </View>
              </View>
            )}

            {modalEdicao === "convite" && (
              <View>
                <Text className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Código de convite</Text>
                <View className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-4">
                  <Text className="text-slate-100 text-lg font-bold">
                    {grupo?.codigo_convite || "Nenhum código gerado"}
                  </Text>
                </View>
                <Text className="text-xs text-slate-500 mt-3">
                  O código é criado automaticamente pelo aplicativo.
                </Text>
              </View>
            )}

            <View className="flex-row gap-3 mt-6">
              <TouchableOpacity
                onPress={fecharModal}
                className="flex-1 bg-slate-900 border border-slate-800 py-4 rounded-2xl items-center"
              >
                <Text className="text-slate-200 font-semibold">Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => salvarAlterações(salvar)}
                disabled={salvando}
                className={`flex-1 py-4 rounded-2xl items-center ${salvando ? "bg-slate-800" : "bg-brand-500"}`}
              >
                <Text className="text-white font-bold">
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
        <View className="flex-1 bg-black/70 justify-end">
          <TouchableOpacity
            className="flex-1"
            activeOpacity={1}
            onPress={() => setModalTransferenciaAdmin(false)}
          />

          <View className="bg-slate-950 border border-slate-800 rounded-t-[28px] px-5 pt-5 pb-7 max-h-[78%]">
            <View className="w-12 h-1.5 rounded-full bg-slate-700 self-center mb-5" />

            <Text className="text-xl font-bold text-slate-100">Escolher novo admin</Text>
            <Text className="text-sm text-slate-400 mt-2 mb-5 leading-5">
              Antes de sair, escolha quem vai assumir a administração do grupo.
            </Text>

            {candidatosAdmin.length === 0 ? (
              <View className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <Text className="text-slate-300 font-semibold">Nenhum membro disponível</Text>
                <Text className="text-slate-500 text-sm mt-1">
                  Se não houver outro membro, o grupo poderá ser apagado ao sair.
                </Text>
              </View>
            ) : (
              <ScrollView className="max-h-80" showsVerticalScrollIndicator={false}>
                <View className="gap-3">
                  {candidatosAdmin.map((membro) => {
                    const selecionado = novoAdminId === membro.user_id;

                    return (
                      <TouchableOpacity
                        key={membro.id}
                        onPress={() => setNovoAdminId(membro.user_id)}
                        className={`flex-row items-center gap-3 rounded-2xl border p-3 ${
                          selecionado
                            ? "bg-brand-500/10 border-brand-500/60"
                            : "bg-slate-900 border-slate-800"
                        }`}
                        activeOpacity={0.82}
                      >
                        <Avatar
                          foto={membro.userData?.foto_usuario}
                          nome={membro.userData?.nome_usuario}
                          size={42}
                        />

                        <View className="flex-1">
                          <Text className="text-slate-100 font-semibold">
                            {membro.userData?.nome_usuario ?? "Membro sem nome"}
                          </Text>
                          <Text className="text-slate-500 text-xs mt-1">
                            {membro.administrador ? "Já é admin do grupo" : "Vai receber as permissões de admin"}
                          </Text>
                        </View>

                        <View
                          className={`w-7 h-7 rounded-full items-center justify-center border ${
                            selecionado
                              ? "bg-brand-500 border-brand-500"
                              : "border-slate-700"
                          }`}
                        >
                          {selecionado && <Check size={16} color="#ffffff" strokeWidth={3} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            )}

            <View className="flex-row gap-3 mt-6">
              <TouchableOpacity
                onPress={() => setModalTransferenciaAdmin(false)}
                className="flex-1 bg-slate-900 border border-slate-800 py-4 rounded-2xl items-center"
              >
                <Text className="text-slate-200 font-semibold">Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={confirmarSaidaComTransferencia}
                disabled={!novoAdminId}
                className={`flex-1 py-4 rounded-2xl items-center ${
                  novoAdminId ? "bg-red-500" : "bg-slate-800"
                }`}
              >
                <Text className="text-white font-bold">Continuar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-950" edges={["top"]}>
      <View className="px-4 py-3 flex-row items-center justify-between border-b border-slate-900 mb-4">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-slate-900 items-center justify-center"
        >
          <ArrowLeft size={20} color={COLORS.textSecondary || "#94a3b8"} />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-slate-200">Configurações do Grupo</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {loading ? (
          <View className="items-center justify-center py-20">
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text className="text-slate-400 mt-4">Carregando configurações...</Text>
          </View>
        ) : (
          <>
        <View className="items-center mb-8 mt-2">
          <ImagePickerAvatar
            bucket="images"
            defaultImage={imageUrl ?? undefined}
            onImageUploaded={(url) => setImageUrl(url)}
          />
          <Text className="text-xl font-bold text-slate-200">{grupo?.nome_grupo ?? "Grupo"}</Text>
          <Text className="text-sm text-slate-400 mt-1">Criado por você em {grupo?.created_at ? formatarData(grupo.created_at) : "-"}</Text>
        </View>

        <View className="bg-slate-900 border border-slate-800 rounded-3xl p-2 mb-6">
          <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-4 mt-2 mb-2">Geral</Text>

          <TouchableOpacity
            onPress={() => abrirModal("dados")}
            className="flex-row items-center justify-between p-3 border-b border-slate-800/50"
          >
            <View className="flex-row items-center gap-3 flex-1 pr-3">
              <View className="w-10 h-10 rounded-xl bg-slate-800 items-center justify-center">
                <Pencil size={18} color={"#cbd5e1"} />
              </View>
              <View className="flex-1">
                <Text className="text-base font-medium text-slate-200">Editar Nome e Descrição</Text>
                <Text className="text-xs text-slate-400" numberOfLines={1}>
                  {grupo?.descricao || "Adicione uma descrição para o grupo"}
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color={COLORS.textMuted || "#64748b"} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => abrirModal("meta")}
            className="flex-row items-center justify-between p-3"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-slate-800 items-center justify-center">
                <Target size={18} color={COLORS.emeraldLight || "#34d399"} />
              </View>
              <View>
                <Text className="text-base font-medium text-slate-200">Meta Semanal</Text>
                <Text className="text-xs text-slate-400">Atualmente: {grupo?.meta_horas} horas</Text>
              </View>
            </View>
            <ChevronRight size={18} color={COLORS.textMuted || "#64748b"} />
          </TouchableOpacity>
        </View>

        <View className="bg-slate-900 border border-slate-800 rounded-3xl p-2 mb-6">
          <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-4 mt-2 mb-2">Privacidade e Acesso</Text>

          <View className="flex-row items-center justify-between p-3 border-b border-slate-800/50">
            <View className="flex-row items-center gap-3 flex-1 pr-4">
              <View className="w-10 h-10 rounded-xl bg-slate-800 items-center justify-center">
                {isPublic ? <Globe size={18} color={COLORS.violetLight || "#a78bfa"} /> : <Lock size={18} color={COLORS.violetLight || "#a78bfa"} />}
              </View>
              <View className="flex-1">
                <Text className="text-base font-medium text-slate-200">Grupo Público</Text>
                <Text className="text-xs text-slate-400">Qualquer pessoa pode encontrar</Text>
              </View>
            </View>
            <Switch
              value={isPublic}
              onValueChange={alternarPrivacidadeLocal}
              trackColor={{ false: "#1e293b", true: COLORS.primary || "#f59e0b" }}
              thumbColor={"#ffffff"}
            />
          </View>

          <TouchableOpacity
            onPress={() => abrirModal("convite")}
            className="flex-row items-center justify-between p-3"
          >
            <View className="flex-row items-center gap-3 flex-1 pr-3">
              <View className="w-10 h-10 rounded-xl bg-slate-800 items-center justify-center">
                <LinkIcon size={18} color={"#cbd5e1"} />
              </View>
              <View className="flex-1">
                <Text className="text-base font-medium text-slate-200">Link de Convite</Text>
                <Text className="text-xs text-slate-400" numberOfLines={1}>
                  {grupo?.codigo_convite ? `${grupo.codigo_convite}` : "Nenhum código configurado"}
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color={COLORS.textMuted || "#64748b"} />
          </TouchableOpacity>
        </View>

        <View className="bg-slate-900 border border-slate-800 rounded-3xl p-2 mb-10">
          <Text className="text-xs font-bold text-red-500/70 uppercase tracking-wider ml-4 mt-2 mb-2">Zona de Perigo</Text>

          <TouchableOpacity
            onPress={handleLeaveGroup}
            className="flex-row items-center justify-between p-3 border-b border-slate-800/50"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-red-500/10 items-center justify-center">
                <LogOut size={18} color="#ef4444" />
              </View>
              <Text className="text-base font-medium text-red-400">Sair do Grupo</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDeleteGroup}
            className="flex-row items-center justify-between p-3"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-red-500/10 items-center justify-center">
                <Trash2 size={18} color="#ef4444" />
              </View>
              <Text className="text-base font-medium text-red-400">Excluir Grupo</Text>
            </View>
          </TouchableOpacity>
        </View>
        </>
        )}
      </ScrollView>

      {renderModal()}
      {renderModalTransferenciaAdmin()}
    </SafeAreaView>
  );
}
