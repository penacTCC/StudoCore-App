import { supabase } from "@/lib/supabase";
import type { GroupMemberWithProfile } from "@/types/groups";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

export function useGroupMembers({ groupId }: { groupId: string }) {
  const [members, setMembers] = useState<GroupMemberWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchGroupMembers = async () => {
    try {
      setIsLoading(true);

      if (!groupId) return;

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
        return;
      }

      const formattedMembers = ((usuarioMembro || []) as GroupMemberWithProfile[]).map((membro) => ({
        ...membro,
        userData: membro.profiles,
      }));

      setMembers(formattedMembers);
    } catch (err) {
      console.error("Erro inesperado:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchGroupMembers();
    }, [groupId])
  );

  return { members, isLoading };
}
