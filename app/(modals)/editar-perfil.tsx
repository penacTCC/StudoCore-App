import { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Pressable,
} from "react-native";
import { toast } from "@/services/toast";
import { SafeAreaView } from "@/components/ui/TelaSegura";
import { useRouter } from "expo-router";
import { X, Eye, Flame, Camera, Image as ImageIcon, Check, CircleAlert } from "@/components/ui/icons";
import { HADES } from "@/constants/hades";
import { getIdentityColor, getInitials } from "@/constants/helpers";
import {
    buscarPerfil,
    buscarUsuarioLogado,
    atualizarPerfil,
    nomeUsuarioDisponivel,
} from "@/services/auth";
import { escolherEEnviarImagem } from "@/services/imagens";
import { updateWeeklyGoal, loadProfileStats } from "@/services/profileStats";
import { BannerPerfil } from "@/components/profile/PerfilBanner";
import Avatar from "@/components/ui/Avatar";
import { Skeleton, SkeletonCircle } from "@/components/ui/Skeleton";
import WheelPicker from "@/components/ui/WheelPicker";
import { Profile } from "@/types/profile";

const WEEKLY_HOURS = Array.from({ length: 50 }, (_, i) => String(i + 1));

const BANNER_H = 132;
const AVATAR_SIZE = 96;
const BIO_MAX = 140;

const sechStyle = {
    fontSize: 12,
    fontWeight: "700" as const,
    color: HADES.textMuted,
    letterSpacing: 0.8,
    textTransform: "uppercase" as const,
};

const capStyle = {
    fontSize: 11,
    fontWeight: "600" as const,
    color: HADES.textMuted,
    letterSpacing: 0.3,
    textTransform: "uppercase" as const,
};

const fieldStyle = {
    // Mais escuro que o fundo dos cards: campo editável tem que ler como "buraco" na tela.
    backgroundColor: HADES.surface,
    borderWidth: 1,
    borderColor: HADES.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 13,
};

/** Estados possíveis do @usuário digitado, na ordem em que a tela os descobre. */
type StatusUsuario = "curto" | "checando" | "disponivel" | "emUso";

export default function EditarPerfilScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [enviandoFoto, setEnviandoFoto] = useState(false);

    const [userId, setUserId] = useState<string>("");
    const [username, setUsername] = useState("");
    const [realName, setRealName] = useState("");
    const [bio, setBio] = useState("");
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [profileData, setProfileData] = useState<Profile | null>(null);
    const [weeklyGoalIdx, setWeeklyGoalIdx] = useState(9);
    const [isPublic, setIsPublic] = useState(true);
    const [showStreak, setShowStreak] = useState(true);
    const [statusUsuario, setStatusUsuario] = useState<StatusUsuario>("disponivel");

    useEffect(() => {
        const fetchUser = async () => {
            const { data } = await buscarUsuarioLogado();
            if (data?.user) {
                setUserId(data.user.id);

                // As duas leituras são independentes: uma esperava a outra sem motivo, e
                // este é um editor — o tempo até os campos aparecerem preenchidos conta.
                const [{ data: prof }, s] = await Promise.all([
                    buscarPerfil(data.user.id),
                    loadProfileStats(),
                ]);

                if (prof) {
                    setProfileData(prof);
                    setUsername(prof.nome_usuario || "");
                    setRealName(prof.nome_real || "");
                    setBio(prof.bio || "");
                    setImageUrl(prof.foto_usuario ?? null);
                    setIsPublic(prof.perfil_publico ?? true);
                    setShowStreak(prof.mostrar_ofensiva ?? true);
                }
                if (s) setWeeklyGoalIdx(Math.max(0, Math.min(49, s.weeklyGoal - 1)));
            }
            setLoading(false);
        };
        fetchUser();
    }, []);

    /*
     * Disponibilidade do @usuário enquanto digita, com 500ms de folga pra não bater no banco
     * a cada tecla. O nome atual do próprio perfil sempre conta como disponível — senão a
     * tela acusaria "já em uso" contra a própria linha de quem está editando.
     */
    const buscaEmVoo = useRef(0);
    useEffect(() => {
        if (loading) return;

        const nome = username.trim();
        if (nome.length < 3) {
            setStatusUsuario("curto");
            return;
        }
        if (nome === profileData?.nome_usuario) {
            setStatusUsuario("disponivel");
            return;
        }

        setStatusUsuario("checando");
        const busca = ++buscaEmVoo.current;
        const timer = setTimeout(async () => {
            const { disponivel, error } = await nomeUsuarioDisponivel(nome);
            // Uma resposta antiga não pode sobrescrever o resultado de uma digitação mais nova.
            if (busca !== buscaEmVoo.current) return;
            if (error) {
                setStatusUsuario("disponivel");
                return;
            }
            setStatusUsuario(disponivel ? "disponivel" : "emUso");
        }, 500);

        return () => clearTimeout(timer);
    }, [username, profileData?.nome_usuario, loading]);

    const trocarFoto = async () => {
        setEnviandoFoto(true);
        try {
            const { publicUrl, error, cancelado } = await escolherEEnviarImagem("images");
            if (cancelado) return;
            if (error || !publicUrl) {
                toast.error(error ?? "Não foi possível enviar a imagem.");
                return;
            }
            setImageUrl(publicUrl);
        } finally {
            setEnviandoFoto(false);
        }
    };

    const handleSave = async () => {
        if (!username.trim() || !realName.trim()) {
            toast.error("Nome e nome de usuário são obrigatórios.");
            return;
        }
        if (statusUsuario === "curto") {
            toast.error("O nome de usuário precisa de pelo menos 3 caracteres.");
            return;
        }
        if (statusUsuario === "emUso") {
            toast.warning("Este nome de usuário já está sendo usado por outra pessoa. Escolha outro!", "Aviso");
            return;
        }

        const weeklyGoal = parseInt(WEEKLY_HOURS[weeklyGoalIdx], 10);
        if (isNaN(weeklyGoal) || weeklyGoal <= 0) {
            toast.error("A meta semanal deve ser maior que 0.");
            return;
        }

        setSaving(true);
        try {
            // Revalida no servidor: o debounce acima pode ter ficado pra trás, e entre a
            // digitação e o toque em "Salvar" alguém pode ter registrado o mesmo @.
            if (username.trim() !== profileData?.nome_usuario) {
                // Falha na checagem não impede o salvamento: o UNIQUE do banco barra o
                // duplicado e o 23505 abaixo explica o que houve.
                const { disponivel, error: selectError } = await nomeUsuarioDisponivel(username);
                if (!selectError && !disponivel) {
                    setStatusUsuario("emUso");
                    toast.warning("Este nome de usuário já está sendo usado por outra pessoa. Escolha outro!", "Aviso");
                    return;
                }
            }

            const { error } = await atualizarPerfil(userId, {
                nomeReal: realName,
                nomeUsuario: username,
                bio,
                fotoUsuario: imageUrl,
                perfilPublico: isPublic,
                mostrarOfensiva: showStreak,
            });

            if (error) {
                if (error.code === "23505") {
                    setStatusUsuario("emUso");
                    toast.warning("Este nome de usuário já está sendo usado por outra pessoa. Escolha outro!", "Aviso");
                    return;
                }
                toast.error("Não foi possível salvar os dados. " + error.message);
                return;
            }

            await updateWeeklyGoal(weeklyGoal);
            toast.success("Perfil atualizado com sucesso!");
            router.back();
        } catch (error) {
            console.error("Erro ao salvar:", error);
            toast.error("Não foi possível salvar os dados.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <EditarPerfilSkeleton />;
    }

    const corIdentidade = getIdentityColor(username || profileData?.nome_usuario);
    const iniciais = getInitials(username || profileData?.nome_usuario);
    const rotuloUsuario: Record<StatusUsuario, string> = {
        curto: "muito curto",
        checando: "verificando…",
        disponivel: "disponível",
        emUso: "já em uso",
    };
    const usuarioInvalido = statusUsuario === "curto" || statusUsuario === "emUso";
    const corUsuario = statusUsuario === "checando"
        ? HADES.textMuted
        : usuarioInvalido
            ? HADES.red
            : HADES.green;
    const IconeUsuario = usuarioInvalido ? CircleAlert : Check;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top"]}>
            {/* Header */}
            <View
                style={{
                    paddingTop: 6,
                    paddingHorizontal: 20,
                    paddingBottom: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <X size={21} color={HADES.textSecondary} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: HADES.text }}>Editar perfil</Text>
                </View>
                <TouchableOpacity
                    onPress={handleSave}
                    disabled={saving}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityLabel="Salvar"
                    style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        backgroundColor: HADES.accentSolid,
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: saving ? 0.7 : 1,
                    }}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color="#000" />
                    ) : (
                        <Check size={18} color="#000" strokeWidth={2.6} />
                    )}
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingBottom: 32 }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Capa: a mesma foto do avatar (ou a cor de identidade quando não há foto) */}
                    <View style={{ height: BANNER_H }}>
                        <BannerPerfil
                            altura={BANNER_H}
                            cor={corIdentidade}
                            iniciais={iniciais}
                            foto={imageUrl}
                            estatico
                        />
                        <TouchableOpacity
                            onPress={trocarFoto}
                            activeOpacity={0.8}
                            style={{
                                position: "absolute",
                                top: 12,
                                left: 14,
                                height: 30,
                                borderRadius: 9,
                                backgroundColor: "rgba(0,0,0,0.5)",
                                borderWidth: 1,
                                borderColor: "rgba(255,255,255,0.16)",
                                flexDirection: "row",
                                alignItems: "center",
                                paddingHorizontal: 11,
                                gap: 6,
                            }}
                        >
                            <ImageIcon size={14} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    {/* Avatar sobreposto */}
                    <View style={{ alignItems: "center", marginTop: -46 }}>
                        <TouchableOpacity onPress={trocarFoto} activeOpacity={0.85}>
                            <View
                                style={{
                                    borderRadius: 999,
                                    borderWidth: 4,
                                    borderColor: HADES.bg,
                                    overflow: "hidden",
                                }}
                            >
                                <Avatar
                                    foto={imageUrl}
                                    nome={username || profileData?.nome_usuario}
                                    size={AVATAR_SIZE}
                                />
                            </View>
                            <View
                                style={{
                                    position: "absolute",
                                    bottom: -2,
                                    right: -2,
                                    width: 32,
                                    height: 32,
                                    borderRadius: 16,
                                    backgroundColor: HADES.accentSolid,
                                    borderWidth: 3,
                                    borderColor: HADES.bg,
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                {enviandoFoto ? (
                                    <ActivityIndicator size="small" color="#000" />
                                ) : (
                                    <Camera size={15} color="#000" />
                                )}
                            </View>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        onPress={trocarFoto}
                        activeOpacity={0.7}
                        style={{ alignItems: "center", marginTop: 10 }}
                    >
                        <Text style={{ fontSize: 12.5, fontWeight: "600", color: HADES.accentSolid }}>
                            {enviandoFoto ? "Enviando…" : "Alterar foto"}
                        </Text>
                    </TouchableOpacity>

                    {/* Campos */}
                    <View style={{ paddingHorizontal: 20, paddingTop: 22, gap: 12 }}>
                        {/* Nome */}
                        <View style={fieldStyle}>
                            <Text style={capStyle}>Nome</Text>
                            <TextInput
                                value={realName}
                                onChangeText={setRealName}
                                placeholder="Seu nome"
                                placeholderTextColor={HADES.grip}
                                maxLength={32}
                                style={{
                                    color: HADES.text,
                                    fontSize: 15.5,
                                    fontWeight: "600",
                                    marginTop: 6,
                                    padding: 0,
                                }}
                            />
                        </View>

                        {/* Usuário */}
                        <View style={fieldStyle}>
                            <View
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                }}
                            >
                                <Text style={capStyle}>Usuário</Text>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                    {statusUsuario !== "checando" && (
                                        <IconeUsuario size={13} color={corUsuario} />
                                    )}
                                    <Text style={{ fontSize: 11.5, fontWeight: "600", color: corUsuario }}>
                                        {rotuloUsuario[statusUsuario]}
                                    </Text>
                                </View>
                            </View>
                            <View
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    marginTop: 6,
                                    gap: 2,
                                }}
                            >
                                <Text style={{ fontSize: 15.5, fontWeight: "600", color: HADES.textDim }}>@</Text>
                                <TextInput
                                    value={username}
                                    onChangeText={(text) => setUsername(text.replace(/[^a-zA-Z0-9._]/g, ""))}
                                    placeholder="usuario"
                                    placeholderTextColor={HADES.grip}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    maxLength={20}
                                    style={{
                                        flex: 1,
                                        color: HADES.text,
                                        fontSize: 15.5,
                                        fontWeight: "600",
                                        padding: 0,
                                    }}
                                />
                            </View>
                        </View>

                        {/* Bio */}
                        <View style={fieldStyle}>
                            <View
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                }}
                            >
                                <Text style={capStyle}>Bio</Text>
                                <Text
                                    style={{
                                        fontSize: 11.5,
                                        fontWeight: "600",
                                        color: bio.length > 125 ? HADES.accentSolid : HADES.textDim,
                                    }}
                                >
                                    {bio.length}/{BIO_MAX}
                                </Text>
                            </View>
                            <TextInput
                                value={bio}
                                onChangeText={setBio}
                                placeholder="Conte o que você está estudando"
                                placeholderTextColor={HADES.grip}
                                multiline
                                maxLength={BIO_MAX}
                                textAlignVertical="top"
                                style={{
                                    height: 74,
                                    marginTop: 6,
                                    color: HADES.text,
                                    fontSize: 14,
                                    fontWeight: "500",
                                    lineHeight: 21,
                                    padding: 0,
                                }}
                            />
                        </View>
                        <Text style={{ fontSize: 11.5, color: HADES.textDim, paddingLeft: 4 }}>
                            Sua bio aparece para o grupo e no ranking.
                        </Text>

                        {/* Privacidade */}
                        <View
                            style={{
                                ...fieldStyle,
                                paddingTop: 4,
                                paddingBottom: 4,
                                marginTop: 6,
                            }}
                        >
                            <LinhaPrivacidade
                                Icone={Eye}
                                titulo="Perfil público"
                                descricao="Qualquer um pode ver suas estatísticas"
                                ligado={isPublic}
                                onToggle={() => setIsPublic((v) => !v)}
                                comBorda
                            />
                            <LinhaPrivacidade
                                Icone={Flame}
                                titulo="Mostrar ofensiva"
                                descricao="Exibe seus dias seguidos no avatar"
                                ligado={showStreak}
                                onToggle={() => setShowStreak((v) => !v)}
                            />
                        </View>

                        {/* Meta Semanal */}
                        <View style={{ marginTop: 8 }}>
                            <Text style={[sechStyle, { marginBottom: 14 }]}>Meta Semanal</Text>
                            <View
                                style={{
                                    height: 260,
                                    borderRadius: 13,
                                    borderWidth: 1,
                                    borderColor: HADES.border,
                                    overflow: "hidden",
                                }}
                            >
                                <WheelPicker
                                    items={WEEKLY_HOURS}
                                    selectedIndex={weeklyGoalIdx}
                                    onChange={setWeeklyGoalIdx}
                                    itemHeight={52}
                                />
                            </View>
                            <Text style={{ fontSize: 11.5, color: HADES.textDim, marginTop: 9, paddingLeft: 4 }}>
                                Defina sua meta semanal de estudo em horas.
                            </Text>
                        </View>

                        {/* Cancelar */}
                        <Pressable
                            onPress={() => router.back()}
                            style={{
                                height: 48,
                                borderRadius: 13,
                                borderWidth: 1,
                                borderColor: "rgba(255,255,255,0.08)",
                                justifyContent: "center",
                                alignItems: "center",
                                marginTop: 8,
                            }}
                        >
                            <Text style={{ fontSize: 14.5, fontWeight: "600", color: HADES.textSecondary }}>
                                Cancelar
                            </Text>
                        </Pressable>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

type LinhaPrivacidadeProps = {
    Icone: typeof Eye;
    titulo: string;
    descricao: string;
    ligado: boolean;
    onToggle: () => void;
    comBorda?: boolean;
};

/** Linha "ícone + texto + interruptor" do bloco de privacidade. */
function LinhaPrivacidade({ Icone, titulo, descricao, ligado, onToggle, comBorda }: LinhaPrivacidadeProps) {
    return (
        <Pressable
            onPress={onToggle}
            style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 13,
                ...(comBorda
                    ? { borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }
                    : {}),
            }}
        >
            <Icone size={17} color={HADES.textMuted} />
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: HADES.text }}>{titulo}</Text>
                <Text style={{ fontSize: 11.5, color: HADES.textFaint, marginTop: 2 }}>{descricao}</Text>
            </View>
            <View
                style={{
                    width: 44,
                    height: 26,
                    borderRadius: 14,
                    backgroundColor: ligado ? HADES.accentSolid : HADES.trackOff,
                    padding: 3,
                    flexDirection: "row",
                    justifyContent: ligado ? "flex-end" : "flex-start",
                    alignItems: "center",
                }}
            >
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff" }} />
            </View>
        </Pressable>
    );
}

function EditarPerfilSkeleton() {
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top"]}>
            <View
                style={{
                    paddingTop: 6,
                    paddingHorizontal: 20,
                    paddingBottom: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Skeleton width={21} height={21} borderRadius={6} hades />
                    <Skeleton width={120} height={16} hades />
                </View>
                <Skeleton width={34} height={34} borderRadius={10} hades />
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 32 }}
                showsVerticalScrollIndicator={false}
            >
                <Skeleton width="100%" height={BANNER_H} hades />

                <View style={{ alignItems: "center", marginTop: -46 }}>
                    <View style={{ borderRadius: 999, borderWidth: 4, borderColor: HADES.bg }}>
                        <SkeletonCircle size={AVATAR_SIZE} hades />
                    </View>
                </View>

                <View style={{ alignItems: "center", marginTop: 10, marginBottom: 22 }}>
                    <Skeleton width={80} height={12} hades />
                </View>

                <View style={{ paddingHorizontal: 20, gap: 12 }}>
                    {/* Nome, Usuário, Bio */}
                    <Skeleton width="100%" height={64} borderRadius={14} hades />
                    <Skeleton width="100%" height={64} borderRadius={14} hades />
                    <Skeleton width="100%" height={119} borderRadius={14} hades />
                    {/* "Sua bio aparece para o grupo e no ranking." */}
                    <Skeleton width={240} height={11.5} hades style={{ marginLeft: 4 }} />

                    {/* Privacidade: dois interruptores no mesmo cartão */}
                    <Skeleton width="100%" height={128} borderRadius={14} hades style={{ marginTop: 6 }} />

                    {/* Meta semanal: título, roda de horas e a legenda embaixo */}
                    <View style={{ marginTop: 8 }}>
                        <Skeleton width={110} height={13} hades style={{ marginBottom: 14 }} />
                        <Skeleton width="100%" height={260} borderRadius={13} hades />
                        <Skeleton width={200} height={11.5} hades style={{ marginTop: 9, marginLeft: 4 }} />
                    </View>

                    <Skeleton width="100%" height={48} borderRadius={13} hades style={{ marginTop: 8 }} />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
