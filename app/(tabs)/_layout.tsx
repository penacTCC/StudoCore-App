import { Text } from "react-native";
import { Tabs } from "expo-router";
import { HADES } from "@/constants/hades";
import BadgeContagem from "@/components/ui/BadgeContagem";
import BotaoAba from "@/components/ui/BotaoAba";
import IconeAba from "@/components/ui/IconeAba";
import { useAuth } from "@/hooks/useAuth";
import { useFormulariosPendentes } from "@/hooks/useFormulariosPendentes";

// Cinza/branco no lugar do laranja: a aba ativa se destaca pelo ícone preenchido
// e pelo texto branco, como no Spotify.
const ATIVO = "#ffffff";
const INATIVO = "#a0a3aa";

export default function TabLayout() {
    const { userId } = useAuth();
    // Formulários de sessão em aberto viram um badge no ícone do Análise, que é a aba
    // onde eles são respondidos.
    const formulariosPendentes = useFormulariosPendentes(userId);

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: HADES.bg,
                    borderTopColor: HADES.border,
                    borderTopWidth: 1,
                    height: 78,
                    paddingTop: 11,
                    paddingBottom: 12,
                },
                tabBarActiveTintColor: ATIVO,
                tabBarInactiveTintColor: INATIVO,
                tabBarButton: (props) => <BotaoAba {...props} />,
                tabBarLabel: ({ focused, color, children }) => (
                    <Text
                        numberOfLines={1}
                        style={{
                            fontSize: 10.5,
                            fontWeight: focused ? "700" : "500",
                            color,
                            includeFontPadding: false,
                        }}
                    >
                        {children}
                    </Text>
                ),
                tabBarIconStyle: {
                    marginBottom: 5,
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: "Comunidade",
                    tabBarIcon: ({ color, focused }) => (
                        <IconeAba nome="grupos" color={color} focused={focused} />
                    ),
                }}
            />
            <Tabs.Screen
                name="schedule"
                options={{
                    title: "Cronograma",
                    tabBarIcon: ({ color, focused }) => (
                        <IconeAba nome="cronograma" color={color} focused={focused} />
                    ),
                }}
            />
            <Tabs.Screen
                name="focus"
                options={{
                    title: "Foco",
                    tabBarIcon: ({ color, focused }) => (
                        <IconeAba nome="foco" color={color} focused={focused} />
                    ),
                }}
            />
            <Tabs.Screen
                name="brain"
                options={{
                    title: "Análise",
                    tabBarIcon: ({ color, focused }) => (
                        <BadgeContagem contagem={formulariosPendentes}>
                            <IconeAba nome="analise" color={color} focused={focused} />
                        </BadgeContagem>
                    ),
                }}
            />
            {/* O Vault saiu da tab bar, mas a rota continua: é alcançado pelo header
                da Home e pelo aviso de materiais antes de iniciar o foco. */}
            <Tabs.Screen name="vault" options={{ href: null }} />
            <Tabs.Screen
                name="profile"
                options={{
                    title: "Perfil",
                    tabBarIcon: ({ color, focused }) => (
                        <IconeAba nome="perfil" color={color} focused={focused} />
                    ),
                }}
            />
        </Tabs>
    );
}
