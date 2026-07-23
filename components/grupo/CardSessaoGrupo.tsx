import { View, Text, TouchableOpacity } from "react-native";
import { Globe, Lock, Flame, Clock, BadgeCheck, Wind } from "lucide-react-native";
import { HADES } from "@/constants/hades";
import { getSubjectColor, getTimeAgo } from "@/constants/helpers";
import Avatar from "@/components/ui/Avatar";
import type { SessaoFocoRow } from "@/types/sessions";

/**
 * Card de sessão no feed da home do grupo, no visual HADES.
 *
 * Separado do `components/groups/SessionCard`, que continua servindo a tela de
 * detalhamento — aquela ainda não migrou para o HADES.
 */
export default function CardSessaoGrupo({ sessao }: { sessao: SessaoFocoRow }) {
    const nome = sessao.profiles?.nome_real || sessao.profiles?.nome_usuario || "Usuário";
    const corMateria = getSubjectColor(sessao.disciplina);
    const verificado = sessao.questoes_acertadas > 7;
    const publica = sessao.is_public;

    const horas = Math.floor(sessao.tempo_minutos / 60);
    const minutos = sessao.tempo_minutos % 60;
    const duracao = horas === 0 ? `${minutos}m` : minutos === 0 ? `${horas}h` : `${horas}h ${minutos}m`;

    const horario = new Date(sessao.created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    });

    return (
        <View
            style={{
                backgroundColor: HADES.surface,
                borderWidth: 1,
                borderColor: HADES.border,
                borderRadius: 16,
                padding: 14,
            }}
        >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
                <Avatar foto={sessao.profiles?.foto_usuario} nome={nome} size={30} />

                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: HADES.text }} numberOfLines={1}>
                        {nome}
                    </Text>
                </View>

                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        backgroundColor: publica ? "rgba(255,154,0,0.10)" : HADES.surfaceOverlay,
                        borderRadius: 7,
                        paddingVertical: 3,
                        paddingHorizontal: 8,
                    }}
                >
                    {publica ? (
                        <Globe size={11} color={HADES.accentSolid} />
                    ) : (
                        <Lock size={11} color={HADES.textMuted} />
                    )}
                    <Text
                        style={{
                            fontSize: 10.5,
                            color: publica ? HADES.accentSolid : HADES.textMuted,
                            fontWeight: "600",
                        }}
                    >
                        {publica ? "Pública" : "Privada"}
                    </Text>
                </View>
            </View>

            <Text style={{ marginTop: 11 }} numberOfLines={1}>
                <Text style={{ fontSize: 13.5, fontWeight: "600", color: corMateria.text }}>
                    {sessao.disciplina}
                </Text>
                <Text style={{ fontSize: 13, color: HADES.textMuted }}>
                    {sessao.conteudo_especifico ? ` · ${sessao.conteudo_especifico}` : ""}
                </Text>
            </Text>

            <View
                style={{
                    flexDirection: "row",
                    alignItems: "flex-end",
                    justifyContent: "space-between",
                    marginTop: 12,
                    paddingTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: "rgba(255,255,255,0.05)",
                }}
            >
                <View>
                    <Text
                        style={{ fontSize: 19, fontWeight: "700", color: HADES.text, letterSpacing: -0.3 }}
                    >
                        {duracao}
                    </Text>
                    <Text
                        style={{
                            fontSize: 10,
                            color: HADES.textDim,
                            fontWeight: "600",
                            letterSpacing: 0.5,
                            marginTop: 1,
                        }}
                    >
                        DURAÇÃO
                    </Text>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <Clock size={13} color={HADES.textFaint} />
                        <Text style={{ fontSize: 12.5, color: HADES.textMuted }}>{getTimeAgo(sessao.created_at)}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <Flame size={14} color={HADES.accentSolid} />
                        <Text style={{ fontSize: 12.5, color: HADES.textSecondary, fontWeight: "600" }}>
                            {sessao.questoes_acertadas}/{sessao.questoes_respondidas}
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

export function FeedVazio({ carregando }: { carregando?: boolean }) {
    return (
        <View
            style={{
                backgroundColor: HADES.surface,
                borderWidth: 1,
                borderColor: HADES.border,
                borderRadius: 16,
                paddingVertical: 28,
                paddingHorizontal: 20,
                alignItems: "center",
            }}
        >
            {carregando ? (
                <Text style={{ fontSize: 13.5, color: HADES.textMuted }}>Carregando...</Text>
            ) : (
                <>
                    <Wind size={26} color={HADES.dot} />
                    <Text style={{ fontSize: 13.5, color: HADES.textMuted, marginTop: 12 }}>
                        Nenhuma sessão registrada ainda.
                    </Text>
                    <Text style={{ fontSize: 12, color: HADES.textDim, marginTop: 4 }}>
                        As sessões dos membros aparecem aqui.
                    </Text>
                </>
            )}
        </View>
    );
}
