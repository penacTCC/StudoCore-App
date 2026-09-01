import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { secureStorage } from './secureStorage';

// No ambiente local, usamos variáveis de ambiente para facilitar a troca entre PCs
//
// A barra final é removida de propósito: o supabase-js monta a URL das Edge Functions
// concatenando "/functions/v1/<nome>" direto no fim desta string. Com uma barra sobrando no
// `.env` (fácil de colar sem reparar), a URL final sai com barra dupla e o fetch nem chega a
// sair — dá FunctionsFetchError ("Failed to send a request") em toda function, sem 4xx/5xx
// pra explicar o motivo.
const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Tempo máximo de uma requisição.
 *
 * O fetch do React Native não tem timeout próprio. Sem isto, uma requisição que pendura
 * numa rede ruim pendura para sempre: a promise nunca resolve nem rejeita, e a tela que a
 * espera fica em skeleton eterno — inclusive depois que a internet volta. Com o limite, a
 * requisição vira um erro, a tela mostra o estado de falha e o usuário pode tentar de novo.
 */
const TEMPO_LIMITE_PADRAO = 20_000;

/** Upload e download de arquivo demoram legitimamente mais; cortá-los em 20s quebraria anexos. */
const TEMPO_LIMITE_ARQUIVO = 120_000;

function tempoLimiteDe(url: string) {
  return url.includes('/storage/v1/object') ? TEMPO_LIMITE_ARQUIVO : TEMPO_LIMITE_PADRAO;
}

const fetchComTempoLimite: typeof fetch = (entrada, init) => {
  const url = typeof entrada === 'string' ? entrada : String((entrada as Request).url ?? entrada);

  const controle = new AbortController();
  const alarme = setTimeout(() => controle.abort(), tempoLimiteDe(url));

  // O supabase-js passa o próprio signal em algumas chamadas (`.abortSignal()`, o refresh
  // de token). Encadear os dois preserva esse cancelamento em vez de descartá-lo.
  const sinalExterno = init?.signal;
  const repassar = () => controle.abort();
  if (sinalExterno?.aborted) controle.abort();
  else sinalExterno?.addEventListener('abort', repassar);

  return fetch(entrada, { ...init, signal: controle.signal }).finally(() => {
    clearTimeout(alarme);
    sinalExterno?.removeEventListener('abort', repassar);
  });
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
  global: {
    fetch: fetchComTempoLimite,
    headers: {
      'ngrok-skip-browser-warning': 'true', // Ignora a tela de aviso do ngrok grátis
    },
  },
});
