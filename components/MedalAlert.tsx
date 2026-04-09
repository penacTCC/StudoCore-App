import { useState, useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, DeviceEventEmitter, Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BookOpen, Flame, Star, Trophy, X } from 'lucide-react-native';
import { COLORS } from '@/constants/colors';
import { BadgeType } from '@/constants/badges';
import type { LucideIcon } from 'lucide-react-native';

const iconMap: Record<string, LucideIcon> = {
    BookOpen, Flame, Star, Trophy
};

export default function MedalAlert() {
    const [queue, setQueue] = useState<BadgeType[]>([]);
    const [currentBadge, setCurrentBadge] = useState<BadgeType | null>(null);
    const translateY = useRef(new Animated.Value(-150)).current;

    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('badgesUnlocked', (newBadges: BadgeType[]) => {
            setQueue(prev => [...prev, ...newBadges]);
        });
        return () => subscription.remove();
    }, []);

    useEffect(() => {
        if (queue.length > 0 && !currentBadge) {
            const nextBadge = queue[0];
            setCurrentBadge(nextBadge);
            
            // Check vibration preference
            AsyncStorage.getItem('@app_preferences_vibration').then((pref) => {
                const wantsVibration = pref !== 'false'; // missing means true by default
                if (wantsVibration) {
                    // Dopamine hit: pattern vibrate!
                    Vibration.vibrate([0, 100, 50, 200]);
                }
            });
            
            // Animação de entrada
            Animated.spring(translateY, {
                toValue: 20,
                friction: 6,
                tension: 40,
                useNativeDriver: true,
            }).start();

            // Auto esconder após 4 segundos e girar a fila
            setTimeout(() => {
                Animated.timing(translateY, {
                    toValue: -150,
                    duration: 300,
                    useNativeDriver: true,
                }).start(() => {
                    setCurrentBadge(null);
                    setQueue(prev => prev.slice(1));
                });
            }, 4000);
        }
    }, [queue, currentBadge]);

    if (!currentBadge) return null;

    const BadgeIcon = iconMap[currentBadge.icon] || Star;

    return (
        <Animated.View 
            style={[
                styles.container,
                { transform: [{ translateY }] }
            ]}
        >
            <View className="flex-row items-center bg-slate-900 border border-emerald-500 rounded-2xl p-4 shadow-xl shadow-emerald-500/20 w-11/12">
                <View className="w-12 h-12 rounded-full bg-emerald-500/20 items-center justify-center mr-4">
                    <BadgeIcon size={24} color={COLORS.emerald} />
                </View>
                <View className="flex-1">
                    <Text className="text-xs text-emerald-400 font-bold uppercase tracking-wider mb-0.5">
                        Nova Medalha Desbloqueada!
                    </Text>
                    <Text className="text-lg font-bold text-white mb-0.5">
                        {currentBadge.name}
                    </Text>
                    <Text className="text-sm text-slate-300">
                        {currentBadge.description}
                    </Text>
                </View>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 40,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 9999,
        elevation: 100,
    }
});
