import { useRef, useEffect, useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    StatusBar,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Share2, Check, Flame, Trophy } from "lucide-react-native";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { useAuth } from "@/hooks/useAuth";
import { buscarPerfil } from "@/services/auth";
import { SubjectItem } from "@/types/share";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const ORANGE = "#F7982C";
const BG_DARK = "#0F1724";
const BG_CARD = "#182234";
const GRID_LINE = "rgba(255,255,255,0.04)";
const TEXT_MUTED = "rgba(255,255,255,0.45)";
const BORDER_SUBTLE = "rgba(255,255,255,0.08)";

export default function ShareWeeklyProgress() {
    const router = useRouter();
    const {
        totalMinutes: totalMinutesParam,
        sequencia: sequenciaParam,
        diasEstaSemana: diasParam,
        distribuicao: distribuicaoParam,
    } = useLocalSearchParams<{
        hours: string;
        streak: string;
        totalMinutes: string;
        sequencia: string;
        diasEstaSemana: string;
        distribuicao: string;
    }>();

    const viewShotRef = useRef<any>(null);
    const { userId } = useAuth();
    const [userName, setUserName] = useState("Estudante");

    useEffect(() => {
        if (userId) {
            buscarPerfil(userId).then(({ data }) => {
                if (data?.nome_real) setUserName(data.nome_real);
                else if (data?.nome_usuario) setUserName(data.nome_usuario);
            });
        }
    }, [userId]);

    // Parse data
    const totalMinutes = parseInt(totalMinutesParam || "0", 10);
    const focusHours = Math.floor(totalMinutes / 60);
    const focusMins = totalMinutes % 60;
    const sequencia = parseInt(sequenciaParam || "0", 10);
    const diasAtivos = parseInt(diasParam || "0", 10);

    let subjects: SubjectItem[] = [];
    try {
        subjects = JSON.parse(distribuicaoParam || "[]");
    } catch { }

    // Format subject time as "Xh" + "YY" (minutes)
    const formatSubjectTime = (hrs: number) => {
        const h = Math.floor(hrs);
        const m = Math.round((hrs - h) * 60);
        return `${h}h${m.toString().padStart(2, "0")}`;
    };

    // Date range
    const now = new Date();
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);

    const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    const dateRange = `${startOfWeek.getDate()} - ${endOfWeek.getDate()} ${months[endOfWeek.getMonth()]} ${endOfWeek.getFullYear()}`;

    // 7-day activity (simplified: show diasAtivos active from left)
    const dayDashes = Array.from({ length: 7 }, (_, i) => i < diasAtivos);

    // Meta diária (percentage based on goal of 7 days)
    const metaDiaria = diasAtivos > 0 ? Math.min(Math.round((diasAtivos / 7) * 100), 100) : 0;

    async function handleShare() {
        try {
            const uri = await viewShotRef.current?.capture?.();
            if (!uri) return;

            const compartilhamentoDisponivel = await Sharing.isAvailableAsync();
            if (!compartilhamentoDisponivel) return;

            await Sharing.shareAsync(uri, {
                mimeType: "image/png",
                dialogTitle: "Compartilhar progresso semanal",
            });
        } catch (error: any) {
            console.log("Erro ao compartilhar:", error);
        }
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={BG_DARK} />

            {/* Top bar with share button */}
            <View style={styles.topBar}>
                <Text style={styles.topBarLabel}>Compartilhar semana</Text>
                <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
                    <Share2 size={18} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* ViewShot captures this entire card */}
            <ViewShot
                ref={viewShotRef}
                options={{ format: "png", quality: 1 }}
                style={styles.viewShotContainer}
            >
                <View style={styles.card}>
                    {/* Grid lines background */}
                    {Array.from({ length: 12 }).map((_, i) => (
                        <View
                            key={`h-${i}`}
                            style={[
                                styles.gridLineH,
                                { top: (i + 1) * (SCREEN_HEIGHT * 0.075) },
                            ]}
                        />
                    ))}
                    {Array.from({ length: 5 }).map((_, i) => (
                        <View
                            key={`v-${i}`}
                            style={[
                                styles.gridLineV,
                                { left: (i + 1) * (SCREEN_WIDTH * 0.2) },
                            ]}
                        />
                    ))}

                    {/* Orange glow top-left */}
                    <View style={styles.glowTopLeft} />

                    {/* ── HEADER: Logo + Date ── */}
                    <View style={styles.header}>
                        <View style={styles.logoRow}>
                            <View style={styles.logoIcon}>
                                <Text style={styles.logoEmoji}>📖</Text>
                            </View>
                            <Text style={styles.logoText}>
                                <Text style={{ fontWeight: "900", color: "#fff" }}>Studo</Text>
                                <Text style={{ fontWeight: "900", color: ORANGE }}>Core</Text>
                            </Text>
                        </View>
                        <Text style={styles.dateText}>{dateRange}</Text>
                    </View>

                    {/* ── USER INFO ── */}
                    <View style={styles.userRow}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarEmoji}>👤</Text>
                        </View>
                        <Text style={styles.userName}>{userName}</Text>
                    </View>

                    {/* ── FOCUS TIME ── */}
                    <View style={styles.focusSection}>
                        <Text style={styles.focusLabel}>TEMPO DE FOCO</Text>
                        <View style={styles.focusTimeRow}>
                            <Text style={styles.focusTimeHuge}>
                                {focusHours}h{focusMins.toString().padStart(2, "0")}
                            </Text>
                            <Text style={styles.focusTimeMin}>min</Text>
                        </View>

                        {/* 7-day dash indicator */}
                        <View style={styles.dashRow}>
                            {dayDashes.map((active, i) => (
                                <View
                                    key={i}
                                    style={[
                                        styles.dash,
                                        { backgroundColor: active ? ORANGE : "rgba(255,255,255,0.15)" },
                                    ]}
                                />
                            ))}
                        </View>
                    </View>

                    {/* ── SUBJECT BREAKDOWN ── */}
                    <View style={styles.subjectList}>
                        {subjects.length > 0 ? (
                            subjects.slice(0, 3).map((item, index) => (
                                <View key={index} style={styles.subjectCard}>
                                    <View style={styles.subjectLeft}>
                                        <View style={styles.checkIcon}>
                                            <Check size={18} color={ORANGE} strokeWidth={3} />
                                        </View>
                                        <Text style={styles.subjectName}>{item.subject}</Text>
                                    </View>
                                    <Text style={styles.subjectTime}>
                                        {formatSubjectTime(item.hours)}
                                    </Text>
                                </View>
                            ))
                        ) : (
                            <View style={styles.subjectCard}>
                                <View style={styles.subjectLeft}>
                                    <View style={styles.checkIcon}>
                                        <Check size={18} color={ORANGE} strokeWidth={3} />
                                    </View>
                                    <Text style={styles.subjectName}>Sem registros</Text>
                                </View>
                                <Text style={styles.subjectTime}>0h00</Text>
                            </View>
                        )}
                    </View>

                    {/* ── BOTTOM STATS + BADGES ── */}
                    <View style={styles.bottomSection}>
                        <View style={styles.bottomLeft}>
                            <View style={styles.statBlock}>
                                <Text style={styles.statBlockLabel}>SEQUÊNCIA</Text>
                                <Text style={styles.statBlockValue}>{sequencia}</Text>
                                <Text style={styles.statBlockUnit}>dias</Text>
                            </View>
                            <View style={styles.statBlock}>
                                <Text style={styles.statBlockLabel}>META DIÁRIA</Text>
                                <Text style={styles.statBlockValue}>{metaDiaria}</Text>
                                <Text style={styles.statBlockUnit}>%</Text>
                            </View>
                        </View>
                        <View style={styles.bottomRight}>
                            {sequencia >= 3 && (
                                <View style={styles.badge}>
                                    <Flame size={14} color={ORANGE} />
                                    <Text style={styles.badgeText}>Em chamas</Text>
                                </View>
                            )}
                            {diasAtivos >= 5 && (
                                <View style={styles.badge}>
                                    <Trophy size={14} color={ORANGE} />
                                    <Text style={styles.badgeText}>Ótima semana</Text>
                                </View>
                            )}
                            {sequencia < 3 && diasAtivos < 5 && (
                                <View style={styles.badge}>
                                    <Flame size={14} color={ORANGE} />
                                    <Text style={styles.badgeText}>Continue assim!</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </ViewShot>

            {/* Bottom share button */}
            <TouchableOpacity
                style={styles.shareButton}
                onPress={handleShare}
                activeOpacity={0.8}
            >
                <Share2 size={20} color="#fff" />
                <Text style={styles.shareButtonText}>Compartilhar Progresso</Text>
            </TouchableOpacity>

            {/* Back button */}
            <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
                activeOpacity={0.7}
            >
                <Text style={styles.backButtonText}>Voltar</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: BG_DARK,
        alignItems: "center",
        justifyContent: "center",
    },
    topBar: {
        position: "absolute",
        top: 40,
        left: 20,
        right: 20,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        zIndex: 20,
    },
    topBarLabel: {
        color: TEXT_MUTED,
        fontSize: 13,
        fontWeight: "500",
    },
    shareBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "rgba(255,255,255,0.08)",
        justifyContent: "center",
        alignItems: "center",
    },
    viewShotContainer: {
        width: SCREEN_WIDTH,
        flex: 1,
        marginTop: 70,
        marginBottom: 120,
    },
    card: {
        flex: 1,
        backgroundColor: BG_DARK,
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 24,
        overflow: "hidden",
        justifyContent: "space-between",
    },
    // Grid background
    gridLineH: {
        position: "absolute",
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: GRID_LINE,
    },
    gridLineV: {
        position: "absolute",
        top: 0,
        bottom: 0,
        width: 1,
        backgroundColor: GRID_LINE,
    },
    glowTopLeft: {
        position: "absolute",
        top: -60,
        left: -60,
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: "rgba(247, 152, 44, 0.08)",
    },

    // Header
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    logoRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    logoIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: ORANGE,
        justifyContent: "center",
        alignItems: "center",
    },
    logoEmoji: {
        fontSize: 18,
    },
    logoText: {
        fontSize: 20,
        fontWeight: "900",
        color: "#fff",
    },
    dateText: {
        color: TEXT_MUTED,
        fontSize: 12,
        fontWeight: "500",
        backgroundColor: "rgba(255,255,255,0.06)",
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        overflow: "hidden",
    },

    // User
    userRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginBottom: 24,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: ORANGE,
        justifyContent: "center",
        alignItems: "center",
    },
    avatarEmoji: {
        fontSize: 20,
    },
    userName: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "700",
    },

    // Focus
    focusSection: {
        marginBottom: 20,
    },
    focusLabel: {
        color: ORANGE,
        fontSize: 13,
        fontWeight: "700",
        letterSpacing: 2,
        marginBottom: 4,
    },
    focusTimeRow: {
        flexDirection: "row",
        alignItems: "flex-end",
    },
    focusTimeHuge: {
        fontSize: 72,
        fontWeight: "900",
        color: "#fff",
        lineHeight: 80,
        letterSpacing: -2,
    },
    focusTimeMin: {
        fontSize: 28,
        fontWeight: "500",
        color: TEXT_MUTED,
        marginBottom: 8,
        marginLeft: 4,
    },
    dashRow: {
        flexDirection: "row",
        gap: 6,
        marginTop: 10,
    },
    dash: {
        flex: 1,
        height: 5,
        borderRadius: 3,
    },

    // Subjects
    subjectList: {
        gap: 10,
        marginBottom: 20,
    },
    subjectCard: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: BG_CARD,
        borderRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 18,
        borderWidth: 1,
        borderColor: BORDER_SUBTLE,
    },
    subjectLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    checkIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: "rgba(247, 152, 44, 0.12)",
        justifyContent: "center",
        alignItems: "center",
    },
    subjectName: {
        color: "rgba(255,255,255,0.8)",
        fontSize: 15,
        fontWeight: "500",
    },
    subjectTime: {
        color: "#fff",
        fontSize: 24,
        fontWeight: "800",
    },

    // Bottom
    bottomSection: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
    },
    bottomLeft: {
        flexDirection: "row",
        gap: 24,
    },
    statBlock: {},
    statBlockLabel: {
        color: ORANGE,
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 1.5,
        marginBottom: 2,
    },
    statBlockValue: {
        color: "#fff",
        fontSize: 32,
        fontWeight: "900",
        lineHeight: 36,
    },
    statBlockUnit: {
        color: TEXT_MUTED,
        fontSize: 12,
        fontWeight: "500",
    },
    bottomRight: {
        gap: 8,
        alignItems: "flex-end",
    },
    badge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "rgba(247, 152, 44, 0.12)",
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "rgba(247, 152, 44, 0.2)",
    },
    badgeText: {
        color: ORANGE,
        fontSize: 12,
        fontWeight: "700",
    },

    // Share button
    shareButton: {
        position: "absolute",
        bottom: 70,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        backgroundColor: ORANGE,
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 28,
        width: SCREEN_WIDTH * 0.8,
        maxWidth: 320,
    },
    shareButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "800",
    },

    // Back
    backButton: {
        position: "absolute",
        bottom: 30,
    },
    backButtonText: {
        color: TEXT_MUTED,
        fontSize: 14,
        fontWeight: "500",
    },
});
