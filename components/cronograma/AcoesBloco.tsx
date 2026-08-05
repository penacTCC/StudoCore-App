import { View, Text, Modal, Pressable, TouchableOpacity } from "react-native";
import { Pencil, Clock, Check, Coffee } from "lucide-react-native";
import { HADES } from "@/constants/hades";
import type { BlocoDoDia } from "@/types/cronograma";

type Props = {
    bloco: BlocoDoDia | null;
    /** Some com "marcar como feito" em bloco que ainda nem começou. */
    permiteConcluir: boolean;
    onFechar: () => void;
    onEditar: (bloco: BlocoDoDia) => void;
    onAdiar: (bloco: BlocoDoDia, minutos: number) => void;
    onMarcarFeito: (bloco: BlocoDoDia) => void;
};

/**
 * Folha de ações de um bloco do dia.
 *
 * Existe porque a linha do tempo só oferecia ação no bloco que está acontecendo
 * agora ("Iniciar foco"): o que já passou e o que ainda vem eram cartazes sem
 * botão, e um bloco marcado como "Furado" não tinha nenhuma saída.
 */
export default function AcoesBloco({
    bloco,
    permiteConcluir,
    onFechar,
    onEditar,
    onAdiar,
    onMarcarFeito,
}: Props) {
    const descanso = bloco?.tipo === "descanso";
    const doPlano = bloco?.origem === "plano";

    return (
        <Modal visible={!!bloco} transparent animationType="fade" onRequestClose={onFechar}>
            <Pressable
                style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}
                onPress={onFechar}
            >
                <Pressable
                    style={{
                        backgroundColor: HADES.bg,
                        borderWidth: 1,
                        borderColor: HADES.borderStrong,
                        borderTopLeftRadius: 24,
                        borderTopRightRadius: 24,
                        paddingHorizontal: 20,
                        paddingBottom: 30,
                    }}
                >
                    <View style={{ paddingTop: 12, paddingBottom: 4, alignItems: "center" }}>
                        <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: HADES.dot }} />
                    </View>

                    {bloco && (
                        <>
                            <View style={{ alignItems: "center", marginTop: 10, marginBottom: 20 }}>
                                <Text style={{ fontSize: 17, fontWeight: "700", color: HADES.text }}>
                                    {descanso ? "Descanso" : bloco.materia ?? "Bloco"}
                                </Text>
                                <Text style={{ fontSize: 13, color: HADES.textMuted, marginTop: 3 }}>
                                    {bloco.horaInicio} · {bloco.duracaoMin} min
                                </Text>
                            </View>

                            <View style={{ gap: 8 }}>
                                {!doPlano && (
                                    <Acao
                                        Icone={Pencil}
                                        rotulo="Editar bloco"
                                        onPress={() => onEditar(bloco)}
                                    />
                                )}

                                <Acao
                                    Icone={Clock}
                                    rotulo="Adiar 15 min"
                                    descricao={doPlano ? "Vale para todos os dias do plano" : undefined}
                                    onPress={() => onAdiar(bloco, 15)}
                                />
                                <Acao
                                    Icone={Clock}
                                    rotulo="Adiar 30 min"
                                    descricao={doPlano ? "Vale para todos os dias do plano" : undefined}
                                    onPress={() => onAdiar(bloco, 30)}
                                />

                                {permiteConcluir && !descanso && (
                                    <Acao
                                        Icone={Check}
                                        rotulo="Marcar como feito"
                                        descricao="Registra o tempo do bloco sem passar pelo cronômetro"
                                        destaque
                                        onPress={() => onMarcarFeito(bloco)}
                                    />
                                )}

                                {descanso && (
                                    <View
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            gap: 10,
                                            paddingVertical: 12,
                                            paddingHorizontal: 14,
                                        }}
                                    >
                                        <Coffee size={16} color={HADES.green} />
                                        <Text style={{ fontSize: 13, color: HADES.textMuted, flex: 1 }}>
                                            Descanso não conta como tempo estudado.
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </>
                    )}
                </Pressable>
            </Pressable>
        </Modal>
    );
}

function Acao({
    Icone,
    rotulo,
    descricao,
    destaque,
    onPress,
}: {
    Icone: typeof Pencil;
    rotulo: string;
    descricao?: string;
    destaque?: boolean;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.8}
            style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                backgroundColor: destaque ? HADES.accentTint : HADES.surfaceRaised,
                borderWidth: 1,
                borderColor: destaque ? HADES.accentTintBorder : HADES.border,
                borderRadius: 13,
                paddingVertical: 14,
                paddingHorizontal: 15,
            }}
        >
            <Icone size={17} color={destaque ? HADES.accentSolid : HADES.textSecondary} />
            <View style={{ flex: 1 }}>
                <Text
                    style={{
                        fontSize: 15,
                        fontWeight: "600",
                        color: destaque ? HADES.accentSolid : HADES.text,
                    }}
                >
                    {rotulo}
                </Text>
                {descricao && (
                    <Text style={{ fontSize: 11, color: HADES.textFaint, marginTop: 2 }}>{descricao}</Text>
                )}
            </View>
        </TouchableOpacity>
    );
}
