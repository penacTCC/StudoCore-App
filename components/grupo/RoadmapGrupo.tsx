import { View, Text } from "react-native";
import { HADES } from "@/constants/hades";
import type { ProgressoRoadmapGrupo } from "@/types/roadmap";

/**
 * Seção "Roadmap do grupo" da home — o ganho coletivo da feature.
 *
 * Mostra o nome do roadmap e quantos blocos por semana, e a % de membros que concluíram
 * os blocos da semana atual (toggle manual em cada bloco, na tela do plano). O cruzamento
 * com `membros` acontece no banco, na RPC `grupo_progresso_roadmap` — quem saiu do grupo
 * não conta. Quando o grupo ainda não tem roadmap, um cartão discreto explica o que é e
 * deixa claro que só o admin gera.
 */
export default function RoadmapGrupo({
    progresso,
    souAdmin,
    aoGerar,
}: {
    progresso: ProgressoRoadmapGrupo | null | undefined;
    souAdmin: boolean;
    aoGerar: () => void;
}) {
    if (!progresso) {
        return (
            <View
                style={{
                    borderWidth: 1,
                    borderStyle: "dashed",
                    borderColor: HADES.borderDashed,
                    borderRadius: 16,
                    paddingVertical: 16,
                    paddingHorizontal: 16,
                    marginBottom: 18,
                }}
            >
                <Text style={{ fontSize: 14, fontWeight: "700", color: HADES.text, letterSpacing: -0.2 }}>
                    Roadmap do grupo
                </Text>
                <Text
                    style={{
                        fontSize: 12.5,
                        color: HADES.textMuted,
                        marginTop: 6,
                        lineHeight: 18,
                    }}
                >
                    O grupo ainda não tem um roadmap de estudos. O administrador gera um por IA a partir
                    de um objetivo, e cada membro recebe a própria cópia como plano.
                </Text>
                {souAdmin && (
                    <Text
                        style={{
                            fontSize: 12.5,
                            fontWeight: "600",
                            color: HADES.accentSolid,
                            marginTop: 10,
                        }}
                        onPress={aoGerar}
                    >
                        Gerar roadmap do grupo
                    </Text>
                )}
            </View>
        );
    }

    const semBlocos = progresso.total_blocos_semana <= 0;
    const semMembros = progresso.total_membros <= 0;
    const percentual =
        semBlocos || semMembros ? 0 : Math.round((progresso.membros_completaram / progresso.total_membros) * 100);
    const todosCompletaram = !semBlocos && !semMembros && percentual >= 100;

    return (
        <View
            style={{
                borderWidth: 1,
                borderColor: todosCompletaram ? "rgba(48,209,88,0.28)" : HADES.border,
                borderRadius: 16,
                paddingVertical: 15,
                paddingHorizontal: 16,
                marginBottom: 18,
            }}
        >
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    marginBottom: 11,
                }}
            >
                <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: HADES.textSecondary }}>
                        Roadmap do grupo
                    </Text>
                    <Text style={{ fontSize: 12.5, color: HADES.textMuted, marginTop: 2 }} numberOfLines={1}>
                        {progresso.nome} · {progresso.total_blocos_semana}{" "}
                        {progresso.total_blocos_semana === 1 ? "bloco" : "blocos"}/semana
                    </Text>
                </View>
                <Text
                    style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: semBlocos || semMembros ? HADES.textFaint : HADES.green,
                    }}
                >
                    {semBlocos || semMembros ? "—" : `${percentual}% completou`}
                </Text>
            </View>

            <Barra largura={semBlocos || semMembros ? "0%" : `${Math.min(percentual, 100)}%`} />

            <Text style={{ fontSize: 12, color: HADES.textFaint, marginTop: 9, lineHeight: 17 }}>
                {semBlocos || semMembros
                    ? "Nenhum bloco de estudo esta semana"
                    : todosCompletaram
                      ? `${progresso.membros_completaram} de ${progresso.total_membros} membros completaram a semana.`
                      : `${progresso.membros_completaram} de ${progresso.total_membros} membros completaram os blocos da semana — marque os seus como feitos na tela do plano.`}
            </Text>
        </View>
    );
}

function Barra({ largura }: { largura: string }) {
    return (
        <View
            style={{ height: 9, borderRadius: 5, backgroundColor: HADES.surfaceOverlay, overflow: "hidden" }}
        >
            <View style={{ height: "100%", width: largura as any, borderRadius: 5, backgroundColor: HADES.green }} />
        </View>
    );
}
