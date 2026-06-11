import { supabase } from '@/repositories/supabase';
import type { Materia, MateriaUsuarioRow, ResultadoMateria, ResultadoDelecao } from '@/types/materias';

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
    usuarioId: row.usuario_id,
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
      usuarioId: row.usuario_id,
      nomeExibicao: row.nome_exibicao,
      nomeNormalizado: row.nome_normalizado,
      isPadrao: false,
    },
  };
}

/**
 * Verifica quantas sessões de foco estão vinculadas a uma matéria pelo nome de exibição.
 */
export async function contarSessoesVinculadas(
  usuarioId: string,
  nomeExibicao: string
): Promise<number> {
  const { count, error } = await supabase
    .from('sessoes_foco')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', usuarioId)
    .eq('disciplina', nomeExibicao);

  if (error) {
    console.error('Erro ao contar sessões vinculadas:', error.message);
    return 0;
  }

  return count ?? 0;
}

/**
 * Remove uma matéria customizada do usuário.
 * Se `forcar` for false e houver sessões vinculadas, retorna erro com a contagem.
 * Se `forcar` for true, remove mesmo com sessões (sessões permanecem intactas no banco).
 */
export async function deletarMateria(
  materiaId: string,
  usuarioId: string,
  nomeExibicao: string,
  forcar: boolean = false
): Promise<ResultadoDelecao> {
  // Verifica sessões vinculadas antes de deletar
  if (!forcar) {
    const sessoesVinculadas = await contarSessoesVinculadas(usuarioId, nomeExibicao);
    if (sessoesVinculadas > 0) {
      return {
        sucesso: false,
        erro: `Essa matéria possui ${sessoesVinculadas} ${sessoesVinculadas === 1 ? 'sessão de foco vinculada' : 'sessões de foco vinculadas'}.`,
        sessoesVinculadas,
      };
    }
  }

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

/**
 * Busca matérias criadas por outros usuários (comunidade).
 * Retorna apenas nomes únicos que o usuário atual NÃO possui na sua lista.
 */
export async function buscarMateriasComunidade(
  usuarioId: string,
  materiasDoUsuario: Materia[]
): Promise<Materia[]> {
  const { data, error } = await supabase
    .from('materias_usuario')
    .select('id, usuario_id, nome_exibicao, nome_normalizado')
    .neq('usuario_id', usuarioId)
    .order('nome_exibicao', { ascending: true })
    .limit(100);

  if (error) {
    console.error('Erro ao buscar matérias da comunidade:', error.message);
    return [];
  }

  const rows = data as MateriaUsuarioRow[];

  // Nomes normalizados que o usuário já possui (padrão + customizadas)
  const nomesDoUsuario = new Set(
    materiasDoUsuario.map((m) => m.nomeNormalizado)
  );

  // Deduplica por nome_normalizado e remove as que o usuário já tem
  const vistos = new Set<string>();
  const resultado: Materia[] = [];

  for (const row of rows) {
    if (nomesDoUsuario.has(row.nome_normalizado)) continue;
    if (vistos.has(row.nome_normalizado)) continue;

    vistos.add(row.nome_normalizado);
    resultado.push({
      id: row.id,
      usuarioId: row.usuario_id,
      nomeExibicao: row.nome_exibicao,
      nomeNormalizado: row.nome_normalizado,
      isPadrao: false,
    });
  }

  return resultado;
}
