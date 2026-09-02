import { View, Text, Image, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Lock } from "@/components/ui/icons";

/**
 * Banner de entrada pro Wrapped mensal — só aparece dentro da janela de acesso (ver
 * `estaNaJanelaDoWrapped` em lib/wrappedMensal.ts, chamado por quem renderiza este card).
 * Fundo azul-marinho quase preto com duas barras diagonais em gradiente (laranja/azul)
 * sangrando pra fora do card — o brilho vem só das próprias barras (mais intensas no
 * meio, somem nas pontas), sem halos redondos atrás, que ficavam com cara de mancha.
 */
export default function CardWrapped({
    mesRotulo,
    onPress,
    travado = false,
}: {
    mesRotulo: string;
    onPress: () => void;
    /** Plano Grátis: o card continua visível, com cadeado, e o toque leva ao paywall. */
    travado?: boolean;
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.85}
            style={{
                position: "relative",
                height: 80,
                overflow: "hidden",
                borderRadius: 16,
                borderWidth: 1,
                borderColor: "rgba(59,130,246,0.2)",
                shadowColor: "rgba(50,80,255,1)",
                shadowOpacity: 0.12,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 0 },
            }}
        >
            {/* Fundo — gradiente sutil, não chapado */}
            <LinearGradient
                colors={["#060d1e", "#040b18", "#020610"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            />

            {/* Barras diagonais — feixes de luz, mais intensos no centro e somem nas pontas */}
            <LinearGradient
                colors={["rgba(249,115,22,0)", "rgba(255,154,61,0.95)", "rgba(249,115,22,0)"]}
                locations={[0, 0.5, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{
                    position: "absolute",
                    right: 48,
                    top: -32,
                    height: 112,
                    width: 10,
                    borderRadius: 999,
                    transform: [{ rotate: "45deg" }],
                }}
            />
            <LinearGradient
                colors={["rgba(59,130,246,0)", "rgba(96,165,250,0.95)", "rgba(59,130,246,0)"]}
                locations={[0, 0.5, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{
                    position: "absolute",
                    right: 24,
                    top: 20,
                    height: 96,
                    width: 10,
                    borderRadius: 999,
                    transform: [{ rotate: "45deg" }],
                }}
            />

            {/* Brilho no topo — lasca de luz batendo na borda superior do card */}
            <LinearGradient
                colors={["rgba(255,255,255,0.06)", "rgba(255,255,255,0)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{ position: "absolute", top: 0, left: 0, right: 0, height: 28 }}
            />

            {/* Conteúdo */}
            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    flex: 1,
                    paddingHorizontal: 16,
                }}
            >
                <Image
                    source={require("@/assets/logo-studocore.png")}
                    style={{ height: 32, width: 32 }}
                    resizeMode="contain"
                />

                <View style={{ height: 36, width: 1, backgroundColor: "rgba(255,255,255,0.15)" }} />

                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: "#fff" }}>Seu Wrapped</Text>
                    <Text
                        numberOfLines={1}
                        style={{ fontSize: 14, fontWeight: "700", color: "#f97316" }}
                    >
                        de {mesRotulo} chegou!
                    </Text>
                </View>

                <View
                    style={{
                        height: 40,
                        width: 40,
                        borderRadius: 20,
                        overflow: "hidden",
                        borderWidth: 1,
                        borderColor: "#f97316",
                        shadowColor: "rgba(255,122,0,1)",
                        shadowOpacity: 0.35,
                        shadowRadius: 12,
                        shadowOffset: { width: 0, height: 0 },
                    }}
                >
                    <LinearGradient
                        colors={["rgba(249,115,22,0.28)", "rgba(249,115,22,0.06)"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
                    >
                        {travado ? (
                            <Lock size={17} color="#fb923c" />
                        ) : (
                            <Text style={{ fontSize: 20, color: "#fb923c" }}>→</Text>
                        )}
                    </LinearGradient>
                </View>
            </View>
        </TouchableOpacity>
    );
}
