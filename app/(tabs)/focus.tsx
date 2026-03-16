import { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
    Play,
    Square,
    ToggleLeft,
    ToggleRight,
} from "lucide-react-native";
import { COLORS } from "@/constants/colors";
import { subjects } from "@/constants/mock-data";

type FocusState = "config" | "active";

export default function FocusScreen() {
    const [focusState, setFocusState] = useState<FocusState>("config");
    const [isPublicSession, setIsPublicSession] = useState(true);
    const [selectedSubject, setSelectedSubject] = useState("");
    const [specificContent, setSpecificContent] = useState("");
    const [timerSeconds, setTimerSeconds] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (focusState === "active") {
            intervalRef.current = setInterval(() => {
                setTimerSeconds((prev) => prev + 1);
            }, 1000);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [focusState]);

    const formatTime = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    const startSession = () => {
        setFocusState("active");
        setTimerSeconds(0);
    };

    const stopSession = () => {
        setFocusState("config");
        setTimerSeconds(0);
        if (intervalRef.current) clearInterval(intervalRef.current);
    };

    return (
        <SafeAreaView className="flex-1 bg-slate-950" edges={["top"]}>
            {/* Header */}
            <View className="bg-slate-950 border-b border-slate-800 px-4 py-3">
                <Text className="text-xl font-bold text-slate-200">Focus Mode</Text>
                <Text className="text-sm text-slate-400">Maximize your productivity</Text>
            </View>

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 32 }}
            >
                {focusState === "config" && (
                    <View className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                        <Text className="text-lg font-semibold text-slate-200 mb-6 text-center">
                            Configure Session
                        </Text>

                        {/* Subject Picker */}
                        <View className="mb-4">
                            <Text className="text-sm text-slate-400 mb-2">Subject</Text>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ gap: 8 }}
                            >
                                {subjects.map((subject) => (
                                    <TouchableOpacity
                                        key={subject}
                                        onPress={() => setSelectedSubject(subject === selectedSubject ? "" : subject)}
                                        className={`px-4 py-2.5 rounded-xl border ${selectedSubject === subject
                                                ? "bg-violet-600 border-violet-500"
                                                : "bg-slate-800 border-slate-700"
                                            }`}
                                    >
                                        <Text
                                            className={`text-sm font-medium ${selectedSubject === subject ? "text-white" : "text-slate-300"
                                                }`}
                                        >
                                            {subject}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        {/* Specific Content */}
                        <View className="mb-4">
                            <Text className="text-sm text-slate-400 mb-2">Specific Content</Text>
                            <TextInput
                                value={specificContent}
                                onChangeText={setSpecificContent}
                                placeholder="e.g., Chapter 5: Derivatives"
                                placeholderTextColor={COLORS.textMuted}
                                className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 text-base"
                            />
                        </View>

                        {/* Session Visibility Toggle */}
                        <View className="flex-row items-center justify-between bg-slate-800/50 p-4 rounded-xl mb-6">
                            <View>
                                <Text className="text-sm font-medium text-slate-200">Session Visibility</Text>
                                <Text className="text-xs text-slate-400">
                                    {isPublicSession ? "Others can join" : "Private session"}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setIsPublicSession(!isPublicSession)}>
                                {isPublicSession ? (
                                    <ToggleRight size={32} color={COLORS.violetLight} />
                                ) : (
                                    <ToggleLeft size={32} color={COLORS.textMuted} />
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Start Button */}
                        <TouchableOpacity
                            onPress={startSession}
                            className="bg-violet-600 py-4 rounded-2xl flex-row items-center justify-center gap-2"
                            style={{
                                shadowColor: COLORS.violet,
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.3,
                                shadowRadius: 12,
                                elevation: 8,
                            }}
                        >
                            <Play size={20} color={COLORS.white} />
                            <Text className="text-white font-semibold text-lg">Start Session</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {focusState === "active" && (
                    <View className="items-center justify-center">
                        {/* Subject info */}
                        <View className="mb-8 items-center">
                            <Text className="text-sm text-violet-400 font-medium mb-1">
                                {selectedSubject || "General Study"}
                            </Text>
                            <Text className="text-xs text-slate-500">
                                {specificContent || "Free session"}
                            </Text>
                        </View>

                        {/* Big Neon Clock */}
                        <View className="items-center justify-center mb-10">
                            <View
                                className="w-64 h-64 rounded-full items-center justify-center"
                                style={{
                                    backgroundColor: "rgba(15, 23, 42, 0.8)",
                                    borderWidth: 4,
                                    borderColor: "rgba(139, 92, 246, 0.5)",
                                    shadowColor: COLORS.violet,
                                    shadowOffset: { width: 0, height: 0 },
                                    shadowOpacity: 0.6,
                                    shadowRadius: 30,
                                    elevation: 15,
                                }}
                            >
                                <Text
                                    className="font-bold text-violet-400"
                                    style={{ fontSize: 42, letterSpacing: 2 }}
                                >
                                    {formatTime(timerSeconds)}
                                </Text>
                                <Text className="text-xs text-slate-500 mt-2 uppercase tracking-widest">
                                    Elapsed
                                </Text>
                            </View>
                        </View>

                        {/* Visibility Badge */}
                        <View className="flex-row items-center gap-2 mb-8">
                            <View
                                className={`w-2 h-2 rounded-full ${isPublicSession ? "bg-emerald-400" : "bg-slate-500"
                                    }`}
                            />
                            <Text className="text-sm text-slate-400">
                                {isPublicSession ? "Public Session" : "Private Session"}
                            </Text>
                        </View>

                        {/* Stop Button */}
                        <TouchableOpacity
                            onPress={stopSession}
                            className="bg-rose-500/20 border border-rose-500 py-4 px-12 rounded-2xl flex-row items-center justify-center gap-2"
                        >
                            <Square size={20} color={COLORS.rose} />
                            <Text className="text-rose-500 font-semibold text-lg">End Session</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
