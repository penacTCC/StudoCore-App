import { Tabs } from "expo-router";
import { Users, Timer, Brain, FolderArchive, User } from "lucide-react-native";
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
                    title: "Group",
                    tabBarIcon: ({ color, size }) => (
                        <Users size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="focus"
                options={{
                    title: "Focus",
                    tabBarIcon: ({ color, size }) => (
                        <Timer size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="brain"
                options={{
                    title: "Brain",
                    tabBarIcon: ({ color, size }) => (
                        <Brain size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="vault"
                options={{
                    title: "Vault",
                    tabBarIcon: ({ color, size }) => (
                        <FolderArchive size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: "Profile",
                    tabBarIcon: ({ color, size }) => (
                        <User size={size} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}
