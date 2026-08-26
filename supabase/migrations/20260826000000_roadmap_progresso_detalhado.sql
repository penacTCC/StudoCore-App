/*
  Progresso detalhado do roadmap de grupo — a tela nova precisa de duas coisas que
  `grupo_progresso_roadmap` (20260811090000_roadmap_ia.sql) não devolve:

  1. O progresso POR MEMBRO (não só o agregado "M de N concluíram"), para a lista
     individual da tela.
  2. Os blocos do roadmap em si (dia, hora, matéria, tópico), que hoje ninguém além do
     admin consegue ler — RLS de `planos_blocos` só libera dono ou plano público, e o
     canônico do roadmap não é público.

  Ambas reaproveitam as CTEs de `grupo_progresso_roadmap` e o mesmo guard de acesso
  (STABLE SECURITY DEFINER, só membros do grupo conseguem chamar).
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Progresso por membro
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.grupo_progresso_roadmap_membros(p_grupo_id UUID)
RETURNS TABLE (
  user_id UUID,
  blocos_concluidos BIGINT,
  blocos_estudo BIGINT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH canonicos AS (
    SELECT p.id
    FROM public.planos p
    WHERE p.origem_grupo_id = p_grupo_id
    ORDER BY p.created_at DESC
    LIMIT 1
  ),
  membros_ativos AS (
    SELECT m.user_id FROM public.membros m WHERE m.grupo_id = p_grupo_id
  ),
  copias AS (
    SELECT p.id AS plano_id, p.usuario_id,
      (SELECT count(*) FROM public.planos_blocos b
        WHERE b.plano_id = p.id AND b.tipo = 'estudo') AS blocos_estudo
    FROM public.planos p
    JOIN canonicos c ON p.id = c.id OR p.origem_roadmap_plano_id = c.id
  )
  SELECT
    cp.usuario_id,
    count(DISTINCT cc.bloco_id),
    max(cp.blocos_estudo)
  FROM copias cp
  JOIN membros_ativos ma ON ma.user_id = cp.usuario_id
  LEFT JOIN public.planos_blocos_concluidos cc
    ON cc.usuario_id = cp.usuario_id
    AND EXISTS (
      SELECT 1 FROM public.planos_blocos b
      WHERE b.plano_id = cp.plano_id AND b.id = cc.bloco_id
    )
    AND (cc.concluido_em at time zone 'America/Sao_Paulo')::date
        >= date_trunc('week', (now() at time zone 'America/Sao_Paulo')::date)
  WHERE EXISTS (
    SELECT 1 FROM public.membros m
    WHERE m.grupo_id = p_grupo_id AND m.user_id = auth.uid()
  )
  GROUP BY cp.usuario_id;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Os blocos do roadmap (canônico mais recente do grupo)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.grupo_roadmap_blocos(p_grupo_id UUID)
RETURNS TABLE (
  dia_semana INTEGER,
  hora_inicio TIME,
  duracao_min INTEGER,
  tipo TEXT,
  materia_nome TEXT,
  materia_cor TEXT,
  topico TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.dia_semana,
    b.hora_inicio,
    b.duracao_min,
    b.tipo,
    m.nome_exibicao,
    m.cor,
    b.topico
  FROM public.planos_blocos b
  LEFT JOIN public.materias_usuario m ON m.id = b.materia_id
  WHERE b.plano_id = (
    SELECT p.id FROM public.planos p
    WHERE p.origem_grupo_id = p_grupo_id
    ORDER BY p.created_at DESC
    LIMIT 1
  )
  AND EXISTS (
    SELECT 1 FROM public.membros m2
    WHERE m2.grupo_id = p_grupo_id AND m2.user_id = auth.uid()
  )
  ORDER BY b.dia_semana NULLS FIRST, b.hora_inicio;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Fechar à API pública — só autenticados (membros do grupo, checado dentro da função)
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.grupo_progresso_roadmap_membros(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grupo_progresso_roadmap_membros(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.grupo_roadmap_blocos(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grupo_roadmap_blocos(UUID) TO authenticated;
