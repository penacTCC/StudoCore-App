import { DeviceEventEmitter } from 'react-native';
import { APP_BADGES } from '../constants/badges';
import { supabase } from '@/supabase';
import { buscarUsuarioLogado } from '@/services/auth';
import AsyncStorage from "@react-native-async-storage/async-storage";

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

// Carrega as estatísticas fundindo profiles e query de agrupamento de study_sessions
export const loadProfileStats = async (): Promise<UserStats> => {
    try {
        const { data: authData } = await buscarUsuarioLogado();
        const userId = authData?.user?.id;
        
        if (!userId) return DEFAULT_STATS;

        // Fetch user profile stats
        const { data: profile } = await supabase
            .from('profiles')
            .select('horas_totais, questoes_feitas, badges_unlocked, favorite_subject, minutos_semana')
            .eq('id', userId)
            .maybeSingle();

        // Fetch study sessions for heatmap (last 100 days to cover 14 weeks)
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 100);

        const { data: sessions } = await supabase
            .from('sessoes_foco')
            .select('tempo_minutos, created_at, disciplina')
            .eq('user_id', userId)
            .gte('created_at', ninetyDaysAgo.toISOString());

        // Aggregate sessions into YYYY-MM-DD
        const studyHistory: Record<string, number> = {};
        let weeklyCurrent = 0;
        let exactLifetimeMinutes = 0;
        
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        if (sessions) {
            sessions.forEach(session => {
                const d = new Date(session.created_at);
                const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                
                // Transforma Minutos da Duração em Horas formatadas
                const hoursInSession = session.tempo_minutos / 60;
                studyHistory[dateStr] = (studyHistory[dateStr] || 0) + hoursInSession;
                exactLifetimeMinutes += session.tempo_minutos;

                if (d >= oneWeekAgo) {
                    weeklyCurrent += hoursInSession;
                }
            });
        }
        
        const exactLifetimeHours = Math.round((exactLifetimeMinutes / 60) * 10) / 10;

        // Removemos o cálculo dinâmico da matéria para que a escolha manual do Perfil seja soberana
        let calculatedFavorite = profile?.favorite_subject || "Matemática";

        return {
            totalHours: exactLifetimeHours,
            totalQuestions: profile?.questoes_feitas || 0,
            favoriteSubject: calculatedFavorite,
            badgesUnlocked: profile?.badges_unlocked || [],
            weeklyCurrent: Math.round(weeklyCurrent * 10) / 10,
            weeklyGoal: profile?.minutos_semana ? (profile.minutos_semana / 60) : 12, 
            studyHistory
        };
    } catch (e) {
        console.error('Erro ao ler estatísticas do Supabase:', e);
        return DEFAULT_STATS;
    }
};

// Salva a matéria selecionada no DB
export const updateFavoriteSubject = async (subject: string): Promise<UserStats> => {
    const { data: authData } = await buscarUsuarioLogado();
    const userId = authData?.user?.id;
    if (userId) {
        // Usa upsert para caso a linha não exista ainda (banco zerado)
        await supabase.from('profiles').upsert({ id: userId, favorite_subject: subject });
    }
    return await loadProfileStats();
};

// Salva a nova meta semanal
export const updateWeeklyGoal = async (hours: number): Promise<UserStats> => {
    const { data: authData } = await buscarUsuarioLogado();
    const userId = authData?.user?.id;
    if (userId) {
        const minSemana = Math.round(hours * 60);
        await supabase.from('profiles').upsert({ id: userId, minutos_semana: minSemana });
    }
    return await loadProfileStats();
};

// Atualiza o banco com horas reais e insere a sessao
export const addStudyHours = async (timerSeconds: number, currentSubject: string): Promise<UserStats | null> => {
    try {
        const { data: authData } = await buscarUsuarioLogado();
        const userId = authData?.user?.id;
        if (!userId) return null;

        const testPref = await AsyncStorage.getItem('@app_test_mode');
        const isTestMode = testPref === 'true';

        // O divisor define quanto tempo vale 1 hora. 
        // Em TestMode (ligado nas config), 10s cravados = 1 hora no DB
        // Em Prod, 3600 = 1 hora
        const divisor = isTestMode ? 10 : 3600;
        const calculatedHours = timerSeconds / divisor; 
        
        if (calculatedHours <= 0) return null;

        // Recuperar perfil pra ler dados atuais
        const current = await loadProfileStats();
        
        const newTotalHours = current.totalHours + calculatedHours;
        const newWeeklyCurrent = current.weeklyCurrent + calculatedHours;

        // Inserir a sessao histórica no Supabase
        await supabase.from('sessoes_foco').insert({
            user_id: userId,
            disciplina: currentSubject,
            tempo_minutos: Math.floor(calculatedHours * 60), // Infla o banco de acordo com a sua regra de teste (1h na ui = 60min no BD)
            questoes_respondidas: 0
        });

        // Verifica Medalhas
        const newBadges = [...current.badgesUnlocked];
        const newlyUnlocked: any[] = [];

        APP_BADGES.forEach(badge => {
            if (!newBadges.includes(badge.id)) {
                let unlocked = false;
                if (badge.id.startsWith("hours_") && newTotalHours >= badge.requirementValue) {
                    unlocked = true;
                } else if (badge.id === "weekly_goal" && newWeeklyCurrent >= current.weeklyGoal) {
                    unlocked = true;
                }

                if (unlocked) {
                    newBadges.push(badge.id);
                    newlyUnlocked.push(badge); 
                }
            }
        });

        const todayDateStr = new Date().toISOString();

        // Atualizar perfil do usuario (usando UPSERT para garantir gravação mesmo sem linha base)
        const { error: profileError } = await supabase.from('profiles').upsert({
             id: userId,
             horas_totais: Math.round(newTotalHours),
             badges_unlocked: newBadges,
             last_study_date: todayDateStr
        });

        if (profileError) {
            console.error("Erro Critico ao Salvar Badges e Horas:", profileError);
        }

        // Dispara alerta global se ganhou medalhas, jogando na fila
        if (newlyUnlocked.length > 0) {
            DeviceEventEmitter.emit('badgesUnlocked', newlyUnlocked);
        }

        // Recarrega atualizado
        return await loadProfileStats();
    } catch (e) {
        console.error('Erro salvar horas:', e);
        return null;
    }
};
