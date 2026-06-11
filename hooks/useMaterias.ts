import { useState, useEffect, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { subjects as materiasPadrao, disciplinasComCores } from '@/constants/mock-data';
import {
  buscarMateriasUsuario,
  normalizarNomeMateria,
  deletarMateria,
} from '@/services/materias';
import type { Materia, MateriaComCor } from '@/types/materias';

/** Paleta de cores para matérias customizadas que não têm cor definida no array padrão. */
const CORES_CUSTOMIZADAS = [
  '#06b6d4', // cyan
  '#f97316', // orange
  '#ec4899', // pink
  '#14b8a6', // teal
  '#a855f7', // purple
  '#ef4444', // red
  '#84cc16', // lime
  '#f59e0b', // amber
  '#6366f1', // indigo
  '#22d3ee', // sky
];

/** Gera uma cor determinística baseada no nome normalizado. */
function corParaNome(nomeNormalizado: string): string {
  let hash = 0;
  for (let i = 0; i < nomeNormalizado.length; i++) {
    hash = nomeNormalizado.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CORES_CUSTOMIZADAS[Math.abs(hash) % CORES_CUSTOMIZADAS.length];
}

/**
 * Hook que une as matérias padrão do app com as matérias customizadas do usuário.
 * Fornece a lista completa, estado de carregamento, cores associadas e funções de gestão.
 */
export function useMaterias(usuarioId: string | null) {
  const [materiasCustomizadas, setMateriasCustomizadas] = useState<Materia[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Converte as matérias estáticas para o formato Materia
  const materiasPadraoFormatadas: Materia[] = useMemo(
    () =>
      materiasPadrao.map((nome) => ({
        nomeExibicao: nome,
        nomeNormalizado: normalizarNomeMateria(nome),
        isPadrao: true,
      })),
    []
  );

  const carregar = useCallback(async () => {
    if (!usuarioId) {
      setCarregando(false);
      return;
    }

    setCarregando(true);
    const resultado = await buscarMateriasUsuario(usuarioId);
    setMateriasCustomizadas(resultado);
    setCarregando(false);
  }, [usuarioId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Junta padrão + customizadas, removendo duplicatas por nome normalizado
  const todasMaterias: Materia[] = useMemo(
    () => [
      ...materiasPadraoFormatadas,
      ...materiasCustomizadas.filter(
        (custom) =>
          !materiasPadraoFormatadas.some(
            (padrao) => padrao.nomeNormalizado === custom.nomeNormalizado
          )
      ),
    ],
    [materiasPadraoFormatadas, materiasCustomizadas]
  );

  // Versão com cores para componentes visuais (AddBlockModal, profile, etc.)
  const materiasComCores: MateriaComCor[] = useMemo(
    () =>
      todasMaterias.map((materia) => {
        // Procura no array estático de cores
        const corPadrao = disciplinasComCores.find(
          (d) =>
            normalizarNomeMateria(d.name) === materia.nomeNormalizado
        );
        return {
          ...materia,
          cor: corPadrao?.color ?? corParaNome(materia.nomeNormalizado),
        };
      }),
    [todasMaterias]
  );

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
          Alert.alert(
            'Matéria com sessões vinculadas',
            `${resultado.erro}\n\nDeseja remover mesmo assim? As sessões de foco anteriores serão mantidas.`,
            [
              {
                text: 'Cancelar',
                style: 'cancel',
                onPress: () => resolve(false),
              },
              {
                text: 'Remover mesmo assim',
                style: 'destructive',
                onPress: async () => {
                  const forceResult = await deletarMateria(
                    materiaId,
                    usuarioId,
                    nomeExibicao,
                    true
                  );
                  if (forceResult.sucesso) {
                    await carregar();
                    resolve(true);
                  } else {
                    Alert.alert('Erro', forceResult.erro || 'Não foi possível remover.');
                    resolve(false);
                  }
                },
              },
            ]
          );
        });
      }

      // Outro tipo de erro
      Alert.alert('Erro', resultado.erro || 'Não foi possível remover a matéria.');
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
