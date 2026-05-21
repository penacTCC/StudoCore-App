export type Profile = {
    id: string;
    nome_usuario: string | null;
    nome_real: string | null;
    foto_usuario: string | null;
    data_nascimento?: string | null;
    materia_favorita?: string | null;
    minutos_semana?: number | null;
    questoes_feitas?: number | null;
};

export type ProfilePreview = Pick<
  Profile,
  "nome_real" | "nome_usuario" | "foto_usuario"
>;
