import { Tabs } from "expo-router";
import { Users, Timer, Brain, User, CalendarDays } from "lucide-react-native";
import { HADES } from "@/constants/hades";

export default function TabLayout() {
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
                tabBarActiveTintColor: HADES.accentSolid,
                tabBarInactiveTintColor: HADES.textFaint,
                tabBarLabelStyle: {
                    fontSize: 10.5,
                    fontWeight: "600",
                },
                tabBarIconStyle: {
                    marginBottom: 5,
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: "Grupos",
                    tabBarIcon: ({ color }) => (
                        <Users size={22} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="schedule"
                options={{
                    title: "Cronograma",
                    tabBarIcon: ({ color }) => (
                        <CalendarDays size={22} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="focus"
                options={{
                    title: "Foco",
                    tabBarIcon: ({ color }) => (
                        <Timer size={22} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="brain"
                options={{
                    title: "Análise",
                    tabBarIcon: ({ color }) => (
                        <Brain size={22} color={color} />
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
                    tabBarIcon: ({ color }) => (
                        <User size={22} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}
