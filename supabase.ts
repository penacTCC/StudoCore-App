import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// No ambiente local, usamos o IP da sua máquina ou localhost
const supabaseUrl = 'https://towardly-insensately-mose.ngrok-free.dev'; // Essa URL aparece quando você roda o 'start'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'; // Pegue a chave anon key no terminal do 'start' ou no painel do Studio (Settings > API)

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'ngrok-skip-browser-warning': 'true', // Ignora a tela de aviso do ngrok grátis
    },
  },
});