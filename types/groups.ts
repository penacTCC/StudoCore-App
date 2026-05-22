import type { ProfilePreview } from "./profile";

export type Group = {
  id: string;
  nome_grupo: string;
  descricao: string | null;
  foto_grupo: string | null;
  meta_horas: number;
  publico: boolean;
  codigo_convite: string | null;
};

export type PublicGroupCard = {
    id: string;
    nome_grupo: string;
    descricao: string;
    foto_grupo?: string | null;
    meta_horas: number;
    publico: boolean;
    members: number;
    activeNow: number;
    weeklyTarget: number;
    isOnline: boolean;
}

export type PublicGroupCardProps = {
    group: PublicGroupCard;
    colorIndex: number;
    onJoin?: () => void;
}

export type GroupWithMembersCount = Group & {
  members: number;
};

export type PublicGroup = GroupWithMembersCount & {
  activeNow?: number;
  weeklyTarget?: number;
  isOnline?: boolean;
};

export type GroupMember = {
  id: string;
  user_id: string;
  grupo_id: string;
  administrador: boolean;
};

export type GroupMemberWithProfile = GroupMember & {
  profiles?: ProfilePreview | null;
  userData?: ProfilePreview | null;
};

export type LastGroupParams = {
  groupId: string;
  groupName: string;
  groupPhoto: string | null;
};
