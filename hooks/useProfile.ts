//Pega informações do usuário
import { buscarPerfil } from "@/services/auth";
import { toast } from "@/services/toast";
import { Profile } from "@/types/profile";
import { useEffect, useState } from "react";


export const useProfile = (userId: string) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [carregando, setCarregando] = useState(true);
  useEffect(() => {
    const fetchProfile = async () => {
      if (!userId) {
        setCarregando(false);
        return;
      }
      const { data, error } = await buscarPerfil(userId);
      if (error) {
        console.error("Error fetching profile:", error);
        toast.error("Não foi possível carregar o perfil.");
        setCarregando(false);
        return;
      }
      setProfile(data);
      setCarregando(false);
    };
    fetchProfile();
  }, [userId]);
  return { profile, carregando };
};