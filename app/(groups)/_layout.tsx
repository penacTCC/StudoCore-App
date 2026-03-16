import { Stack } from "expo-router";

export default function GroupsLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "#020617" },
                animation: "slide_from_right",
            }}
        >
            <Stack.Screen name="browse-groups" />
            <Stack.Screen name="group-details" />
            <Stack.Screen name="cronogram" />
            <Stack.Screen name="detailing" />
        </Stack>
    );
}
