-- ─────────────────────────────────────────────────────────────────────────────
-- Migration de reconciliação — só necessária porque `20260813000000` e
-- `20260813010000` foram aplicadas no ambiente remoto ANTES de serem reescritas (na
-- própria sessão de implementação): a versão que rodou lá ainda tinha `comunidade_salvos`
-- com o par polimórfico (origem, referencia_id) para as três origens, sem
-- `importado_de_usuario_id` em `planos`. Numa instalação nova, que já roda as duas
-- migrations na forma final, todo DROP abaixo não encontra nada pra apagar — idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. planos.importado_de_usuario_id + comunidade_importar_plano (idempotente, mas
--    reafirmado aqui pro caso de este arquivo ser o primeiro a rodar num ambiente que já
--    tinha 20260813000000 na forma antiga, sem esta coluna).
ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS importado_de_usuario_id UUID
    CONSTRAINT planos_importado_de_usuario_id_fkey REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.planos.importado_de_usuario_id IS
  'Preenchido só na cópia que comunidade_importar_plano cria — quem publicou o plano original. ON DELETE SET NULL: se o autor original apagar a conta, a cópia continua existindo, só perde o badge de importado.';

CREATE OR REPLACE FUNCTION public.comunidade_importar_plano(p_plano_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eu       UUID := auth.uid();
  v_origem   public.planos%ROWTYPE;
  v_novo_id  UUID;
  v_bloco    RECORD;
  v_materia  UUID;
BEGIN
  IF v_eu IS NULL THEN
    RAISE EXCEPTION 'Sessão expirada.';
  END IF;

  SELECT * INTO v_origem FROM public.planos WHERE id = p_plano_id;

  IF v_origem.id IS NULL
     OR NOT v_origem.publico
     OR NOT public.comunidade_autor_visivel(v_origem.usuario_id) THEN
    RAISE EXCEPTION 'Esse plano não está mais disponível.';
  END IF;

  INSERT INTO public.planos (usuario_id, nome, cor, agenda_tipo, importado_de_usuario_id)
  VALUES (v_eu, v_origem.nome, v_origem.cor, 'nenhuma', v_origem.usuario_id)
  RETURNING id INTO v_novo_id;

  FOR v_bloco IN
    SELECT b.*, m.nome_exibicao, m.nome_normalizado, m.cor AS materia_cor
    FROM public.planos_blocos b
    LEFT JOIN public.materias_usuario m ON m.id = b.materia_id
    WHERE b.plano_id = p_plano_id
  LOOP
    v_materia := NULL;

    IF v_bloco.materia_id IS NOT NULL THEN
      SELECT m.id INTO v_materia
      FROM public.materias_usuario m
      WHERE m.nome_normalizado = v_bloco.nome_normalizado
        AND (m.usuario_id = v_eu OR m.usuario_id IS NULL)
      ORDER BY (m.usuario_id IS NULL)
      LIMIT 1;

      IF v_materia IS NULL THEN
        INSERT INTO public.materias_usuario (usuario_id, nome_exibicao, nome_normalizado, cor)
        VALUES (v_eu, v_bloco.nome_exibicao, v_bloco.nome_normalizado, v_bloco.materia_cor)
        RETURNING id INTO v_materia;
      END IF;
    END IF;

    INSERT INTO public.planos_blocos
      (plano_id, hora_inicio, duracao_min, tipo, materia_id, topico, notificar, antecedencia_min, dia_semana)
    VALUES
      (v_novo_id, v_bloco.hora_inicio, v_bloco.duracao_min, v_bloco.tipo, v_materia,
       v_bloco.topico, v_bloco.notificar, v_bloco.antecedencia_min, v_bloco.dia_semana);
  END LOOP;

  RETURN v_novo_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. comunidade_salvos: schema antigo (origem/referencia_id, 3 origens) → schema novo
--    (FK direta pra sessoes_foco, só Galeria). A tabela estava vazia no ambiente onde
--    essa troca foi necessária — sem isso não seria seguro fazer DROP TABLE aqui.
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.comunidade_salvos_arquivos;
DROP FUNCTION IF EXISTS public.comunidade_salvos_planos;
DROP FUNCTION IF EXISTS public.comunidade_salvos_galeria;
DROP TABLE IF EXISTS public.comunidade_salvos;

CREATE TABLE public.comunidade_salvos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sessao_id  UUID NOT NULL REFERENCES public.sessoes_foco(id) ON DELETE CASCADE,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, sessao_id)
);

CREATE INDEX comunidade_salvos_user_idx
  ON public.comunidade_salvos (user_id, criado_em DESC);

ALTER TABLE public.comunidade_salvos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem os próprios salvos"
  ON public.comunidade_salvos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários salvam o que podem ver"
  ON public.comunidade_salvos FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.comunidade_publicacao_visivel('galeria', sessao_id)
  );

CREATE POLICY "Usuários removem os próprios salvos"
  ON public.comunidade_salvos FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.comunidade_salvos_galeria(
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
  salvo_por_mim   BOOLEAN,
  salvo_em        TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.user_id,
    p.nome_usuario,
    p.foto_usuario,
    s.foto_path,
    s.foto_legenda,
    s.disciplina,
    s.tempo_minutos,
    s.created_at,
    (SELECT count(*) FROM public.comunidade_curtidas c
      WHERE c.origem = 'galeria' AND c.referencia_id = s.id),
    EXISTS (SELECT 1 FROM public.comunidade_curtidas c
      WHERE c.origem = 'galeria' AND c.referencia_id = s.id AND c.user_id = auth.uid()),
    (SELECT count(*) FROM public.comunidade_comentarios m
      WHERE m.origem = 'galeria' AND m.referencia_id = s.id),
    TRUE,
    sv.criado_em
  FROM public.comunidade_salvos sv
  JOIN public.sessoes_foco s ON s.id = sv.sessao_id
  JOIN public.profiles p ON p.id = s.user_id
  WHERE sv.user_id = auth.uid()
    AND s.is_public
    AND s.foto_path IS NOT NULL
    AND COALESCE((SELECT pr.perfil_publico FROM public.profiles pr WHERE pr.id = s.user_id), TRUE)
    AND NOT public.comunidade_bloqueio_entre(s.user_id, auth.uid())
    AND (p_cursor_data IS NULL
         OR sv.criado_em < p_cursor_data
         OR (sv.criado_em = p_cursor_data AND sv.sessao_id < p_cursor_id))
  ORDER BY sv.criado_em DESC, sv.sessao_id DESC
  LIMIT LEAST(GREATEST(p_limite, 1), 30);
$$;

REVOKE ALL ON FUNCTION public.comunidade_salvos_galeria FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.comunidade_salvos_galeria TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. comunidade_feed_galeria: reafirma a coluna salvo_por_mim (idempotente).
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. comunidade_feed_arquivos / comunidade_feed_planos: a versão antiga desta migration
--    tinha acrescentado `salvo_por_mim` (quando "salvar" ainda cobria as três origens).
--    Reverte pra exatamente a definição de 20260807210000_arquivos_e_planos_publicos.sql
--    — arquivo/plano não têm "salvar" na versão final (têm "Adicionar aos meus arquivos"
--    e "Importar plano", que já existiam e não mudam aqui).
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.comunidade_feed_arquivos;

CREATE OR REPLACE FUNCTION public.comunidade_feed_arquivos(
  p_limite INT DEFAULT 6,
  p_cursor_data TIMESTAMPTZ DEFAULT NULL,
  p_cursor_id UUID DEFAULT NULL
)
RETURNS TABLE (
  arquivo_id      UUID,
  autor_id        UUID,
  autor_nome      TEXT,
  autor_foto      TEXT,
  titulo          TEXT,
  storage_path    TEXT,
  disciplina      TEXT,
  tamanho_bytes   BIGINT,
  criado_em       TIMESTAMPTZ,
  curtidas        BIGINT,
  curtido_por_mim BOOLEAN,
  comentarios     BIGINT
)
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.user_id,
    p.nome_usuario,
    p.foto_usuario,
    a.titulo,
    a.storage_path,
    a.disciplina,
    a.tamanho_bytes,
    a.created_at,
    (SELECT count(*) FROM public.comunidade_curtidas c
      WHERE c.origem = 'arquivo' AND c.referencia_id = a.id),
    EXISTS (SELECT 1 FROM public.comunidade_curtidas c
      WHERE c.origem = 'arquivo' AND c.referencia_id = a.id AND c.user_id = auth.uid()),
    (SELECT count(*) FROM public.comunidade_comentarios m
      WHERE m.origem = 'arquivo' AND m.referencia_id = a.id)
  FROM public.arquivos a
  JOIN public.profiles p ON p.id = a.user_id
  WHERE a.publico
    AND (p_cursor_data IS NULL OR (a.created_at, a.id) < (p_cursor_data, p_cursor_id))
  ORDER BY a.created_at DESC, a.id DESC
  LIMIT LEAST(GREATEST(p_limite, 1), 30);
$$;

DROP FUNCTION IF EXISTS public.comunidade_feed_planos;

CREATE OR REPLACE FUNCTION public.comunidade_feed_planos(
  p_limite INT DEFAULT 6,
  p_cursor_data TIMESTAMPTZ DEFAULT NULL,
  p_cursor_id UUID DEFAULT NULL
)
RETURNS TABLE (
  plano_id        UUID,
  autor_id        UUID,
  autor_nome      TEXT,
  autor_foto      TEXT,
  nome            TEXT,
  cor             TEXT,
  blocos          BIGINT,
  minutos_totais  BIGINT,
  materias        JSONB,
  criado_em       TIMESTAMPTZ,
  curtidas        BIGINT,
  curtido_por_mim BOOLEAN,
  comentarios     BIGINT
)
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    pl.id,
    pl.usuario_id,
    p.nome_usuario,
    p.foto_usuario,
    pl.nome,
    pl.cor,
    (SELECT count(*) FROM public.planos_blocos b WHERE b.plano_id = pl.id),
    COALESCE((SELECT sum(b.duracao_min) FROM public.planos_blocos b
              WHERE b.plano_id = pl.id AND b.tipo = 'estudo'), 0),
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('nome', t.nome, 'cor', t.cor) ORDER BY t.ordem)
      FROM (
        SELECT m.nome_exibicao AS nome, m.cor AS cor, min(b.hora_inicio) AS ordem
        FROM public.planos_blocos b
        JOIN public.materias_usuario m ON m.id = b.materia_id
        WHERE b.plano_id = pl.id
        GROUP BY m.id, m.nome_exibicao, m.cor
      ) t
    ), '[]'::jsonb),
    pl.created_at,
    (SELECT count(*) FROM public.comunidade_curtidas c
      WHERE c.origem = 'plano' AND c.referencia_id = pl.id),
    EXISTS (SELECT 1 FROM public.comunidade_curtidas c
      WHERE c.origem = 'plano' AND c.referencia_id = pl.id AND c.user_id = auth.uid()),
    (SELECT count(*) FROM public.comunidade_comentarios m
      WHERE m.origem = 'plano' AND m.referencia_id = pl.id)
  FROM public.planos pl
  JOIN public.profiles p ON p.id = pl.usuario_id
  WHERE pl.publico
    AND (p_cursor_data IS NULL OR (pl.created_at, pl.id) < (p_cursor_data, p_cursor_id))
  ORDER BY pl.created_at DESC, pl.id DESC
  LIMIT LEAST(GREATEST(p_limite, 1), 30);
$$;
