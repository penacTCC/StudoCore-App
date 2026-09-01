import { supabase } from "@/repositories/supabase";
import { limparUltimoGrupoLocalmente } from "@/services/armazenamentoOffline";
import { removerTokenPush } from "@/services/pushTokens";
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

export const redefinirSenha = async (password: string) => {
  return await supabase.auth.updateUser({ password });
};

/**
 * Diz se um @usuário está livre.
 *
 * Passa por RPC em vez de consultar `profiles` direto porque a policy de SELECT da tabela
 * exige `authenticated`: na tela de cadastro ninguém está logado, a consulta voltava vazia
 * por RLS e o formulário carimbava "disponível" em nome já tomado. A função no banco roda
 * como SECURITY DEFINER e devolve só um booleano (ver a migration
 * `20260808120000_nome_usuario_disponivel.sql`).
 *
 * Em caso de erro devolve `disponivel: false` e o erro: quem chama decide se avisa ou se
 * deixa passar — o UNIQUE de `nome_usuario` continua sendo a garantia final.
 */
export const nomeUsuarioDisponivel = async (
  username: string,
): Promise<{ disponivel: boolean; error: unknown }> => {
  const { data, error } = await supabase.rpc("nome_usuario_disponivel", {
    p_nome: username.trim(),
  });

  return { disponivel: data === true, error };
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

//Atualizar os campos editáveis do perfil (tela de editar perfil)
export type DadosEdicaoPerfil = {
  nomeReal: string;
  nomeUsuario: string;
  bio: string | null;
  fotoUsuario: string | null;
  perfilPublico: boolean;
  mostrarOfensiva: boolean;
};

/**
 * UPDATE (e não upsert como no onboarding): aqui a linha já existe, e um upsert
 * apagaria os campos de preferência que esta tela não edita.
 */
export const atualizarPerfil = async (userId: string, dados: DadosEdicaoPerfil) => {
  return await supabase
    .from("profiles")
    .update({
      nome_real: dados.nomeReal.trim(),
      nome_usuario: dados.nomeUsuario.trim(),
      bio: dados.bio?.trim() || null,
      foto_usuario: dados.fotoUsuario,
      perfil_publico: dados.perfilPublico,
      mostrar_ofensiva: dados.mostrarOfensiva,
    })
    .eq("id", userId);
};

/**
 * Liga/desliga o perfil público sem passar pelo formulário inteiro de edição.
 *
 * `atualizarPerfil` reescreve nome, bio e foto de uma vez — chamá-la a partir de um
 * interruptor solto obrigaria a tela a carregar e reenviar campos que ela nem mostra.
 */
export const atualizarPrivacidadePerfil = async (userId: string, perfilPublico: boolean) => {
  return await supabase
    .from("profiles")
    .update({ perfil_publico: perfilPublico })
    .eq("id", userId);
};

/**
 * Exclusão definitiva da conta de quem está logado.
 *
 * Roda na Edge Function `excluir-conta` porque apagar de auth.users exige a service role
 * key; o id vem do JWT lá dentro, então o app não consegue pedir a exclusão de terceiros.
 * Depois de apagar, a sessão local ainda existe: o signOut abaixo é o que devolve o app
 * para a tela de login.
 */
export const excluirConta = async (): Promise<{ error: string | null }> => {
  const { data, error } = await supabase.functions.invoke("excluir-conta");

  if (error) {
    console.warn("Erro ao excluir conta:", error);
    return { error: "Não foi possível excluir a conta. Tente de novo em instantes." };
  }
  if (data && data.ok === false) {
    return { error: data.error ?? "Não foi possível excluir a conta." };
  }

  await supabase.auth.signOut();
  return { error: null };
};

//Cadastrar novo usuário
export const cadastrarUsuario = async (
  email: string,
  password: string,
  nomeReal?: string,
  nomeUsuario?: string,
) => {
  const resposta = await supabase.auth.signUp({
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

  /**
   * Com a confirmação de e-mail ligada, o Supabase NÃO devolve erro quando o e-mail já tem
   * conta — se devolvesse, o cadastro viraria um oráculo para descobrir quem usa o app.
   * No lugar disso responde 200 com um usuário falso, sem sessão e com `identities` vazio.
   *
   * Sem olhar esse array o app tratava tudo como sucesso e mandava a pessoa para a tela do
   * código de 6 dígitos, onde o e-mail nunca chegava e o reenvio também falhava.
   */
  const emailJaCadastrado =
    !resposta.error &&
    !!resposta.data.user &&
    Array.isArray(resposta.data.user.identities) &&
    resposta.data.user.identities.length === 0;

  return { ...resposta, emailJaCadastrado };
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
/**
 * Usuário da sessão atual, no mesmo formato de `auth.getUser()`.
 *
 * Usa `getSession()` de propósito: `getUser()` bate no servidor de auth toda vez que é
 * chamado, e esta função está no caminho crítico de várias telas (o `loadProfileStats`
 * sozinho a chama antes de qualquer consulta). `getSession()` lê do storage local e
 * ainda renova o token quando ele está perto de vencer, então o dado continua válido —
 * o que se perde é a revalidação da conta no servidor a cada chamada, que não é o que
 * essas telas precisam.
 */
export const buscarUsuarioLogado = async () => {
  const { data, error } = await supabase.auth.getSession();
  return { data: { user: data.session?.user ?? null }, error };
};

//Buscar informações do perfil
export const buscarPerfil = async (userId: string) => {
  return await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
};

/**
 * Perfil de OUTRA pessoa para a tela `member-profile.tsx` — nunca use `buscarPerfil` para
 * isso. Passa pela RPC `perfil_membro_para_visualizacao` (migration
 * 20260831000000_perfil_membro_respeita_privacidade), que devolve identidade sempre e
 * estatística (horas, medalhas, ofensiva) só quando `perfil_publico` é true ou é você
 * mesmo — o mesmo padrão já usado no duelo (`buscarEstatisticasParaDuelo`). `buscarPerfil`
 * continua correto para o SEU PRÓPRIO perfil, onde as estatísticas sempre podem aparecer.
 */
export const buscarPerfilMembroParaVisualizacao = async (userId: string) => {
  return await supabase
    .rpc("perfil_membro_para_visualizacao", { p_user_id: userId })
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
  // O último grupo fica no AsyncStorage do aparelho. Limpar aqui evita que ele sobreviva
  // até o próximo login: quem lê já valida o dono, mas apagar no logout impede que um
  // registro órfão fique guardado à toa depois que a conta sai.
  await limparUltimoGrupoLocalmente();

  // O token de push é do APARELHO, mas fica gravado na conta. Se ele não sair junto, uma
  // força mandada pra esta conta tocaria no aparelho de quem logar aqui depois. Precisa ser
  // antes do signOut: depois dele a RLS não deixa mais apagar a linha.
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await removerTokenPush(user.id);

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