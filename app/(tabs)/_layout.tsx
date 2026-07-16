import { Tabs } from "expo-router";
import { Users, Timer, Brain, User, CalendarDays } from "lucide-react-native";
import { COLORS } from "@/constants/colors";

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: "#0f172a", // slate-950
                    borderTopColor: "#1e293b", // slate-800
                    borderTopWidth: 1,
                    height: 70,
                    paddingBottom: 10,
                    paddingTop: 8,
                },
                tabBarActiveTintColor: COLORS.primary,
                tabBarInactiveTintColor: COLORS.textMuted,
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: "600",
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: "Grupos",
                    tabBarIcon: ({ color, size }) => (
                        <Users size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="schedule"
                options={{
                    title: "Cronograma",
                    tabBarIcon: ({ color, size }) => (
                        <CalendarDays size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="focus"
                options={{
                    title: "Foco",
                    tabBarIcon: ({ color, size }) => (
                        <Timer size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="brain"
                options={{
                    title: "Análise",
                    tabBarIcon: ({ color, size }) => (
                        <Brain size={size} color={color} />
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
                    tabBarIcon: ({ color, size }) => (
                        <User size={size} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}
