import { supabase } from "@/supabase";

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
    if (!user) return;

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
                        publico
                    )
                `)
      .eq("user_id", user.id);

    if (error) {
      console.error("Erro ao buscar grupos:", error);
      return;
    }

    // Exclui membros que não tem um grupo correspondente, se houver, e mapeia para a array de grupos
    const myGroups = memberData
      ?.filter(m => m.grupos)
      .map(m => m.grupos);

    return myGroups || [];
  } catch (error) {
    console.error("Error fetching groups:", error);
    return [];
  }
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



