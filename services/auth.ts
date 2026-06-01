import { supabase } from "@/repositories/supabase";
import * as Linking from "expo-linking";
import type { AuthChangeEvent } from "@supabase/supabase-js";
import type { AuthSession } from "@/types/auth";

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
    redirectTo: Linking.createURL("/forgot-password"),
  });
};

export const validarSessaoPorCodigo = async (code: string) => {
  return await supabase.auth.exchangeCodeForSession(code);
};

export const validarSessaoPorTokens = async (accessToken: string, refreshToken: string) => {
  return await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
};

export const redefinirSenha = async (password: string) => {
  return await supabase.auth.updateUser({ password });
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

export const perfilEstaCompleto = async (userId: string) => {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("nome_usuario")
    .eq("id", userId)
    .single();

  return { profile, error, completo: !!profile?.nome_usuario };
};

//Deslogar Usuario
export const deslogarUsuario = async () => {
  return await supabase.auth.signOut();
}

//Verifica se o email está confirmado
export const verificaEmailConfirmado = async () => {
  const { data, error } = await supabase.auth.getSession();
  const emailVerificado = !!data.session?.user?.email_confirmed_at;
  return {data, error, emailVerificado}
}

export const obterSessaoAtual = async () => {
  return await supabase.auth.getSession();
};

export const observarMudancasAuth = (
  callback: (event: AuthChangeEvent, session: AuthSession | null) => void
) => {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
};

//Obtém o email do usuário
export const obtemEmailUsuario = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  const email = session?.user?.email ?? "";
  return {email}
}

//Refresh na Sessão
export const refreshSessao = async () => {
  await supabase.auth.refreshSession();
}
