/** Representa uma matéria/disciplina disponível para estudo. */
export interface Materia {
  id?: string;
  nomeExibicao: string;
  nomeNormalizado: string;
  isPadrao: boolean; // true = matéria estática do app, false = criada pelo usuário
}

/** Linha retornada pelo Supabase na tabela materias_usuario. */
export interface MateriaUsuarioRow {
  id: string;
  usuario_id: string;
  nome_exibicao: string;
  nome_normalizado: string;
  created_at: string;
}

/** Resultado padronizado de operações do service de matérias. */
export interface ResultadoMateria {
  sucesso: boolean;
  erro?: string;
  materia?: Materia;
}
