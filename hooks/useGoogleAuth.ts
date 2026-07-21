import { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";

//Componentes do Expo
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

//Serviços da Aplicação
import { gerarUrlLoginGoogle, obterSessaoAtual, validarSessaoGoogle, validarSessaoPorTokens } from "@/services/auth";

const GOOGLE_REDIRECT_URL = "studocore://login";

type GoogleCallbackParams = {
    code: string | null;
    accessToken: string | null;
    refreshToken: string | null;
    error: string | null;
    errorDescription: string | null;
};

// Avisa ao sistema para fechar o navegador automaticamente quando terminar
WebBrowser.maybeCompleteAuthSession();

/**
 * Encapsula o fluxo de login com Google (mesma lógica usada na tela de login):
 * abre o navegador, trata o callback via deep-link e finaliza a sessão.
 */
export function useGoogleAuth() {
    const params = useLocalSearchParams<{ code?: string; error?: string; error_description?: string }>();
    const codigoGoogleProcessado = useRef<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const extrairParametrosUrl = (url: string): GoogleCallbackParams => {
        const queryString = url.split("?")[1]?.split("#")[0] ?? "";
        const hashString = url.split("#")[1] ?? "";
        const searchParams = new URLSearchParams(queryString || hashString);

        return {
            code: searchParams.get("code"),
            accessToken: searchParams.get("access_token"),
            refreshToken: searchParams.get("refresh_token"),
            error: searchParams.get("error"),
            errorDescription: searchParams.get("error_description"),
        };
    };

    const finalizarLoginGoogle = async (code: string) => {
        if (codigoGoogleProcessado.current === code) return;
        codigoGoogleProcessado.current = code;

        const { error: sessionError } = await validarSessaoGoogle(code);
        if (sessionError) {
            const { data: { session } } = await obterSessaoAtual();
            if (!session) throw sessionError;
        }

        router.replace("/");
    };

    const finalizarCallbackGoogle = async (
        code?: string | null,
        accessToken?: string | null,
        refreshToken?: string | null,
        error?: string | null,
        errorDescription?: string | null
    ) => {
        if (error) {
            Alert.alert("Erro no Google", errorDescription ?? error);
            return;
        }

        if (!code && (!accessToken || !refreshToken)) return;

        try {
            setIsLoading(true);
            if (code) {
                await finalizarLoginGoogle(code);
            } else if (accessToken && refreshToken) {
                const { error: sessionError } = await validarSessaoPorTokens(accessToken, refreshToken);
                if (sessionError) throw sessionError;
                router.replace("/");
            }
        } catch (error) {
            console.error("Erro no callback do Google:", error);
            Alert.alert("Erro", "Não foi possível concluir o login com o Google.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        finalizarCallbackGoogle(params.code, null, null, params.error, params.error_description);
    }, [params.code, params.error, params.error_description]);

    useEffect(() => {
        const subscription = Linking.addEventListener("url", ({ url }) => {
            if (!url.startsWith(GOOGLE_REDIRECT_URL)) return;

            const { code, accessToken, refreshToken, error, errorDescription } = extrairParametrosUrl(url);
            finalizarCallbackGoogle(code, accessToken, refreshToken, error, errorDescription);
        });

        return () => subscription.remove();
    }, []);

    const handleGoogleSignIn = async () => {
        try {
            setIsLoading(true);
            const { data, error } = await gerarUrlLoginGoogle(GOOGLE_REDIRECT_URL);
            if (error) throw error;

            const res = await WebBrowser.openAuthSessionAsync(data?.url ?? "", GOOGLE_REDIRECT_URL);

            if (res.type === "success") {
                const { code, accessToken, refreshToken, error, errorDescription } = extrairParametrosUrl(res.url);

                await finalizarCallbackGoogle(code, accessToken, refreshToken, error, errorDescription);

                if (!code && !accessToken && !error) {
                    Alert.alert("Erro no Google", "O Google voltou sem código de autenticação.");
                }
            }
        } catch (error) {
            console.error("Erro no fluxo do Google:", error);
            Alert.alert("Erro", "Não foi possível concluir o login com o Google.");
        } finally {
            setIsLoading(false);
        }
    };

    return { isLoading, handleGoogleSignIn };
}
