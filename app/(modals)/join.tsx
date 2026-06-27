import { useEffect, useState } from "react";

//Componentes do react native
import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

//Componentes do expo router
import { router, useLocalSearchParams } from "expo-router";

//Componentes do projeto
import { LoadingScreen } from "@/components/ui/LoadingScreen";

//Tela aberta a partir do link de convite (studocore://join?groupId=X).
//Não entra no grupo direto: leva para o preview do grupo (group-details),
//que já mostra os detalhes e tem o botão "Entrar neste grupo".
export default function JoinScreen() {
    const { groupId } = useLocalSearchParams<{ groupId: string }>();
    const [erro, setErro] = useState<string | null>(null);

    useEffect(() => {
        if (!groupId) {
            setErro("Link de convite inválido.");
            return;
        }

        router.replace(`/(groups)/group-details?groupId=${groupId}`);
    }, [groupId]);

    if (erro) {
        return (
            <SafeAreaView className="flex-1 bg-navy-950 items-center justify-center px-6" edges={["top"]}>
                <Text className="text-slate-200 text-base text-center mb-4">{erro}</Text>
                <Text
                    className="text-brand-500 font-semibold"
                    onPress={() => router.replace("/(groups)/no-group")}
                >
                    Voltar
                </Text>
            </SafeAreaView>
        );
    }

    return <LoadingScreen />;
}
