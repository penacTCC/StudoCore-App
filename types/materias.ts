/** Representa uma matéria/disciplina disponível para estudo. */
export interface Materia {
  id?: string;
  usuarioId?: string;
  nomeExibicao: string;
  nomeNormalizado: string;
  isPadrao: boolean; // true = matéria global do sistema (usuario_id nulo), false = criada pelo usuário
  cor: string;
}

/** Matéria com cor associada para exibição em componentes visuais. */
export interface MateriaComCor extends Materia {
  cor: string;
}

/** Linha retornada pelo Supabase na tabela materias_usuario. */
export interface MateriaUsuarioRow {
  id: string;
  usuario_id: string | null; // NULL = matéria padrão do sistema, visível a todos
  nome_exibicao: string;
  nome_normalizado: string;
  cor: string;
  created_at: string;
}

/** Resultado padronizado de operações do service de matérias. */
export interface ResultadoMateria {
  sucesso: boolean;
  erro?: string;
  materia?: Materia;
}

/** Resultado padronizado de operações de deleção. */
export interface ResultadoDelecao {
  sucesso: boolean;
  erro?: string;
  sessoesVinculadas?: number;
}

export type MateriaMaisEstudada = { rotulo: string; pct: number; cor: string };