import { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "@/components/ui/TelaSegura";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
    ArrowLeft,
    Check,
    Clock,
    FileText,
    Paperclip,
    Pencil,
    RefreshCw,
    Sparkles,
    Trash2,
    AlertCircle,
} from "@/components/ui/icons";

import { HADES } from "@/constants/hades";
import { useAuth } from "@/hooks/useAuth";
import { useMaterias } from "@/hooks/useMaterias";
import { useDetalhesSessao } from "@/hooks/useDetalhesSessao";
import DocumentPickerVault from "@/components/ui/DocumentPickerVault";
import { anexarFormularioASessao, removerAnexo } from "@/services/anexosSessao";
import { abrirArquivoDoBucket } from "@/services/visualizarArquivo";
import { confirm } from "@/services/confirm";
import { toast } from "@/services/toast";
import { taxaDeAcerto, totalAcertos, totalQuestoes } from "@/utils/estatisticasSessao";
import FormAnotacoes from "@/components/sessao/FormAnotacoes";
import { salvarAnotacoes } from "@/services/anotacoes";
import { ANOTACOES_VAZIAS, anexoCorrigido, acertosDoAnexo, temAnotacao } from "@/types/anotacoes";
import type { AnexoSessao, AnotacoesSessao } from "@/types/anotacoes";

/**
 * Detalhes de uma sessão salva — a tela que abre ao tocar num formulário no Banco de dados.
 *
 * Substituiu o bottom sheet que existia em app/(tabs)/brain.tsx: os botões de "Sessão de
 * revisão" e "Refazer agora" vieram pra cá, junto com as anotações e os formulários
 * externos anexados.
 */
export default function DetalhesSessaoModal() {
    const router = useRouter();
    const { sessaoId } = useLocalSearchParams<{ sessaoId: string }>();
    const { userId } = useAuth();
    const { materiasComCores } = useMaterias(userId);

    const { sessao, anotacoes, anexos, carregando, recarregar } = useDetalhesSessao(sessaoId);
    const [anexando, setAnexando] = useState(false);

    /*
      Anotações são editadas aqui mesmo, tocando no campo — não há botão de salvar nem tela
      separada. Por isso a gravação é um autosave debounced, no mesmo espírito do
      hooks/usePreferencias.ts.

      `rascunho` existe separado do que veio do banco porque o hook relê a sessão sempre que
      a tela ganha foco (voltar da correção de um anexo, por exemplo); sem essa cópia local,
      a releitura sobrescreveria o que o usuário está digitando.
    */
    const [rascunho, setRascunho] = useState<AnotacoesSessao>(ANOTACOES_VAZIAS);
    const [statusAnotacoes, setStatusAnotacoes] = useState<"salvando" | "salvo" | null>(null);
    const [abriuCampos, setAbriuCampos] = useState(false);
    const editado = useRef(false);
    const semeado = useRef<string | null>(null);

    // Semeia o rascunho uma única vez por sessão carregada — depois disso quem manda é o
    // que está na tela.
    useEffect(() => {
        if (!sessaoId || carregando || semeado.current === sessaoId) return;
        semeado.current = sessaoId;
        setRascunho(anotacoes);
    }, [sessaoId, carregando, anotacoes]);

    // Autosave: 900ms depois da última tecla. Só dispara se o usuário realmente editou,
    // pra semear o rascunho não gravar nada sozinho.
    useEffect(() => {
        if (!sessaoId || !editado.current) return;

        setStatusAnotacoes("salvando");
        const timeout = setTimeout(async () => {
            const { sucesso, erro } = await salvarAnotacoes(sessaoId, rascunho);
            if (!sucesso) {
                setStatusAnotacoes(null);
                toast.error(erro || "Não foi possível salvar suas anotações.");
                return;
            }
            setStatusAnotacoes("salvo");
        }, 900);

        return () => clearTimeout(timeout);
    }, [rascunho, sessaoId]);

    // Com anotação salva, os campos já aparecem preenchidos e editáveis; sem nenhuma, mostra
    // o convite tracejado até o usuário tocar nele.
    const mostrarCampos = abriuCampos || temAnotacao(rascunho) || temAnotacao(anotacoes);

    const corDaMateria =
        materiasComCores.find((m) => m.nomeExibicao === sessao?.disciplina)?.cor ?? HADES.blue;

    const pendente = sessao?.status === "pendente";
    const questoes = sessao ? totalQuestoes(sessao) : 0;
    const acertos = sessao ? totalAcertos(sessao) : 0;
    const acerto = sessao ? taxaDeAcerto(sessao) : 0;

    const corAcerto = acerto > 70 ? HADES.green : acerto <= 40 ? HADES.red : "#f5a623";

    const formatarDuracao = (minutos: number) => {
        const horas = Math.floor(minutos / 60);
        const resto = minutos % 60;
        if (horas === 0) return `${resto}m`;
        return resto === 0 ? `${horas}h` : `${horas}h ${resto}m`;
    };

    const anexarArquivo = async (arquivo: { uri: string; name: string; mimeType: string; size: number }) => {
        if (!userId || !sessao) return;

        setAnexando(true);
        const { anexo, erro, erroAnalise } = await anexarFormularioASessao({
            userId,
            sessaoId: sessao.id,
            disciplina: sessao.disciplina,
            conteudo: sessao.conteudo_especifico,
            arquivo,
        });
        setAnexando(false);

        if (erro || !anexo) {
            toast.error(erro || "Não foi possível anexar o arquivo.");
            return;
        }

        if (anexo.questoes_detectadas === null) {
            // Mostra o motivo real quando a Edge Function conseguiu explicar (ver services/quizIA.ts).
            console.warn("Falha na análise do anexo:", erroAnalise);
            toast.info(erroAnalise || "Arquivo anexado. A IA não conseguiu analisar agora — dá pra tentar de novo.");
        } else if (anexo.questoes_detectadas === 0) {
            toast.info("Arquivo anexado, mas nenhuma questão objetiva foi encontrada nele.");
        } else {
            const discursivas = anexo.questoes_discursivas ?? 0;
            toast.success(
                `Arquivo anexado — ${anexo.questoes_detectadas} questões objetivas` +
                    (discursivas > 0 ? ` (${discursivas} discursivas ignoradas).` : ".")
            );
        }
        recarregar();
    };

    const excluirAnexo = (anexo: AnexoSessao) => {
        if (!sessao) return;
        confirm({
            title: "Remover anexo",
            message: `Remover "${anexo.titulo}" desta sessão? A correção dele também será descartada.`,
            confirmText: "Remover",
            destructive: true,
            onConfirm: async () => {
                const { erro } = await removerAnexo(anexo.id, sessao.id);
                if (erro) {
                    toast.error(erro);
                    return;
                }
                recarregar();
            },
        });
    };

    if (carregando) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator color={HADES.accentSolid} />
            </SafeAreaView>
        );
    }

    if (!sessao) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg, alignItems: "center", justifyContent: "center", gap: 12 }}>
                <Text style={{ color: HADES.textMuted }}>Sessão não encontrada.</Text>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text style={{ color: HADES.accentSolid, fontWeight: "600" }}>Voltar</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top"]}>
            {/* Header */}
            <View style={{ paddingHorizontal: 20, paddingTop: 2, paddingBottom: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
                    <ArrowLeft size={21} color="#fff" />
                </TouchableOpacity>
                <Text style={{ flex: 1, fontSize: 15, fontWeight: "700", color: "#fff" }}>Formulário</Text>
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                        borderRadius: 7,
                        paddingHorizontal: 9,
                        paddingVertical: 4,
                        backgroundColor: pendente ? "rgba(240,85,107,0.12)" : HADES.greenTint,
                    }}
                >
                    {pendente ? (
                        <AlertCircle size={12} color={HADES.red} />
                    ) : (
                        <Check size={12} color={HADES.green} />
                    )}
                    <Text
                        style={{
                            fontSize: 10.5,
                            fontWeight: "700",
                            letterSpacing: 0.3,
                            color: pendente ? HADES.red : HADES.green,
                        }}
                    >
                        {pendente ? "PENDENTE" : "SALVO"}
                    </Text>
                </View>
            </View>

            {/* Os campos de anotação são editados dentro deste scroll, daí o
                KeyboardAvoidingView e o keyboardShouldPersistTaps (sem ele, o primeiro toque
                num outro campo só fecha o teclado em vez de focar o campo). */}
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 32 }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
            >
                {/* Matéria e conteúdo */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: corDaMateria }} />
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 20, fontWeight: "700", color: "#fff", letterSpacing: -0.4 }}>
                            {sessao.disciplina}
                        </Text>
                        {!!sessao.conteudo_especifico && (
                            <Text style={{ fontSize: 12.5, color: HADES.textMuted, marginTop: 3 }}>
                                {sessao.conteudo_especifico}
                            </Text>
                        )}
                    </View>
                </View>

                {/* Faixa de estatísticas */}
                <View
                    style={{
                        flexDirection: "row",
                        marginVertical: 20,
                        paddingVertical: 16,
                        borderTopWidth: 1,
                        borderBottomWidth: 1,
                        borderColor: "rgba(255,255,255,0.07)",
                    }}
                >
                    <View style={{ flex: 1, alignItems: "center" }}>
                        <Text style={{ fontSize: 20, fontWeight: "700", color: "#fff", letterSpacing: -0.5 }}>
                            {formatarDuracao(sessao.tempo_minutos)}
                        </Text>
                        <Text style={{ fontSize: 11, color: HADES.textFaint, marginTop: 3 }}>duração</Text>
                    </View>
                    <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.07)" }} />
                    <View style={{ flex: 1, alignItems: "center" }}>
                        <Text style={{ fontSize: 20, fontWeight: "700", color: "#fff", letterSpacing: -0.5 }}>
                            {questoes}
                        </Text>
                        <Text style={{ fontSize: 11, color: HADES.textFaint, marginTop: 3 }}>questões</Text>
                    </View>
                    <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.07)" }} />
                    <View style={{ flex: 1, alignItems: "center" }}>
                        <Text style={{ fontSize: 20, fontWeight: "700", color: corAcerto, letterSpacing: -0.5 }}>
                            {acerto}%
                        </Text>
                        <Text style={{ fontSize: 11, color: HADES.textFaint, marginTop: 3 }}>acerto</Text>
                    </View>
                </View>

                {/*
                  Discrimina a origem das questões quando há as duas: o número grande acima é a
                  soma, e aqui embaixo dá pra ver quanto veio do quiz e quanto do formulário.
                */}
                {(sessao.questoes_externas ?? 0) > 0 && (
                    <Text style={{ fontSize: 11.5, color: HADES.textFaint, marginTop: -8, marginBottom: 18, textAlign: "center" }}>
                        quiz: {sessao.questoes_acertadas}/{sessao.questoes_respondidas} · formulário:{" "}
                        {sessao.acertos_externos}/{sessao.questoes_externas}
                    </Text>
                )}

                {/* Anotações — editáveis no lugar, sem tela intermediária nem botão de salvar. */}
                <SecaoTitulo titulo="Anotações" status={statusAnotacoes} />
                {mostrarCampos ? (
                    <FormAnotacoes
                        anotacoes={rascunho}
                        aoMudar={(campo, valor) => {
                            editado.current = true;
                            setRascunho((atual) => ({ ...atual, [campo]: valor }));
                        }}
                    />
                ) : (
                    <TouchableOpacity
                        onPress={() => setAbriuCampos(true)}
                        activeOpacity={0.8}
                        style={{
                            borderRadius: 14,
                            borderWidth: 1,
                            borderStyle: "dashed",
                            borderColor: HADES.borderDashed,
                            paddingVertical: 22,
                            alignItems: "center",
                            gap: 6,
                        }}
                    >
                        <Pencil size={18} color={HADES.textMuted} />
                        <Text style={{ fontSize: 13.5, fontWeight: "600", color: HADES.textSecondary }}>
                            Adicionar anotações
                        </Text>
                        <Text style={{ fontSize: 12, color: HADES.textDim, textAlign: "center", paddingHorizontal: 24 }}>
                            O que estudou, concentração, pendências e próximo passo
                        </Text>
                    </TouchableOpacity>
                )}

                {/* Anexos */}
                <SecaoTitulo titulo="Formulários anexados" />
                <View style={{ gap: 10 }}>
                    {anexos.map((anexo) => (
                        <CardAnexo
                            key={anexo.id}
                            anexo={anexo}
                            aoAbrir={() => anexo.storage_path && abrirArquivoDoBucket(anexo.storage_path)}
                            aoCorrigir={() =>
                                router.push({
                                    pathname: "/(modals)/corrigir-anexo",
                                    params: { anexoId: anexo.id, sessaoId: sessao.id },
                                })
                            }
                            aoRemover={() => excluirAnexo(anexo)}
                        />
                    ))}

                    {anexando ? (
                        <View style={{ paddingVertical: 26, alignItems: "center", gap: 8 }}>
                            <ActivityIndicator color={HADES.accentSolid} />
                            <Text style={{ fontSize: 12.5, color: HADES.textMuted }}>
                                Enviando e analisando o arquivo...
                            </Text>
                        </View>
                    ) : (
                        <DocumentPickerVault category="pdf" selectedFile={null} onFileSelected={anexarArquivo} />
                    )}
                </View>

                {/* Ações */}
                <View style={{ gap: 10, marginTop: 20 }}>
                    <BotaoSecundario
                        icone={<RefreshCw size={16} color={HADES.textSecondary} />}
                        texto="Refazer agora"
                        aoTocar={() =>
                            router.push({
                                pathname: "/(modals)/focus-feedback",
                                params: {
                                    sessionId: sessao.id,
                                    subject: sessao.disciplina,
                                    content: sessao.conteudo_especifico || "",
                                    oldDuration: sessao.tempo_minutos.toString(),
                                    duration: "0",
                                    isPublic: sessao.is_public.toString(),
                                },
                            })
                        }
                    />

                    <TouchableOpacity
                        onPress={() =>
                            router.push({
                                pathname: "/(tabs)/focus",
                                params: {
                                    reviewSessionId: sessao.id,
                                    subject: sessao.disciplina,
                                    content: sessao.conteudo_especifico || "",
                                    oldDuration: sessao.tempo_minutos.toString(),
                                    isPublic: sessao.is_public.toString(),
                                    autoStart: "true",
                                },
                            })
                        }
                        activeOpacity={0.85}
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            height: 46,
                            borderRadius: 13,
                            backgroundColor: HADES.accentSolid,
                        }}
                    >
                        <Clock size={16} color="#000" />
                        <Text style={{ fontSize: 14, fontWeight: "700", color: "#000" }}>Sessão de revisão</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

/**
 * Título de seção. `status` é o retorno visual do autosave das anotações — sem botão de
 * salvar, é a única confirmação de que o texto foi gravado.
 */
const SecaoTitulo = ({ titulo, status }: { titulo: string; status?: "salvando" | "salvo" | null }) => (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 26, marginBottom: 14 }}>
        <Text
            style={{
                flex: 1,
                fontSize: 11.5,
                fontWeight: "700",
                color: HADES.textMuted,
                letterSpacing: 0.8,
                textTransform: "uppercase",
            }}
        >
            {titulo}
        </Text>
        {!!status && (
            <Text style={{ fontSize: 11, color: status === "salvo" ? HADES.green : HADES.textDim }}>
                {status === "salvo" ? "salvo" : "salvando..."}
            </Text>
        )}
    </View>
);

const BotaoSecundario = ({
    icone,
    texto,
    aoTocar,
}: {
    icone: React.ReactNode;
    texto: string;
    aoTocar: () => void;
}) => (
    <TouchableOpacity
        onPress={aoTocar}
        activeOpacity={0.8}
        style={{
            flex: 1,
            height: 46,
            borderRadius: 13,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.12)",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
        }}
    >
        {icone}
        <Text style={{ fontSize: 14, fontWeight: "600", color: HADES.textSecondary }}>{texto}</Text>
    </TouchableOpacity>
);

/** Um PDF anexado, com o que a IA extraiu e o estado da correção. */
const CardAnexo = ({
    anexo,
    aoAbrir,
    aoCorrigir,
    aoRemover,
}: {
    anexo: AnexoSessao;
    aoAbrir: () => void;
    aoCorrigir: () => void;
    aoRemover: () => void;
}) => {
    const corrigido = anexoCorrigido(anexo);
    const total = anexo.questoes_detectadas ?? 0;
    const discursivas = anexo.questoes_discursivas ?? 0;

    return (
        <View
            style={{
                backgroundColor: HADES.surface,
                borderWidth: 1,
                borderColor: HADES.border,
                borderRadius: 15,
                padding: 14,
            }}
        >
            <TouchableOpacity onPress={aoAbrir} activeOpacity={0.75} style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
                <View
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "rgba(240,85,107,0.14)",
                    }}
                >
                    <FileText size={20} color={HADES.red} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: HADES.text }} numberOfLines={1}>
                        {anexo.titulo}
                    </Text>
                    <Text style={{ fontSize: 12, color: HADES.textMuted, marginTop: 2 }}>
                        {total > 0 ? `${total} objetivas` : "nenhuma objetiva identificada"}
                        {corrigido ? ` · ${acertosDoAnexo(anexo)} acertos` : ""}
                    </Text>
                    {/* A contagem menor que o PDF sugere não é erro de leitura: discursivas
                        ficam de fora porque o app ainda não sabe corrigi-las. */}
                    {discursivas > 0 && (
                        <Text style={{ fontSize: 11.5, color: HADES.textFaint, marginTop: 2 }}>
                            {discursivas} discursiva{discursivas > 1 ? "s" : ""} ignorada
                            {discursivas > 1 ? "s" : ""} por enquanto
                        </Text>
                    )}
                </View>
                <TouchableOpacity onPress={aoRemover} hitSlop={10}>
                    <Trash2 size={17} color={HADES.textFaint} />
                </TouchableOpacity>
            </TouchableOpacity>

            {!!anexo.proximo_passo_ia && (
                <View
                    style={{
                        flexDirection: "row",
                        gap: 9,
                        marginTop: 12,
                        padding: 11,
                        borderRadius: 12,
                        backgroundColor: HADES.accentTint,
                        borderWidth: 1,
                        borderColor: HADES.accentTintBorder,
                    }}
                >
                    <Sparkles size={15} color={HADES.accentSolid} />
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: HADES.accentSolid, letterSpacing: 0.5 }}>
                            PRÓXIMO PASSO
                        </Text>
                        <Text style={{ fontSize: 13, color: HADES.textSecondary, lineHeight: 19, marginTop: 4 }}>
                            {anexo.proximo_passo_ia}
                        </Text>
                    </View>
                </View>
            )}

            {/*
              Enquanto não for corrigido, o anexo não entra na taxa de acerto da sessão —
              contar 0 de 28 antes do usuário dizer como foi seria injusto com a média dele.
            */}
            <TouchableOpacity
                onPress={aoCorrigir}
                activeOpacity={0.8}
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                    marginTop: 12,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: corrigido ? HADES.surfaceRaised : "rgba(242,176,61,0.10)",
                    borderWidth: 1,
                    borderColor: corrigido ? HADES.border : HADES.amberBorder,
                }}
            >
                {corrigido ? (
                    <Check size={15} color={HADES.textSecondary} />
                ) : (
                    <Paperclip size={15} color={HADES.amber} />
                )}
                <Text
                    style={{
                        fontSize: 13,
                        fontWeight: "600",
                        color: corrigido ? HADES.textSecondary : HADES.amber,
                    }}
                >
                    {corrigido ? "Revisar correção" : "Aguardando correção"}
                </Text>
            </TouchableOpacity>
        </View>
    );
};
