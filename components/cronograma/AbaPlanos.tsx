import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Modal, Pressable, ActivityIndicator, RefreshControl, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
    MoreHorizontal,
    Pin,
    Calendar,
    CalendarCheck,
    CalendarPlus,
    Copy,
    Trash2,
    Plus,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    Sparkles,
} from "@/components/ui/icons";
import { HADES } from "@/constants/hades";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Plano } from "@/types/cronograma";
import { paraDataISO } from "@/utils/tempo";
import {
    aplicarPlanoHoje,
    aplicarPlanoData,
    fixarPlanoEmDias,
    duplicarPlano,
    excluirPlano,
} from "@/services/planos";
import { toast } from "@/services/toast";
import { confirm } from "@/services/confirm";
import { EstadoDeErro } from "@/components/ui/EstadoDeErro";
import { mostrarPaywallProSeLimite } from "@/services/paywall";

const DIAS_CURTOS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]; // 0 = segunda
const MESES_NOME = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Início do mês (dia 1) que contém `data`. */
function inicioDoMes(data: Date) {
    return new Date(data.getFullYear(), data.getMonth(), 1);
}

type Props = {
    planos: Plano[];
    userId: string | null | undefined;
    menuAbertoId: string | null;
    carregando?: boolean;
    erro?: unknown;
    onAbrirMenu: (id: string | null) => void;
    onNovoPlano: () => void;
    onEditarPlano: (plano: Plano) => void;
    onRecarregar: () => void;
    /** Abre o fluxo de roadmap por IA (app/(modals)/gerar-roadmap.tsx). */
    onGerarComIA: () => void;
};

export default function AbaPlanos({
    planos,
    userId,
    menuAbertoId,
    carregando,
    erro,
    onAbrirMenu,
    onNovoPlano,
    onEditarPlano,
    onRecarregar,
    onGerarComIA,
}: Props) {
    // Guardado à parte do menuAbertoId: as folhas de "aplicar a uma data" e
    // "fixar em dias" continuam abertas mesmo depois do menu de ações fechar.
    const [planoAlvoId, setPlanoAlvoId] = useState<string | null>(null);
    const [folhaData, setFolhaData] = useState(false);
    const [mesCalendario, setMesCalendario] = useState(() => inicioDoMes(new Date()));
    const [folhaDias, setFolhaDias] = useState(false);
    const [diasSelecionados, setDiasSelecionados] = useState<number[]>([]);
    const [processando, setProcessando] = useState(false);

    // Altura máxima das folhas — reserva um respiro no topo em vez de deixá-las
    // crescer até quase encostar na borda superior da tela.
    const insets = useSafeAreaInsets();
    const { height: alturaJanela } = useWindowDimensions();
    const alturaMaximaFolha = alturaJanela - insets.top - 48;

    const fecharMenu = () => onAbrirMenu(null);

    const aplicarHoje = async (plano: Plano) => {
        if (!userId) return;
        fecharMenu();
        setProcessando(true);
        const resultado = await aplicarPlanoHoje(userId, plano.id);
        setProcessando(false);
        if (!resultado.sucesso) {
            toast.error(resultado.erro ?? "Não foi possível aplicar o plano a hoje.");
        }
        onRecarregar();
    };

    const abrirFolhaData = (plano: Plano) => {
        setPlanoAlvoId(plano.id);
        fecharMenu();
        setMesCalendario(inicioDoMes(new Date()));
        setFolhaData(true);
    };

    const mudarMesCalendario = (delta: number) =>
        setMesCalendario((atual) => new Date(atual.getFullYear(), atual.getMonth() + delta, 1));

    const escolherData = async (data: string) => {
        if (!userId || !planoAlvoId) return;
        setFolhaData(false);
        setProcessando(true);
        const resultado = await aplicarPlanoData(userId, planoAlvoId, data);
        setProcessando(false);
        if (!resultado.sucesso) {
            toast.error(resultado.erro ?? "Não foi possível aplicar o plano a essa data.");
        }
        onRecarregar();
    };

    const abrirFolhaDias = (plano: Plano) => {
        setPlanoAlvoId(plano.id);
        fecharMenu();
        setDiasSelecionados([]);
        setFolhaDias(true);
    };

    const alternarDia = (dia: number) =>
        setDiasSelecionados((atual) =>
            atual.includes(dia) ? atual.filter((d) => d !== dia) : [...atual, dia].sort()
        );

    const confirmarDias = async () => {
        if (!planoAlvoId || diasSelecionados.length === 0) return;
        setFolhaDias(false);
        setProcessando(true);
        const resultado = await fixarPlanoEmDias(planoAlvoId, diasSelecionados);
        setProcessando(false);
        if (!resultado.sucesso) {
            toast.error(resultado.erro ?? "Não foi possível fixar o plano nesses dias.");
        }
        onRecarregar();
    };

    const duplicar = async (plano: Plano) => {
        if (!userId) return;
        fecharMenu();
        setProcessando(true);
        const resultado = await duplicarPlano(userId, plano.id);
        setProcessando(false);
        if (!resultado.sucesso) {
            if (mostrarPaywallProSeLimite(resultado.erro)) return;
            toast.error(resultado.erro ?? "Não foi possível duplicar o plano.");
        }
        onRecarregar();
    };

    const confirmarExclusao = (plano: Plano) => {
        fecharMenu();
        confirm({
            title: "Excluir plano",
            message: `Remover "${plano.nome}" e todos os seus blocos?`,
            confirmText: "Excluir",
            destructive: true,
            onConfirm: async () => {
                setProcessando(true);
                const { sucesso, erro } = await excluirPlano(plano.id);
                setProcessando(false);
                if (!sucesso) toast.error(erro ?? "Não foi possível excluir o plano.");
                onRecarregar();
            },
        });
    };

    const planoDoMenu = planos.find((p) => p.id === menuAbertoId) ?? null;

    return (
        <View style={{ flex: 1 }}>
            {!carregando && planos.length === 0 && erro ? (
                <EstadoDeErro erro={erro} onTentarNovamente={onRecarregar} style={{ marginHorizontal: 20 }} />
            ) : !carregando && planos.length === 0 ? (
                <PlanosVazio onNovoPlano={onNovoPlano} onGerarComIA={onGerarComIA} />
            ) : (
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 96, gap: 12 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={!!carregando} onRefresh={onRecarregar} tintColor={HADES.accentSolid} />
                    }
                >
                    {carregando
                        ? [0, 1, 2].map((i) => <CardPlanoSkeleton key={i} />)
                        : planos.map((plano) => (
                            <CardPlano
                                key={plano.id}
                                plano={plano}
                                menuAberto={menuAbertoId === plano.id}
                                onAbrirMenu={onAbrirMenu}
                                onEditar={onEditarPlano}
                            />
                        ))}
                </ScrollView>
            )}

            {processando && (
                <View
                    style={{
                        position: "absolute",
                        top: 14,
                        alignSelf: "center",
                        backgroundColor: HADES.surfaceOverlay,
                        borderRadius: 20,
                        paddingVertical: 8,
                        paddingHorizontal: 16,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                    }}
                >
                    <ActivityIndicator size="small" color={HADES.accentSolid} />
                    <Text style={{ fontSize: 12, color: HADES.textSecondary }}>Atualizando plano…</Text>
                </View>
            )}

            {/* Menu de ações do plano */}
            <Modal
                visible={menuAbertoId !== null}
                transparent
                animationType="fade"
                onRequestClose={fecharMenu}
            >
                <Pressable style={{ flex: 1 }} onPress={fecharMenu}>
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
                            <ItemMenu
                                Icone={CalendarCheck}
                                rotulo="Aplicar a hoje"
                                destaque
                                onPress={() => planoDoMenu && aplicarHoje(planoDoMenu)}
                            />
                            <ItemMenu
                                Icone={CalendarPlus}
                                rotulo="Aplicar a uma data"
                                onPress={() => planoDoMenu && abrirFolhaData(planoDoMenu)}
                            />
                            <ItemMenu
                                Icone={Pin}
                                rotulo="Fixar em dias"
                                onPress={() => planoDoMenu && abrirFolhaDias(planoDoMenu)}
                            />
                            <ItemMenu
                                Icone={Copy}
                                rotulo="Duplicar"
                                onPress={() => planoDoMenu && duplicar(planoDoMenu)}
                            />
                            <View
                                style={{
                                    height: 1,
                                    backgroundColor: "rgba(255,255,255,0.08)",
                                    marginVertical: 4,
                                    marginHorizontal: 8,
                                }}
                            />
                            <ItemMenu
                                Icone={Trash2}
                                rotulo="Excluir"
                                perigo
                                onPress={() => planoDoMenu && confirmarExclusao(planoDoMenu)}
                            />
                        </View>
                    </View>
                </Pressable>
            </Modal>

            {/* Folha · Aplicar a uma data */}
            <Modal visible={folhaData} transparent animationType="fade" onRequestClose={() => setFolhaData(false)}>
                <Pressable
                    style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}
                    onPress={() => setFolhaData(false)}
                >
                    <Pressable
                        style={{
                            backgroundColor: HADES.surfaceRaised,
                            borderWidth: 1,
                            borderColor: HADES.borderStrong,
                            borderTopLeftRadius: 24,
                            borderTopRightRadius: 24,
                            paddingHorizontal: 20,
                            paddingBottom: 26,
                            maxHeight: alturaMaximaFolha,
                        }}
                    >
                        <View style={{ paddingTop: 12, paddingBottom: 4, alignItems: "center" }}>
                            <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: HADES.dot }} />
                        </View>
                        <Text style={{ textAlign: "center", fontSize: 17, fontWeight: "700", color: HADES.text, marginTop: 8, marginBottom: 14 }}>
                            Aplicar a uma data
                        </Text>
                        <CalendarioMes mes={mesCalendario} onMudarMes={mudarMesCalendario} onEscolherData={escolherData} />
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Folha · Fixar em dias */}
            <Modal visible={folhaDias} transparent animationType="fade" onRequestClose={() => setFolhaDias(false)}>
                <Pressable
                    style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}
                    onPress={() => setFolhaDias(false)}
                >
                    <Pressable
                        style={{
                            backgroundColor: HADES.surfaceRaised,
                            borderWidth: 1,
                            borderColor: HADES.borderStrong,
                            borderTopLeftRadius: 24,
                            borderTopRightRadius: 24,
                            paddingHorizontal: 20,
                            paddingBottom: 26,
                            maxHeight: alturaMaximaFolha,
                        }}
                    >
                        <View style={{ paddingTop: 12, paddingBottom: 4, alignItems: "center" }}>
                            <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: HADES.dot }} />
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={{ textAlign: "center", fontSize: 17, fontWeight: "700", color: HADES.text, marginTop: 8 }}>
                                Fixar em dias
                            </Text>
                            <Text style={{ textAlign: "center", fontSize: 13, color: HADES.textMuted, marginTop: 6 }}>
                                Esse plano passa a valer nesses dias, toda semana, à frente da rotina.
                            </Text>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 20, justifyContent: "center" }}>
                                {DIAS_CURTOS.map((rotulo, i) => {
                                    const selecionado = diasSelecionados.includes(i);
                                    return (
                                        <TouchableOpacity
                                            key={rotulo}
                                            onPress={() => alternarDia(i)}
                                            activeOpacity={0.8}
                                            style={{
                                                width: 60,
                                                paddingVertical: 12,
                                                borderRadius: 12,
                                                alignItems: "center",
                                                backgroundColor: selecionado ? HADES.accentTint : HADES.bg,
                                                borderWidth: selecionado ? 1.5 : 1,
                                                borderColor: selecionado ? HADES.accentSolid : HADES.borderStrong,
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    fontSize: 13,
                                                    fontWeight: selecionado ? "700" : "600",
                                                    color: selecionado ? HADES.accentSolid : HADES.textSecondary,
                                                }}
                                            >
                                                {rotulo}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                            <View style={{ flexDirection: "row", gap: 12, marginTop: 24 }}>
                                <TouchableOpacity
                                    onPress={() => setFolhaDias(false)}
                                    activeOpacity={0.8}
                                    style={{
                                        flex: 1,
                                        height: 50,
                                        borderRadius: 25,
                                        backgroundColor: HADES.surfaceOverlay,
                                        borderWidth: 1,
                                        borderColor: HADES.borderStrong,
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <Text style={{ fontSize: 15, fontWeight: "600", color: HADES.textSecondary }}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={confirmarDias}
                                    activeOpacity={0.85}
                                    disabled={diasSelecionados.length === 0}
                                    style={{
                                        flex: 1,
                                        height: 50,
                                        borderRadius: 25,
                                        backgroundColor: HADES.accentSolid,
                                        alignItems: "center",
                                        justifyContent: "center",
                                        opacity: diasSelecionados.length === 0 ? 0.4 : 1,
                                    }}
                                >
                                    <Text style={{ fontSize: 15, fontWeight: "700", color: "#000" }}>Confirmar</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Novo plano / Gerar com IA */}
            <View style={{ position: "absolute", right: 20, bottom: 24, alignItems: "flex-end", gap: 10 }}>
                <TouchableOpacity
                    onPress={onGerarComIA}
                    activeOpacity={0.85}
                    style={{
                        height: 48,
                        paddingHorizontal: 18,
                        borderRadius: 24,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        backgroundColor: HADES.surfaceRaised,
                        borderWidth: 1,
                        borderColor: HADES.borderStrong,
                    }}
                >
                    <Sparkles size={16} color={HADES.accentSolid} />
                    <Text style={{ fontSize: 14, fontWeight: "700", color: HADES.text }}>Gerar com IA</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={onNovoPlano}
                    activeOpacity={0.85}
                    style={{
                        height: 52,
                        paddingHorizontal: 15,
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
                    <Plus size={24} color="#000" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

function PlanosVazio({ onNovoPlano, onGerarComIA }: { onNovoPlano: () => void; onGerarComIA: () => void }) {
    return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 }}>
            <View
                style={{
                    width: 64,
                    height: 64,
                    borderRadius: 20,
                    backgroundColor: HADES.surfaceRaised,
                    borderWidth: 1,
                    borderColor: HADES.borderStrong,
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <ClipboardList size={28} color={HADES.textMuted} />
            </View>

            <Text style={{ fontSize: 19, fontWeight: "700", color: HADES.text, marginTop: 22 }}>
                Nenhum plano ainda
            </Text>
            <Text
                style={{
                    fontSize: 14,
                    color: HADES.textMuted,
                    marginTop: 8,
                    lineHeight: 21,
                    textAlign: "center",
                }}
            >
                Crie um plano de estudos com seus blocos e horários pra aplicar em qualquer dia da semana.
            </Text>

            <TouchableOpacity
                onPress={onGerarComIA}
                activeOpacity={0.85}
                style={{
                    marginTop: 14,
                    height: 52,
                    paddingHorizontal: 22,
                    borderRadius: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    backgroundColor: HADES.surfaceRaised,
                    borderWidth: 1,
                    borderColor: HADES.borderStrong,
                }}
            >
                <Sparkles size={18} color={HADES.accentSolid} />
                <Text style={{ fontSize: 15, fontWeight: "700", color: HADES.text }}>Gerar meu primeiro com IA</Text>
            </TouchableOpacity>

            <TouchableOpacity
                onPress={onNovoPlano}
                activeOpacity={0.85}
                style={{
                    marginTop: 14,
                    height: 52,
                    paddingHorizontal: 22,
                    borderRadius: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    backgroundColor: HADES.accentSolid,
                }}
            >
                <Plus size={18} color="#000" />
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#000" }}>Criar meu primeiro plano</Text>
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

function CardPlanoSkeleton() {
    return (
        <View
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
                    <Skeleton width={11} height={11} borderRadius={6} hades />
                    <View style={{ flex: 1 }}>
                        <Skeleton width="55%" height={16} hades />
                        <Skeleton width="35%" height={12} hades style={{ marginTop: 3 }} />
                    </View>
                </View>
                {/* O "..." do menu fica na ponta da linha do título. */}
                <Skeleton width={20} height={20} borderRadius={6} hades />
            </View>
            <Skeleton width="45%" height={12} hades style={{ marginTop: 13 }} />
        </View>
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
    onPress,
}: {
    Icone: typeof Pin;
    rotulo: string;
    destaque?: boolean;
    perigo?: boolean;
    onPress?: () => void;
}) {
    const cor = perigo ? HADES.red : destaque ? HADES.accentSolid : HADES.textSecondary;
    const corTexto = perigo ? HADES.red : destaque ? HADES.text : "#e8e9ec";

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={onPress}
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

function CalendarioMes({
    mes,
    onMudarMes,
    onEscolherData,
}: {
    mes: Date;
    onMudarMes: (delta: number) => void;
    onEscolherData: (data: string) => void;
}) {
    const hojeISO = paraDataISO(new Date());
    const noMesAtual = mes.getFullYear() === Number(hojeISO.slice(0, 4)) && mes.getMonth() === Number(hojeISO.slice(5, 7)) - 1;

    const primeiroDiaSemana = (mes.getDay() + 6) % 7; // 0 = segunda
    const diasNoMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
    const celulas: (Date | null)[] = [
        ...Array.from({ length: primeiroDiaSemana }, () => null),
        ...Array.from({ length: diasNoMes }, (_, i) => new Date(mes.getFullYear(), mes.getMonth(), i + 1)),
    ];
    const semanas: (Date | null)[][] = [];
    for (let i = 0; i < celulas.length; i += 7) {
        semanas.push(celulas.slice(i, i + 7));
    }

    return (
        <View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <TouchableOpacity
                    onPress={() => onMudarMes(-1)}
                    disabled={noMesAtual}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ padding: 6, opacity: noMesAtual ? 0.25 : 1 }}
                >
                    <ChevronLeft size={18} color={HADES.textSecondary} />
                </TouchableOpacity>
                <Text style={{ fontSize: 14, fontWeight: "700", color: HADES.text }}>
                    {MESES_NOME[mes.getMonth()]} de {mes.getFullYear()}
                </Text>
                <TouchableOpacity
                    onPress={() => onMudarMes(1)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ padding: 6 }}
                >
                    <ChevronRight size={18} color={HADES.textSecondary} />
                </TouchableOpacity>
            </View>

            <View style={{ flexDirection: "row" }}>
                {DIAS_CURTOS.map((letra) => (
                    <Text
                        key={letra}
                        style={{
                            flex: 1,
                            textAlign: "center",
                            fontSize: 11,
                            fontWeight: "600",
                            color: HADES.textFaint,
                            marginBottom: 8,
                        }}
                    >
                        {letra[0]}
                    </Text>
                ))}
            </View>

            {semanas.map((semana, i) => (
                <View key={i} style={{ flexDirection: "row" }}>
                    {semana.map((dia, j) => {
                        if (!dia) return <View key={j} style={{ flex: 1, aspectRatio: 1 }} />;

                        const dataISO = paraDataISO(dia);
                        const passado = dataISO < hojeISO;
                        const ehHoje = dataISO === hojeISO;

                        return (
                            <View key={j} style={{ flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center" }}>
                                <TouchableOpacity
                                    onPress={() => onEscolherData(dataISO)}
                                    disabled={passado}
                                    activeOpacity={0.7}
                                    style={{
                                        width: "82%",
                                        aspectRatio: 1,
                                        borderRadius: 999,
                                        alignItems: "center",
                                        justifyContent: "center",
                                        backgroundColor: ehHoje ? HADES.accentTint : "transparent",
                                        borderWidth: ehHoje ? 1 : 0,
                                        borderColor: HADES.accentTintBorder,
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 14,
                                            fontWeight: ehHoje ? "700" : "500",
                                            color: passado ? HADES.textFaint : ehHoje ? HADES.accentSolid : HADES.text,
                                            opacity: passado ? 0.4 : 1,
                                        }}
                                    >
                                        {dia.getDate()}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        );
                    })}
                </View>
            ))}
        </View>
    );
}
