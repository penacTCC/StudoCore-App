import { supabase } from '@/repositories/supabase';
import type { Materia, MateriaUsuarioRow, ResultadoMateria } from '@/types/materias';

/**
 * Normaliza o nome de uma matéria para comparação:
 * - Remove acentos
 * - Converte para minúsculo
 * - Remove espaços extras
 */
export function normalizarNomeMateria(nome: string): string {
  return nome
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/\s+/g, '');            // remove espaços
}

/**
 * Busca todas as matérias customizadas de um usuário no Supabase.
 */
export async function buscarMateriasUsuario(usuarioId: string): Promise<Materia[]> {
  const { data, error } = await supabase
    .from('materias_usuario')
    .select('*')
    .eq('usuario_id', usuarioId)
    .order('nome_exibicao', { ascending: true });

  if (error) {
    console.error('Erro ao buscar matérias do usuário:', error.message);
    return [];
  }

  return (data as MateriaUsuarioRow[]).map((row) => ({
    id: row.id,
    nomeExibicao: row.nome_exibicao,
    nomeNormalizado: row.nome_normalizado,
    isPadrao: false,
  }));
}

/**
 * Cria uma nova matéria para o usuário.
 * Retorna erro se a matéria (normalizada) já existir.
 */
export async function criarMateria(
  usuarioId: string,
  nomeExibicao: string
): Promise<ResultadoMateria> {
  const nomeLimpo = nomeExibicao.trim();

  if (!nomeLimpo) {
    return { sucesso: false, erro: 'O nome da matéria não pode estar vazio.' };
  }

  const nomeNormalizado = normalizarNomeMateria(nomeLimpo);

  const { data, error } = await supabase
    .from('materias_usuario')
    .insert({
      usuario_id: usuarioId,
      nome_exibicao: nomeLimpo,
      nome_normalizado: nomeNormalizado,
    })
    .select()
    .single();

  if (error) {
    // Código 23505 = violação de UNIQUE no Postgres
    if (error.code === '23505') {
      return { sucesso: false, erro: 'Essa matéria já existe na sua lista.' };
    }
    console.error('Erro ao criar matéria:', error.message);
    return { sucesso: false, erro: 'Erro inesperado ao criar matéria.' };
  }

  const row = data as MateriaUsuarioRow;

  return {
    sucesso: true,
    materia: {
      id: row.id,
      nomeExibicao: row.nome_exibicao,
      nomeNormalizado: row.nome_normalizado,
      isPadrao: false,
    },
  };
}

/**
 * Remove uma matéria customizada do usuário.
 */
export async function deletarMateria(materiaId: string): Promise<{ sucesso: boolean; erro?: string }> {
  const { error } = await supabase
    .from('materias_usuario')
    .delete()
    .eq('id', materiaId);

  if (error) {
    console.error('Erro ao deletar matéria:', error.message);
    return { sucesso: false, erro: 'Erro ao remover a matéria.' };
  }

  return { sucesso: true };
}
