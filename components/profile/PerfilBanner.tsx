import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Camera, Flame } from "lucide-react-native";
import { HADES } from "@/constants/hades";
import Avatar from "@/components/ui/Avatar";

type BannerProps = {
    altura: number;
    cor: string;
    iniciais: string;
    /** Foto do usuário. Quando existe, vira a capa (desfocada e escurecida) no lugar da cor. */
    foto?: string | null;
    /** Preenche o espaço em vez de se posicionar absoluto sobre a tela. Padrão: false. */
    estatico?: boolean;
};

/**
 * Fundo do banner do perfil.
 *
 * Sem foto: a mesma cor de identidade do avatar (getIdentityColor) + iniciais em marca d'água.
 * Com foto: a própria foto do avatar esticada no tamanho do banner, desfocada e escurecida —
 * uma foto 1:1 esticada em faixa larga fica ruim nítida, e o escurecido é o que mantém os
 * botões do topo e o avatar legíveis por cima. Nos dois casos esmaece pro fundo do app.
 */
export function BannerPerfil({ altura, cor, iniciais, foto, estatico }: BannerProps) {
    return (
        <View
            style={{
                ...(estatico
                    ? { height: altura }
                    : { position: "absolute", top: 0, left: 0, right: 0, height: altura }),
                backgroundColor: cor,
                overflow: "hidden",
            }}
        >
            {foto ? (
                <Image
                    source={{ uri: foto }}
                    style={StyleSheet.absoluteFillObject}
                    resizeMode="cover"
                    blurRadius={18}
                />
            ) : (
                <View
                    style={{
                        position: "absolute",
                        top: -altura * 0.3,
                        left: -30,
                        right: -30,
                        alignItems: "center",
                        transform: [{ rotate: "-8deg" }],
                    }}
                >
                    <Text
                        style={{
                            fontSize: altura * 1.05,
                            fontWeight: "800",
                            color: "rgba(255,255,255,0.14)",
                            letterSpacing: -6,
                        }}
                        numberOfLines={1}
                    >
                        {iniciais}
                    </Text>
                </View>
            )}
            <LinearGradient
                colors={
                    foto
                        ? ["rgba(0,0,0,0.55)", "rgba(0,0,0,0.4)", HADES.bg]
                        : ["rgba(0,0,0,0.45)", "rgba(0,0,0,0.22)", HADES.bg]
                }
                locations={[0, 0.45, 1]}
                style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            />
        </View>
    );
}

type AvatarProps = {
    tamanho: number;
    foto?: string | null;
    nome?: string | null;
    ofensiva: number;
    /** Esconde o selo de ofensiva (perfil ainda sem nenhuma sessão). */
    mostrarOfensiva?: boolean;
    /** Mostra o selo de câmera (editar foto) no lugar do selo de ofensiva. */
    badgeEditar?: boolean;
    onPress?: () => void;
};

/** Avatar circular sobreposto ao banner, com o selo de ofensiva (ou de edição) centralizado embaixo. */
export function AvatarComOfensiva({
    tamanho,
    foto,
    nome,
    ofensiva,
    mostrarOfensiva = true,
    badgeEditar,
    onPress,
}: AvatarProps) {
    const conteudo = (
        <View style={{ width: tamanho }}>
            <View
                style={{
                    borderRadius: 999,
                    borderWidth: 4,
                    borderColor: HADES.bg,
                    overflow: "hidden",
                    alignSelf: "center",
                }}
            >
                <Avatar foto={foto} nome={nome} size={tamanho} />
            </View>

            {badgeEditar ? (
                <View
                    style={{
                        position: "absolute",
                        bottom: 2,
                        right: 0,
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: HADES.surfaceRaised,
                        borderWidth: 2,
                        borderColor: HADES.bg,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Camera size={15} color={HADES.textSecondary} />
                </View>
            ) : mostrarOfensiva ? (
                <View
                    style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        bottom: -8,
                        alignItems: "center",
                    }}
                >
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 3,
                            backgroundColor: HADES.surfaceRaised,
                            borderWidth: 2,
                            borderColor: HADES.bg,
                            borderRadius: 12,
                            paddingVertical: 4,
                            paddingLeft: 6,
                            paddingRight: 8,
                        }}
                    >
                        <Flame size={13} color={HADES.accentSolid} />
                        <Text style={{ fontSize: 12.5, fontWeight: "700", color: HADES.text }}>
                            {ofensiva}
                        </Text>
                    </View>
                </View>
            ) : null}
        </View>
    );

    if (!onPress) return conteudo;

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
            {conteudo}
        </TouchableOpacity>
    );
}
