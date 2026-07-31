import { useState, useEffect, useCallback, useMemo } from 'react';
import { buscarMateriasUsuario, deletarMateria } from '@/services/materias';
import type { Materia, MateriaComCor } from '@/types/materias';
import { toast } from '@/services/toast';
import { confirm } from '@/services/confirm';

/**
 * Hook que busca as matérias padrão do sistema + as customizadas do usuário
 * (ambas já vêm de materias_usuario, com cor persistida). Fornece a lista
 * completa, estado de carregamento e funções de gestão.
 */
export function useMaterias(usuarioId: string | null) {
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    if (!usuarioId) {
      setCarregando(false);
      return;
    }

    setCarregando(true);
    const resultado = await buscarMateriasUsuario(usuarioId);
    setMaterias(resultado);
    setCarregando(false);
  }, [usuarioId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const materiasCustomizadas = useMemo(
    () => materias.filter((m) => !m.isPadrao),
    [materias]
  );

  // Já vem com cor persistida no banco; mantido pelo mesmo nome pra não quebrar quem já usa (AddBlockModal, profile, etc.)
  const materiasComCores: MateriaComCor[] = materias as MateriaComCor[];
  const todasMaterias = materias;

  /**
   * Remove uma matéria customizada com verificação de sessões vinculadas.
   * Se houver sessões, mostra Alert com opção de forçar a exclusão.
   */
  const deletarMateriaComVerificacao = useCallback(
    async (materiaId: string, nomeExibicao: string): Promise<boolean> => {
      if (!usuarioId) return false;

      // Primeira tentativa sem forçar
      const resultado = await deletarMateria(materiaId, usuarioId, nomeExibicao, false);

      if (resultado.sucesso) {
        await carregar();
        return true;
      }

      // Se tem sessões vinculadas, perguntar ao usuário
      if (resultado.sessoesVinculadas && resultado.sessoesVinculadas > 0) {
        return new Promise<boolean>((resolve) => {
          confirm({
            title: 'Matéria com sessões vinculadas',
            message: `${resultado.erro}\n\nDeseja remover mesmo assim? As sessões de foco anteriores serão mantidas.`,
            confirmText: 'Remover mesmo assim',
            destructive: true,
            onCancel: () => resolve(false),
            onConfirm: async () => {
              const forceResult = await deletarMateria(materiaId, usuarioId, nomeExibicao, true);
              if (forceResult.sucesso) {
                await carregar();
                resolve(true);
              } else {
                toast.error(forceResult.erro || 'Não foi possível remover.');
                resolve(false);
              }
            },
          });
        });
      }

      // Outro tipo de erro
      toast.error(resultado.erro || 'Não foi possível remover a matéria.');
      return false;
    },
    [usuarioId, carregar]
  );

  return {
    materias: todasMaterias,
    materiasCustomizadas,
    materiasComCores,
    carregando,
    recarregarMaterias: carregar,
    deletarMateriaComVerificacao,
  };
}
