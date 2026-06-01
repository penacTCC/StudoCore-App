import "../global.css";
import { useEffect } from "react";
import { SplashScreen, Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import { useAuthState } from "@/hooks/useAuthState";
import { useStatusMembroGrupo } from "@/hooks/useStatusMembroGrupo";
import { useRouteGuard } from "@/hooks/useRoutGuard";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import MedalAlert from "@/components/MedalAlert";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const router = useRouter();

    //Busca a sessão e perfil do usuário
    const { isInitialized, session, profileComplete } = useAuthState();

    //Busca se o usuário tem um grupo
    const { membro, parametrosUltimoGrupo } = useStatusMembroGrupo(session, isInitialized);

    //Roteia o usuário para as telas
    useRouteGuard({
        inicializado: isInitialized,
        session,
        perfilCompleto: profileComplete,
        membro,
        parametrosUltimoGrupo
    });

    useEffect(() => {
        const handleUrl = (url: string | null) => {
            if (!url) return;

            const { params } = QueryParams.getQueryParams(url);
            const isForgotPasswordUrl = url.includes("forgot-password");
            const isRecoveryLink =
                params.type === "recovery" ||
                (isForgotPasswordUrl && typeof params.code === "string") ||
                (isForgotPasswordUrl &&
                    typeof params.access_token === "string" &&
                    typeof params.refresh_token === "string");

            if (!isRecoveryLink) return;

            router.replace({
                pathname: "/(auth)/forgot-password",
                params,
            });
        };

        Linking.getInitialURL().then(handleUrl);

        const subscription = Linking.addEventListener("url", ({ url }) => {
            handleUrl(url);
        });

        return () => subscription.remove();
    }, [router]);

    if (!isInitialized) return <LoadingScreen />
    return (
        <SafeAreaProvider>
            <View className="flex-1 bg-slate-950">
                <StatusBar style="light" />
                <MedalAlert />
                <Stack
                    screenOptions={{
                        headerShown: false,
                        contentStyle: { backgroundColor: "#020617" },
                        animation: "fade",
                    }}
                >
                    <Stack.Screen name="index" />
                    <Stack.Screen name="(auth)" />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="(groups)" />
                    <Stack.Screen name="(modals)" options={{ headerShown: false }} />
                </Stack>
            </View>
        </SafeAreaProvider>
    );
}
