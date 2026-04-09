import { Stack } from "expo-router";

export default function ModalsLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="create-group" options={{ presentation: "modal" }} />
            <Stack.Screen name="invite" options={{ presentation: "modal" }} />
            <Stack.Screen name="join-session" options={{ presentation: "modal" }} />
            <Stack.Screen name="join-by-code" options={{ presentation: "modal" }} />
            <Stack.Screen name="badges" options={{ presentation: "modal" }} />
        </Stack>
    );
}
