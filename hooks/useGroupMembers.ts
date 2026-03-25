import { supabase } from "@/supabase";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

export function useGroupMembers({ groupId }: { groupId: string }) {
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchGroupMembers = async () => {
    try {
      setIsLoading(true);

      if (!groupId) return; // Se o groupId não chegou pelos parâmetros ainda, não faz a busca

      // 1. A Consulta
      //é uma junção de tabelas (left join)
      const { data: usuarioMembro, error } = await supabase

        .from("membros")//(FROM) supabase procura na tabela 'membros'
        //(SELECT) * (tudo da tabela membros)
        //Pega a coluna 'id' e busca os dados do usuário na tabela profiles (id, nome foto_perfil)
        .select(`
                  *,
                  profiles:user_id (
                      id,
                      nome_usuario,
                      foto_usuario
                  )
                `)
        .eq("grupo_id", groupId); //(WHERE grupo_id = groupId) .eq()(equal = igual) -> traga APENAS membros onde a coluna 'grupo_id' seja IGUAL ao 'groupId' desta tela.

      if (error) {
        console.error("Erro ao puxar membros:", error);
        return;
      }

      // 2. Formatando os dados
      const formattedMembers = usuarioMembro?.map((membro) => {// O data?.map tem esse "?" para dizer: "Se o Supabase não retornou erro e o data existe, faça o loop"
        return {
          ...membro, // O "..." (Spread Operator) significa: "Pegue tudo que já existe dentro de 'membro' (ex: id, pontos, cargo) e despeje aqui dentro"

          userData: membro.profiles // //Cria uma chave NOVA chamada "userData" e guarda os dados da pessoa.
        };
      });

      // 3. Salva no Estado
      setMembers(formattedMembers || []);

    } catch (err) {
      console.error("Erro inesperado:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchGroupMembers();

    }, [groupId]) // O [groupId] faz a busca rodar de novo se o grupo mudar

  );
  return { members, isLoading }
}