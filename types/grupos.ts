import type { ProfilePreview } from "./profile";

export type Grupo = {
  id: string;
  nome_grupo: string;
  descricao: string | null;
  foto_grupo: string | null;
  meta_horas: number;
  publico: boolean;
  codigo_convite: string | null;
  created_at: string | null;
};

export type CartaoGrupoPublico = {
    id: string;
    nome_grupo: string;
    descricao: string | null;
    foto_grupo?: string | null;
    meta_horas: number;
    publico: boolean;
    members: number;
    activeNow?: number;
    weeklyTarget?: number;
    isOnline?: boolean;
}

export type CartaoGrupoPublicoProps = {
    grupo: CartaoGrupoPublico;
    colorIndex: number;
    onJoin?: () => void;
}

export type GrupoComTotalMembros = Grupo & {
  members: number;
};

export type GrupoPublico = GrupoComTotalMembros & {
  activeNow?: number;
  weeklyTarget?: number;
  isOnline?: boolean;
};

export type MembroGrupo = {
  id: string;
  user_id: string;
  grupo_id: string;
  administrador: boolean;
  rank?: number;
  ofensiva?: number;
};

// Perfil com a gamificação (ofensiva) embutida via join do PostgREST em buscarMembrosGrupo.
type PerfilComGamificacao = ProfilePreview & {
  gamificacoes?: { ofensiva: number } | { ofensiva: number }[] | null;
};

export type MembroGrupoComPerfil = MembroGrupo & {
  profiles?: PerfilComGamificacao | null;
  userData?: PerfilComGamificacao | null;
};

export type ParametrosUltimoGrupo = {
  groupId: string;
  groupName: string;
  groupPhoto: string | null;
  groupGoal: number;
};
