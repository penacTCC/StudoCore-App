import { View, Text, ScrollView, TouchableOpacity, TextInput } from "react-native";
import { Timer, AlarmClock, Plus, Globe, Lock, Info } from "lucide-react-native";
import { HADES } from "@/constants/hades";
import { PRESETS_POMODORO } from "@/constants/foco";
import type { ConfigPomodoro, ModoFoco } from "@/types/foco";
import type { Materia } from "@/types/materias";

function Rotulo({ texto, obrigatorio }: { texto: string; obrigatorio?: boolean }) {
    return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <Text
                style={{
                    fontSize: 12,
                    color: HADES.textFaint,
                    fontWeight: "700",
                    letterSpacing: 0.6,
                }}
            >
                {texto}
            </Text>
            {obrigatorio && <Text style={{ fontSize: 12, color: HADES.accentSolid }}>•</Text>}
        </View>
    );
}

export function SeletorModo({ modo, onChange }: { modo: ModoFoco; onChange: (m: ModoFoco) => void }) {
    const opcoes: { chave: ModoFoco; rotulo: string; Icone: typeof Timer }[] = [
        { chave: "cronometro", rotulo: "Cronômetro", Icone: Timer },
        { chave: "pomodoro", rotulo: "Pomodoro", Icone: AlarmClock },
    ];

    return (
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
            {opcoes.map(({ chave, rotulo, Icone }) => {
                const ativo = modo === chave;
                return (
                    <TouchableOpacity
                        key={chave}
                        onPress={() => onChange(chave)}
                        activeOpacity={0.7}
                        style={{
                            flex: 1,
                            paddingVertical: 10,
                            borderRadius: 9,
                            backgroundColor: ativo ? HADES.surfaceOverlay : "transparent",
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                        }}
                    >
                        <Icone size={15} color={ativo ? HADES.text : HADES.textFaint} />
                        <Text
                            style={{
                                fontSize: 14,
                                fontWeight: "600",
                                color: ativo ? HADES.text : HADES.textFaint,
                            }}
                        >
                            {rotulo}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

type Props = {
    modo: ModoFoco;
    materias: Materia[];
    materiaSelecionada: string;
    onSelecionarMateria: (nome: string) => void;
    onNovaMateria: () => void;
    conteudo: string;
    onChangeConteudo: (texto: string) => void;
    publica: boolean;
    onChangeVisibilidade: (publica: boolean) => void;
    config: ConfigPomodoro;
    onChangeConfig: (c: ConfigPomodoro) => void;
};

export default function ConfigSessao({
    modo,
    materias,
    materiaSelecionada,
    onSelecionarMateria,
    onNovaMateria,
    conteudo,
    onChangeConteudo,
    publica,
    onChangeVisibilidade,
    config,
    onChangeConfig,
}: Props) {
    const presetAtivo = PRESETS_POMODORO.find(
        (p) => p.focoMin === config.focoMin && p.descansoMin === config.descansoCurtoMin
    );

    return (
        <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
        >
            <Rotulo texto="MATÉRIA" />
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -20, marginBottom: modo === "pomodoro" ? 22 : 24 }}
                contentContainerStyle={{ paddingHorizontal: 20, gap: 9 }}
            >
                {materias.map((materia) => {
                    const ativa = materia.nomeExibicao === materiaSelecionada;
                    return (
                        <TouchableOpacity
                            key={materia.nomeNormalizado}
                            onPress={() => onSelecionarMateria(ativa ? "" : materia.nomeExibicao)}
                            activeOpacity={0.8}
                            style={{
                                paddingVertical: 11,
                                paddingHorizontal: 16,
                                borderRadius: 12,
                                backgroundColor: ativa ? HADES.accentSolid : HADES.surfaceRaised,
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 14,
                                    fontWeight: "600",
                                    color: ativa ? "#000" : HADES.textSecondary,
                                }}
                            >
                                {materia.nomeExibicao}
                            </Text>
                        </TouchableOpacity>
                    );
                })}

                <TouchableOpacity
                    onPress={onNovaMateria}
                    activeOpacity={0.8}
                    style={{
                        paddingVertical: 11,
                        paddingHorizontal: 16,
                        borderRadius: 12,
                        borderWidth: 1.5,
                        borderStyle: "dashed",
                        borderColor: "rgba(255,255,255,0.22)",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                    }}
                >
                    <Plus size={15} color={HADES.textMuted} />
                    <Text style={{ fontSize: 14, fontWeight: "600", color: HADES.textMuted }}>
                        Nova matéria
                    </Text>
                </TouchableOpacity>
            </ScrollView>

            {modo === "cronometro" && <Rotulo texto="CONTEÚDO ESPECÍFICO" obrigatorio />}
            <View
                style={{
                    backgroundColor: HADES.surface,
                    borderWidth: 1,
                    borderColor: HADES.borderStrong,
                    borderRadius: 13,
                    padding: 15,
                }}
            >
                <TextInput
                    value={conteudo}
                    onChangeText={onChangeConteudo}
                    placeholder="ex.: Capítulo 5: Derivadas"
                    placeholderTextColor={HADES.textFaint}
                    style={{ padding: 0, color: HADES.text, fontSize: 15 }}
                />
            </View>
            {modo === "cronometro" && (
                <Text style={{ fontSize: 12, color: HADES.textDim, marginTop: 8 }}>
                    Obrigatório para iniciar
                </Text>
            )}

            {modo === "cronometro" ? (
                <>
                    <View style={{ marginTop: 26 }}>
                        <Rotulo texto="VISIBILIDADE" />
                    </View>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                        <CardVisibilidade
                            Icone={Globe}
                            titulo="Pública"
                            descricao="Outros podem entrar"
                            ativo={publica}
                            onPress={() => onChangeVisibilidade(true)}
                        />
                        <CardVisibilidade
                            Icone={Lock}
                            titulo="Privada"
                            descricao="Só você vê"
                            ativo={!publica}
                            onPress={() => onChangeVisibilidade(false)}
                        />
                    </View>
                </>
            ) : (
                <>
                    <View style={{ marginTop: 22 }}>
                        <Rotulo texto="PRESET" />
                    </View>
                    <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
                        {PRESETS_POMODORO.map((preset) => {
                            const ativo = presetAtivo?.id === preset.id;
                            return (
                                <TouchableOpacity
                                    key={preset.id}
                                    onPress={() =>
                                        onChangeConfig({
                                            ...config,
                                            focoMin: preset.focoMin,
                                            descansoCurtoMin: preset.descansoMin,
                                        })
                                    }
                                    activeOpacity={0.8}
                                    style={{
                                        flex: 1,
                                        alignItems: "center",
                                        paddingVertical: 12,
                                        borderRadius: 12,
                                        backgroundColor: ativo ? "rgba(255,154,0,0.10)" : HADES.surface,
                                        borderWidth: ativo ? 1.5 : 1,
                                        borderColor: ativo ? "rgba(255,154,0,0.5)" : "rgba(255,255,255,0.08)",
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 13,
                                            fontWeight: "700",
                                            color: ativo ? HADES.text : HADES.textSecondary,
                                        }}
                                    >
                                        {preset.nome}
                                    </Text>
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            marginTop: 3,
                                            color: ativo ? HADES.accentSolid : HADES.textMuted,
                                        }}
                                    >
                                        {preset.focoMin} / {preset.descansoMin}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <View
                        style={{
                            backgroundColor: HADES.surface,
                            borderWidth: 1,
                            borderColor: HADES.border,
                            borderRadius: 14,
                            overflow: "hidden",
                            marginBottom: 16,
                        }}
                    >
                        <Stepper
                            rotulo="Foco"
                            valor={`${config.focoMin}min`}
                            onDiminuir={() =>
                                onChangeConfig({ ...config, focoMin: Math.max(5, config.focoMin - 5) })
                            }
                            onAumentar={() =>
                                onChangeConfig({ ...config, focoMin: Math.min(180, config.focoMin + 5) })
                            }
                        />
                        <Stepper
                            rotulo="Descanso curto"
                            valor={`${config.descansoCurtoMin}min`}
                            onDiminuir={() =>
                                onChangeConfig({
                                    ...config,
                                    descansoCurtoMin: Math.max(1, config.descansoCurtoMin - 1),
                                })
                            }
                            onAumentar={() =>
                                onChangeConfig({
                                    ...config,
                                    descansoCurtoMin: Math.min(30, config.descansoCurtoMin + 1),
                                })
                            }
                        />
                        <Stepper
                            rotulo="Ciclos até o longo"
                            valor={`${config.ciclosAteLongo}`}
                            ultima
                            onDiminuir={() =>
                                onChangeConfig({
                                    ...config,
                                    ciclosAteLongo: Math.max(2, config.ciclosAteLongo - 1),
                                })
                            }
                            onAumentar={() =>
                                onChangeConfig({
                                    ...config,
                                    ciclosAteLongo: Math.min(8, config.ciclosAteLongo + 1),
                                })
                            }
                        />
                    </View>

                    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 4 }}>
                        <Info size={14} color={HADES.textDim} style={{ marginTop: 1 }} />
                        <Text style={{ fontSize: 12, color: HADES.textMuted, lineHeight: 17, flex: 1 }}>
                            Só o tempo de foco vira hora de estudo, XP e ranking. Descanso não conta.
                        </Text>
                    </View>
                </>
            )}
        </ScrollView>
    );
}

function CardVisibilidade({
    Icone,
    titulo,
    descricao,
    ativo,
    onPress,
}: {
    Icone: typeof Globe;
    titulo: string;
    descricao: string;
    ativo: boolean;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.85}
            style={{
                flex: 1,
                backgroundColor: ativo ? "rgba(255,154,0,0.10)" : HADES.surface,
                borderWidth: ativo ? 1.5 : 1,
                borderColor: ativo ? "rgba(255,154,0,0.5)" : "rgba(255,255,255,0.08)",
                borderRadius: 14,
                padding: 14,
            }}
        >
            <Icone size={18} color={ativo ? HADES.accentSolid : HADES.textMuted} />
            <Text
                style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: ativo ? HADES.text : HADES.textSecondary,
                    marginTop: 9,
                }}
            >
                {titulo}
            </Text>
            <Text style={{ fontSize: 12, color: ativo ? HADES.textMuted : HADES.textFaint, marginTop: 2 }}>
                {descricao}
            </Text>
        </TouchableOpacity>
    );
}

function Stepper({
    rotulo,
    valor,
    onDiminuir,
    onAumentar,
    ultima,
}: {
    rotulo: string;
    valor: string;
    onDiminuir: () => void;
    onAumentar: () => void;
    ultima?: boolean;
}) {
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 14,
                borderBottomWidth: ultima ? 0 : 1,
                borderBottomColor: "rgba(255,255,255,0.05)",
            }}
        >
            <Text style={{ flex: 1, fontSize: 14, color: HADES.text }}>{rotulo}</Text>
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: HADES.bg,
                    borderRadius: 9,
                }}
            >
                <TouchableOpacity
                    onPress={onDiminuir}
                    activeOpacity={0.6}
                    style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}
                >
                    <Text style={{ color: HADES.textMuted, fontSize: 16 }}>−</Text>
                </TouchableOpacity>
                <Text
                    style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: HADES.text,
                        minWidth: 44,
                        textAlign: "center",
                    }}
                >
                    {valor}
                </Text>
                <TouchableOpacity
                    onPress={onAumentar}
                    activeOpacity={0.6}
                    style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}
                >
                    <Text style={{ color: HADES.accentSolid, fontSize: 16 }}>+</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
