import { DeviceEventEmitter } from 'react-native';
import { APP_BADGES } from '@/constants/badges';
import { supabase } from '@/repositories/supabase';
import { buscarUsuarioLogado } from '@/services/auth';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { UserStats } from '@/types/profile';

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

        // Define a janela visual do heatmap: 100 dias cobrem as 14 semanas exibidas na tela.
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 100);

        // Busca todas as sessões do usuário para calcular totais vitalícios sem cortar histórico antigo.
        const { data: sessions } = await supabase
            .from('sessoes_foco')
            .select('tempo_minutos, created_at, disciplina')
            .eq('user_id', userId);

        // Aggregate sessions into YYYY-MM-DD
        const studyHistory: Record<string, number> = {};
        let weeklyCurrent = 0;
        let exactLifetimeMinutes = 0;

        // A semana atual começa na segunda-feira para bater com o progresso de grupo.
        const now = new Date();
        const weekDay = now.getDay();
        const mondayOffset = weekDay === 0 ? -6 : 1 - weekDay;
        const startOfWeek = new Date(now);
        startOfWeek.setHours(0, 0, 0, 0);
        startOfWeek.setDate(now.getDate() + mondayOffset);

        if (sessions) {
            sessions.forEach(session => {
                const d = new Date(session.created_at);
                const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

                // Transforma minutos da duração em horas para alimentar cards e heatmap.
                const hoursInSession = session.tempo_minutos / 60;
                exactLifetimeMinutes += session.tempo_minutos;

                // Só adiciona no heatmap quando a sessão está dentro da janela visual de 100 dias.
                if (d >= ninetyDaysAgo) {
                    studyHistory[dateStr] = (studyHistory[dateStr] || 0) + hoursInSession;
                }

                // Só adiciona na semana atual quando a sessão cai dentro da semana de segunda a domingo.
                if (d >= startOfWeek) {
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
            badgesUnlocked: parsedBadges,
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
 * Sincroniza o perfil depois que uma sessão de foco foi inserida ou atualizada.
 * A fonte da verdade passa a ser a tabela `sessoes_foco`, então refazer quiz não duplica horas nem questões.
 */
export const syncProfileStatsAfterFocusSession = async (userId: string): Promise<UserStats | null> => {
    try {
        // Busca o perfil atual para preservar campos manuais e descobrir quais medalhas já estavam desbloqueadas.
        const { data: profile } = await supabase
            .from('profiles')
            .select('medalhas_desbloqueadas, minutos_semana')
            .eq('id', userId)
            .maybeSingle();

        // Busca todas as sessões do usuário para recalcular horas, questões e quantidade de sessões de forma idempotente.
        const { data: sessions, error: sessionsError } = await supabase
            .from('sessoes_foco')
            .select('tempo_minutos, questoes_respondidas, data_sessao, created_at')
            .eq('user_id', userId);

        // Interrompe a sincronização se o banco não conseguir devolver as sessões necessárias para o cálculo.
        if (sessionsError) {
            console.error('Erro ao sincronizar sessões do perfil:', sessionsError);
            return null;
        }

        // Normaliza medalhas vindas do banco, aceitando JSONB como array ou string serializada.
        let currentBadges: string[] = [];
        try {
            if (Array.isArray(profile?.medalhas_desbloqueadas)) {
                currentBadges = profile.medalhas_desbloqueadas;
            } else if (typeof profile?.medalhas_desbloqueadas === "string") {
                currentBadges = JSON.parse(profile.medalhas_desbloqueadas);
            }
        } catch (error) {
            console.warn("Aviso: medalhas_desbloqueadas inválido durante sincronização.", error);
        }

        // Define o intervalo da semana começando na segunda-feira, igual ao cálculo do progresso do grupo.
        const today = new Date();
        const weekDay = today.getDay();
        const mondayOffset = weekDay === 0 ? -6 : 1 - weekDay;
        const weekStart = new Date(today);
        weekStart.setHours(0, 0, 0, 0);
        weekStart.setDate(today.getDate() + mondayOffset);

        // Soma os minutos e as questões a partir das sessões persistidas.
        const totals = (sessions || []).reduce(
            (acc, session) => {
                // Usa `data_sessao` quando existir e cai para `created_at` como fallback defensivo.
                const sessionDate = new Date(session.data_sessao || session.created_at);

                // Soma todos os minutos para o total vitalício do perfil.
                acc.totalMinutes += session.tempo_minutos || 0;

                // Soma todas as questões respondidas para medalhas e estatísticas gerais.
                acc.totalQuestions += session.questoes_respondidas || 0;

                // Soma apenas sessões da semana atual para medalhas de meta semanal.
                if (sessionDate >= weekStart) {
                    acc.weeklyMinutes += session.tempo_minutos || 0;
                }

                return acc;
            },
            { totalMinutes: 0, totalQuestions: 0, weeklyMinutes: 0 }
        );

        // Converte o total em horas arredondadas porque `horas_totais` é inteiro na tabela.
        const totalHours = Math.round(totals.totalMinutes / 60);

        // Converte a meta semanal salva em minutos para horas, mantendo 12h como fallback.
        const weeklyGoalHours = profile?.minutos_semana ? profile.minutos_semana / 60 : 12;

        // Mantém as medalhas em Set para impedir duplicatas no JSONB.
        const newBadgesSet = new Set(currentBadges);

        // Guarda as medalhas novas para disparar o alerta global só quando algo realmente mudou.
        const newlyUnlocked: any[] = [];

        // Percorre todas as regras de medalha usando os totais recalculados após a sessão salva.
        APP_BADGES.forEach((badge) => {
            // Ignora medalhas já conquistadas antes desta sincronização.
            if (newBadgesSet.has(badge.id)) return;

            // Calcula se a regra específica da medalha foi cumprida.
            let unlocked = false;
            switch (badge.requirementType) {
                case 'hours':
                    unlocked = totalHours >= badge.requirementValue;
                    break;
                case 'questions':
                    unlocked = totals.totalQuestions >= badge.requirementValue;
                    break;
                case 'weekly_goal':
                    unlocked = (totals.weeklyMinutes / 60) >= weeklyGoalHours;
                    break;
                case 'sessions':
                    unlocked = (sessions?.length || 0) >= badge.requirementValue;
                    break;
            }

            // Registra a medalha nova no Set e na fila de alerta.
            if (unlocked) {
                newBadgesSet.add(badge.id);
                newlyUnlocked.push(badge);
            }
        });

        // Persiste os totais recalculados no perfil, mantendo o banco coerente com as sessões reais.
        const { error: profileError } = await supabase
            .from('profiles')
            .update({
                horas_totais: totalHours,
                questoes_feitas: totals.totalQuestions,
                medalhas_desbloqueadas: Array.from(newBadgesSet),
            })
            .eq('id', userId);

        // Retorna nulo se a escrita do perfil falhar, mas deixa a sessão já salva no banco.
        if (profileError) {
            console.error('Erro ao sincronizar perfil após sessão:', profileError);
            return null;
        }

        // Dispara os alertas de medalhas novas depois que o perfil foi salvo com sucesso.
        if (newlyUnlocked.length > 0) {
            DeviceEventEmitter.emit('badgesUnlocked', newlyUnlocked);
        }

        // Recarrega as estatísticas públicas para devolver o mesmo formato usado pelas telas.
        return await loadProfileStats();
    } catch (error) {
        console.error('Erro inesperado ao sincronizar estatísticas:', error);
        return null;
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

        // UPDATE (não upsert!) para nunca tentar criar linha nova sem os campos NOT NULL (nome_real, etc.)
        const { error: profileError } = await supabase.from('profiles').update({
             horas_totais: Math.round(newTotalHours),
             medalhas_desbloqueadas: newBadgesArray, // Transição Array puro pro Postgres serializar JSONB
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
