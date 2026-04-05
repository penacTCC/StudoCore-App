import "../global.css";
import { Stack, useRouter, useSegments } from "expo-router";

// Suppress non-fatal Expo internal error during splash screen in Expo Go
if (typeof global !== "undefined") {
    const originalHandler = (global as any).ErrorUtils?.getGlobalHandler?.();
    (global as any).ErrorUtils?.setGlobalHandler?.((error: Error, isFatal: boolean) => {
        if (error?.message?.includes("Unable to activate keep awake")) return;
        originalHandler?.(error, isFatal);
    });
}
import { StatusBar } from "expo-status-bar";
import { DeviceEventEmitter, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { supabase } from "../supabase";
import { useState, useEffect } from "react";
import * as SplashScreen from "expo-splash-screen";
import { loadLastGroupLocally } from "../services/offlineStorage";
import { fetchGroupById } from "../services/groups";
import MedalAlert from "../components/MedalAlert";

// Impede que a tela de splash suma imediatamente
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const [isInitialized, setIsInitialized] = useState(false);
    const [session, setSession] = useState<any>(null);
    const [isMember, setIsMember] = useState<boolean | null>(null);
    const [lastGroupParams, setLastGroupParams] = useState<any>(undefined);

    //Começa como null para indicar que está carregando
    const [profileComplete, setProfileComplete] = useState<boolean | null>(null);

    const router = useRouter();
    const segments = useSegments();

    // ── 1. Inicializa a Sessão 
    useEffect(() => {
        console.log("RootLayout: Iniciando busca de sessão...");
        supabase.auth.getSession().then(({ data: { session } }) => {
            console.log("RootLayout: Sessão obtida:", session ? "Sim" : "Não");
            setSession(session);
            setIsInitialized(true); //só inicia o app se pegar a sessão
        }).catch(err => {
            console.error("RootLayout: Erro ao obter sessão:", err);
            setIsInitialized(true); // tenta prosseguir mesmo com erro para não travar infinitamente
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            console.log("RootLayout: AuthState changed:", _event);
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    // ── 2. Verifica o Perfil e Liga o DeviceEventEmitter 
    useEffect(() => {
        if (!isInitialized) return; // Aguarda a checagem da sessão terminar

        if (!session) {
            setProfileComplete(false);
            return;
        }

        const checkProfileComplete = async () => {
            console.log("RootLayout: Verificando perfil para usuário:", session.user.id);
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('nome_usuario')
                .eq('id', session.user.id) // Certifique-se de que é 'id' e não 'user_id' aqui
                .maybeSingle();

            if (error && error.code !== 'PGRST116') console.error("RootLayout: Erro ao checar perfil:", error);
            console.log("RootLayout: Perfil encontrado:", profile ? profile.nome_usuario : "Nenhum");
            setProfileComplete(!!profile?.nome_usuario);
        };

        checkProfileComplete();

        // O Passe Livre instantâneo sem ir no banco de novo!
        const subscription = DeviceEventEmitter.addListener('profileReady', () => {
            setProfileComplete(true);
        });

        return () => subscription.remove();
    }, [session, isInitialized]);

    //Verifica se o usuario tem um grupo
    useEffect(() => {
        if (!isInitialized) return; // Aguarda a checagem da sessão terminar

        if (!session) {
            setIsMember(false);
            return;
        }

        const checkGroup = async () => {
            const { data: member } = await supabase
                .from('membros')
                .select('id')
                .eq('user_id', session?.user?.id)
                .limit(1)
                .maybeSingle();

            setIsMember(!!member);
            console.log("Member: ", member);

            // Se for membro, tenta carregar o último grupo visitado
            if (member) {
                // Tenta achar o grupo ANTES de avisar o Guarda
                const lastGroupId = await loadLastGroupLocally();
                let paramsToSave = null; // Presume null por padrão
                if (lastGroupId) {
                    const groupInfo = await fetchGroupById(lastGroupId);
                    if (groupInfo) {
                        paramsToSave = ({
                            groupId: groupInfo.id,
                            groupName: groupInfo.nome_grupo,
                            groupPhoto: groupInfo.foto_grupo
                        });
                    }
                }
                // Atualiza os states SEMPRE, mesmo sem lastGroupId salvo
                setLastGroupParams(paramsToSave);
                setIsMember(true); // Só agora que o Guarda pode ver que ele tem grupo
            } else {
                setLastGroupParams(undefined);
            }
        };

        checkGroup();
    }, [session, isInitialized]);

    //O Guarda 
    useEffect(() => {
        // --- 🚨 MODO DE TESTE (TESTAR SEM BACKEND) 🚨 ---
        // Desativado para o Commit no Github - App volta ao normal!
        /* 
        if (isInitialized) {
            if (segments[0] !== '(tabs)' && segments[0] !== '(modals)') {
                router.replace('/(tabs)/profile'); 
            }
            setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 200);
            return;
        }
        */
        // -----------------------------------------------

        // Log para depuração de onde o app está travando
        console.log("RootLayout Guard Check:", {
            isInitialized,
            profileComplete,
            isMember,
            hasLastGroupParams: lastGroupParams !== undefined,
            isMemberTrue: isMember === true
        });

        // O app só faz algo se já inicializou e se já checou o perfil e grupo. Além disso, ele precisa obrigatoriamente verificar os grupos salvos localmente no asyncStorage
        if (!isInitialized || profileComplete === null || isMember === null || (isMember === true && lastGroupParams === undefined)) {
            console.log("RootLayout: Aguardando inicialização completa...");
            return;
        }

        let destinationHandled = false;
        const inAuthGroup = segments[0] === '(auth)';
        const isProfileScreen = segments.includes('onboarding-profile');
        const isVerifyEmailScreen = segments.includes('verify-email');

        const isEmailVerified = !!session?.user?.email_confirmed_at;

        if (!session) {
            // Sem sessão → Welcome
            if (!inAuthGroup) {
                router.replace('/(auth)/onboarding-welcome');
            }
            destinationHandled = true;
        } else if (!isEmailVerified) {
            // Com sessão, mas sem e-mail confirmado → Verify Email (MUDANÇA 4)
            if (!isVerifyEmailScreen) {
                router.replace('/(auth)/verify-email');
            }
            destinationHandled = true;
        } else if (!profileComplete) {
            // E-mail OK, mas sem perfil → Onboarding Profile
            if (!isProfileScreen) {
                router.replace('/(auth)/onboarding-profile');
            }
            destinationHandled = true;
        } else if (!isMember) {
            // Se não tem grupo → No Group
            if (inAuthGroup) {
                router.replace('/(groups)/no-group');
            }
            destinationHandled = true;
        } else {
            // Cuida do caso de o usuário não entrar em alguma tela do grupo (auth)
            const inIndex = segments[0] === 'index' || !segments.length;

            if (inAuthGroup || inIndex) {
                if (lastGroupParams) {
                    router.replace({ pathname: '/(tabs)', params: lastGroupParams });
                } else {
                    router.replace('/(groups)');
                }
            }
            destinationHandled = true;
        }

        if (destinationHandled) {
            // Dá um tempo bem pequeno para o router fazer o replace das telas antes de sumir o splash
            setTimeout(() => {
                SplashScreen.hideAsync().catch(() => { });
            }, 200);
        }

    }, [session, isInitialized, profileComplete, segments, isMember, lastGroupParams]);

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