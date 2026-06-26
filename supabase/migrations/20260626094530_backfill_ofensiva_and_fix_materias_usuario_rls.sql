-- 1. Recalcula a ofensiva real de cada usuário a partir do histórico de sessoes_foco,
--    para não "zerar" quem já está com sequência ativa quando a feature de ofensiva entrar no ar.
WITH dias AS (
  SELECT DISTINCT user_id, data_sessao AS dia
  FROM public.sessoes_foco
  WHERE data_sessao IS NOT NULL
),
ilhas AS (
  -- Técnica "gaps and islands": dias consecutivos caem no mesmo grupo (dia - posição = constante).
  SELECT user_id, dia,
         dia - (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY dia))::int AS grupo
  FROM dias
),
sequencias AS (
  SELECT user_id, MAX(dia) AS fim, COUNT(*) AS tamanho
  FROM ilhas
  GROUP BY user_id, grupo
),
sequencia_ativa AS (
  -- Só conta como ofensiva viva se o último dia estudado foi hoje ou ontem.
  SELECT s.user_id, s.tamanho
  FROM sequencias s
  WHERE s.fim = (SELECT MAX(s2.fim) FROM sequencias s2 WHERE s2.user_id = s.user_id)
    AND s.fim >= CURRENT_DATE - 1
),
melhor_sequencia AS (
  SELECT user_id, MAX(tamanho) AS tamanho
  FROM sequencias
  GROUP BY user_id
),
ultimo_dia AS (
  SELECT user_id, MAX(dia) AS dia
  FROM dias
  GROUP BY user_id
)
UPDATE public.gamificacoes g
SET ofensiva = COALESCE(sa.tamanho, 0),
    melhor_ofensiva = GREATEST(COALESCE(ms.tamanho, 0), COALESCE(sa.tamanho, 0)),
    ultima_data_estudo = ud.dia
FROM (SELECT user_id FROM public.gamificacoes) g2
LEFT JOIN sequencia_ativa sa ON sa.user_id = g2.user_id
LEFT JOIN melhor_sequencia ms ON ms.user_id = g2.user_id
LEFT JOIN ultimo_dia ud ON ud.user_id = g2.user_id
WHERE g.user_id = g2.user_id;

-- 2. Corrige o RLS de materias_usuario (estava completamente desabilitado, exposto a qualquer anon key).
--    Mantém os mesmos acessos que o código em services/materias.ts já usa:
--    leitura de qualquer matéria (próprias + comunidade), escrita só na própria.
ALTER TABLE public.materias_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Matérias visíveis para usuários logados"
  ON public.materias_usuario FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários podem criar suas próprias matérias"
  ON public.materias_usuario FOR INSERT
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Usuários podem apagar suas próprias matérias"
  ON public.materias_usuario FOR DELETE
  USING (auth.uid() = usuario_id);
