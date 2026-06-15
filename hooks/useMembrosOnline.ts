import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMembrosGrupo } from "@/hooks/useMembrosGrupo";
import { useOnlineUsers } from "@/hooks/useOnlineUsers";

type UseMembrosOnlineOptions = {
  excluirUsuarioAtual?: boolean;
};

export const useMembrosOnline = (
  grupoId?: string,
  options: UseMembrosOnlineOptions = {}
) => {
  const { userId } = useAuth();
  const { membros, carregando } = useMembrosGrupo({ grupoId: grupoId ?? "" });
  const { onlineUsers } = useOnlineUsers();

  const membrosIds = useMemo(() => {
    return membros.map((membro) => membro.user_id);
  }, [membros]);

  const membrosOnlineIds = useMemo(() => {
    const idsMembros = new Set(membrosIds);

    return onlineUsers.filter((onlineUserId) => {
      const pertenceAoGrupo = idsMembros.has(onlineUserId);
      const deveRemoverUsuarioAtual =
        options.excluirUsuarioAtual && onlineUserId === userId;

      return pertenceAoGrupo && !deveRemoverUsuarioAtual;
    });
  }, [membrosIds, onlineUsers, options.excluirUsuarioAtual, userId]);

  const membrosOnline = useMemo(() => {
    const idsOnline = new Set(membrosOnlineIds);

    return membros.filter((membro) => idsOnline.has(membro.user_id));
  }, [membros, membrosOnlineIds]);

  return {
    membrosOnline,
    membrosOnlineIds,
    totalOnline: membrosOnlineIds.length,
    carregando,
  };
};
