//Pega informações do usuário
import { buscarPerfil } from "@/services/auth";
import { Profile } from "@/types/profile";
import { useEffect, useState } from "react";


export const useProfile = (userId: string) => {
  const [profile, setProfile] = useState<Profile | null>(null);
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