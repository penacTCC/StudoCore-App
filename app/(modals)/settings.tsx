import { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, LogOut, Trash2 } from "lucide-react-native";

import { HADES } from "@/constants/hades";
import {
    DURACAO_BLOCO_UNICO_MAX,
    DURACAO_BLOCO_UNICO_MIN,
    DURACAO_POMODORO_MAX,
    DURACAO_POMODORO_MIN,
} from "@/constants/cronograma";
import { toast } from "@/services/toast";
import { confirm } from "@/services/confirm";
import { carregarModoTeste, definirModoTeste } from "@/services/modoTeste";
import {
    buscarPerfil,
    deslogarUsuario,
    excluirConta,
    atualizarPrivacidadePerfil,
} from "@/services/auth";
import { SecaoConfig, LinhaSwitch, LinhaStepper, LinhaEscolha, LinhaPerigo } from "@/components/cronograma/LinhasConfig";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/hooks/useAuth";
import { usePreferencias } from "@/hooks/usePreferencias";

/** Mantém o valor dentro de [min, max] ao usar os steppers. */
function limitar(valor: number, min: number, max: number) {
    return Math.min(max, Math.max(min, valor));
}

/**
 * Soma minutos a um horário "HH:MM", dando a volta no dia.
 *
 * A janela do "não perturbar" quase sempre cruza a meia-noite (22:00 → 07:00), então o
 * módulo aqui não é detalhe: sem ele, baixar de 00:00 daria horário negativo.
 */
function deslocarHorario(horario: string, minutos: number) {
    const [h, m] = horario.split(":").map(Number);
    const total = (((h * 60 + m + minutos) % 1440) + 1440) % 1440;
    const hh = Math.floor(total / 60);
    const mm = total % 60;
    return `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
}

export default function SettingsScreen() {
    const router = useRouter();
    const { userId } = useAuth();
    // Preferências que moram no banco (o hook já faz o autosave debounced).
    const { prefs, ajustar, alternar } = usePreferencias(userId);

    const [loading, setLoading] = useState(true);
    const [modoTesteLigado, setModoTesteLigado] = useState(false);
    const [perfilPublico, setPerfilPublico] = useState(true);
    const [excluindoConta, setExcluindoConta] = useState(false);

    useEffect(() => {
        const carregar = async () => {
            setModoTesteLigado(await carregarModoTeste());
            if (userId) {
                const { data } = await buscarPerfil(userId);
                if (data) setPerfilPublico(data.perfil_publico ?? true);
            }
            setLoading(false);
        };
        carregar();
    }, [userId]);

    const alternarPerfilPublico = useCallback(async () => {
        if (!userId) return;
        const novo = !perfilPublico;
        // Otimista: o interruptor responde na hora e volta atrás se o banco recusar.
        setPerfilPublico(novo);
        const { error } = await atualizarPrivacidadePerfil(userId, novo);
        if (error) {
            setPerfilPublico(!novo);
            toast.error("Não foi possível salvar a privacidade do perfil.");
        }
    }, [userId, perfilPublico]);

    const alternarModoTeste = async (valor: boolean) => {
        setModoTesteLigado(valor);
        // Passa pelo serviço para a escala em memória mudar junto com a preferência salva:
        // as telas que calculam tempo ao vivo leem essa escala de forma síncrona.
        await definirModoTeste(valor);
    };

    const sairDaConta = () => {
        confirm({
            title: "Sair da conta",
            message: "Tem certeza que deseja sair?",
            confirmText: "Sair",
            destructive: true,
            onConfirm: async () => {
                const { error } = await deslogarUsuario();
                if (error) toast.error("Não foi possível sair da conta.");
            },
        });
    };

    /**
     * Exclusão de conta: dois avisos antes de chamar o servidor, porque não existe desfazer —
     * o primeiro conta o que some, o segundo é a confirmação final. Quem apaga é a Edge
     * Function `excluir-conta` (ver services/auth.ts); o signOut lá dentro devolve o app
     * pro login sozinho, então aqui não há navegação a fazer.
     */
    const apagarConta = () => {
        confirm({
            title: "Excluir conta",
            message:
                "Isso apaga para sempre seu perfil, sessões de foco, ofensivas, medalhas e a participação nos seus grupos. Não dá para desfazer.",
            confirmText: "Continuar",
            destructive: true,
            onConfirm: () => {
                confirm({
                    title: "Tem certeza absoluta?",
                    message: "Sua conta e todos os seus dados serão excluídos agora.",
                    confirmText: "Excluir para sempre",
                    destructive: true,
                    onConfirm: async () => {
                        setExcluindoConta(true);
                        const { error } = await excluirConta();
                        if (error) {
                            setExcluindoConta(false);
                            toast.error(error);
                        }
                    },
                });
            },
        });
    };

    if (loading) return <SettingsSkeleton />;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.settingsBg }} edges={["top"]}>
            <View
                style={{
                    paddingTop: 6,
                    paddingHorizontal: 20,
                    paddingBottom: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                }}
            >
                <TouchableOpacity
                    onPress={() => router.back()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <ChevronLeft size={22} color={HADES.textSecondary} />
                </TouchableOpacity>
                <Text style={{ fontSize: 20, fontWeight: "700", color: HADES.text }}>Configurações</Text>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
                showsVerticalScrollIndicator={false}
            >
                <SecaoConfig titulo="CONTA">
                    <LinhaEscolha
                        rotulo="Editar perfil"
                        valor="Nome, foto, bio"
                        onPress={() => router.push("/(modals)/editar-perfil")}
                        ultima
                    />
                </SecaoConfig>

                <SecaoConfig titulo="PRIVACIDADE">
                    <LinhaSwitch
                        rotulo="Perfil público"
                        ligado={perfilPublico}
                        onToggle={alternarPerfilPublico}
                    />
                    <LinhaSwitch
                        rotulo="Aparecer no ranking"
                        ligado={prefs.aparecerNoRanking}
                        onToggle={() => alternar("aparecerNoRanking")}
                    />
                    <LinhaSwitch
                        rotulo="Sessão pública por padrão"
                        descricao="Vale para os seus grupos."
                        ligado={prefs.sessaoPublicaPadrao}
                        onToggle={() => alternar("sessaoPublicaPadrao")}
                    />
                    {/*
                      Separado de "sessão pública" de propósito: aquele interruptor sempre
                      quis dizer "o meu grupo vê", e vale TRUE por padrão. Deixar o feed
                      pendurado nele publicaria para estranhos as fotos de quem só tinha
                      consentido com o grupo. Ver 20260807190000_feed_publico_opt_in.
                    */}
                    <LinhaSwitch
                        rotulo="Participar do feed público"
                        descricao="Suas fotos de sessões públicas aparecem no Explorar, para qualquer pessoa do app."
                        ligado={prefs.feedPublico}
                        onToggle={() => alternar("feedPublico")}
                    />
                    {/*
                      Bloquear alguém no Explorar precisa ter volta: sem esta tela, um toque
                      errado no menu de um card seria definitivo.
                    */}
                    <LinhaEscolha
                        rotulo="Contas bloqueadas"
                        valor="Gerenciar"
                        onPress={() => router.push("/(modals)/contas-bloqueadas")}
                        ultima
                    />
                </SecaoConfig>

                <SecaoConfig titulo="POMODORO">
                    <LinhaStepper
                        rotulo="Foco"
                        valor={`${prefs.focoMin}min`}
                        onDiminuir={() =>
                            ajustar(
                                "focoMin",
                                limitar(prefs.focoMin - 5, DURACAO_POMODORO_MIN, DURACAO_POMODORO_MAX)
                            )
                        }
                        onAumentar={() =>
                            ajustar(
                                "focoMin",
                                limitar(prefs.focoMin + 5, DURACAO_POMODORO_MIN, DURACAO_POMODORO_MAX)
                            )
                        }
                    />
                    <LinhaStepper
                        rotulo="Descanso curto"
                        valor={`${prefs.descansoCurtoMin}min`}
                        onDiminuir={() => ajustar("descansoCurtoMin", limitar(prefs.descansoCurtoMin - 1, 1, 30))}
                        onAumentar={() => ajustar("descansoCurtoMin", limitar(prefs.descansoCurtoMin + 1, 1, 30))}
                    />
                    <LinhaStepper
                        rotulo="Descanso longo"
                        valor={`${prefs.descansoLongoMin}min`}
                        onDiminuir={() => ajustar("descansoLongoMin", limitar(prefs.descansoLongoMin - 5, 5, 60))}
                        onAumentar={() => ajustar("descansoLongoMin", limitar(prefs.descansoLongoMin + 5, 5, 60))}
                    />
                    <LinhaStepper
                        rotulo="Ciclos até o longo"
                        valor={`${prefs.ciclosAteLongo}`}
                        onDiminuir={() => ajustar("ciclosAteLongo", limitar(prefs.ciclosAteLongo - 1, 2, 8))}
                        onAumentar={() => ajustar("ciclosAteLongo", limitar(prefs.ciclosAteLongo + 1, 2, 8))}
                    />
                    <LinhaSwitch
                        rotulo="Iniciar descanso automaticamente"
                        ligado={prefs.autoDescanso}
                        onToggle={() => alternar("autoDescanso")}
                    />
                    <LinhaSwitch
                        rotulo="Iniciar próximo foco automaticamente"
                        ligado={prefs.autoFoco}
                        onToggle={() => alternar("autoFoco")}
                        ultima
                    />
                </SecaoConfig>

                <SecaoConfig titulo="FIM DA SESSÃO">
                    <LinhaSwitch
                        rotulo="Foto ao fim da sessão"
                        ligado={prefs.fotoAposSessao}
                        onToggle={() => alternar("fotoAposSessao")}
                    />
                    <LinhaSwitch
                        rotulo="Anotar ao fim da sessão"
                        ligado={prefs.anotarAposQuiz}
                        onToggle={() => alternar("anotarAposQuiz")}
                        ultima
                    />
                </SecaoConfig>

                <SecaoConfig titulo="NOTIFICAÇÕES">
                    <LinhaSwitch
                        rotulo="Notificações do cronograma"
                        ligado={prefs.notificacoesAtivas}
                        onToggle={() => alternar("notificacoesAtivas")}
                    />
                    <LinhaStepper
                        rotulo="Antecedência padrão"
                        valor={`${prefs.antecedenciaMin} min`}
                        largura={48}
                        onDiminuir={() => ajustar("antecedenciaMin", limitar(prefs.antecedenciaMin - 5, 0, 60))}
                        onAumentar={() => ajustar("antecedenciaMin", limitar(prefs.antecedenciaMin + 5, 0, 60))}
                    />
                    <LinhaSwitch
                        rotulo="Avisar no fim de cada fase"
                        ligado={prefs.avisarFimDeFase}
                        onToggle={() => alternar("avisarFimDeFase")}
                    />
                    <LinhaSwitch
                        rotulo="Não perturbar"
                        descricao="Nenhum lembrete de cronograma dentro da janela abaixo."
                        ligado={prefs.naoPerturbar}
                        onToggle={() => alternar("naoPerturbar")}
                        ultima={!prefs.naoPerturbar}
                    />
                    {/* Os horários só aparecem quando a janela está em uso — desligada, seriam
                        dois controles que não mudam nada. */}
                    {prefs.naoPerturbar && (
                        <>
                            <LinhaStepper
                                rotulo="Começa às"
                                valor={prefs.naoPerturbarInicio}
                                largura={48}
                                onDiminuir={() =>
                                    ajustar("naoPerturbarInicio", deslocarHorario(prefs.naoPerturbarInicio, -30))
                                }
                                onAumentar={() =>
                                    ajustar("naoPerturbarInicio", deslocarHorario(prefs.naoPerturbarInicio, 30))
                                }
                            />
                            <LinhaStepper
                                rotulo="Termina às"
                                valor={prefs.naoPerturbarFim}
                                largura={48}
                                onDiminuir={() =>
                                    ajustar("naoPerturbarFim", deslocarHorario(prefs.naoPerturbarFim, -30))
                                }
                                onAumentar={() =>
                                    ajustar("naoPerturbarFim", deslocarHorario(prefs.naoPerturbarFim, 30))
                                }
                                ultima
                            />
                        </>
                    )}
                </SecaoConfig>

                <SecaoConfig titulo="VIBRAÇÃO E TELA">
                    <LinhaSwitch
                        rotulo="Vibrar"
                        descricao="No fim de cada fase do pomodoro e ao desbloquear uma medalha."
                        ligado={prefs.vibrar}
                        onToggle={() => alternar("vibrar")}
                    />
                    <LinhaSwitch
                        rotulo="Manter tela ligada"
                        ligado={prefs.manterTelaLigada}
                        onToggle={() => alternar("manterTelaLigada")}
                        ultima
                    />
                </SecaoConfig>

                <SecaoConfig titulo="CRONOGRAMA">
                    <LinhaStepper
                        rotulo="Duração padrão do bloco"
                        valor={`${prefs.duracaoPadraoBlocoMin}min`}
                        onDiminuir={() =>
                            ajustar(
                                "duracaoPadraoBlocoMin",
                                limitar(
                                    prefs.duracaoPadraoBlocoMin - 5,
                                    DURACAO_BLOCO_UNICO_MIN,
                                    DURACAO_BLOCO_UNICO_MAX
                                )
                            )
                        }
                        onAumentar={() =>
                            ajustar(
                                "duracaoPadraoBlocoMin",
                                limitar(
                                    prefs.duracaoPadraoBlocoMin + 5,
                                    DURACAO_BLOCO_UNICO_MIN,
                                    DURACAO_BLOCO_UNICO_MAX
                                )
                            )
                        }
                    />
                    <LinhaStepper
                        rotulo="Duração padrão do descanso"
                        valor={`${prefs.duracaoPadraoDescansoMin}min`}
                        onDiminuir={() =>
                            ajustar("duracaoPadraoDescansoMin", limitar(prefs.duracaoPadraoDescansoMin - 5, 5, 60))
                        }
                        onAumentar={() =>
                            ajustar("duracaoPadraoDescansoMin", limitar(prefs.duracaoPadraoDescansoMin + 5, 5, 60))
                        }
                    />
                    <LinhaSwitch
                        rotulo="Contar descanso como estudado"
                        descricao="Descanso nunca conta como tempo de estudo — mantém suas horas reais fiéis."
                        ligado={false}
                        travado
                        ultima
                    />
                </SecaoConfig>

                {/*
                  Ferramenta de desenvolvimento, não configuração.

                  Ficava visível para qualquer usuário e multiplicava por 360 o tempo gravado
                  no banco: bastava alguém de um grupo ligá-la para o ranking, a ofensiva e o
                  heatmap de todo mundo virarem ficção. Fora do build de desenvolvimento ela
                  não é renderizada.
                */}
                {__DEV__ && (
                    <SecaoConfig titulo="DESENVOLVIMENTO">
                        <LinhaSwitch
                            rotulo="Modo de testes rápido"
                            ligado={modoTesteLigado}
                            onToggle={() => alternarModoTeste(!modoTesteLigado)}
                            ultima
                        />
                    </SecaoConfig>
                )}

                <SecaoConfig titulo="SOBRE">
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: 14,
                        }}
                    >
                        <Text style={{ fontSize: 14, color: HADES.text }}>Versão do aplicativo</Text>
                        <Text style={{ fontSize: 14, color: HADES.textMuted }}>1.0.0 (Beta)</Text>
                    </View>
                </SecaoConfig>

                <SecaoConfig titulo="ZONA DE PERIGO">
                    <LinhaPerigo
                        rotulo="Sair da conta"
                        icone={<LogOut size={16} color={HADES.red} />}
                        onPress={sairDaConta}
                    />
                    <LinhaPerigo
                        rotulo="Excluir minha conta"
                        descricao="Apaga perfil, sessões, ofensivas e medalhas. Não dá para desfazer."
                        icone={<Trash2 size={16} color={HADES.red} />}
                        onPress={apagarConta}
                        carregando={excluindoConta}
                        ultima
                    />
                </SecaoConfig>
            </ScrollView>
        </SafeAreaView>
    );
}

function SettingsSkeleton() {
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.settingsBg }} edges={["top"]}>
            <View
                style={{
                    paddingTop: 6,
                    paddingHorizontal: 20,
                    paddingBottom: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                }}
            >
                <Skeleton width={22} height={22} borderRadius={6} />
                <Skeleton width={140} height={20} />
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
                showsVerticalScrollIndicator={false}
            >
                <Skeleton width="100%" height={64} borderRadius={14} style={{ marginBottom: 20 }} />
                <Skeleton width="100%" height={200} borderRadius={14} style={{ marginBottom: 20 }} />
                <Skeleton width="100%" height={170} borderRadius={14} />
            </ScrollView>
        </SafeAreaView>
    );
}
