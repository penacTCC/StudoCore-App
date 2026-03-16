import "../global.css";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { DeviceEventEmitter, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { supabase } from "./supabase";
import { useState, useEffect } from "react";

export default function RootLayout() {
    const [isInitialized, setIsInitialized] = useState(false);
    const [session, setSession] = useState<any>(null);
    const [isMember, setIsMember] = useState<boolean | null>(null);

    // MUDANÇA 1: Começa como null para indicar que está carregando
    const [profileComplete, setProfileComplete] = useState<boolean | null>(null);

    const router = useRouter();
    const segments = useSegments();

    // ── 1. Inicializa a Sessão 
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setIsInitialized(true); //só inicia o app se pegar a sessão
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    // ── 2. Verifica o Perfil e Liga o DeviceEventEmitter 
    useEffect(() => {
        if (!session) {
            setProfileComplete(false);
            return;
        }

        const checkProfileComplete = async () => {
            const { data: profile } = await supabase
                .from('profiles')
                .select('nome_usuario')
                .eq('id', session.user.id) // Certifique-se de que é 'id' e não 'user_id' aqui
                .single();

            setProfileComplete(!!profile?.nome_usuario);
        };

        checkProfileComplete();

        // O Passe Livre instantâneo sem ir no banco de novo!
        const subscription = DeviceEventEmitter.addListener('profileReady', () => {
            setProfileComplete(true);
        });

        return () => subscription.remove();
    }, [session]);

    //Verifica se o usuario tem um grupo
    useEffect(() => {
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
        };

        checkGroup();
    }, [session]);

    // ── 3. O Guarda de Trânsito
    useEffect(() => {
        // O app SÓ TOMA DECISÃO se já inicializou e se já checou o perfil (!== null) e grupo
        if (!isInitialized || profileComplete === null || isMember === null) return;

        const inAuthGroup = segments[0] === '(auth)';
        const isProfileScreen = segments.includes('onboarding-profile');
        const isVerifyEmailScreen = segments.includes('verify-email');

        const isEmailVerified = !!session?.user?.email_confirmed_at;

        if (!session) {
            // Sem sessão → Welcome
            if (!inAuthGroup) {
                router.replace('/(auth)/onboarding-welcome');
            }
        } else if (!isEmailVerified) {
            // Com sessão, mas sem e-mail confirmado → Verify Email (MUDANÇA 4)
            if (!isVerifyEmailScreen) {
                router.replace('/(auth)/verify-email');
            }
        } else if (!profileComplete) {
            // E-mail OK, mas sem perfil → Onboarding Profile
            if (!isProfileScreen) {
                router.replace('/(auth)/onboarding-profile');
            }
        } else if (!isMember) {
            // Se não tem grupo → No Group
            if (inAuthGroup) {
                router.replace('/(groups)/no-group');
            }
        } else {
            // Tudo perfeito → Vai para o App (My Groups)
            if (inAuthGroup) {
                router.replace('/(groups)');
            }
        }

    }, [session, isInitialized, profileComplete, segments, isMember]);

    return (
        <SafeAreaProvider>
            <View className="flex-1 bg-slate-950">
                <StatusBar style="light" />
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