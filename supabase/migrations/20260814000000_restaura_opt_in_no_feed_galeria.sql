-- ─────────────────────────────────────────────────────────────────────────────
-- Restaura o opt-in (comunidade_usuario_no_feed) no feed da Galeria.
--
-- A reescrita dos "Salvos" (20260813010000 e reafirmado em 20260813020000)
-- redefiniu `comunidade_feed_galeria` sem a checagem de opt-in: o WHERE passou a
-- aceitar só `is_public`, `perfil_publico` e `bloqueio`. Mas `comunidade_dono_da_publicacao`
-- (20260807190000) continua exigindo `comunidade_usuario_no_feed`. Resultado desse
-- descompasso no banco de produção:
--
--   * o feed mostra cards de autores que NÃO optaram pelo Explorar;
--   * curtir/comentar/salvar cai no portão comunidade_publicacao_visivel →
--     comunidade_dono_da_publicacao → retorna null (sem opt-in) → RLS recusa o INSERT.
--
-- A intenção original (20260807190000) é explícita: sem opt-in o card some E as
-- interações novas são recusadas. O feed é o lado que está divergente — corrige-se
-- ele, não o portão de RLS, para preservar o modelo de consentimento.
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.comunidade_feed_galeria;

CREATE OR REPLACE FUNCTION public.comunidade_feed_galeria(
  p_limite INT DEFAULT 6,
  p_cursor_data TIMESTAMPTZ DEFAULT NULL,
  p_cursor_id UUID DEFAULT NULL
)
RETURNS TABLE (
  sessao_id       UUID,
  autor_id        UUID,
  autor_nome      TEXT,
  autor_foto      TEXT,
  foto_path       TEXT,
  foto_legenda    TEXT,
  disciplina      TEXT,
  tempo_minutos   INT,
  criado_em       TIMESTAMPTZ,
  curtidas        BIGINT,
  curtido_por_mim BOOLEAN,
  comentarios     BIGINT,
  salvo_por_mim   BOOLEAN
)
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH sessoes AS (
    SELECT DISTINCT ON (COALESCE(s.execucao_id, s.id))
      s.id,
      s.user_id,
      s.foto_path,
      s.foto_legenda,
      s.disciplina,
      s.tempo_minutos,
      COALESCE(s.foto_criada_em, s.concluido_em, s.created_at) AS criado_em
    FROM public.sessoes_foco s
    JOIN public.profiles p ON p.id = s.user_id
    WHERE s.foto_path IS NOT NULL
      AND s.is_public
      AND COALESCE(p.perfil_publico, TRUE)
      AND public.comunidade_usuario_no_feed(s.user_id)
      AND NOT public.comunidade_bloqueio_entre(s.user_id, auth.uid())
    ORDER BY COALESCE(s.execucao_id, s.id), s.created_at
  )
  SELECT
    sessoes.id,
    sessoes.user_id,
    p.nome_usuario,
    p.foto_usuario,
    sessoes.foto_path,
    sessoes.foto_legenda,
    sessoes.disciplina,
    sessoes.tempo_minutos,
    sessoes.criado_em,
    (SELECT count(*) FROM public.comunidade_curtidas c
      WHERE c.origem = 'galeria' AND c.referencia_id = sessoes.id),
    EXISTS (SELECT 1 FROM public.comunidade_curtidas c
      WHERE c.origem = 'galeria' AND c.referencia_id = sessoes.id AND c.user_id = auth.uid()),
    (SELECT count(*) FROM public.comunidade_comentarios m
      WHERE m.origem = 'galeria' AND m.referencia_id = sessoes.id),
    EXISTS (SELECT 1 FROM public.comunidade_salvos sv
      WHERE sv.sessao_id = sessoes.id AND sv.user_id = auth.uid())
  FROM sessoes
  JOIN public.profiles p ON p.id = sessoes.user_id
  WHERE p_cursor_data IS NULL
     OR (sessoes.criado_em, sessoes.id) < (p_cursor_data, p_cursor_id)
  ORDER BY sessoes.criado_em DESC, sessoes.id DESC
  LIMIT LEAST(GREATEST(p_limite, 1), 30);
$$;