import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "@/components/ui/TelaSegura";
import { useRouter, useLocalSearchParams } from "expo-router";
import { CalendarDays, ChevronLeft, ChevronRight, LayoutGrid, RotateCcw, Settings } from "@/components/ui/icons";
import { HADES } from "@/constants/hades";
import AbasCronograma from "@/components/cronograma/AbasCronograma";
import AbaHoje from "@/components/cronograma/AbaHoje";
import AbaSemana from "@/components/cronograma/AbaSemana";
import AbaPlanos from "@/components/cronograma/AbaPlanos";
import AcoesBloco from "@/components/cronograma/AcoesBloco";
import type { AbaCronograma, BlocoDoDia, Plano, VisualizacaoSemana } from "@/types/cronograma";
import {
    formatarIntervaloSemana,
    paraDataISO,
    pegarSegundaDaSemana,
    somarDias,
    somarSemanas,
} from "@/utils/tempo";
import { useAuth } from "@/hooks/useAuth";
import { usePlanos } from "@/hooks/usePlanos";
import { useAgendaHoje } from "@/hooks/useAgendaHoje";
import { adiarBlocoRotina } from "@/services/schedule";
import { adiarBlocoPlano, buscarPlanoPorId } from "@/services/planos";
import { registrarBlocoComoFeito } from "@/services/sessions";
import { marcarBlocoRoadmapConcluido } from "@/services/roadmapIA";
import { toast } from "@/services/toast";

const DIAS_EXTENSO = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MESES = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function dataPorExtenso(d: Date) {
    return `${DIAS_EXTENSO[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/** Horário de fim do bloco, formatado como "11h" ou "11h30" (mesmo estilo do resumo do dia). */
function calcularFimEm(bloco: BlocoDoDia) {
    const [h, m] = bloco.horaInicio.split(":").map(Number);
    const fimMin = h * 60 + m + bloco.duracaoMin;
    const horaFim = Math.floor(fimMin / 60) % 24;
    const minFim = fimMin % 60;
    return minFim === 0 ? `${horaFim}h` : `${horaFim}h${minFim.toString().padStart(2, "0")}`;
}

/** "2026-08-03" -> Date local, sem passar por UTC. */
function deISO(dataISO: string) {
    const [ano, mes, dia] = dataISO.split("-").map(Number);
    return new Date(ano, mes - 1, dia);
}

/** "Hoje" / "Amanhã" / "Ontem" quando cabe; senão a data por extenso. */
function rotuloDoDia(dataISO: string, hojeISO: string) {
    if (dataISO === hojeISO) return dataPorExtenso(deISO(dataISO));

    const diff = Math.round((deISO(dataISO).getTime() - deISO(hojeISO).getTime()) / 86400000);
    if (diff === 1) return "Amanhã";
    if (diff === -1) return "Ontem";
    return dataPorExtenso(deISO(dataISO));
}

/**
 * Navegador de data — é o próprio subtítulo do cabeçalho, em vez de mais uma
 * faixa na tela. Serve tanto pra folhear dias (aba Hoje) quanto semanas (aba
 * Semana), e mostra um atalho de volta ao presente quando você saiu dele.
 */
function NavegadorData({
    rotulo,
    destacado,
    onAnterior,
    onProximo,
    onVoltarAoPresente,
}: {
    rotulo: string;
    destacado: boolean;
    onAnterior: () => void;
    onProximo: () => void;
    onVoltarAoPresente?: () => void;
}) {
    const toque = { top: 10, bottom: 10, left: 6, right: 6 };

    return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 2, marginTop: 1 }}>
            <TouchableOpacity onPress={onAnterior} hitSlop={toque} accessibilityLabel="Anterior">
                <ChevronLeft size={16} color={HADES.textMuted} />
            </TouchableOpacity>

            <Text
                numberOfLines={1}
                style={{
                    fontSize: 13,
                    color: destacado ? HADES.accentText : HADES.textMuted,
                    fontWeight: destacado ? "600" : "400",
                    paddingHorizontal: 2,
                }}
            >
                {rotulo}
            </Text>

            <TouchableOpacity onPress={onProximo} hitSlop={toque} accessibilityLabel="Próximo">
                <ChevronRight size={16} color={HADES.textMuted} />
            </TouchableOpacity>

            {onVoltarAoPresente && (
                <TouchableOpacity
                    onPress={onVoltarAoPresente}
                    hitSlop={toque}
                    accessibilityLabel="Voltar para hoje"
                    style={{ marginLeft: 6 }}
                >
                    <RotateCcw size={13} color={HADES.accentSolid} />
                </TouchableOpacity>
            )}
        </View>
    );
}

/**
 * Calendário/Blocos são duas leituras da mesma semana, então moram no cabeçalho
 * como um par de ícones em vez de ocupar uma faixa própria abaixo das abas —
 * dois níveis de navegação empilhados deixavam a tela confusa.
 */
function AlternadorVisualizacao({
    ativa,
    onChange,
}: {
    ativa: VisualizacaoSemana;
    onChange: (v: VisualizacaoSemana) => void;
}) {
    const opcoes = [
        { valor: "calendario" as const, Icone: CalendarDays, rotulo: "Ver como calendário" },
        { valor: "blocos" as const, Icone: LayoutGrid, rotulo: "Ver como blocos" },
    ];

    return (
        <View
            style={{
                flexDirection: "row",
                backgroundColor: HADES.surfaceRaised,
                borderRadius: 19,
                padding: 3,
                gap: 2,
            }}
        >
            {opcoes.map(({ valor, Icone, rotulo }) => {
                const selecionada = ativa === valor;
                return (
                    <TouchableOpacity
                        key={valor}
                        onPress={() => onChange(valor)}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel={rotulo}
                        accessibilityState={{ selected: selecionada }}
                        style={{
                            width: 36,
                            height: 32,
                            borderRadius: 16,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: selecionada ? HADES.accentTint : "transparent",
                        }}
                    >
                        <Icone size={16} color={selecionada ? HADES.accentSolid : HADES.textFaint} />
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

export default function ScheduleScreen() {
    const router = useRouter();
    const { aba: abaAlvo } = useLocalSearchParams<{ aba?: AbaCronograma }>();
    const { userId } = useAuth();
    const { planos, carregando: carregandoPlanos, erro: erroPlanos, recarregarPlanos } = usePlanos(userId);
    // Datas que a tela está olhando. Ficam aqui (e não dentro das abas) porque
    // quem desenha o navegador é o cabeçalho.
    const [diaISO, setDiaISO] = useState(() => paraDataISO(new Date()));
    const [inicioDaSemana, setInicioDaSemana] = useState(() => pegarSegundaDaSemana(new Date()));
    const { blocos: blocosDeHoje, resumo: resumoHoje, carregando: carregandoHoje, erro: erroHoje, recarregar: recarregarHoje } = useAgendaHoje(userId, diaISO);
    const [aba, setAba] = useState<AbaCronograma>("hoje");
    const [visualizacao, setVisualizacao] = useState<VisualizacaoSemana>("calendario");
    const [menuPlanoId, setMenuPlanoId] = useState<string | null>(null);
    const [blocoEmAcao, setBlocoEmAcao] = useState<BlocoDoDia | null>(null);

    // O plano-editor volta pra cá com `?aba=planos` (via dismissTo) depois de salvar,
    // pra pousar direto na aba de planos em vez de deixar a última aba visitada.
    useEffect(() => {
        if (abaAlvo) {
            setAba(abaAlvo);
            router.setParams({ aba: undefined });
        }
    }, [abaAlvo]);

    const hojeISO = paraDataISO(new Date());
    const semanaEhAAtual = paraDataISO(inicioDaSemana) === paraDataISO(pegarSegundaDaSemana(new Date()));

    const abrirEditor = (planoId?: string, aplicarHoje?: boolean) =>
        router.push({
            pathname: "/(modals)/plano-editor",
            params: {
                ...(planoId ? { planoId } : {}),
                ...(aplicarHoje ? { aplicarHoje: "1" } : {}),
            },
        });

    const abrirRoadmapIA = () =>
        router.push({ pathname: "/(modals)/gerar-roadmap", params: { escopo: "pessoal" } });

    const editarBloco = (bloco: BlocoDoDia) => {
        setBlocoEmAcao(null);
        router.push({ pathname: "/(modals)/novo-bloco", params: { blocoId: bloco.id } });
    };

    const adiarBloco = async (bloco: BlocoDoDia, minutos: number) => {
        setBlocoEmAcao(null);
        const { error } =
            bloco.origem === "plano"
                ? await adiarBlocoPlano(bloco.id, minutos)
                : await adiarBlocoRotina(bloco.id, minutos);

        if (error) {
            console.error(error);
            toast.error("Não foi possível adiar o bloco.");
            return;
        }
        toast.success(`Bloco adiado em ${minutos} min.`);
        recarregarHoje();
    };

    const marcarBlocoComoFeito = async (bloco: BlocoDoDia) => {
        setBlocoEmAcao(null);
        if (!userId) return;

        const { error } = await registrarBlocoComoFeito({
            userId,
            disciplina: bloco.materia ?? "Estudo Geral",
            conteudo: bloco.topico ?? null,
            minutos: bloco.duracaoMin,
            origem: bloco.origem ?? "rotina",
            blocoId: bloco.id,
            planoId: bloco.planoId ?? null,
            // O estudo conta no dia que a tela está mostrando, não no dia em que você clicou.
            dataISO: diaISO,
        });

        if (error) {
            console.error(error);
            toast.error("Não foi possível marcar o bloco como feito.");
            return;
        }

        if (bloco.origem === "plano" && bloco.planoId) {
            const plano = await buscarPlanoPorId(bloco.planoId);
            if (plano?.roadmapDeGrupo) {
                await marcarBlocoRoadmapConcluido(userId, bloco.id, true);
            }
        }

        toast.success("Bloco marcado como feito.");
        recarregarHoje();
    };

    const iniciarFoco = (bloco: BlocoDoDia) =>
        router.push({
            pathname: "/(tabs)/focus",
            params: {
                subject: bloco.materia ?? "",
                content: bloco.topico ?? "",
                blocoId: bloco.id,
                origemBloco: bloco.origem ?? "rotina",
                duracaoMin: bloco.duracaoMin.toString(),
                fimEm: calcularFimEm(bloco),
                ...(bloco.planoId ? { planoId: bloco.planoId } : {}),
            },
        });

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top"]}>
            {/* Header */}
            <View style={{ paddingTop: 6, paddingHorizontal: 20, paddingBottom: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
                    <View>
                        <Text
                            style={{
                                fontSize: 23,
                                fontWeight: "700",
                                color: HADES.text,
                                letterSpacing: -0.3,
                            }}
                        >
                            Cronograma
                        </Text>
                        {aba === "hoje" ? (
                            <NavegadorData
                                rotulo={rotuloDoDia(diaISO, hojeISO)}
                                destacado={diaISO !== hojeISO}
                                onAnterior={() => setDiaISO((d) => paraDataISO(somarDias(deISO(d), -1)))}
                                onProximo={() => setDiaISO((d) => paraDataISO(somarDias(deISO(d), 1)))}
                                onVoltarAoPresente={diaISO !== hojeISO ? () => setDiaISO(hojeISO) : undefined}
                            />
                        ) : aba === "semana" ? (
                            <NavegadorData
                                rotulo={formatarIntervaloSemana(inicioDaSemana)}
                                destacado={!semanaEhAAtual}
                                onAnterior={() => setInicioDaSemana((d) => somarSemanas(d, -1))}
                                onProximo={() => setInicioDaSemana((d) => somarSemanas(d, 1))}
                                onVoltarAoPresente={
                                    semanaEhAAtual ? undefined : () => setInicioDaSemana(pegarSegundaDaSemana(new Date()))
                                }
                            />
                        ) : (
                            <Text style={{ fontSize: 13, color: HADES.textMuted, marginTop: 2 }}>
                                {planos.length} planos salvos
                            </Text>
                        )}
                    </View>

                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        {aba === "semana" && (
                            <AlternadorVisualizacao ativa={visualizacao} onChange={setVisualizacao} />
                        )}
                    </View>
                </View>
            </View>

            <AbasCronograma ativa={aba} onChange={setAba} />

            {aba === "hoje" && (
                <AbaHoje
                    blocos={blocosDeHoje}
                    resumo={resumoHoje}
                    carregando={carregandoHoje}
                    erro={erroHoje}
                    onIniciarFoco={iniciarFoco}
                    onMontarDia={() => abrirEditor(undefined, true)}
                    onAplicarPlano={() => setAba("planos")}
                    refreshing={carregandoHoje}
                    onRefresh={recarregarHoje}
                    onAbrirAcoes={setBlocoEmAcao}
                />
            )}

            {aba === "semana" && (
                <AbaSemana visualizacao={visualizacao} inicioDaSemana={inicioDaSemana} />
            )}

            {aba === "planos" && (
                <AbaPlanos
                    planos={planos}
                    userId={userId}
                    menuAbertoId={menuPlanoId}
                    carregando={carregandoPlanos}
                    erro={erroPlanos}
                    onAbrirMenu={setMenuPlanoId}
                    onNovoPlano={() => abrirEditor()}
                    onEditarPlano={(p: Plano) => abrirEditor(p.id)}
                    onGerarComIA={abrirRoadmapIA}
                    onRecarregar={() => {
                        recarregarPlanos();
                        recarregarHoje();
                    }}
                />
            )}
            <AcoesBloco
                bloco={blocoEmAcao}
                // Só faz sentido concluir um bloco que já começou.
                permiteConcluir={!!blocoEmAcao && blocoEmAcao.status !== "futuro"}
                onFechar={() => setBlocoEmAcao(null)}
                onEditar={editarBloco}
                onAdiar={adiarBloco}
                onMarcarFeito={marcarBlocoComoFeito}
            />
        </SafeAreaView>
    );
}
