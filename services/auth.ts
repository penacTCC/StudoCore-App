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
export type PreferenciasOnboarding = {
  objetivo?: string | null;
  nivelEnsino?: string | null;
  areasFoco?: string[] | null;
  ritmoEstudo?: string | null;
  dificuldade?: string | null;
};

export const salvarDadosPerfil = async (
  userId: string,
  realName: string,
  username: string,
  dataFormatada: string,
  foto_usuario: string | null,
  preferencias: PreferenciasOnboarding = {},
) => {
  return await supabase.from("profiles").upsert({
    id: userId,
    nome_usuario: username.trim(),
    nome_real: realName.trim(),
    data_nascimento: dataFormatada,
    questoes_feitas: 0,
    foto_usuario: foto_usuario,
    objetivo: preferencias.objetivo ?? null,
    nivel_ensino: preferencias.nivelEnsino ?? null,
    areas_foco: preferencias.areasFoco ?? null,
    ritmo_estudo: preferencias.ritmoEstudo ?? null,
    dificuldade: preferencias.dificuldade ?? null,
  });
};

//Cadastrar novo usuário
export const cadastrarUsuario = async (
  email: string,
  password: string,
  nomeReal?: string,
  nomeUsuario?: string,
) => {
  return await supabase.auth.signUp({
    email,
    password,
    // Nome e @usuário são coletados no signup mas só podem ser gravados em
    // profiles depois da verificação de e-mail (quando há sessão). Guardamos
    // em user_metadata para carregá-los até o carrossel de onboarding salvar tudo.
    options: {
      data: {
        ...(nomeReal ? { nome_real: nomeReal.trim() } : {}),
        ...(nomeUsuario ? { nome_usuario: nomeUsuario.trim() } : {}),
      },
    },
  });
};

//Reenviar email de confirmação
export const reenviarEmailConfirmacao = async (email: string) => {
  return await supabase.auth.resend({ type: "signup", email });
};

//Confirmar cadastro via código de 6 dígitos enviado por email
export const confirmarCodigoCadastro = async (email: string, token: string) => {
  return await supabase.auth.verifyOtp({ email, token, type: "signup" });
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
    .maybeSingle();

  return { profile, error, completo: !!profile?.nome_usuario };
};

//Deslogar Usuario
export const deslogarUsuario = async () => {
  return await supabase.auth.signOut();
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

//Busca número de celular do usuário
export const verificaCelularUsuario = async (userId: string) => {
  return await supabase
    .from("profiles") 
    .select("celular")
    .eq("id", userId)
}