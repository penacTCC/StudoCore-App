import { Stack } from "expo-router";

export default function ModalsLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="create-group" options={{ presentation: "modal" }} />
            <Stack.Screen name="invite" options={{ presentation: "modal" }} />
            <Stack.Screen name="session-preview" options={{ presentation: "modal" }} />
            <Stack.Screen name="join-by-code" options={{ presentation: "modal" }} />
            <Stack.Screen name="join" options={{ presentation: "modal" }} />
            <Stack.Screen name="badges" options={{ presentation: "modal" }} />
            <Stack.Screen name="ShareWeeklyProgress" options={{ presentation: "fullScreenModal" }} />
            <Stack.Screen name="criar-materia" options={{ presentation: "modal" }} />
            <Stack.Screen name="plano-editor" options={{ presentation: "modal" }} />
            <Stack.Screen name="plano-preview" options={{ presentation: "modal" }} />
            <Stack.Screen name="novo-bloco" options={{ presentation: "modal" }} />
            <Stack.Screen name="novo-bloco-plano" options={{ presentation: "modal" }} />
            <Stack.Screen name="editar-perfil" options={{ presentation: "modal" }} />
            <Stack.Screen name="detalhes-sessao" options={{ presentation: "card" }} />
            <Stack.Screen name="corrigir-anexo" options={{ presentation: "modal" }} />
            <Stack.Screen name="contas-bloqueadas" options={{ presentation: "card" }} />
            <Stack.Screen name="notificacoes" options={{ presentation: "card" }} />
        </Stack>
    );
}

