import { useEffect } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";

export default function ShareSession() {
    const router = useRouter();

    useEffect(() => {
        router.back();
    }, [router]);

    return <View />;
}
