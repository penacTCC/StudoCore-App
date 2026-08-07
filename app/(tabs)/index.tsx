import { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Search } from "lucide-react-native";

import AbaExplorar from "@/components/comunidade/AbaExplorar";
import AbaMeuGrupo from "@/components/comunidade/AbaMeuGrupo";
import SegmentoComunidade, { EscopoComunidade } from "@/components/comunidade/SegmentoComunidade";
import { HADES } from "@/constants/hades";

/**
 * Aba Comunidade — substitui a antiga aba Grupos.
 *
 * A casca é só o título, a busca e o alternador de escopo; o conteúdo de cada escopo vive
 * em seu próprio componente. "Meu grupo" é a home de grupo de sempre; "Explorar" é o feed
 * público (ainda mockado, ver `services/comunidade.ts`).
 *
 * Quem chega sem grupo abre direto no Explorar: é o lado da aba que tem o que mostrar
 * antes de a pessoa entrar em algum grupo.
 */
export default function ComunidadeScreen() {
    const { groupId } = useLocalSearchParams();
    const temGrupo = !!groupId;

    const escopoInicial: EscopoComunidade = temGrupo ? "meu-grupo" : "explorar";
    const [escopo, setEscopo] = useState<EscopoComunidade>(escopoInicial);
    // O escopo que nunca foi aberto não é montado: assim o feed público só vai à rede
    // quando alguém pede por ele. Depois de visitado, fica montado.
    const [visitados, setVisitados] = useState<EscopoComunidade[]>([escopoInicial]);

    const trocarEscopo = (novo: EscopoComunidade) => {
        setEscopo(novo);
        setVisitados((atuais) => (atuais.includes(novo) ? atuais : [...atuais, novo]));
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top"]}>
            <View
                style={{
                    paddingTop: 4,
                    paddingHorizontal: 18,
                    paddingBottom: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                }}
            >
                <Text style={{ flex: 1, fontSize: 22, fontWeight: "700", color: "#fff", letterSpacing: -0.3 }}>
                    Comunidade
                </Text>

                <TouchableOpacity
                    onPress={() => router.push("/(groups)/browse-groups")}
                    activeOpacity={0.8}
                    style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: HADES.surfaceRaised,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Search size={18} color={HADES.textSecondary} />
                </TouchableOpacity>
            </View>

            <SegmentoComunidade escopo={escopo} onSelecionar={trocarEscopo} />

            {/*
              Escopo já visitado continua montado: alternar não pode custar uma recarga do
              grupo nem perder a posição do feed. O que sai de cena é só escondido.
            */}
            {visitados.includes("meu-grupo") && (
                <View style={{ flex: 1, display: escopo === "meu-grupo" ? "flex" : "none" }}>
                    <AbaMeuGrupo />
                </View>
            )}
            {visitados.includes("explorar") && (
                <View style={{ flex: 1, display: escopo === "explorar" ? "flex" : "none" }}>
                    <AbaExplorar temGrupo={temGrupo} />
                </View>
            )}
        </SafeAreaView>
    );
}
