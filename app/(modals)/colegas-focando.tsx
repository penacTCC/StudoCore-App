import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "@/components/ui/TelaSegura";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ChevronLeft, HandMetal, MessageCircle } from "@/components/ui/icons";
import { HADES } from "@/constants/hades";
import { useAuth } from "@/hooks/useAuth";
import { useIncentivos } from "@/hooks/useIncentivos";
import { useParticipantesDaSala } from "@/hooks/useParticipantesDaSala";
import { tempoAoVivoDoMembro } from "@/utils/tempo";
import type { ParticipanteDaSala } from "@/types/sala";

const formatarTempo = (segundos: number) => {
    const totalSegundos = Math.max(0, Math.floor(segundos));
    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    const segundosRestantes = totalSegundos % 60;

    if (horas > 0) {
        return `${horas.toString().padStart(2, "0")}:${minutos.toString().padStart(2, "0")}:${segundosRestantes.toString().padStart(2, "0")}`;
    }

    return `${minutos.toString().padStart(2, "0")}:${segundosRestantes.toString().padStart(2, "0")}`;
};

/** mm:ss do cooldown restante — nunca passa de 20min, então minutos sempre cabem em 2 dígitos. */
const formatarCooldown = (segundos: number) => {
    const m = Math.floor(segundos / 60);
    const s = segundos % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

export default function ColegasFocandoScreen() {
    const router = useRouter();
    const { userId } = useAuth();
    const { materia, conteudo, salaId } = useLocalSearchParams<{ materia?: string; conteudo?: string; salaId?: string }>();

    const idDaSala = Array.isArray(salaId) ? salaId[0] : salaId;

    // Participantes sincronizados em tempo real (ver hooks/useParticipantesDaSala).
    const { participantes: members } = useParticipantesDaSala(idDaSala);

    // Tick de 1s só para repintar a tela: o tempo em si é sempre recalculado a partir do
    // acumulado do membro + `ultimo_inicio` (ver tempoAoVivoDoMembro), nunca somado ao tick.
    const [, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 1000);
        return () => clearInterval(id);
    }, []);

    // A força é individual: cada colega da lista pode receber a sua.
    const { enviandoPara, contarPara, podeTorcerPor, cooldownRestante, enviarForca } = useIncentivos(idDaSala);

    // Quem já encerrou não é "em pausa": o contador dizia que a pessoa ainda estava na
    // sessão, parada, quando na verdade ela tinha saído.
    const focando = members.filter((member) => member.status === "ativo").length;
    const emPausa = members.filter((member) => member.status === "pausado").length;

    /** Tempo real do membro: o acumulado dele mais o que passou desde o último início. */
    const tempoDoMembro = (member: ParticipanteDaSala) => tempoAoVivoDoMembro(member);

    const tempoCombinado = members.reduce((total, member) => total + tempoDoMembro(member), 0);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top"]}>
            <View style={{ paddingHorizontal: 18, paddingTop: 6, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{
                        width: 38,
                        height: 38,
                        borderRadius: 11,
                        backgroundColor: HADES.surfaceRaised,
                        borderWidth: 1,
                        borderColor: HADES.border,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <ChevronLeft size={20} color={HADES.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 18, fontWeight: "700", color: HADES.text, letterSpacing: -0.3 }}>
                        Focando juntos
                    </Text>
                </View>
            </View>

            <View
                style={{
                    marginHorizontal: 16,
                    marginBottom: 4,
                    backgroundColor: "rgba(255,154,0,0.09)",
                    borderWidth: 1,
                    borderColor: "rgba(255,154,0,0.22)",
                    borderRadius: 16,
                    paddingVertical: 16,
                    paddingHorizontal: 18,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 16,
                }}
            >
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: HADES.accentSolid, fontWeight: "700", letterSpacing: 0.6 }}>
                        TEMPO COMBINADO
                    </Text>
                    <Text style={{ fontSize: 30, fontWeight: "600", color: HADES.text, marginTop: 3 }}>{formatarTempo(tempoCombinado)}</Text>
                </View>
                <View style={{ width: 1, alignSelf: "stretch", backgroundColor: "rgba(255,255,255,0.1)" }} />
                <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: 24, fontWeight: "700", color: HADES.green }}>{focando}</Text>
                    <Text style={{ fontSize: 11, color: HADES.textMuted, marginTop: 1 }}>focando</Text>
                </View>
                <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: 24, fontWeight: "700", color: HADES.textFaint }}>{emPausa}</Text>
                    <Text style={{ fontSize: 11, color: HADES.textMuted, marginTop: 1 }}>em pausa</Text>
                </View>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 8 }}>
                <Text style={{ fontSize: 11, color: HADES.textFaint, fontWeight: "700", letterSpacing: 0.6, marginHorizontal: 4, marginBottom: 10 }}>
                    POR TEMPO DE HOJE
                </Text>

                <View style={{ gap: 9 }}>
                    {members.length === 0 ? (
                        <Text style={{ fontSize: 13, color: HADES.textMuted, paddingVertical: 8 }}>
                            Nenhum participante encontrado para esta sessão ainda.
                        </Text>
                    ) : (
                        members.map((member) => {
                            const nome = member.profiles?.nome_usuario || member.profiles?.nome_real || "Participante";
                            const inicial = nome.charAt(0).toUpperCase() || "P";
                            const cor = member.membro_id === userId ? "#e08a1e" : (member.status === "ativo" ? "#1f9d63" : "#5a5d66");

                            return (
                                <LinhaColega
                                    key={member.membro_id}
                                    inicial={inicial}
                                    cor={cor}
                                    nome={member.membro_id === userId ? "Você" : nome}
                                    voce={member.membro_id === userId}
                                    topico={conteudo || materia || "Sessão em andamento"}
                                    tempo={formatarTempo(tempoDoMembro(member))}
                                    emFoco={member.status === "ativo"}
                                    podeTorcer={podeTorcerPor(member.membro_id)}
                                    cooldownSegundos={cooldownRestante(member.membro_id)}
                                    forcasRecebidas={contarPara(member.membro_id)}
                                    torcendo={enviandoPara === member.membro_id}
                                    onTorcer={() => enviarForca(member.membro_id)}
                                />
                            );
                        })
                    )}
                </View>
            </ScrollView>

            {/* A força agora sai no card de cada colega, então o rodapé só guarda o chat. */}
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingHorizontal: 16,
                    paddingTop: 10,
                    paddingBottom: 26,
                    borderTopWidth: 1,
                    borderTopColor: HADES.border,
                }}
            >
            </View>
        </SafeAreaView>
    );
}

function LinhaColega({
    inicial,
    cor,
    nome,
    topico,
    tempo,
    emFoco,
    voce = false,
    podeTorcer = false,
    cooldownSegundos = 0,
    forcasRecebidas = 0,
    torcendo = false,
    onTorcer,
}: {
    inicial: string;
    cor: string;
    nome: string;
    topico: string;
    tempo: string;
    emFoco: boolean;
    voce?: boolean;
    podeTorcer?: boolean;
    cooldownSegundos?: number;
    forcasRecebidas?: number;
    torcendo?: boolean;
    onTorcer?: () => void;
}) {
    const emCooldown = cooldownSegundos > 0;
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 13,
                backgroundColor: voce ? "rgba(255,154,0,0.08)" : HADES.surface,
                borderWidth: 1,
                borderColor: voce ? "rgba(255,154,0,0.3)" : HADES.border,
                borderRadius: 14,
                paddingVertical: 13,
                paddingHorizontal: 14,
                opacity: emFoco ? 1 : 0.7,
            }}
        >
            <View style={{ position: "relative" }}>
                <View
                    style={{
                        width: 42,
                        height: 42,
                        borderRadius: 21,
                        backgroundColor: cor,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Text style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}>{inicial}</Text>
                </View>
                <View
                    style={{
                        position: "absolute",
                        right: -1,
                        bottom: -1,
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: emFoco ? HADES.green : HADES.textMuted,
                        borderWidth: 2.5,
                        borderColor: voce ? "#1c1608" : HADES.surface,
                    }}
                />
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: voce ? HADES.text : emFoco ? HADES.text : HADES.textSecondary }}>
                        {nome}
                    </Text>
                    {voce && (
                        <Text
                            style={{
                                fontSize: 10,
                                fontWeight: "700",
                                color: HADES.accentSolid,
                                backgroundColor: "rgba(255,154,0,0.15)",
                                borderRadius: 5,
                                paddingVertical: 2,
                                paddingHorizontal: 6,
                            }}
                        >
                            VOCÊ
                        </Text>
                    )}
                </View>
                <Text
                    style={{ fontSize: 12, color: emFoco ? HADES.textMuted : HADES.textFaint, marginTop: 2 }}
                    numberOfLines={1}
                >
                    {topico}
                </Text>
            </View>

            <View style={{ alignItems: "flex-end" }}>
                <Text
                    style={{
                        fontSize: 16,
                        fontWeight: "600",
                        color: emFoco ? HADES.text : HADES.textMuted,
                        fontVariant: ["tabular-nums"],
                    }}
                >
                    {tempo}
                </Text>
                <Text style={{ fontSize: 11, color: emFoco ? HADES.accentSolid : HADES.textFaint, marginTop: 1 }}>
                    {emFoco ? "em foco" : "em pausa"}
                </Text>
            </View>

            {/* Cada colega recebe força individualmente; não aparece na própria linha. */}
            {podeTorcer && (
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={onTorcer}
                    disabled={torcendo || emCooldown}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        paddingHorizontal: 9,
                        paddingVertical: 7,
                        borderRadius: 10,
                        backgroundColor: HADES.surfaceRaised,
                        borderWidth: 1,
                        borderColor: HADES.borderStrong,
                        opacity: torcendo ? 0.6 : emCooldown ? 0.5 : 1,
                    }}
                >
                    {emCooldown ? (
                        <Text style={{ fontSize: 11, fontWeight: "700", color: HADES.textMuted, fontVariant: ["tabular-nums"] }}>
                            {formatarCooldown(cooldownSegundos)}
                        </Text>
                    ) : (
                        <>
                            <HandMetal size={15} color={HADES.accentSolid} />
                            {forcasRecebidas > 0 && (
                                <Text style={{ fontSize: 12, fontWeight: "700", color: HADES.accentSolid }}>{forcasRecebidas}</Text>
                            )}
                        </>
                    )}
                </TouchableOpacity>
            )}
        </View>
    );
}
