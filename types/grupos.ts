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
  // Ofensiva coletiva (streak) do grupo — cota diária de estudo batida em dias seguidos.
  ofensiva: number;
  melhor_ofensiva: number;
  ultima_data_estudo: string | null;
};

// Retorno da RPC registrar_ofensiva_grupo — estado da ofensiva coletiva depois do recálculo.
export type OfensivaGrupo = Pick<Grupo, 'meta_horas' | 'ofensiva' | 'melhor_ofensiva' | 'ultima_data_estudo'>;

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
  /*
    Permissão de convidar concedida pelo admin (migration 20260806170000). Opcional porque
    um banco que ainda não recebeu a migration devolve a linha sem a coluna — nesse caso
    vale o mesmo que `false`. O admin convida sempre, sem depender deste campo.
  */
  pode_convidar?: boolean;
  /*
    Participação da própria pessoa (migration 20260806190000), opcionais pelo mesmo motivo
    de `pode_convidar`. `meta_horas_pessoal` nulo significa seguir a meta do grupo.
  */
  silenciar_notificacoes?: boolean;
  meta_horas_pessoal?: number | null;
  rank?: number;
  ofensiva?: number;
};

// Perfil com a gamificação (ofensiva) embutida via join do PostgREST em buscarMembrosGrupo.
// `ultima_data_estudo` vem junto porque a ofensiva gravada pode estar vencida — quem decide
// se ela ainda vale é `ofensivaVigente` (services/gamificacao).
type GamificacaoDoMembro = { ofensiva: number; ultima_data_estudo: string | null };

type PerfilComGamificacao = ProfilePreview & {
  gamificacoes?: GamificacaoDoMembro | GamificacaoDoMembro[] | null;
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
