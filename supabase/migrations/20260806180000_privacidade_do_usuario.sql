/*
  Privacidade do usuário.

  O app já publicava dado pessoal para terceiros — ranking do grupo, "colegas focando",
  sessão pública — sem nenhum controle de quem é publicado. Só existia `perfil_publico`,
  que fecha o perfil mas não tira ninguém do ranking nem da lista de quem está estudando.

  1. Duas preferências novas, com o padrão igual ao comportamento de hoje, para que
     ninguém veja nada mudar sem ter pedido.
  2. `ranking_horas_membros_grupo` passa a respeitar a primeira delas.
*/

-- ───── 1. Preferências ─────
ALTER TABLE public.preferencias_cronograma
  ADD COLUMN IF NOT EXISTS aparecer_no_ranking BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sessao_publica_padrao BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.preferencias_cronograma.aparecer_no_ranking IS
  'Desligado, o usuário some do ranking dos grupos dele e da lista de quem está estudando agora. Continua membro.';
COMMENT ON COLUMN public.preferencias_cronograma.sessao_publica_padrao IS
  'Valor inicial do interruptor "sessão pública" ao montar uma sessão de foco.';

-- ───── 2. Ranking de horas por membro do grupo ─────
DROP FUNCTION IF EXISTS public.ranking_horas_membros_grupo(UUID, TEXT);

/*
  Mesma soma de antes, agora pulando quem optou por não aparecer.

  Passou a ser SECURITY DEFINER por necessidade: a preferência de outra pessoa é invisível
  sob RLS, e com SECURITY INVOKER o LEFT JOIN devolveria NULL para todo mundo menos você —
  ou seja, a opção não filtraria ninguém. Como a função deixa de depender da RLS para
  limitar o que enxerga, a checagem de que quem chama é membro do grupo é feita aqui
  dentro; sem ela, qualquer usuário autenticado leria o ranking de um grupo alheio.

  O COALESCE cobre quem nunca abriu as configurações e por isso não tem linha de
  preferências: sem ele, esses usuários sumiriam do ranking.
*/
CREATE FUNCTION public.ranking_horas_membros_grupo(p_grupo_id UUID, p_periodo TEXT DEFAULT 'total')
RETURNS TABLE (user_id UUID, total_minutos BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.user_id,
    COALESCE(SUM(s.tempo_minutos), 0)::BIGINT AS total_minutos
  FROM public.sessoes_foco s
  LEFT JOIN public.preferencias_cronograma p ON p.usuario_id = s.user_id
  WHERE s.grupo_id = p_grupo_id
    AND s.status IN ('salvo', 'pendente')
    AND COALESCE(p.aparecer_no_ranking, TRUE)
    AND EXISTS (
      SELECT 1 FROM public.membros m
      WHERE m.grupo_id = p_grupo_id AND m.user_id = auth.uid()
    )
    AND (
      p_periodo IS NULL
      OR p_periodo = 'total'
      OR (p_periodo = 'semanal' AND s.data_sessao >= date_trunc('week', CURRENT_DATE)::DATE)
      OR (p_periodo = 'mensal' AND s.data_sessao >= date_trunc('month', CURRENT_DATE)::DATE)
      OR (p_periodo = 'anual' AND s.data_sessao >= date_trunc('year', CURRENT_DATE)::DATE)
    )
  GROUP BY s.user_id
  ORDER BY total_minutos DESC;
$$;

GRANT EXECUTE ON FUNCTION public.ranking_horas_membros_grupo(UUID, TEXT) TO authenticated;
