import "../global.css";
import { useEffect, useState } from "react";
import { SplashScreen, Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import { useAuthState } from "@/hooks/useAuthState";
import { useStatusMembroGrupo } from "@/hooks/useStatusMembroGrupo";
import { useRouteGuard } from "@/hooks/useRoutGuard";
import { useForcasRecebidas } from "@/hooks/useForcasRecebidas";
import { usePushToken } from "@/hooks/usePushToken";
import { useLembreteDeOfensiva } from "@/hooks/useLembreteDeOfensiva";
import { useLembreteWrapped } from "@/hooks/useLembreteWrapped";
import { useAberturaAutomaticaWrapped } from "@/hooks/useAberturaAutomaticaWrapped";
import { useAberturaPorNotificacao } from "@/hooks/useAberturaPorNotificacao";
import { useRecuperarSessoesAbandonadas } from "@/hooks/useRecuperarSessoesAbandonadas";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { ToastHost } from "@/components/ui/Toast";
import { ConfirmDialogHost } from "@/components/ui/ConfirmDialog";
import { ProBottomSheetHost } from "@/components/ui/ProBottomSheet";
import { CompraPlayHost } from "@/components/ui/CompraPlayHost";
import { HADES } from "@/constants/hades";
import MedalAlert from "@/components/MedalAlert";
import { validarSessaoPorCodigo } from "@/services/auth";
import { carregarModoTeste } from "@/services/modoTeste";
import { ligarInvalidacaoDeCache } from "@/services/invalidacaoCache";
import { toast } from "@/services/toast";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const router = useRouter();
    const [processandoLinkAuth, setProcessandoLinkAuth] = useState(true);

    //Busca a sessão e perfil do usuário
    const { isInitialized, session, profileComplete } = useAuthState();

    //Busca se o usuário tem um grupo
    const { membro, parametrosUltimoGrupo } = useStatusMembroGrupo(session, isInitialized);

    // Registra o token de push da conta neste aparelho (é o que faz a força chegar com o
    // app fechado).
    usePushToken(session?.user?.id);

    // Plano B do push: escuta por Realtime as forças que chegam e notifica localmente
    // quando o aparelho não conseguiu token de push.
    useForcasRecebidas(session?.user?.id);

    // Tocar numa notificação de curtida/comentário abre a caixa de notificações.
    useAberturaPorNotificacao(session?.user?.id);

    // Reagenda o lembrete da noite pra quem tem ofensiva pra perder e ainda não estudou.
    useLembreteDeOfensiva(session?.user?.id);

    // Garante o push do Wrapped mensal (dia 1, 9h) agendado.
    useLembreteWrapped(session?.user?.id);

    // Abre o Wrapped mensal sozinho na primeira vez que o app abre no dia 1 — só depois
    // que o roteamento inicial já decidiu que a pessoa tem grupo e pousou nas tabs.
    useAberturaAutomaticaWrapped(session?.user?.id, membro === true);

    // Fecha sessões de foco que ficaram abertas de um fechamento forçado do app.
    useRecuperarSessoesAbandonadas(session?.user?.id);

    // Carrega a escala do modo de testes uma vez: os cronômetros ao vivo a consultam
    // durante o render, onde não dá pra esperar o AsyncStorage (ver services/modoTeste.ts).
    useEffect(() => {
        carregarModoTeste();
    }, []);

    // Faz os avisos de mutação (entrar/sair de grupo, medalha desbloqueada) vencerem as
    // chaves correspondentes do cache de navegação.
    useEffect(() => {
        ligarInvalidacaoDeCache();
    }, []);

    //Roteia o usuário para as telas
    useRouteGuard({
        inicializado: isInitialized && !processandoLinkAuth,
        session,
        perfilCompleto: profileComplete,
        membro,
        parametrosUltimoGrupo
    });

    useEffect(() => {
        const handleUrl = async (url: string | null) => {
            if (!url) return;
            if (url.startsWith("studocore://login")) return;

            const { params } = QueryParams.getQueryParams(url);
            const isForgotPasswordUrl = url.includes("forgot-password");
            const isRecoveryLink =
                params.type === "recovery" ||
                (isForgotPasswordUrl && typeof params.code === "string");

            if (!isRecoveryLink) return;

            if (typeof params.code === "string") {
                const { error } = await validarSessaoPorCodigo(params.code);
                if (error) {
                    console.error("Erro ao validar código de recuperação:", error);
                    toast.error("Este link de recuperação é inválido ou expirou.");
                }
            }

            router.replace({
                pathname: "/(auth)/forgot-password",
                params,
            });
        };

        Linking.getInitialURL()
            .then(handleUrl)
            .finally(() => setProcessandoLinkAuth(false));

        const subscription = Linking.addEventListener("url", ({ url }) => {
            if (url.startsWith("studocore://login")) {
                return;
            }

            setProcessandoLinkAuth(true);
            handleUrl(url).finally(() => setProcessandoLinkAuth(false));
        });

        return () => subscription.remove();
    }, [router]);

    if (!isInitialized || processandoLinkAuth) return <LoadingScreen />
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <View style={{ flex: 1, backgroundColor: HADES.bg }}>
                    <StatusBar style="light" />
                    <MedalAlert />
                    <ToastHost />
                    <ConfirmDialogHost />
                    <ProBottomSheetHost />
                    <CompraPlayHost />
                    <OfflineBanner />
                    <Stack
                        screenOptions={{
                            headerShown: false,
                            contentStyle: { backgroundColor: HADES.bg },
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
        </GestureHandlerRootView>
    );
}
