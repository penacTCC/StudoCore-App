-- Correções de contabilização de tempo das sessões de foco.
--
-- 1. `sessoes_foco.ultimo_inicio` / `concluido_em` foram criadas fora de banda, sem
--    migration, como TIMESTAMP WITHOUT TIME ZONE. O app grava com `toISOString()` (UTC),
--    mas o PostgREST devolve o valor sem marcador de fuso e o JS o lê como horário local —
--    o início da sessão aparecia no futuro e o cronômetro ao vivo dava negativo.
--    Convertidas aqui para TIMESTAMPTZ interpretando o conteúdo atual como UTC.
--
-- 2. `ranking_horas_membros_grupo` é redefinida para somar exatamente o mesmo
--    `tempo_minutos` que o resto do app soma, contando só sessões já encerradas — o
--    ranking mostrava um total diferente do "tempo de hoje" para os mesmos dados.

-- ───── 1. Colunas de tempo das sessões ─────
ALTER TABLE public.sessoes_foco
  ADD COLUMN IF NOT EXISTS ultimo_inicio TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS concluido_em TIMESTAMP WITH TIME ZONE;

DO $$
DECLARE
  coluna TEXT;
BEGIN
  FOREACH coluna IN ARRAY ARRAY['ultimo_inicio', 'concluido_em'] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'sessoes_foco'
        AND column_name = coluna
        AND data_type = 'timestamp without time zone'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.sessoes_foco ALTER COLUMN %I TYPE TIMESTAMP WITH TIME ZONE USING %I AT TIME ZONE ''UTC''',
        coluna, coluna
      );
    END IF;
  END LOOP;
END $$;

-- Mesma checagem para a participação em sessão de grupo: a tabela já existia no remoto,
-- então o CREATE TABLE IF NOT EXISTS da migration anterior não garantiu o tipo.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tab_sessao_membros'
      AND column_name = 'ultimo_inicio'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE public.tab_sessao_membros
      ALTER COLUMN ultimo_inicio TYPE TIMESTAMP WITH TIME ZONE USING ultimo_inicio AT TIME ZONE 'UTC';
  END IF;
END $$;

-- ───── 2. Ranking de horas por membro do grupo ─────
DROP FUNCTION IF EXISTS public.ranking_horas_membros_grupo(UUID, TEXT);

/*
  Soma os minutos de estudo de cada membro do grupo no período pedido.

  Só entram sessões já encerradas ('salvo'/'pendente'): enquanto a sessão está 'ativo' ou
  'pausado' o `tempo_minutos` gravado é parcial, e uma sessão pública em andamento não deve
  pontuar no ranking antes de terminar.

  O período usa `data_sessao` (DATE, no dia em que a sessão aconteceu) para bater com o
  "tempo de hoje" da tela de detalhes, que filtra pela mesma coluna.
*/
CREATE FUNCTION public.ranking_horas_membros_grupo(p_grupo_id UUID, p_periodo TEXT DEFAULT 'total')
RETURNS TABLE (user_id UUID, total_minutos BIGINT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    s.user_id,
    COALESCE(SUM(s.tempo_minutos), 0)::BIGINT AS total_minutos
  FROM public.sessoes_foco s
  WHERE s.grupo_id = p_grupo_id
    AND s.status IN ('salvo', 'pendente')
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
