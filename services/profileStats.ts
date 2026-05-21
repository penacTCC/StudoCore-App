import { DeviceEventEmitter } from 'react-native';
import { APP_BADGES } from '../constants/badges';
import { supabase } from '@/lib/supabase';
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
    totalSessions: number;
}

const DEFAULT_STATS: UserStats = {
    totalHours: 0,
    totalQuestions: 0,
    favoriteSubject: "Matemática",
    weeklyCurrent: 0,
    weeklyGoal: 12,
    studyHistory: {},
    badgesUnlocked: [],
    totalSessions: 0,
};

/**
 * @function loadProfileStats
 * @description Carrega e processa estatísticas baseando-se na tabela perfil mestre e agrega as `sessoes_foco` 
 * num dicionário (Record) que mapeia "YYYY-MM-DD" -> horas, providenciando os pilares de UI do Heatmap.
 * @returns {Promise<UserStats>} Objeto unificado com as estatísticas em tempo real formatado para o React.
 */
export const loadProfileStats = async (): Promise<UserStats> => {
    try {
        const { data: authData } = await buscarUsuarioLogado();
        const userId = authData?.user?.id;

        if (!userId) return DEFAULT_STATS;

        // Fetch user profile stats
        const { data: profile } = await supabase
            .from('profiles')
            .select('horas_totais, questoes_feitas, medalhas_desbloqueadas, materia_favorita, minutos_semana')
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
        let calculatedFavorite = profile?.materia_favorita || "Matemática";

        // Fetch total session count for badges
        const { count: totalSessions } = await supabase
            .from('sessoes_foco')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        // Fix Definitivo de Badges: Força Parse Seguro vindo do banco. Evita colapsos de String JSON vs Array Nativos PostgreSQL
        let parsedBadges: string[] = [];
        try {
            if (Array.isArray(profile?.medalhas_desbloqueadas)) {
                parsedBadges = profile.medalhas_desbloqueadas;
            } else if (typeof profile?.medalhas_desbloqueadas === "string") {
                parsedBadges = JSON.parse(profile.medalhas_desbloqueadas);
            }
        } catch(e) {
            console.warn("Aviso: Parse do medalhas_desbloqueadas falhou. Resetando vetor.", e);
        }

        return {
            totalHours: exactLifetimeHours,
            totalQuestions: profile?.questoes_feitas || 0,
            favoriteSubject: calculatedFavorite,
            badgesUnlocked: profile?.medalhas_desbloqueadas || [],
            weeklyCurrent: Math.round(weeklyCurrent * 10) / 10,
            weeklyGoal: profile?.minutos_semana ? (profile.minutos_semana / 60) : 12,
            studyHistory,
            totalSessions: totalSessions || 0,
        };
    } catch (e) {
        console.error('Erro ao ler estatísticas do Supabase:', e);
        return DEFAULT_STATS;
    }
};

/**
 * Atualiza instantâneamente a matéria favorita no banco de dados.
 * (Usando lógica agressiva Upsert para evitar fallbacks).
 */
export const updateFavoriteSubject = async (subject: string): Promise<UserStats> => {
    const { data: authData } = await buscarUsuarioLogado();
    const userId = authData?.user?.id;
    if (userId) {
        await supabase.from('profiles').update({ materia_favorita: subject }).eq('id', userId);
    }
    return await loadProfileStats();
};

/**
 * Modifica e persiste a meta semanal individual baseada em horas.
 */
export const updateWeeklyGoal = async (hours: number): Promise<UserStats> => {
    const { data: authData } = await buscarUsuarioLogado();
    const userId = authData?.user?.id;
    if (userId) {
        const minSemana = Math.round(hours * 60);
        await supabase.from('profiles').update({ minutos_semana: minSemana }).eq('id', userId);
    }
    return await loadProfileStats();
};

/**
 * Motor central de Registro de Estudo.
 * Disparado pelo temporizador de Focus. Transcreve o tempo gasto em minutos reais para a tabela `sessoes_foco`,
 * agrupa o ganho somado na tabela `profiles` de horas totais, processa checagem de destrancamento de medalha virtual
 * e coordena emissores globais pro UI Alert e repintura de Tela.
 * @param timerSeconds Total absoluto cronometrado.
 * @param currentSubject Label da matéria estudada
 */
export const addStudyHours = async (timerSeconds: number, currentSubject: string): Promise<{ stats: UserStats, sessionId?: string } | null> => {
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

        // OBS: O insert na sessoes_foco é feito exclusivamente pelo focus-feedback.tsx
        // para evitar duplicatas. Aqui só atualizamos o profile (horas e badges).

        // Total de sessões do usuário (para badges de sessão)
        const { count: totalSessions } = await supabase
            .from('sessoes_foco')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        // Verifica Medalhas e usa Sets (conjuntos únicos) para estourar o Bug de repetidos de uma vez por todas
        const newBadgesSet = new Set(current.badgesUnlocked);
        const newlyUnlocked: any[] = [];

        APP_BADGES.forEach(badge => {
            if (!newBadgesSet.has(badge.id)) {
                let unlocked = false;
                switch (badge.requirementType) {
                    case 'hours':
                        unlocked = newTotalHours >= badge.requirementValue;
                        break;
                    case 'questions':
                        unlocked = (current.totalQuestions) >= badge.requirementValue;
                        break;
                    case 'weekly_goal':
                        unlocked = newWeeklyCurrent >= current.weeklyGoal;
                        break;
                    case 'sessions':
                        unlocked = (totalSessions || 0) >= badge.requirementValue;
                        break;
                }

                if (unlocked) {
                    newBadgesSet.add(badge.id); // Tranca instantaneamente a ref em memória do Set (Garante bloqueio proximo loop ou chamada reativa)
                    newlyUnlocked.push(badge); 
                }
            }
        });
        
        const newBadgesArray = Array.from(newBadgesSet);
        const todayDateStr = new Date().toISOString();

        // UPDATE (não upsert!) para nunca tentar criar linha nova sem os campos NOT NULL (nome_real, etc.)
        const { error: profileError } = await supabase.from('profiles').update({
             horas_totais: Math.round(newTotalHours),
             medalhas_desbloqueadas: newBadgesArray, // Transição Array puro pro Postgres serializar JSONB
             ultima_data_estudo: todayDateStr
        }).eq('id', userId);

        if (profileError) {
            console.error("Erro Critico ao Salvar Badges e Horas:", profileError);
        }

        // Dispara alerta global se ganhou medalhas, jogando na fila
        if (newlyUnlocked.length > 0) {
            DeviceEventEmitter.emit('badgesUnlocked', newlyUnlocked);
        }

        // Recarrega atualizado
        return { 
            stats: await loadProfileStats(), 
            sessionId: undefined 
        };
    } catch (e) {
        console.error('Erro salvar horas:', e);
        return null;
    }
};

/**
 * Adiciona as questões respondidas ao perfil, verifica as medalhas de questões
 * e emite os alertas necessários.
 * @param questionsCount Quantidade de questões respondidas no quiz
 */
export const addStudyQuestions = async (questionsCount: number): Promise<UserStats | null> => {
    try {
        const { data: authData } = await buscarUsuarioLogado();
        const userId = authData?.user?.id;
        if (!userId || questionsCount <= 0) return null;

        const current = await loadProfileStats();
        
        const newTotalQuestions = current.totalQuestions + questionsCount;

        const { count: totalSessions } = await supabase
            .from('sessoes_foco')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        const newBadgesSet = new Set(current.badgesUnlocked);
        const newlyUnlocked: any[] = [];

        APP_BADGES.forEach(badge => {
            if (!newBadgesSet.has(badge.id)) {
                let unlocked = false;
                switch (badge.requirementType) {
                    case 'hours':
                        unlocked = current.totalHours >= badge.requirementValue;
                        break;
                    case 'questions':
                        unlocked = newTotalQuestions >= badge.requirementValue; // Avalia a nova quantidade
                        break;
                    case 'weekly_goal':
                        unlocked = current.weeklyCurrent >= current.weeklyGoal;
                        break;
                    case 'sessions':
                        unlocked = (totalSessions || 0) >= badge.requirementValue;
                        break;
                }

                if (unlocked) {
                    newBadgesSet.add(badge.id);
                    newlyUnlocked.push(badge); 
                }
            }
        });
        
        const newBadgesArray = Array.from(newBadgesSet);

        // Atualiza a quantidade total de questões no perfil
        const { error: profileError } = await supabase.from('profiles').update({
             questoes_feitas: newTotalQuestions,
             medalhas_desbloqueadas: newBadgesArray
        }).eq('id', userId);

        if (profileError) {
            console.error("Erro ao salvar questões no perfil:", profileError);
        }

        if (newlyUnlocked.length > 0) {
            DeviceEventEmitter.emit('badgesUnlocked', newlyUnlocked);
        }

        return await loadProfileStats();
    } catch (e) {
        console.error('Erro ao salvar questoes:', e);
        return null;
    }
};
