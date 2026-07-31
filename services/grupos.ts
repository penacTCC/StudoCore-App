import { supabase } from "@/repositories/supabase";
import { toast } from "@/services/toast";
import type { Grupo, MembroGrupoComPerfil } from "@/types/grupos";

/**
 * Função para contar quantos membros tem um grupo específico, usando o ID do grupo.
 */
export const contarMembrosGrupo = async (id: string) => {
  try {

    const { count, error } = await supabase
      .from('membros') //pega tudo da tabela grupos se estiver publico=true
      .select('*', { count: 'exact', head: true }) // Busca o grupo e os dados do perfil do criador
      .eq('grupo_id', id);

    if (error) {
      console.error("Erro ao buscar membros do grupo:", error);
      toast.error("Não foi possível contar os membros do grupo.");
      return 0;
    }

    return count || 0;  // ← Retorna o número de membros

  } catch (err) {
    console.error("Erro inesperado:", err);
    toast.error("Não foi possível contar os membros do grupo.");
    return 0;
  }
};

//Busca por grupos onde o usuário é membro
export const buscarMeusGrupos = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Busca por grupos onde o usuário é membro
    const { data: memberData, error } = await supabase
      .from("membros")
      .select(`
                    grupo_id,
                    grupos (
                        id,
                        nome_grupo,
                        descricao,
                        foto_grupo,
                        meta_horas,
                        publico,
                        codigo_convite,
                        created_at
                    )
                `)
      .eq("user_id", user.id);

    if (error) {
      console.error("Erro ao buscar grupos:", error);
      toast.error("Não foi possível carregar seus grupos.");
      return [];
    }

    // Exclui membros que não tem um grupo correspondente, se houver, e mapeia para a array de grupos
    const meusGrupos = memberData
      ?.flatMap(m => Array.isArray(m.grupos) ? m.grupos : [m.grupos])
      .filter((grupo): grupo is Grupo => Boolean(grupo));

    return meusGrupos || [];
  } catch (error) {
    console.error("Error fetching groups:", error);
    toast.error("Não foi possível carregar seus grupos.");
    return [];
  }
};

export const buscarGruposPublicosDisponiveis = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: grupoPublico, error } = await supabase
    .from('grupos')
    .select('*, membros(count)')
    .eq('publico', true);

  if (error) {
    console.error("Erro ao buscar grupos:", error);
    toast.error("Não foi possível carregar os grupos públicos.");
    return [];
  }

  const { data: meusMembros } = await supabase
    .from('membros')
    .select('grupo_id')
    .eq('user_id', user.id);

  const meusGruposIds = meusMembros?.map(m => m.grupo_id) || [];
  const gruposFiltrados = grupoPublico?.filter(grupo => !meusGruposIds.includes(grupo.id));

  return gruposFiltrados?.map((grupo) => ({
    ...grupo,
    members: grupo.membros[0]?.count || 0
  })) || [];
};

export const buscarMembrosGrupo = async (grupoId: string) => {
  if (!grupoId) return [];

  const { data: usuarioMembro, error } = await supabase
    .from("membros")
    .select(`
      *,
      profiles:user_id (
        id,
        nome_usuario,
        foto_usuario,
        gamificacoes (
          ofensiva
        )
      )
    `)
    .eq("grupo_id", grupoId);

  if (error) {
    console.error("Erro ao puxar membros:", error);
    toast.error("Não foi possível carregar os membros do grupo.");
    return [];
  }

  return ((usuarioMembro || []) as MembroGrupoComPerfil[]).map((membro) => {
    // `gamificacoes` vem como relação 1:1 (user_id é PK), mas o PostgREST pode devolver objeto ou array de 1 item.
    const gamificacao = membro.profiles?.gamificacoes;
    const ofensiva = Array.isArray(gamificacao) ? gamificacao[0]?.ofensiva : gamificacao?.ofensiva;

    return {
      ...membro,
      userData: membro.profiles,
      ofensiva: ofensiva ?? 0,
    };
  });
};

export const usuarioParticipaDeGrupo = async (userId: string) => {
  const { data: member } = await supabase
    .from('membros')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  return !!member;
};

//Insere grupo na tabela grupos
export const inserirGrupo = async (nome: string, descricao: string, publico: boolean, metaSemanal: number, linkConvite: string, urlImagem: string | null) => {
  return await supabase
    .from('grupos')
    .upsert({ //upsert é uma função que insere ou atualiza um registro
      nome_grupo: nome.trim(),
      descricao: descricao.trim(),
      publico,
      meta_horas: metaSemanal,
      codigo_convite: linkConvite,
      foto_grupo: urlImagem,
    })
    .select()
    .single()//retorna apenas um registro, nesse caso, o id do grupo, utilizado na tabela membros
}

//Insere usuário na tabela membros
export const inserirMembro = async (userId: string, novoGrupo: { id: string }) => {
  return await supabase
    .from('membros')
    .upsert({
      user_id: userId,
      grupo_id: novoGrupo.id,
      administrador: true
    })
    .select()
    .single()
}

//Entrar em um grupo público
export const entrarEmGrupoPublico = async (grupoId: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: novoMembro, error: erroMembro } = await supabase
      .from("membros")
      .insert({
        user_id: user.id,
        grupo_id: grupoId,
        administrador: false
      })
      .select()
      .single();

    if (erroMembro) {
      console.error("Erro ao entrar no grupo:", erroMembro);
      return null;
    }

    return novoMembro;

  } catch (error) {
    console.error("Error joining group:", error);
    return null;
  }
}

//Insere código de convite na tabela grupos
export const inserirCodigoConvite = async (grupoId: string, codigoConvite: string) => {
  return await supabase
    .from('grupos')
    .update({
      codigo_convite: codigoConvite
    })
    .eq('id', grupoId)
    .select()
    .single();
}

//Busca um grupo específico pelo ID
export const buscarGrupoPorId = async (grupoId: string) => {
  try {
    const { data: grupo, error } = await supabase
      .from('grupos')
      .select('*, membros(count)')
      .eq('id', grupoId)
      .single();

    if (error) {
      console.error("Erro ao buscar grupo:", error);
      toast.error("Não foi possível carregar o grupo.");
      return null;
    }

    return {
      ...grupo,
      members: grupo.membros[0]?.count || 0
    };
  } catch (error) {
    console.error("Error fetching group:", error);
    toast.error("Não foi possível carregar o grupo.");
    return null;
  }
}

//Atualiza os dados do grupo
export const atualizarDadosGrupo = async (grupo: Grupo) => {
  return await supabase
    .from('grupos')
    .update({
      nome_grupo: grupo.nome_grupo.trim(),
      descricao: grupo.descricao?.trim() || null,
      meta_horas: grupo.meta_horas,
      publico: grupo.publico,
      foto_grupo: grupo.foto_grupo
    })
    .eq("id", grupo.id)
    .select()
    .single();
}

//Exclusão de um grupo
export const excluirGrupoAtual = async (groupId: string) => {
  return await supabase
    .from('grupos')
    .delete()
    .match({ id: groupId })
}

const obterSemanaAtual = () => {
  const hoje = new Date();

  const diaSemana = hoje.getDay();
  // domingo = 0, segunda = 1, ..., sábado = 6

  const diffSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;

  const inicioSemana = new Date(hoje);
  inicioSemana.setDate(hoje.getDate() + diffSegunda);

  const fimSemana = new Date(inicioSemana);
  fimSemana.setDate(inicioSemana.getDate() + 6);

  const formatar = (data: Date) => data.toISOString().split("T")[0];

  return {
    inicio: formatar(inicioSemana),
    fim: formatar(fimSemana),
  };
};

export const horasSemanaisGrupo = async (groupId: string) => {
  // Busca o intervalo da semana atual para filtrar apenas o progresso semanal.
  const { inicio, fim } = obterSemanaAtual()

  // Soma apenas sessões vinculadas ao grupo atual, evitando misturar estudos de outros grupos do mesmo usuário.
  const { data: sessions, error } = await supabase
    .from('sessoes_foco')
    .select('tempo_minutos')
    .eq("grupo_id", groupId)
    .gte("data_sessao", inicio)
    .lte("data_sessao", fim);

  if (error) {
    // O Postgres retorna 42703 e o PostgREST retorna PGRST204 quando `grupo_id` ainda não existe no remoto.
    const grupoIdAusenteNoSchema = ["42703", "PGRST204"].includes(error.code) && String(error.message || "").includes("grupo_id");

    // Enquanto a migration de `grupo_id` não estiver aplicada no remoto, usa o fallback antigo por membros.
    if (grupoIdAusenteNoSchema) {
      // Busca os membros do grupo para montar o filtro compatível com o schema antigo.
      const membros = await buscarMembrosGrupo(groupId)

      // Extrai os IDs dos membros que podem ter sessões registradas.
      const membrosIds = membros.map((membro) => membro.user_id)

      // Se não houver membros, o grupo ainda não tem horas acumuladas.
      if (membrosIds.length === 0) return 0;

      // Busca sessões da semana atual feitas pelos membros do grupo.
      const { data: fallbackSessions, error: fallbackError } = await supabase
        .from('sessoes_foco')
        .select('tempo_minutos')
        .in("user_id", membrosIds)
        .gte("data_sessao", inicio)
        .lte("data_sessao", fim);

      // Se o fallback também falhar, registra o erro e devolve zero para manter a UI viva.
      if (fallbackError) {
        console.log("Erro ao buscar as horas do grupo pelo fallback", fallbackError)
        return 0
      }

      // Soma os minutos encontrados pelo fallback de membros.
      const fallbackTotalMinutes = fallbackSessions?.reduce((total, session) =>
        total + (session.tempo_minutos ?? 0), 0
      ) ?? 0

      // Converte minutos para horas para manter o contrato da função.
      return fallbackTotalMinutes / 60
    }

    console.log("Erro ao buscar as horas do grupo", error)
    return 0
  }

  // Total de minutos estudados no grupo durante a semana atual.
  const totalMinutes = sessions?.reduce((total, session) =>
    total + (session.tempo_minutos ?? 0), 0
  ) ?? 0

  // Converte minutos para horas porque a UI compara com metas em horas.
  return totalMinutes / 60
}

// Formata a data pro formato aaaa-mm-dd usado em data_sessao (mesma convenção de services/gamificacao.ts).
const paraDataISO = (data: Date) => data.toISOString().split("T")[0];

/**
 * Recalcula e persiste a ofensiva coletiva do grupo: um dia só conta se a soma de
 * minutos estudados por TODOS os membros naquele dia bater a cota diária "justa"
 * da meta semanal (meta_horas * membros / 7) — assim quem estuda mais compensa
 * quem não estudou naquele dia específico, sem exigir que cada membro apareça.
 * Segue a mesma regra Duolingo da ofensiva pessoal (registrarSessaoConcluida):
 * bateu a cota ontem -> +1; pulou um dia -> reseta pra 1. Idempotente por dia —
 * chamar de novo depois que a cota do dia já foi contabilizada não faz nada.
 * Deve ser chamada depois de toda sessão salva com grupo_id, pra recontar a cota
 * do dia à medida que as sessões dos membros forem chegando.
 */
export const registrarOfensivaGrupo = async (grupoId: string) => {
  const { data: grupo, error: erroGrupo } = await supabase
    .from('grupos')
    .select('meta_horas, ofensiva, melhor_ofensiva, ultima_data_estudo')
    .eq('id', grupoId)
    .single();

  if (erroGrupo || !grupo) {
    console.error("Erro ao buscar grupo para ofensiva:", erroGrupo);
    return null;
  }

  const hojeStr = paraDataISO(new Date());

  // Cota do dia já contabilizada — nada a recalcular.
  if (grupo.ultima_data_estudo === hojeStr) {
    return grupo;
  }

  const qtdMembros = await contarMembrosGrupo(grupoId);
  if (qtdMembros === 0) return grupo;

  // Fração diária da meta semanal do grupo, em minutos.
  const metaDiariaMinutos = ((grupo.meta_horas * qtdMembros) / 7) * 60;

  const { data: sessoesHoje, error: erroSessoes } = await supabase
    .from('sessoes_foco')
    .select('tempo_minutos')
    .eq('grupo_id', grupoId)
    .eq('data_sessao', hojeStr);

  if (erroSessoes) {
    console.error("Erro ao buscar sessões de hoje do grupo:", erroSessoes);
    return grupo;
  }

  const minutosHoje = sessoesHoje?.reduce((total, sessao) => total + (sessao.tempo_minutos ?? 0), 0) ?? 0;

  // Ainda não bateu a cota do dia — espera mais sessões dos membros chegarem.
  if (minutosHoje < metaDiariaMinutos) return grupo;

  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const ontemStr = paraDataISO(ontem);

  const estudouOntem = grupo.ultima_data_estudo === ontemStr;
  const novaOfensiva = estudouOntem ? grupo.ofensiva + 1 : 1;
  const novaMelhorOfensiva = Math.max(grupo.melhor_ofensiva, novaOfensiva);

  const { data, error } = await supabase
    .from('grupos')
    .update({
      ofensiva: novaOfensiva,
      melhor_ofensiva: novaMelhorOfensiva,
      ultima_data_estudo: hojeStr,
    })
    .eq('id', grupoId)
    .select('meta_horas, ofensiva, melhor_ofensiva, ultima_data_estudo')
    .single();

  if (error) {
    console.error("Erro ao registrar ofensiva do grupo:", error);
    return null;
  }

  return data;
};

//horas totais do usuario
export const horasTotaisUsuario = async (groupId?: string) => {
  if (!groupId) return 0

  const { data, error } = await supabase
  .from("ranking_horas_grupo")
  .select("*")
  .eq("grupo_id", groupId)
  .order("total_minutos", { ascending: false });
}

export const buscarMembrosDosGrupos = async (gruposIds: string[]): Promise<Record<string, MembroGrupoComPerfil[]>> => {
  if (!gruposIds || gruposIds.length === 0) return {};

  const { data: usuarioMembro, error } = await supabase
    .from("membros")
    .select(`
      *,
      profiles:user_id (
        id,
        nome_usuario,
        foto_usuario,
        gamificacoes (
          ofensiva
        )
      )
    `)
    .in("grupo_id", gruposIds);

  if (error) {
    console.error("Erro ao puxar membros:", error);
    toast.error("Não foi possível carregar os membros dos grupos.");
    return {};
  }

  return ((usuarioMembro || []) as MembroGrupoComPerfil[]).reduce((porGrupo, membro) => {
    // `gamificacoes` vem como relação 1:1 (user_id é PK), mas o PostgREST pode devolver objeto ou array de 1 item.
    const gamificacao = membro.profiles?.gamificacoes;
    const ofensiva = Array.isArray(gamificacao) ? gamificacao[0]?.ofensiva : gamificacao?.ofensiva;

    const membroTratado: MembroGrupoComPerfil = {
      ...membro,
      userData: membro.profiles,
      ofensiva: ofensiva ?? 0,
    };

    (porGrupo[membro.grupo_id] ??= []).push(membroTratado);
    return porGrupo;
  }, {} as Record<string, MembroGrupoComPerfil[]>);
}