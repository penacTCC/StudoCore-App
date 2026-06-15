import { MembroGrupoComPerfil } from "./grupos";

export type RankingHorasMembro = {
  user_id: string;
  total_minutos: number;
};

export type RankingMembroComPerfil = {
  user_id: string;
  total_minutos: number;
  membro?: MembroGrupoComPerfil;
};