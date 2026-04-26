import { supabase } from "@/supabase";
import { makeRedirectUri } from "expo-auth-session";
import * as Linking from 'expo-linking';

//Login com Email e Senha
export const loginComSenha = async (email: string, password: string) => {
  return await supabase.auth.signInWithPassword({ email, password });
};

//Iniciar fluxo do Google (Gera a URL)
export const gerarUrlLoginGoogle = async (redirectUrl: string) => {
  return await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
    },
  });
};

//Finalizar fluxo do Google (Troca o código pela sessão)
export const validarSessaoGoogle = async (code: string) => {
  return await supabase.auth.exchangeCodeForSession(code);
};

//Recuperação de Senha
export const recuperarSenha = async (email: string) => {
  return await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: makeRedirectUri({ path: "forgot-password" }),
  });
};

//Verificar nome de usuário
export const verificarNomeUsuario = async (username: string) => {
  return await supabase
    .from("profiles")
    .select("nome_usuario")
    .eq("nome_usuario", username.trim());
};

//Salvar dados do perfil
export const salvarDadosPerfil = async (userId: string, realName: string, username: string, dataFormatada: string, foto_usuario: string | null) => {
  return await supabase.from("profiles").upsert({
    id: userId,
    nome_usuario: username.trim(),
    nome_real: realName.trim(),
    data_nascimento: dataFormatada,
    questoes_feitas: 0,
    foto_usuario: foto_usuario,
  });
};

//Cadastrar novo usuário
export const cadastrarUsuario = async (email: string, password: string) => {
  return await supabase.auth.signUp({
    email,
    password,
  });
};

//Reenviar email de confirmação
export const reenviarEmailConfirmacao = async (email: string) => {
  return await supabase.auth.resend({ type: "signup", email });
};

//Buscar usuário logado
export const buscarUsuarioLogado = async () => {
  return await supabase.auth.getUser();
};

//Buscar informações do perfil
export const buscarPerfil = async (userId: string) => {
  return await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
};



