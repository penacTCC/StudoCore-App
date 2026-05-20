import React, { useRef } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { X, Share2 } from "lucide-react-native";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";

export default function ShareWeeklyProgress() {
    const router = useRouter();
    const { hours, streak } = useLocalSearchParams<{ hours: string, streak: string }>();
    const viewShotRef = useRef<any>(null);

    async function handleShare() {
        const uri = await viewShotRef.current?.capture?.();
        if (!uri) return;
        await Sharing.shareAsync(uri);
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.closeButton}
                >
                    <X size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            <View style={styles.content}>
                <ViewShot
                    ref={viewShotRef}
                    options={{
                        format: "png",
                        quality: 1,
                    }}
                >
                    <View style={styles.card}>
                        <Text style={styles.cardHeader}>STUDOCORE</Text>
                        <Text style={styles.title}>
                            Resumo da Semana
                        </Text>

                        <View style={styles.statsContainer}>
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>Tempo de Foco</Text>
                                <Text style={styles.hours}>{hours || "0h"}</Text>
                            </View>
                            
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>Ofensiva</Text>
                                <Text style={styles.streak}>🔥 {streak || "0 dias"}</Text>
                            </View>
                        </View>
                        
                        <View style={styles.footer}>
                            <Text style={styles.footerText}>Acompanhando meu progresso no StudoCore</Text>
                        </View>
                    </View>
                </ViewShot>

                <TouchableOpacity
                    style={styles.shareButton}
                    onPress={handleShare}
                >
                    <Share2 size={20} color="#fff" />
                    <Text style={styles.shareButtonText}>
                        Compartilhar Imagem
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#020617",
    },
    header: {
        padding: 16,
        alignItems: "flex-end",
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "rgba(255,255,255,0.1)",
        justifyContent: "center",
        alignItems: "center",
    },
    content: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingBottom: 40,
    },
    card: {
        width: 320,
        height: 480,
        backgroundColor: "#1e293b",
        borderRadius: 30,
        padding: 32,
        alignItems: "center",
        justifyContent: "space-between",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
    },
    cardHeader: {
        color: "#8b5cf6",
        fontWeight: "900",
        letterSpacing: 2,
        fontSize: 14,
    },
    title: {
        fontSize: 28,
        fontWeight: "800",
        color: "#f8fafc",
        textAlign: "center",
    },
    statsContainer: {
        alignItems: "center",
        gap: 20,
    },
    statItem: {
        alignItems: "center",
    },
    statLabel: {
        color: "#94a3b8",
        fontSize: 14,
        marginBottom: 4,
    },
    hours: {
        fontSize: 42,
        fontWeight: "900",
        color: "#f97316",
    },
    streak: {
        fontSize: 24,
        fontWeight: "700",
        color: "#f8fafc",
    },
    footer: {
        marginTop: 20,
    },
    footerText: {
        color: "#64748b",
        fontSize: 12,
        textAlign: "center",
    },
    shareButton: {
        marginTop: 32,
        backgroundColor: "#7c3aed",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 32,
        paddingVertical: 16,
        borderRadius: 20,
        shadowColor: "#7c3aed",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    shareButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "bold",
    },
});