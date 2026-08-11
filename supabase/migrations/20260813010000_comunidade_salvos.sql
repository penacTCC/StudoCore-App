-- ─────────────────────────────────────────────────────────────────────────────
-- "Salvos" — só fotos da Galeria, de propósito.
--
-- Arquivo e plano publicados na Comunidade já têm uma ação de cópia de verdade
-- ("Adicionar aos meus arquivos" / "Importar plano" — RPC comunidade_importar_plano)
-- que os leva pra um lugar seu de uso real (Vault → Arquivos, Cronograma → Planos).
-- Duplicar isso como "salvar" criaria dois jeitos de guardar a mesma coisa. A foto de
-- sessão de outra pessoa não tem equivalente — não existe "copiar a sessão alheia pra
-- minha área", só guardar uma referência pra ver depois. É por isso que "Salvos" cobre
-- só `galeria`: schema direto (FK pra sessoes_foco), sem o par polimórfico
-- (origem, referencia_id) que curtida/comentário usam pelas outras duas origens.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.comunidade_salvos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sessao_id  UUID NOT NULL REFERENCES public.sessoes_foco(id) ON DELETE CASCADE,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, sessao_id)
);

-- Listar "meus salvos" ordenado por data de salvamento é a consulta quente daqui.
CREATE INDEX IF NOT EXISTS comunidade_salvos_user_idx
  ON public.comunidade_salvos (user_id, criado_em DESC);

ALTER TABLE public.comunidade_salvos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Leitura é PRIVADA (só o próprio usuário vê o que salvou —
  -- diferente de curtidas, que são contagem pública). Não existe "3 pessoas salvaram".
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='comunidade_salvos' AND policyname='Usuários veem os próprios salvos') THEN
    CREATE POLICY "Usuários veem os próprios salvos"
      ON public.comunidade_salvos FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  -- Reusa o mesmo portão de visibilidade das curtidas (comunidade_publicacao_visivel),
  -- chamado com origem fixa 'galeria' — evita duplicar a checagem de opt-in/bloqueio.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='comunidade_salvos' AND policyname='Usuários salvam o que podem ver') THEN
    CREATE POLICY "Usuários salvam o que podem ver"
      ON public.comunidade_salvos FOR INSERT
      WITH CHECK (
        auth.uid() = user_id
        AND public.comunidade_publicacao_visivel('galeria', sessao_id)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='comunidade_salvos' AND policyname='Usuários removem os próprios salvos') THEN
    CREATE POLICY "Usuários removem os próprios salvos"
      ON public.comunidade_salvos FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC de listagem — ordenada por quando EU salvei (comunidade_salvos.criado_em), não
-- pela data da sessão. Colunas espelham comunidade_feed_galeria 1:1, com `salvo_em` a mais.
-- ─────────────────────────────────────────────────────────────────────────────
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
    -- Órfão de verdade (sessão apagada) já não existe mais, o CASCADE cuidou disso.
    -- O que sobra checar é se a sessão AINDA está pública — pode ter sido despublicada
    -- depois de salva.
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
-- Coluna `salvo_por_mim` só em comunidade_feed_galeria — é a única origem com botão de
-- salvar. arquivo/plano não mudam (continuam como em 20260807210000).
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
