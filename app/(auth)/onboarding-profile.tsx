import { useEffect, useMemo, useState } from "react";

//Componentes do React Native
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StatusBar,
    Alert,
    DeviceEventEmitter,
    ActivityIndicator,
} from "react-native";

//Componentes do Expo Router
import { router, useLocalSearchParams } from "expo-router";

//Componentes do Lucide React Native
import {
    ArrowLeft,
    Lock,
    Check,
    BookOpen,
    Target,
    GraduationCap,
    Briefcase,
    TrendingUp,
    Flame,
    Shuffle,
    User,
    AtSign,
} from "lucide-react-native";

//Constantes
import { HADES } from "@/constants/hades";

//Componentes do Projeto
import { InputField } from "@/components/form";
import { ImagePickerAvatar, WheelPicker } from "@/components/ui";

//Serviços da aplicação
import { useAuth } from "@/hooks/useAuth";
import {
    obterSessaoAtual,
    refreshSessao,
    salvarDadosPerfil,
    validarSessaoGoogle,
    verificarNomeUsuario,
} from "@/services/auth";

// ── Dados das opções ──────────────────────────────────────────────────────────
const OBJETIVOS = [
    { value: "vestibular", label: "Passar em um vestibular" },
    { value: "enem", label: "Gabaritar o ENEM" },
    { value: "concurso", label: "Passar em um concurso público" },
    { value: "escola", label: "Ir bem nas provas da escola/faculdade" },
    { value: "autodidata", label: "Aprender por conta própria" },
];

const FASES = [
    { value: "ensino_medio", label: "Ensino Médio", Icon: BookOpen },
    { value: "cursinho", label: "Cursinho / pré-vestibular", Icon: Target },
    { value: "superior", label: "Ensino Superior", Icon: GraduationCap },
    { value: "formado", label: "Já formado, estudando por conta", Icon: Briefcase },
];

const AREAS = [
    { value: "exatas", label: "Exatas (Matemática, Física, Química)" },
    { value: "biologicas", label: "Biológicas (Biologia, Saúde)" },
    { value: "humanas", label: "Humanas (História, Geografia, Filosofia)" },
    { value: "linguagens", label: "Linguagens (Português, Redação, Inglês)" },
    { value: "tecnologia", label: "Tecnologia / Programação" },
];

const RITMOS = [
    { value: "intenso", label: "Intenso", subtitle: "Várias horas por dia" },
    { value: "equilibrado", label: "Equilibrado", subtitle: "Um pouco todo dia" },
    { value: "leve", label: "Leve", subtitle: "Quando dá tempo" },
];

const DIFICULDADES = [
    { value: "progressiva", label: "Começar mais fácil e ir subindo", Icon: TrendingUp },
    { value: "desafiadora", label: "Desafiadoras desde o início", Icon: Flame },
    { value: "variada", label: "Variadas — um mix de tudo", Icon: Shuffle },
];

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const DIAS = Array.from({ length: 31 }, (_, i) => String(i + 1));
const ANO_ATUAL = new Date().getFullYear();
const ANOS = Array.from({ length: ANO_ATUAL - 1946 + 1 }, (_, i) => String(1946 + i));

// ── Sub-componentes visuais ────────────────────────────────────────────────────
function ProgressSegments({ total, active }: { total: number; active: number }) {
    return (
        <View style={{ flexDirection: "row", gap: 6, marginTop: 22 }}>
            {Array.from({ length: total }).map((_, i) => (
                <View
                    key={i}
                    style={{
                        flex: 1,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: i <= active ? HADES.accentSolid : "rgba(255,255,255,0.12)",
                    }}
                />
            ))}
        </View>
    );
}

function SlideHeader({ title, accent, subtitle }: { title: string; accent: string; subtitle?: string }) {
    return (
        <View style={{ marginTop: 26 }}>
            <Text style={{ fontSize: 29, fontWeight: "800", color: HADES.text, letterSpacing: -0.7, lineHeight: 34 }}>
                {title} <Text style={{ color: HADES.accentSolid }}>{accent}</Text>
            </Text>
            {subtitle && <Text style={{ fontSize: 14, color: HADES.textMuted, marginTop: 8 }}>{subtitle}</Text>}
        </View>
    );
}

function SingleCard({
    label,
    subtitle,
    selected,
    Icon,
    onPress,
}: {
    label: string;
    subtitle?: string;
    selected: boolean;
    Icon?: React.ComponentType<{ size?: number; color?: string }>;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            style={{
                backgroundColor: selected ? "rgba(255,154,0,0.10)" : HADES.surfaceOverlay,
                borderWidth: selected ? 1.5 : 1,
                borderColor: selected ? HADES.accentSolid : HADES.border,
                borderRadius: 15,
                paddingVertical: 16,
                paddingHorizontal: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 13,
            }}
        >
            {Icon && (
                <View
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: 11,
                        backgroundColor: selected ? "rgba(255,154,0,0.15)" : "rgba(255,255,255,0.05)",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Icon size={20} color={selected ? HADES.accentSolid : HADES.textMuted} />
                </View>
            )}
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: selected ? "700" : "600", color: selected ? HADES.text : "#e8e9ec" }}>
                    {label}
                </Text>
                {subtitle && (
                    <Text style={{ fontSize: 13, color: selected ? HADES.textSecondary : HADES.textMuted, marginTop: 3 }}>
                        {subtitle}
                    </Text>
                )}
            </View>
            {selected && <Check size={20} color={HADES.accentSolid} />}
        </TouchableOpacity>
    );
}

function MultiCard({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            style={{
                backgroundColor: selected ? "rgba(255,154,0,0.10)" : HADES.surfaceOverlay,
                borderWidth: selected ? 1.5 : 1,
                borderColor: selected ? HADES.accentSolid : HADES.border,
                borderRadius: 14,
                paddingVertical: 14,
                paddingHorizontal: 15,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
            }}
        >
            <Text style={{ flex: 1, fontSize: 14.5, fontWeight: selected ? "700" : "600", color: selected ? HADES.text : "#e8e9ec" }}>
                {label}
            </Text>
            <View
                style={{
                    width: 22,
                    height: 22,
                    borderRadius: 7,
                    backgroundColor: selected ? HADES.accentSolid : "transparent",
                    borderWidth: selected ? 0 : 1.5,
                    borderColor: "rgba(255,255,255,0.18)",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                {selected && <Check size={15} color="#000" />}
            </View>
        </TouchableOpacity>
    );
}

function PrimaryCTA({ label, onPress, loading }: { label: string; onPress: () => void; loading?: boolean }) {
    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={onPress}
            disabled={loading}
            style={{
                height: 56,
                borderRadius: 15,
                backgroundColor: HADES.accentSolid,
                alignItems: "center",
                justifyContent: "center",
                opacity: loading ? 0.8 : 1,
            }}
        >
            {loading ? (
                <ActivityIndicator size="small" color="#000" />
            ) : (
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#000" }}>{label}</Text>
            )}
        </TouchableOpacity>
    );
}

// ── Tela ────────────────────────────────────────────────────────────────────────
export default function OnboardingCarousel() {
    const params = useLocalSearchParams<{ code?: string }>();
    const { user, userId, isLoading } = useAuth();

    const [validatingGoogleLogin, setValidatingGoogleLogin] = useState(false);
    const [loading, setLoading] = useState(false);

    // Nome/@usuário vêm do signup (user_metadata). Se faltarem (login Google), coletamos aqui.
    const metaName = (user?.user_metadata?.nome_real as string | undefined) ?? "";
    const metaUsername = (user?.user_metadata?.nome_usuario as string | undefined) ?? "";
    const needsIdentity = !metaName || !metaUsername;

    const [realName, setRealName] = useState("");
    const [username, setUsername] = useState("");

    // Aniversário (índices das rodas)
    const [dayIdx, setDayIdx] = useState(14); // dia 15
    const [monthIdx, setMonthIdx] = useState(5); // Jun
    const [yearIdx, setYearIdx] = useState(Math.max(0, ANOS.indexOf(String(ANO_ATUAL - 18))));

    // Respostas
    const [objetivo, setObjetivo] = useState<string | null>(null);
    const [fase, setFase] = useState<string | null>(null);
    const [areas, setAreas] = useState<string[]>([]);
    const [ritmo, setRitmo] = useState<string | null>(null);
    const [dificuldade, setDificuldade] = useState<string | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    const [step, setStep] = useState(0);

    // Sincroniza nome/@usuário quando o metadata carrega.
    useEffect(() => {
        if (metaName) setRealName(metaName);
        if (metaUsername) setUsername(metaUsername);
    }, [metaName, metaUsername]);

    // Finaliza login com Google, preservando o comportamento antigo.
    useEffect(() => {
        const finishGoogleLogin = async () => {
            if (!params.code) return;
            setValidatingGoogleLogin(true);
            const { error } = await validarSessaoGoogle(params.code);
            if (error) {
                const { data: { session } } = await obterSessaoAtual();
                if (!session) Alert.alert("Erro no Google", error.message);
            }
            setValidatingGoogleLogin(false);
        };
        finishGoogleLogin();
    }, [params.code]);

    // Sequência de slides (o slide de identidade só aparece no login Google).
    const slides = useMemo(
        () => [
            ...(needsIdentity ? (["identity"] as const) : []),
            "birthday",
            "objetivo",
            "fase",
            "areas",
            "ritmo",
            "dificuldade",
            "foto",
        ],
        [needsIdentity],
    );

    const current = slides[step];
    const total = slides.length;

    const goBack = () => {
        if (step === 0) {
            router.back();
            return;
        }
        setStep((s) => s - 1);
    };

    const goNext = () => {
        if (step >= total - 1) {
            handleFinish();
            return;
        }
        setStep((s) => s + 1);
    };

    // Seleciona e avança automaticamente (seleção única).
    const selectAndAdvance = (setter: (v: string) => void, value: string) => {
        setter(value);
        setTimeout(goNext, 220);
    };

    const toggleArea = (value: string) => {
        setAreas((prev) => (prev.includes(value) ? prev.filter((a) => a !== value) : [...prev, value]));
    };

    const handleFinish = async () => {
        const nome = realName.trim();
        const user_name = username.trim();

        if (!nome || !user_name) {
            Alert.alert("Dados incompletos", "Precisamos do seu nome e nome de usuário.");
            setStep(0);
            return;
        }
        if (!objetivo || !fase || !ritmo || !dificuldade) {
            Alert.alert("Faltam respostas", "Responda todas as etapas para continuar.");
            return;
        }
        if (areas.length === 0) {
            Alert.alert("Escolha ao menos uma área", "Selecione pelo menos uma área de foco.");
            return;
        }
        if (isLoading || validatingGoogleLogin) {
            Alert.alert("Aguarde", "Ainda estamos finalizando seu login.");
            return;
        }

        const { data: { session } } = await obterSessaoAtual();
        const usuarioId = userId ?? session?.user.id;
        if (!usuarioId) {
            Alert.alert("Erro", "Usuário não encontrado. Tente logar novamente.");
            return;
        }

        setLoading(true);

        const ano = ANOS[yearIdx];
        const mes = String(monthIdx + 1).padStart(2, "0");
        const dia = String(dayIdx + 1).padStart(2, "0");
        const dataFormatada = `${ano}-${mes}-${dia}`;

        // Verifica se o nome de usuário já existe (o banco também garante via UNIQUE).
        const { data: existentes, error: selectError } = await verificarNomeUsuario(user_name);
        if (selectError) {
            Alert.alert("Erro ao buscar", selectError.message);
            setLoading(false);
            return;
        }
        if (existentes && existentes.length > 0) {
            Alert.alert("Nome de usuário indisponível", "Esse nome de usuário já existe. Escolha outro.");
            setLoading(false);
            if (needsIdentity) setStep(0);
            return;
        }

        const { error: insertError } = await salvarDadosPerfil(usuarioId, nome, user_name, dataFormatada, imageUrl, {
            objetivo,
            nivelEnsino: fase,
            areasFoco: areas,
            ritmoEstudo: ritmo,
            dificuldade,
        });

        if (insertError) {
            const dup = insertError.code === "23505";
            Alert.alert(
                dup ? "Nome de usuário indisponível" : "Erro ao salvar",
                dup ? "Esse nome de usuário já existe. Escolha outro." : insertError.message,
            );
            setLoading(false);
            if (dup && needsIdentity) setStep(0);
        } else {
            await refreshSessao();
            DeviceEventEmitter.emit("profileReady");
        }
    };

    // Aguarda o metadata (nome/@usuário) antes de decidir a sequência de slides,
    // evitando o slide de identidade piscar para quem veio do signup.
    if (isLoading || validatingGoogleLogin) {
        return (
            <View style={{ flex: 1, backgroundColor: HADES.bg, alignItems: "center", justifyContent: "center" }}>
                <StatusBar barStyle="light-content" backgroundColor="#000000" />
                <ActivityIndicator size="large" color={HADES.accentSolid} />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: HADES.bg }}>
            <StatusBar barStyle="light-content" backgroundColor="#000000" />

            <View style={{ flex: 1, paddingTop: 56, paddingHorizontal: 26 }}>
                {/* Voltar + progresso */}
                <TouchableOpacity onPress={goBack} style={{ paddingTop: 6, width: 40 }}>
                    <ArrowLeft size={26} color={HADES.text} />
                </TouchableOpacity>
                <ProgressSegments total={total} active={step} />

                {/* Slides */}
                {current === "identity" && (
                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
                        <SlideHeader title="Como podemos te" accent="chamar?" subtitle="Seu nome e um nome de usuário" />
                        <View style={{ marginTop: 24, gap: 14 }}>
                            <InputField
                                icon={<User size={18} color={HADES.accentSolid} />}
                                value={realName}
                                onChangeText={setRealName}
                                placeholder="Nome completo"
                                autoCapitalize="words"
                                hades
                            />
                            <InputField
                                icon={<AtSign size={18} color={HADES.violet} />}
                                value={username}
                                onChangeText={(v) => setUsername(v.replace(/[^a-zA-Z0-9_.]/g, ""))}
                                placeholder="Nome de usuário"
                                maxLength={30}
                                hades
                            />
                        </View>
                        <View style={{ flex: 1 }} />
                        <View style={{ paddingVertical: 24 }}>
                            <PrimaryCTA
                                label="Continuar"
                                onPress={() => {
                                    if (!realName.trim() || username.trim().length < 3) {
                                        Alert.alert("Dados incompletos", "Informe seu nome e um nome de usuário (mín. 3 caracteres).");
                                        return;
                                    }
                                    goNext();
                                }}
                            />
                        </View>
                    </ScrollView>
                )}

                {current === "birthday" && (
                    <View style={{ flex: 1 }}>
                        <SlideHeader title="Quando é o teu" accent="aniversário?" />
                        <View style={{ flex: 1, justifyContent: "center" }}>
                            <View style={{ flexDirection: "row", gap: 10, position: "relative" }}>
                                <View
                                    style={{
                                        position: "absolute",
                                        top: "50%",
                                        left: 0,
                                        right: 0,
                                        height: 52,
                                        transform: [{ translateY: -26 }],
                                        borderRadius: 14,
                                        backgroundColor: "rgba(255,154,0,0.10)",
                                        borderWidth: 1,
                                        borderColor: "rgba(255,154,0,0.35)",
                                    }}
                                    pointerEvents="none"
                                />
                                <WheelPicker items={DIAS} selectedIndex={dayIdx} onChange={setDayIdx} flex={1} />
                                <WheelPicker items={MESES_ABREV} selectedIndex={monthIdx} onChange={setMonthIdx} flex={1.2} />
                                <WheelPicker items={ANOS} selectedIndex={yearIdx} onChange={setYearIdx} flex={1.4} />
                            </View>
                        </View>
                        <View style={{ paddingBottom: 24 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginBottom: 14 }}>
                                <Lock size={13} color={HADES.textMuted} />
                                <Text style={{ fontSize: 12.5, color: HADES.textMuted }}>
                                    Os teus dados são privados e estão protegidos.
                                </Text>
                            </View>
                            <PrimaryCTA label="Continuar" onPress={goNext} />
                        </View>
                    </View>
                )}

                {current === "objetivo" && (
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                        <SlideHeader title="Qual é o seu principal" accent="objetivo?" subtitle="Escolha uma opção" />
                        <View style={{ gap: 11, marginTop: 24 }}>
                            {OBJETIVOS.map((o) => (
                                <SingleCard
                                    key={o.value}
                                    label={o.label}
                                    selected={objetivo === o.value}
                                    onPress={() => selectAndAdvance(setObjetivo, o.value)}
                                />
                            ))}
                        </View>
                    </ScrollView>
                )}

                {current === "fase" && (
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                        <SlideHeader title="Em que fase" accent="você está?" subtitle="Escolha uma opção" />
                        <View style={{ gap: 11, marginTop: 24 }}>
                            {FASES.map((f) => (
                                <SingleCard
                                    key={f.value}
                                    label={f.label}
                                    Icon={f.Icon}
                                    selected={fase === f.value}
                                    onPress={() => selectAndAdvance(setFase, f.value)}
                                />
                            ))}
                        </View>
                    </ScrollView>
                )}

                {current === "areas" && (
                    <View style={{ flex: 1 }}>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <SlideHeader title="Quais áreas você mais quer" accent="focar?" subtitle="Pode escolher mais de uma" />
                            <View style={{ gap: 10, marginTop: 20 }}>
                                {AREAS.map((a) => (
                                    <MultiCard
                                        key={a.value}
                                        label={a.label}
                                        selected={areas.includes(a.value)}
                                        onPress={() => toggleArea(a.value)}
                                    />
                                ))}
                            </View>
                        </ScrollView>
                        <View style={{ paddingBottom: 24, paddingTop: 14 }}>
                            <PrimaryCTA label="Continuar" onPress={goNext} />
                        </View>
                    </View>
                )}

                {current === "ritmo" && (
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                        <SlideHeader title="Qual é o seu" accent="ritmo de estudo?" subtitle="Escolha uma opção" />
                        <View style={{ gap: 12, marginTop: 24 }}>
                            {RITMOS.map((r) => (
                                <SingleCard
                                    key={r.value}
                                    label={r.label}
                                    subtitle={r.subtitle}
                                    selected={ritmo === r.value}
                                    onPress={() => selectAndAdvance(setRitmo, r.value)}
                                />
                            ))}
                        </View>
                    </ScrollView>
                )}

                {current === "dificuldade" && (
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                        <SlideHeader title="Como você prefere que as" accent="questões sejam?" subtitle="Escolha uma opção" />
                        <View style={{ gap: 12, marginTop: 24 }}>
                            {DIFICULDADES.map((d) => (
                                <SingleCard
                                    key={d.value}
                                    label={d.label}
                                    Icon={d.Icon}
                                    selected={dificuldade === d.value}
                                    onPress={() => selectAndAdvance(setDificuldade, d.value)}
                                />
                            ))}
                        </View>
                    </ScrollView>
                )}

                {current === "foto" && (
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
                        <SlideHeader title="Adicione uma" accent="foto de perfil" subtitle="Opcional — você pode mudar depois" />
                        <View style={{ marginTop: 40 }}>
                            <ImagePickerAvatar bucket="images" onImageUploaded={setImageUrl} circle hades />
                        </View>
                        <View style={{ flex: 1 }} />
                        <View style={{ paddingVertical: 24 }}>
                            <PrimaryCTA label="Concluir ✓" onPress={handleFinish} loading={loading} />
                        </View>
                    </ScrollView>
                )}
            </View>
        </View>
    );
}
