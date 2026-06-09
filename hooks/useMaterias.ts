import { useState, useEffect, useCallback } from 'react';
import { subjects as materiasPadrao } from '@/constants/mock-data';
import { buscarMateriasUsuario, normalizarNomeMateria } from '@/services/materias';
import type { Materia } from '@/types/materias';

/**
 * Hook que une as matérias padrão do app com as matérias customizadas do usuário.
 * Fornece a lista completa, estado de carregamento, e função de recarga.
 */
export function useMaterias(usuarioId: string | null) {
  const [materiasCustomizadas, setMateriasCustomizadas] = useState<Materia[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Converte as matérias estáticas para o formato Materia
  const materiasPadraoFormatadas: Materia[] = materiasPadrao.map((nome) => ({
    nomeExibicao: nome,
    nomeNormalizado: normalizarNomeMateria(nome),
    isPadrao: true,
  }));

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
  const todasMaterias: Materia[] = [
    ...materiasPadraoFormatadas,
    ...materiasCustomizadas.filter(
      (custom) => !materiasPadraoFormatadas.some(
        (padrao) => padrao.nomeNormalizado === custom.nomeNormalizado
      )
    ),
  ];

  return {
    materias: todasMaterias,
    materiasCustomizadas,
    carregando,
    recarregarMaterias: carregar,
  };
}
