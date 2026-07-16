import { View, Text, ScrollView, TouchableOpacity, Modal, Pressable } from "react-native";
import {
    MoreHorizontal,
    Pin,
    Calendar,
    CalendarCheck,
    CalendarPlus,
    Copy,
    Trash2,
    Plus,
} from "lucide-react-native";
import { HADES } from "@/constants/hades";
import type { Plano } from "@/types/cronograma";

type Props = {
    planos: Plano[];
    menuAbertoId: string | null;
    onAbrirMenu: (id: string | null) => void;
    onNovoPlano: () => void;
    onEditarPlano: (plano: Plano) => void;
};

export default function AbaPlanos({
    planos,
    menuAbertoId,
    onAbrirMenu,
    onNovoPlano,
    onEditarPlano,
}: Props) {
    return (
        <View style={{ flex: 1 }}>
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 96, gap: 12 }}
                showsVerticalScrollIndicator={false}
            >
                {planos.map((plano) => (
                    <CardPlano
                        key={plano.id}
                        plano={plano}
                        menuAberto={menuAbertoId === plano.id}
                        onAbrirMenu={onAbrirMenu}
                        onEditar={onEditarPlano}
                    />
                ))}
            </ScrollView>

            {/* Menu de ações do plano */}
            <Modal
                visible={menuAbertoId !== null}
                transparent
                animationType="fade"
                onRequestClose={() => onAbrirMenu(null)}
            >
                <Pressable style={{ flex: 1 }} onPress={() => onAbrirMenu(null)}>
                    <View style={{ flex: 1, justifyContent: "flex-end", padding: 20, paddingBottom: 40 }}>
                        <View
                            style={{
                                backgroundColor: HADES.surfaceOverlay,
                                borderWidth: 1,
                                borderColor: "rgba(255,255,255,0.10)",
                                borderRadius: 13,
                                padding: 6,
                            }}
                        >
                            <ItemMenu Icone={CalendarCheck} rotulo="Aplicar a hoje" destaque />
                            <ItemMenu Icone={CalendarPlus} rotulo="Aplicar a uma data" />
                            <ItemMenu Icone={Pin} rotulo="Fixar em dias" />
                            <ItemMenu Icone={Copy} rotulo="Duplicar" />
                            <View
                                style={{
                                    height: 1,
                                    backgroundColor: "rgba(255,255,255,0.08)",
                                    marginVertical: 4,
                                    marginHorizontal: 8,
                                }}
                            />
                            <ItemMenu Icone={Trash2} rotulo="Excluir" perigo />
                        </View>
                    </View>
                </Pressable>
            </Modal>

            {/* Novo plano */}
            <TouchableOpacity
                onPress={onNovoPlano}
                activeOpacity={0.85}
                style={{
                    position: "absolute",
                    right: 20,
                    bottom: 24,
                    height: 52,
                    paddingHorizontal: 20,
                    borderRadius: 26,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    backgroundColor: HADES.accentSolid,
                    shadowColor: HADES.accent,
                    shadowOffset: { width: 0, height: 12 },
                    shadowOpacity: 0.35,
                    shadowRadius: 30,
                    elevation: 10,
                }}
            >
                <Plus size={19} color="#000" />
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#000" }}>Novo plano</Text>
            </TouchableOpacity>
        </View>
    );
}

function CardPlano({
    plano,
    menuAberto,
    onAbrirMenu,
    onEditar,
}: {
    plano: Plano;
    menuAberto: boolean;
    onAbrirMenu: (id: string | null) => void;
    onEditar: (plano: Plano) => void;
}) {
    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => onEditar(plano)}
            style={{
                backgroundColor: HADES.surface,
                borderWidth: 1,
                borderColor: HADES.border,
                borderRadius: 16,
                padding: 16,
            }}
        >
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 11, flex: 1 }}>
                    <View
                        style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: plano.cor }}
                    />
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: HADES.text }}>
                            {plano.nome}
                        </Text>
                        <Text style={{ fontSize: 12, color: HADES.textFaint, marginTop: 3 }}>
                            {plano.qtdBlocos} blocos · {plano.duracaoTotal}
                        </Text>
                    </View>
                </View>

                <TouchableOpacity
                    onPress={() => onAbrirMenu(plano.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <MoreHorizontal size={20} color={menuAberto ? HADES.accentSolid : HADES.textFaint} />
                </TouchableOpacity>
            </View>

            <AgendaDoPlano plano={plano} />
        </TouchableOpacity>
    );
}

function AgendaDoPlano({ plano }: { plano: Plano }) {
    const estilo = { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 13 } as const;

    if (plano.agenda.tipo === "fixado") {
        return (
            <View style={estilo}>
                <Pin size={12} color={HADES.textMuted} />
                <Text style={{ fontSize: 12, color: HADES.textMuted }}>
                    Fixado em{" "}
                    <Text style={{ color: HADES.textSecondary, fontWeight: "600" }}>
                        {plano.agenda.dias.join(", ")}
                    </Text>
                </Text>
            </View>
        );
    }

    if (plano.agenda.tipo === "data") {
        return (
            <View style={estilo}>
                <Calendar size={12} color={HADES.textMuted} />
                <Text style={{ fontSize: 12, color: HADES.textMuted }}>
                    Agendado para{" "}
                    <Text style={{ color: HADES.textSecondary, fontWeight: "600" }}>{plano.agenda.data}</Text>
                </Text>
            </View>
        );
    }

    return (
        <View style={estilo}>
            <Text style={{ fontSize: 12, color: HADES.textFaint }}>Não agendado</Text>
        </View>
    );
}

function ItemMenu({
    Icone,
    rotulo,
    destaque,
    perigo,
}: {
    Icone: typeof Pin;
    rotulo: string;
    destaque?: boolean;
    perigo?: boolean;
}) {
    const cor = perigo ? HADES.red : destaque ? HADES.accentSolid : HADES.textSecondary;
    const corTexto = perigo ? HADES.red : destaque ? HADES.text : "#e8e9ec";

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingVertical: 10,
                paddingHorizontal: 11,
                borderRadius: 9,
            }}
        >
            <Icone size={15} color={cor} />
            <Text style={{ fontSize: 13, color: corTexto, fontWeight: destaque ? "500" : "400" }}>
                {rotulo}
            </Text>
        </TouchableOpacity>
    );
}
