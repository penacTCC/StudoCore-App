import { Stack } from "expo-router";

export default function AuthLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "#020617" },
                animation: "slide_from_right",
            }}
        >
            <Stack.Screen name="onboarding-welcome" />
            <Stack.Screen name="onboarding-profile" />
            <Stack.Screen name="login" />
            <Stack.Screen name="signup" />
        </Stack>
    );
}
