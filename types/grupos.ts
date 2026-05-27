import type { ProfilePreview } from "./profile";

export type Grupo = {
  id: string;
  nome_grupo: string;
  descricao: string | null;
  foto_grupo: string | null;
  meta_horas: number;
  publico: boolean;
  codigo_convite: string | null;
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

export type MembroGrupoComPerfil = MembroGrupo & {
  profiles?: ProfilePreview | null;
  userData?: ProfilePreview | null;
};

export type ParametrosUltimoGrupo = {
  groupId: string;
  groupName: string;
  groupPhoto: string | null;
};
