import { useCallback, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Image,
} from "react-native";
import { SafeAreaView } from "@/components/ui/TelaSegura";
import { router } from "expo-router";
import { Brain, Check, ChevronLeft, Crown, FileText, Lock, Sparkles, Users } from "@/components/ui/icons";

import ProgressBar from "@/components/ui/ProgressBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { HADES } from "@/constants/hades";
import { useDadosCache } from "@/hooks/useDadosCache";
import { buscarEstadoDoPlano, buscarLimitesDePlano, restante, type EstadoDoPlano } from "@/services/assinatura";

const ICONE_PLANO_GRATIS = require("../../assets/plan/coroa-gratis.png");
const ICONE_PLANO_PRO = require("../../assets/plan/coroa-pro.png");
const FUNDO_PLANO_GRATIS = require("../../assets/plan/fundo-gratis.png");
const FUNDO_PLANO_PRO = require("../../assets/plan/fundo-pro.png");
const PROPORCAO_CARD_PLANO = 3.82;

/**
 * Tela "Meu plano" — plano vigente, quanto de cada cota já foi usado e o que o Pro abre.
 *
 * Existe porque até aqui o limite só aparecia como erro, na hora em que a pessoa tentava
 * fazer algo. Um limite que só se manifesta como falha afasta o usuário; mostrado antes,
 * com quanto ainda resta, ele vira motivo para assinar.
 *
 * Os números vêm todos de `uso_do_plano()` (uma RPC só) e são os MESMOS que o servidor usa
 * para barrar — nada aqui é decidido no cliente, ver `services/assinatura.ts`.
 */
export default function PlanoScreen() {
    const {
        dados: estado,
        carregando,
        revalidando,
        recarregar,
    } = useDadosCache<EstadoDoPlano>("plano:estado", buscarEstadoDoPlano, {
        // Cota muda a cada uso de IA, então nunca é "fresca" o bastante para pular a
        // revalidação ao focar a tela.
        tempoFresco: 0,
    });

    const aoAtualizar = useCallback(() => {
        recarregar();
    }, [recarregar]);

    const ehPro = estado?.plano === "pro";

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.settingsBg }}>
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingHorizontal: 20,
                    paddingVertical: 14,
                }}
            >
                <TouchableOpacity
                    onPress={() => router.back()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <ChevronLeft size={22} color={HADES.textSecondary} />
                </TouchableOpacity>
                <Text style={{ fontSize: 20, fontWeight: "700", color: HADES.text }}>Meu plano</Text>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={revalidando && !carregando}
                        onRefresh={aoAtualizar}
                        tintColor={HADES.accent}
                    />
                }
            >
                {carregando || !estado ? (
                    <EsqueletoDoPlano />
                ) : (
                    <>
                        <CartaoDoPlano ehPro={ehPro} rotulo={estado.limites.rotulo} />

                        <Secao titulo="INTELIGÊNCIA ARTIFICIAL">
                            <LinhaDeUso
                                icone={<Brain size={16} color={HADES.accent} />}
                                rotulo="Quiz pós-sessão"
                                periodo="hoje"
                                usado={estado.uso.quizHoje}
                                limite={estado.limites.quizIaPorDia}
                            />
                            <LinhaDeUso
                                icone={<FileText size={16} color={HADES.accent} />}
                                rotulo="Análise de anexo"
                                periodo="neste mês"
                                usado={estado.uso.anexosNoMes}
                                limite={estado.limites.anexosIaPorMes}
                            />
                            <LinhaDeUso
                                icone={<Sparkles size={16} color={HADES.accent} />}
                                rotulo="Plano de estudos por IA"
                                periodo="neste mês"
                                usado={estado.uso.roadmapsNoMes}
                                limite={estado.limites.roadmapIaPorMes}
                            />
                            <LinhaDeUso
                                icone={<Brain size={16} color={HADES.accent} />}
                                rotulo="Chat com o anexo"
                                periodo="neste mês"
                                usado={estado.uso.chatNoMes}
                                limite={estado.limites.chatIaPorMes}
                                ultima
                            />
                        </Secao>

                        <Secao titulo="ARMAZENAMENTO E ORGANIZAÇÃO">
                            <LinhaDeUso
                                icone={<FileText size={16} color={HADES.accent} />}
                                rotulo="Espaço no Cofre"
                                usado={estado.uso.armazenamentoBytes}
                                limite={estado.limites.armazenamentoBytes}
                                formatar={formatarBytes}
                            />
                            <LinhaDeUso
                                icone={<Users size={16} color={HADES.accent} />}
                                rotulo="Grupos que você administra"
                                usado={estado.uso.gruposAdministrados}
                                limite={estado.limites.gruposMax}
                            />
                            <LinhaDeUso
                                icone={<Sparkles size={16} color={HADES.accent} />}
                                rotulo="Planos de estudo"
                                usado={estado.uso.planos}
                                limite={estado.limites.planosMax}
                                ultima
                            />
                        </Secao>

                        {!ehPro && <ConviteParaOPro />}

                        <Text
                            style={{
                                fontSize: 11,
                                color: HADES.settingsTextMuted,
                                textAlign: "center",
                                marginTop: 20,
                                lineHeight: 16,
                            }}
                        >
                            As cotas diárias renovam à meia-noite e as mensais no dia 1º.
                        </Text>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

/* ------------------------------------------------------------------ */

function CartaoDoPlano({ ehPro, rotulo }: { ehPro: boolean; rotulo: string }) {
    const [largura, setLargura] = useState(0);
    const altura = largura / PROPORCAO_CARD_PLANO;
  const tamanhoCoroa = largura * 0.11


    return (
        <View
            className="relative mt-1 w-full justify-center overflow-hidden rounded-[20px]"
            style={{ aspectRatio: PROPORCAO_CARD_PLANO, backgroundColor: "#080D24" }}
            onLayout={(event) => setLargura(event.nativeEvent.layout.width)}
        >
            <Image
                source={ehPro ? FUNDO_PLANO_PRO : FUNDO_PLANO_GRATIS}
                className="rounded-[20px]"
                style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                }}
                resizeMode="stretch"
            />

            <View
                pointerEvents="none"
                className="absolute inset-0 rounded-[20px] border"
                style={{
                    borderColor: ehPro ? "rgba(139, 82, 255, 0.78)" : "rgba(83, 92, 219, 0.72)",
                }}
            />

            <Image
                source={ehPro ? ICONE_PLANO_PRO : ICONE_PLANO_GRATIS}
                className="absolute"
                style={{
                    width: tamanhoCoroa,
                    height: tamanhoCoroa,
                    left: largura * 0.111 - tamanhoCoroa / 2,
                    top: altura * 0.48 - tamanhoCoroa / 2,
                    opacity: largura ? 1 : 0,
                }}
                resizeMode="contain"
            />

            <View className="ml-[25%] justify-center pr-6">
                <Text className="text-[12px] font-normal text-[#A9AFE0]">Seu plano</Text>
                <Text className="text-[21px] font-extrabold tracking-wider text-white ">{rotulo}</Text>
            </View>
        </View>
    );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
    return (
        <View style={{ marginTop: 26 }}>
            <Text
                style={{
                    fontSize: 11,
                    fontWeight: "700",
                    letterSpacing: 0.8,
                    color: HADES.settingsTextMuted,
                    marginBottom: 10,
                    marginLeft: 4,
                }}
            >
                {titulo}
            </Text>
            <View
                style={{
                    backgroundColor: HADES.settingsCard,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: HADES.borderSettings,
                    overflow: "hidden",
                }}
            >
                {children}
            </View>
        </View>
    );
}

/**
 * Uma cota. Os três estados que ela pode ter dizem coisas diferentes e são desenhados
 * diferente de propósito:
 *   - limite `null`  → ilimitado, não há barra a mostrar (só o quanto já foi usado);
 *   - limite `0`     → o plano não tem o recurso: cadeado, sem número de uso;
 *   - limite `n`     → barra de progresso, que fica âmbar perto do fim e vermelha no teto.
 */
function LinhaDeUso({
    icone,
    rotulo,
    periodo,
    usado,
    limite,
    formatar = (n: number) => String(n),
    ultima,
}: {
    icone: React.ReactNode;
    rotulo: string;
    periodo?: string;
    usado: number;
    limite: number | null;
    formatar?: (n: number) => string;
    ultima?: boolean;
}) {
    const bloqueado = limite === 0;
    const ilimitado = limite === null;
    const proporcao = ilimitado || bloqueado ? 0 : Math.min(1, usado / limite);
    const sobrando = restante(usado, limite);

    const cor = proporcao >= 1 ? HADES.red : proporcao >= 0.8 ? HADES.accentSolid : HADES.accent;

    return (
        <View
            style={{
                paddingHorizontal: 14,
                paddingVertical: 13,
                borderBottomWidth: ultima ? 0 : 1,
                borderBottomColor: HADES.borderSettings,
            }}
        >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                {bloqueado ? <Lock size={16} color={HADES.settingsTextMuted} /> : icone}

                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, color: bloqueado ? HADES.settingsTextSecondary : HADES.text }}>
                        {rotulo}
                    </Text>
                    {periodo && !bloqueado && (
                        <Text style={{ fontSize: 11, color: HADES.settingsTextMuted, marginTop: 1 }}>
                            {periodo}
                        </Text>
                    )}
                </View>

                <Text style={{ fontSize: 13, fontWeight: "600", color: HADES.settingsTextSecondary }}>
                    {bloqueado
                        ? "Só no Pro"
                        : ilimitado
                          ? `${formatar(usado)} · ilimitado`
                          : `${formatar(usado)} / ${formatar(limite)}`}
                </Text>
            </View>

            {!bloqueado && !ilimitado && (
                <View style={{ marginTop: 9 }}>
                    <ProgressBar progress={proporcao} color={cor} height={5} />
                    {sobrando !== null && (
                        <Text style={{ fontSize: 11, color: HADES.settingsTextMuted, marginTop: 5 }}>
                            {sobrando === 0
                                ? "Sem saldo — renova no próximo período."
                                : `${formatar(sobrando)} restante${sobrando === 1 ? "" : "s"}`}
                        </Text>
                    )}
                </View>
            )}
        </View>
    );
}

/**
 * O que muda ao assinar. Mostrado só para quem está no Grátis — para quem já é Pro, listar
 * o que ele tem não informa nada e ainda parece anúncio.
 */
function ConviteParaOPro() {
    /*
      Os números vêm da linha do PRO em `planos_limites`, não do plano atual de quem está
      olhando — senão a lista de vantagens exibiria os limites do Grátis. Buscar da tabela
      em vez de escrever à mão mantém o texto de venda sincronizado com o que o servidor
      realmente aplica.
    */
    const { dados: pro } = useDadosCache("plano:limites:pro", () => buscarLimitesDePlano("pro"));

    const vantagens = [
        "Quiz por IA ilimitado",
        `${pro?.anexosIaPorMes ?? 50} análises de anexo por mês`,
        "Chat com o anexo da sessão",
        `Grupos com até ${pro?.membrosPorGrupoMax ?? 50} pessoas, sem limite de grupos`,
        "Planos de estudo ilimitados",
        "Histórico e análises completos",
        "Wrapped mensal",
    ];

    return (
        <View
            style={{
                marginTop: 26,
                backgroundColor: HADES.settingsCard,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: HADES.accentTintBorder,
                padding: 18,
            }}
        >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Crown size={18} color={HADES.accentSolid} />
                <Text style={{ fontSize: 16, fontWeight: "700", color: HADES.text }}>
                    O que o Pro abre
                </Text>
            </View>

            {vantagens.map((vantagem) => (
                <View
                    key={vantagem}
                    style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 9 }}
                >
                    <Check size={15} color={HADES.accent} />
                    <Text style={{ fontSize: 13, color: HADES.textSecondary, flex: 1 }}>{vantagem}</Text>
                </View>
            ))}

            {/*
              Sem botão de compra: o fluxo de pagamento (Play Billing) ainda não existe, e
              um botão que não leva a lugar nenhum é pior do que nenhum botão. Quando o
              checkout entrar, é aqui que ele encaixa.
            */}
            <Text
                style={{
                    fontSize: 12,
                    color: HADES.settingsTextMuted,
                    marginTop: 8,
                    lineHeight: 17,
                }}
            >
                A assinatura ainda não está disponível para compra no app.
            </Text>
        </View>
    );
}

function EsqueletoDoPlano() {
    return (
        <View style={{ marginTop: 4, gap: 26 }}>
            <Skeleton height={88} borderRadius={20} hades />
            <Skeleton height={220} borderRadius={14} hades />
            <Skeleton height={170} borderRadius={14} hades />
        </View>
    );
}

function formatarBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
