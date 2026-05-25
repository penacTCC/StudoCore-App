import { supabase } from "@/repositories/supabase";
import type { Group, GroupMemberWithProfile } from "@/types/groups";

/**
 * Função para contar quantos membros tem um grupo específico, usando o ID do grupo.
 */
export const qtdGroupMembers = async (id: string) => {
  try {

    const { count, error } = await supabase
      .from('membros') //pega tudo da tabela grupos se estiver publico=true
      .select('*', { count: 'exact', head: true }) // Busca o grupo e os dados do perfil do criador
      .eq('grupo_id', id);

    if (error) {
      console.error("Erro ao buscar membros do grupo:", error);
      return 0;
    }

    return count || 0;  // ← Retorna o número de membros

  } catch (err) {
    console.error("Erro inesperado:", err);
    return 0;
  }
};

//Busca por grupos onde o usuário é membro
export const fetchMyGroups = async () => {
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
                        codigo_convite
                    )
                `)
      .eq("user_id", user.id);

    if (error) {
      console.error("Erro ao buscar grupos:", error);
      return [];
    }

    // Exclui membros que não tem um grupo correspondente, se houver, e mapeia para a array de grupos
    const myGroups = memberData
      ?.flatMap(m => Array.isArray(m.grupos) ? m.grupos : [m.grupos])
      .filter((group): group is Group => Boolean(group));

    return myGroups || [];
  } catch (error) {
    console.error("Error fetching groups:", error);
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
    return [];
  }

  const { data: meusMembros } = await supabase
    .from('membros')
    .select('grupo_id')
    .eq('user_id', user.id);

  const myGroupIds = meusMembros?.map(m => m.grupo_id) || [];
  const filteredGroups = grupoPublico?.filter(grupo => !myGroupIds.includes(grupo.id));

  return filteredGroups?.map((grupo) => ({
    ...grupo,
    members: grupo.membros[0]?.count || 0
  })) || [];
};

export const buscarMembrosGrupo = async (groupId: string) => {
  if (!groupId) return [];

  const { data: usuarioMembro, error } = await supabase
    .from("membros")
    .select(`
      *,
      profiles:user_id (
        id,
        nome_usuario,
        foto_usuario
      )
    `)
    .eq("grupo_id", groupId);

  if (error) {
    console.error("Erro ao puxar membros:", error);
    return [];
  }

  return ((usuarioMembro || []) as GroupMemberWithProfile[]).map((membro) => ({
    ...membro,
    userData: membro.profiles,
  }));
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
export const insereGrupo = async (name: string, description: string, isPublic: boolean, weeklyTarget: number, inviteLink: string, imageUrl: string | null) => {
  return await supabase
    .from('grupos')
    .upsert({ //upsert é uma função que insere ou atualiza um registro
      nome_grupo: name.trim(),
      descricao: description.trim(),
      publico: isPublic,
      meta_horas: weeklyTarget,
      codigo_convite: inviteLink,
      foto_grupo: imageUrl,
    })
    .select()
    .single()//retorna apenas um registro, nesse caso, o id do grupo, utilizado na tabela membros
}

//Insere usuário na tabela membros
export const insereMembro = async (userId: string, NewGroup: { id: string }) => {
  return await supabase
    .from('membros')
    .upsert({
      user_id: userId,
      grupo_id: NewGroup.id,
      administrador: true
    })
    .select()
    .single()
}

//Entrar em um grupo público
export const joinPublicGroup = async (groupId: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: NewMember, error: MemberError } = await supabase
      .from("membros")
      .insert({
        user_id: user.id,
        grupo_id: groupId,
        administrador: false
      })
      .select()
      .single();

    if (MemberError) {
      console.error("Erro ao entrar no grupo:", MemberError);
      return null;
    }

    return NewMember;

  } catch (error) {
    console.error("Error joining group:", error);
    return null;
  }
}

//Insere código de convite na tabela grupos
export const insereCodigoConvite = async (groupId: string, inviteCode: string) => {
  return await supabase
    .from('grupos')
    .update({
      code_convite: inviteCode
    })
    .eq('id', groupId)
    .select()
    .single();
}

//Busca um grupo específico pelo ID
export const fetchGroupById = async (groupId: string) => {
  try {
    const { data: group, error } = await supabase
      .from('grupos')
      .select('*, membros(count)')
      .eq('id', groupId)
      .single();

    if (error) {
      console.error("Erro ao buscar grupo:", error);
      return null;
    }

    return {
      ...group,
      members: group.membros[0]?.count || 0
    };
  } catch (error) {
    console.error("Error fetching group:", error);
    return null;
  }
}
