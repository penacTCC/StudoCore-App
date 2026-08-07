//Pega informações do usuário
import { buscarPerfil } from "@/services/auth";
import { toast } from "@/services/toast";
import { useDadosCache } from "@/hooks/useDadosCache";
import { Profile } from "@/types/profile";

/**
 * Perfil de um usuário qualquer (o próprio ou o de um colega).
 *
 * A chave leva o id, então abrir o perfil do mesmo colega uma segunda vez — coisa comum
 * vindo do ranking ou do feed — não passa mais pela rede antes de desenhar a tela.
 */
export const useProfile = (userId: string) => {
  const { dados, carregando } = useDadosCache<Profile | null>(
    userId ? `perfil:${userId}` : null,
    async () => {
      const { data, error } = await buscarPerfil(userId);
      if (error) {
        console.error("Error fetching profile:", error);
        toast.error("Não foi possível carregar o perfil.");
        throw error;
      }
      return data;
    },
    { tempoFresco: 60_000 }
  );

  return { profile: dados ?? null, carregando };
};
