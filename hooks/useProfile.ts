//Pega informações do usuário
import { buscarPerfil } from "@/services/auth";
import { useEffect, useState } from "react";


export const useProfile = (userId: string) => {
  const [profile, setProfile] = useState<any>(null);
  useEffect(() => {
    const fetchProfile = async () => {
      if (!userId) return;
      const { data, error } = await buscarPerfil(userId);
      if (error) {
        console.error("Error fetching profile:", error);
        return;
      }
      setProfile(data);
    };
    fetchProfile();
  }, [userId]);
  return { profile };
};