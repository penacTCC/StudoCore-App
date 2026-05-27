import { buscarMembrosGrupo } from "@/services/groups";
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

      const membros = await buscarMembrosGrupo(groupId);
      setMembers(membros);
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
