import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { CloudOff, RotateCw, Telescope, Users } from "lucide-react-native";

import { Skeleton, SkeletonCircle } from "@/components/ui/Skeleton";
import { HADES } from "@/constants/hades";

/** Placeholder do feed público quando não há nada em cache para mostrar. */
export function ExplorarSkeleton() {
    return (
        <View style={{ paddingHorizontal: 18, paddingTop: 2, gap: 12 }}>
            {[0, 1, 2].map((i) => (
                <View
                    key={i}
                    style={{
                        backgroundColor: HADES.surface,
                        borderWidth: 1,
                        borderColor: HADES.border,
                        borderRadius: 16,
                        padding: 14,
                    }}
                >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
                        <SkeletonCircle size={32} hades />
                        <Skeleton width={110} height={12} hades />
                    </View>

                    {/* O card do meio imita um arquivo (bloco baixo); os outros, uma foto. */}
                    <Skeleton
                        width="100%"
                        height={i === 1 ? 66 : 172}
                        borderRadius={12}
                        hades
                        style={{ marginTop: 11 }}
                    />

                    <Skeleton width={150} height={12} hades style={{ marginTop: 12 }} />

                    <View style={{ flexDirection: "row", gap: 16, marginTop: 14 }}>
                        <Skeleton width={44} height={12} hades />
                        <Skeleton width={44} height={12} hades />
                    </View>
                </View>
            ))}
        </View>
    );
}

/** Faixa de "atualizando" — o dado antigo segue na tela enquanto revalida por baixo. */
export function FaixaRevalidando() {
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                paddingTop: 2,
                paddingBottom: 10,
            }}
        >
            <ActivityIndicator size="small" color={HADES.accentSolid} />
            <Text style={{ fontSize: 12, color: HADES.textMuted, fontWeight: "600" }}>Atualizando…</Text>
        </View>
    );
}

/** Rodapé do scroll infinito. */
export function CarregandoMais() {
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                paddingTop: 16,
                paddingBottom: 6,
            }}
        >
            <ActivityIndicator size="small" color={HADES.textFaint} />
            <Text style={{ fontSize: 12, color: HADES.textDim, fontWeight: "600" }}>Carregando mais…</Text>
        </View>
    );
}

/**
 * @param naoParticipa O usuário está fora do feed público (opt-in desligado).
 *
 * Sem esse aviso o opt-in seria indescobrível: quem não participa veria um feed vazio,
 * concluiria que ninguém publica nada e nunca saberia que existe um interruptor — e um
 * feed onde ninguém opta fica vazio para sempre. O convite mora aqui, e não numa tela de
 * boas-vindas, porque é aqui que a pessoa está olhando o buraco que ele preenche.
 */
export function ExplorarVazio({
    naoParticipa,
    onParticipar,
}: {
    naoParticipa?: boolean;
    onParticipar?: () => void;
} = {}) {
    return (
        <View style={{ alignItems: "center", paddingHorizontal: 40, paddingVertical: 70 }}>
            <View
                style={{
                    width: 58,
                    height: 58,
                    borderRadius: 17,
                    backgroundColor: HADES.surfaceRaised,
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <Telescope size={27} color={HADES.textMuted} />
            </View>
            <Text style={{ fontSize: 17, fontWeight: "700", color: "#fff", marginTop: 16 }}>
                Nada publicado por aqui ainda
            </Text>
            <Text
                style={{
                    fontSize: 13,
                    color: HADES.textMuted,
                    marginTop: 6,
                    lineHeight: 20,
                    textAlign: "center",
                }}
            >
                Fotos públicas de sessão, arquivos do Vault e planos compartilhados vão aparecer neste feed.
            </Text>

            {naoParticipa && (
                <TouchableOpacity
                    onPress={onParticipar}
                    activeOpacity={0.85}
                    style={{
                        marginTop: 20,
                        paddingVertical: 11,
                        paddingHorizontal: 18,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: HADES.accentTintBorder,
                        backgroundColor: HADES.accentTint,
                    }}
                >
                    <Text style={{ fontSize: 13.5, fontWeight: "700", color: HADES.accentSolid }}>
                        Participar do feed público
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

export function ExplorarComErro({ onTentarDeNovo }: { onTentarDeNovo: () => void }) {
    return (
        <View style={{ alignItems: "center", paddingHorizontal: 40, paddingVertical: 70 }}>
            <View
                style={{
                    width: 58,
                    height: 58,
                    borderRadius: 17,
                    backgroundColor: HADES.surfaceRaised,
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <CloudOff size={27} color={HADES.textMuted} />
            </View>
            <Text style={{ fontSize: 17, fontWeight: "700", color: "#fff", marginTop: 16 }}>
                Não deu para carregar
            </Text>
            <Text
                style={{
                    fontSize: 13,
                    color: HADES.textMuted,
                    marginTop: 6,
                    lineHeight: 20,
                    textAlign: "center",
                }}
            >
                Verifique sua conexão e tente novamente.
            </Text>

            <TouchableOpacity
                onPress={onTentarDeNovo}
                activeOpacity={0.85}
                style={{
                    height: 46,
                    borderRadius: 13,
                    backgroundColor: HADES.surfaceRaised,
                    borderWidth: 1,
                    borderColor: HADES.borderStrong,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    paddingHorizontal: 24,
                    marginTop: 20,
                }}
            >
                <RotateCw size={15} color={HADES.textSecondary} />
                <Text style={{ fontSize: 14, fontWeight: "600", color: HADES.text }}>Tentar de novo</Text>
            </TouchableOpacity>
        </View>
    );
}

/**
 * Faixa que aparece no topo do Explorar para quem ainda não tem grupo: o feed público
 * é o que essa pessoa vê primeiro, e daqui ela chega ao grupo.
 */
export function BannerSemGrupo({ onComecar }: { onComecar: () => void }) {
    return (
        <View
            style={{
                marginHorizontal: 18,
                marginBottom: 14,
                paddingVertical: 14,
                paddingHorizontal: 16,
                backgroundColor: HADES.surface,
                borderWidth: 1,
                borderColor: "rgba(255,154,0,0.3)",
                borderRadius: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 13,
            }}
        >
            <View
                style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    backgroundColor: "rgba(255,154,0,0.14)",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <Users size={20} color={HADES.accentSolid} />
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>
                    Você ainda não tem grupo
                </Text>
                <Text style={{ fontSize: 12, color: HADES.textMuted, marginTop: 2 }}>
                    Crie um ou entre num grupo público
                </Text>
            </View>

            <TouchableOpacity
                onPress={onComecar}
                activeOpacity={0.85}
                style={{
                    backgroundColor: HADES.accentSolid,
                    borderRadius: 9,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                }}
            >
                <Text style={{ fontSize: 12.5, color: "#000", fontWeight: "700" }}>Começar</Text>
            </TouchableOpacity>
        </View>
    );
}
