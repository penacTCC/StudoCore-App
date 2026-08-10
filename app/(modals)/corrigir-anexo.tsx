import { useEffect, useMemo, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { SafeAreaView } from "@/components/ui/TelaSegura";
import { useRouter, useLocalSearchParams } from "expo-router";
import { X, Check, Sparkles } from "@/components/ui/icons";

import { HADES } from "@/constants/hades";
import { buscarAnexo, salvarCorrecaoAnexo } from "@/services/anexosSessao";
import { toast } from "@/services/toast";
import type { AnexoSessao, CorrecaoFormulario } from "@/types/anotacoes";

/*
  O app não tem como saber sozinho o desempenho num PDF de questões: o arquivo traz os
  enunciados, não o resultado. Então a correção vem de uma de duas fontes:

  1. "gabarito" — o próprio PDF trazia o gabarito (a IA extraiu). O aluno marca só as
                  respostas dele e o app corrige. Quando existe gabarito é o ÚNICO modo
                  oferecido: escolher "certo/errado" na mão tendo o gabarito à disposição
                  seria só uma forma pior de fazer a mesma coisa.
  2. "grade"    — marca certo/errado questão a questão, para os PDFs sem gabarito.

  Os dois guardam o resultado POR QUESTÃO (não só o total), que é o que vai alimentar o
  banco de erros depois.
*/
type ModoCorrecao = "grade" | "gabarito";

/** Alternativas clicáveis deduzidas do próprio gabarito. Null quando não são letras. */
function alternativasDoGabarito(gabarito: Record<string, string> | null): string[] | null {
    if (!gabarito) return null;

    const valores = Object.values(gabarito).map((valor) => valor.trim().toUpperCase());
    if (valores.length === 0) return null;

    // Gabarito de verdadeiro/falso.
    if (valores.every((valor) => valor === "V" || valor === "F")) return ["V", "F"];

    // Só serve pra botão se o gabarito for por letra; texto de alternativa inteiro não cabe.
    if (!valores.every((valor) => /^[A-Z]$/.test(valor))) return null;

    /*
      Vai de A até a maior letra que aparece, com mínimo de E. Usar só as letras presentes
      no gabarito esconderia opções: se nenhuma resposta correta é "D", o aluno que marcou
      D não teria em que tocar pra registrar o erro dele.
    */
    const maior = valores.reduce((atual, valor) => (valor > atual ? valor : atual), "E");
    const alternativas: string[] = [];
    for (let codigo = 65; codigo <= maior.charCodeAt(0); codigo++) {
        alternativas.push(String.fromCharCode(codigo));
    }
    return alternativas;
}

export default function CorrigirAnexoModal() {
    const router = useRouter();
    const { anexoId, sessaoId } = useLocalSearchParams<{ anexoId: string; sessaoId: string }>();

    const [anexo, setAnexo] = useState<AnexoSessao | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);

    const [modo, setModo] = useState<ModoCorrecao>("grade");
    const [grade, setGrade] = useState<CorrecaoFormulario>({});
    const [respostas, setRespostas] = useState<Record<string, string>>({});

    const totalQuestoes = anexo?.questoes_detectadas ?? 0;
    const discursivas = anexo?.questoes_discursivas ?? 0;

    /*
      Numera a grade com os números REAIS do documento quando a IA conseguiu extraí-los.
      Numa lista mista (objetivas + discursivas) as objetivas podem ser as questões
      1, 2, 5 e 6 — mostrar 1..4 aqui faria o aluno marcar a questão errada.
    */
    const numeros = useMemo(() => {
        const doDocumento = anexo?.numeros_objetivas;
        if (Array.isArray(doDocumento) && doDocumento.length === totalQuestoes) return doDocumento;
        return Array.from({ length: totalQuestoes }, (_, i) => String(i + 1));
    }, [anexo?.numeros_objetivas, totalQuestoes]);
    const temGabarito = !!anexo?.gabarito_ia && Object.keys(anexo.gabarito_ia).length > 0;
    const alternativas = useMemo(() => alternativasDoGabarito(anexo?.gabarito_ia ?? null), [anexo?.gabarito_ia]);
    const respondidas = numeros.filter((numero) => !!respostas[numero]).length;

    useEffect(() => {
        if (!anexoId) {
            setCarregando(false);
            return;
        }
        buscarAnexo(anexoId).then((encontrado) => {
            setAnexo(encontrado);
            if (encontrado) {
                // Começa com tudo certo: é mais rápido desmarcar as poucas que errou do que
                // marcar as muitas que acertou.
                const total = encontrado.questoes_detectadas ?? 0;
                const rotulos =
                    Array.isArray(encontrado.numeros_objetivas) && encontrado.numeros_objetivas.length === total
                        ? encontrado.numeros_objetivas
                        : Array.from({ length: total }, (_, i) => String(i + 1));
                const inicial: CorrecaoFormulario =
                    encontrado.correcao && Object.keys(encontrado.correcao).length > 0
                        ? encontrado.correcao
                        : Object.fromEntries(rotulos.map((rotulo) => [rotulo, true]));
                setGrade(inicial);

                // Com gabarito no PDF, esse é o único caminho oferecido.
                const gabarito = encontrado.gabarito_ia;
                if (gabarito && Object.keys(gabarito).length > 0) setModo("gabarito");
            }
            setCarregando(false);
        });
    }, [anexoId]);

    const acertosNaGrade = Object.values(grade).filter(Boolean).length;

    /** Compara as respostas marcadas com o gabarito extraído do PDF, ignorando caixa/espaços. */
    const corrigirPeloGabarito = (): CorrecaoFormulario => {
        const gabarito = anexo?.gabarito_ia ?? {};
        const normalizar = (valor: string) => valor.trim().toLowerCase();

        return Object.fromEntries(
            numeros.map((numero) => {
                const esperada = gabarito[numero];
                const dada = respostas[numero];
                if (!esperada || !dada) return [numero, false];
                return [numero, normalizar(esperada) === normalizar(dada)];
            })
        );
    };

    const salvar = async () => {
        if (!anexoId || !sessaoId) return;
        setSalvando(true);

        const resultado =
            modo === "gabarito"
                ? { correcao: corrigirPeloGabarito(), acertosInformados: null }
                : { correcao: grade, acertosInformados: null };

        const { sucesso, erro } = await salvarCorrecaoAnexo({ anexoId, sessaoId, ...resultado });
        setSalvando(false);

        if (!sucesso) {
            toast.error(erro || "Não foi possível salvar a correção.");
            return;
        }
        toast.success("Correção salva.");
        router.back();
    };

    if (carregando) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator color={HADES.accentSolid} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top"]}>
            <View style={{ paddingHorizontal: 20, paddingTop: 2, paddingBottom: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 17, fontWeight: "700", color: "#fff", letterSpacing: -0.3 }}>
                        Corrigir formulário
                    </Text>
                    <Text style={{ fontSize: 12.5, color: HADES.textMuted, marginTop: 2 }} numberOfLines={1}>
                        {anexo?.titulo}
                        {totalQuestoes > 0 ? ` · ${totalQuestoes} objetivas` : ""}
                        {discursivas > 0 ? ` · ${discursivas} discursivas fora` : ""}
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={() => router.back()}
                    hitSlop={8}
                    style={{
                        width: 30,
                        height: 30,
                        borderRadius: 15,
                        backgroundColor: HADES.surfaceOverlay,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <X size={16} color={HADES.textSecondary} />
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {temGabarito && (
                        <View
                            style={{
                                flexDirection: "row",
                                gap: 9,
                                padding: 12,
                                borderRadius: 13,
                                backgroundColor: HADES.accentTint,
                                borderWidth: 1,
                                borderColor: HADES.accentTintBorder,
                                marginBottom: 16,
                            }}
                        >
                            <Sparkles size={15} color={HADES.accentSolid} />
                            <Text style={{ flex: 1, fontSize: 12.5, color: HADES.textSecondary, lineHeight: 18 }}>
                                Esse PDF tinha gabarito. Marque só as suas respostas que o app corrige pra você.
                            </Text>
                        </View>
                    )}

                    {/*
                      Sem seletor de modo: havendo gabarito, corrigir pelo gabarito é
                      estritamente melhor do que marcar certo/errado na mão, então a tela
                      não oferece a escolha pior.
                    */}

                    {totalQuestoes === 0 && (
                        <View style={{ paddingVertical: 40, alignItems: "center", gap: 8 }}>
                            <Text style={{ fontSize: 14, fontWeight: "600", color: HADES.textSecondary }}>
                                Nenhuma questão objetiva neste arquivo
                            </Text>
                            <Text style={{ fontSize: 12.5, color: HADES.textDim, textAlign: "center" }}>
                                {discursivas > 0
                                    ? "Só foram encontradas questões discursivas, que o app ainda não corrige."
                                    : "A IA não conseguiu identificar questões de alternativa aqui."}
                            </Text>
                        </View>
                    )}

                    {modo === "grade" && totalQuestoes > 0 && (
                        <>
                            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
                                <Text style={{ flex: 1, fontSize: 13, color: HADES.textMuted }}>
                                    Toque nas que você errou
                                </Text>
                                <TouchableOpacity
                                    onPress={() =>
                                        setGrade(Object.fromEntries(numeros.map((numero) => [numero, true])))
                                    }
                                >
                                    <Text style={{ fontSize: 12.5, fontWeight: "600", color: HADES.accentSolid }}>
                                        Marcar todas certas
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                                {numeros.map((numero) => {
                                    const certa = grade[numero] !== false;
                                    return (
                                        <TouchableOpacity
                                            key={numero}
                                            onPress={() => setGrade((atual) => ({ ...atual, [numero]: !certa }))}
                                            activeOpacity={0.75}
                                            style={{
                                                width: 46,
                                                height: 46,
                                                borderRadius: 13,
                                                alignItems: "center",
                                                justifyContent: "center",
                                                backgroundColor: certa ? HADES.greenTint : "rgba(240,85,107,0.12)",
                                                borderWidth: 1,
                                                borderColor: certa ? "rgba(48,209,88,0.35)" : "rgba(240,85,107,0.4)",
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    fontSize: 14,
                                                    fontWeight: "700",
                                                    color: certa ? HADES.green : HADES.red,
                                                }}
                                            >
                                                {numero}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={{ fontSize: 13, color: HADES.textMuted, marginTop: 18 }}>
                                {acertosNaGrade} de {totalQuestoes} certas
                            </Text>
                        </>
                    )}

                    {modo === "gabarito" && totalQuestoes > 0 && (
                        <>
                            <Text style={{ fontSize: 13, color: HADES.textMuted, marginBottom: 14 }}>
                                Marque o que você respondeu · {respondidas} de {totalQuestoes}
                            </Text>

                            <View style={{ gap: 14 }}>
                                {numeros.map((numero) => (
                                    <View key={numero} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                                        <Text style={{ width: 26, fontSize: 13.5, fontWeight: "700", color: HADES.textMuted }}>
                                            {numero}.
                                        </Text>

                                        {alternativas ? (
                                            <View style={{ flex: 1, flexDirection: "row", gap: 8 }}>
                                                {alternativas.map((letra) => {
                                                    const marcada = respostas[numero] === letra;
                                                    return (
                                                        <TouchableOpacity
                                                            key={letra}
                                                            onPress={() =>
                                                                setRespostas((atual) => ({
                                                                    // Tocar de novo na mesma desmarca — dá pra corrigir
                                                                    // um toque errado sem ter que zerar tudo.
                                                                    ...atual,
                                                                    [numero]: marcada ? "" : letra,
                                                                }))
                                                            }
                                                            activeOpacity={0.75}
                                                            style={{
                                                                flex: 1,
                                                                height: 42,
                                                                borderRadius: 12,
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                                backgroundColor: marcada
                                                                    ? HADES.accentSolid
                                                                    : HADES.surfaceRaised,
                                                                borderWidth: 1,
                                                                borderColor: marcada ? HADES.accentSolid : HADES.border,
                                                            }}
                                                        >
                                                            <Text
                                                                style={{
                                                                    fontSize: 14,
                                                                    fontWeight: "700",
                                                                    color: marcada ? "#000" : HADES.textSecondary,
                                                                }}
                                                            >
                                                                {letra}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>
                                        ) : (
                                            /* Gabarito por texto (não por letra): não dá pra virar botão, então
                                               esse PDF continua com campo livre. */
                                            <TextInput
                                                value={respostas[numero] ?? ""}
                                                onChangeText={(texto) =>
                                                    setRespostas((atual) => ({ ...atual, [numero]: texto }))
                                                }
                                                placeholder="Sua resposta"
                                                placeholderTextColor={HADES.textDim}
                                                style={{
                                                    flex: 1,
                                                    height: 42,
                                                    borderRadius: 12,
                                                    backgroundColor: HADES.surfaceRaised,
                                                    borderWidth: 1,
                                                    borderColor: HADES.border,
                                                    paddingHorizontal: 12,
                                                    fontSize: 14,
                                                    color: HADES.text,
                                                }}
                                            />
                                        )}
                                    </View>
                                ))}
                            </View>
                        </>
                    )}
                </ScrollView>

                <View style={{ paddingHorizontal: 20, paddingBottom: 16, paddingTop: 8 }}>
                    <TouchableOpacity
                        onPress={salvar}
                        disabled={salvando || totalQuestoes === 0}
                        activeOpacity={0.85}
                        style={{
                            flexDirection: "row",
                            gap: 8,
                            height: 50,
                            borderRadius: 14,
                            backgroundColor: HADES.accentSolid,
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: salvando || totalQuestoes === 0 ? 0.6 : 1,
                        }}
                    >
                        {salvando ? (
                            <ActivityIndicator color="#000" />
                        ) : (
                            <>
                                <Check size={18} color="#000" />
                                <Text style={{ fontSize: 15, fontWeight: "700", color: "#000" }}>Salvar correção</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
