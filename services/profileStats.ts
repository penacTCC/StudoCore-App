import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import { APP_BADGES } from '../constants/badges';

const STATS_KEY = '@user_profile_stats';

export interface UserStats {
  totalHours: number;
  totalQuestions: number;
  favoriteSubject: string;
  weeklyCurrent: number;
  weeklyGoal: number;
  studyHistory: Record<string, number>; // Record<"YYYY-MM-DD", hours>
  badgesUnlocked: string[];
}

const DEFAULT_STATS: UserStats = {
  totalHours: 0,
  totalQuestions: 0,
  favoriteSubject: "Matemática",
  weeklyCurrent: 0,
  weeklyGoal: 12,
  studyHistory: {},
  badgesUnlocked: [],
};

export const loadProfileStats = async (): Promise<UserStats> => {
  try {
    const data = await AsyncStorage.getItem(STATS_KEY);
    if (data) {
        // Preenche novas chaves caso o modelo antigo não as tenha
      return { ...DEFAULT_STATS, ...JSON.parse(data) };
    }
    await saveProfileStats(DEFAULT_STATS);
    return DEFAULT_STATS;
  } catch (e) {
    console.error('Erro ao ler estatísticas do perfil:', e);
    return DEFAULT_STATS;
  }
};

export const saveProfileStats = async (stats: UserStats): Promise<void> => {
  try {
    await AsyncStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (e) {
    console.error('Erro ao salvar estatísticas do perfil:', e);
  }
};

export const updateFavoriteSubject = async (subject: string): Promise<UserStats> => {
  const current = await loadProfileStats();
  const updated = { ...current, favoriteSubject: subject };
  await saveProfileStats(updated);
  return updated;
};

const getTodayDateString = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

// Adiciona horas reais (usando matemática de testes: 5 sec = 1 hora se flagAtivada)
export const addStudyHours = async (timerSeconds: number): Promise<UserStats> => {
    const current = await loadProfileStats();
    
    // Matemática Real: Segundos transformados em Horas 
    // (Para testes rápidos de UI, use: const calculatedHours = timerSeconds / 5)
    const calculatedHours = timerSeconds / 3600;
    
    if (calculatedHours <= 0) return current; // Se foi muito rápido, ignora para não floodar
    
    const newTotalHours = current.totalHours + calculatedHours;
    const newWeeklyCurrent = current.weeklyCurrent + calculatedHours;

    // Atualiza HeatMap
    const today = getTodayDateString();
    const history = { ...current.studyHistory };
    history[today] = (history[today] || 0) + calculatedHours;

    // Verifica Medalhas
    const newBadges = [...current.badgesUnlocked];
    const newlyUnlocked: any[] = [];

    APP_BADGES.forEach(badge => {
        if (!newBadges.includes(badge.id)) {
            let unlocked = false;
            if (badge.id.startsWith("hours_") && newTotalHours >= badge.requirementValue) {
                unlocked = true;
            } else if (badge.id === "weekly_goal" && newWeeklyCurrent >= badge.requirementValue) {
                unlocked = true;
            }

            if (unlocked) {
                newBadges.push(badge.id);
                newlyUnlocked.push(badge); 
            }
        }
    });

    const updated: UserStats = { 
        ...current, 
        totalHours: newTotalHours,
        weeklyCurrent: newWeeklyCurrent,
        studyHistory: history,
        badgesUnlocked: newBadges
    };
    
    await saveProfileStats(updated);

    // Dispara alerta global se ganhou medalhas, jogando na fila
    if (newlyUnlocked.length > 0) {
        DeviceEventEmitter.emit('badgesUnlocked', newlyUnlocked);
    }

    return updated;
};
