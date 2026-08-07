/*
  O feed público passa a ser opt-in.

  A migration anterior fez o feed ler `sessoes_foco.is_public`. O problema é o que esse
  flag significa para quem o ligou: dentro do app ele sempre quis dizer "o meu GRUPO vê
  esta sessão" — é o cadeado no card do grupo e a lista de quem está estudando agora. Ele
  vale TRUE por padrão desde a primeira migration, e a tela que pede a foto promete, com
  todas as letras, "fica na sua galeria do perfil".

  Reusar esse flag para o Explorar transformaria consentimento de grupo em consentimento
  público, retroativamente, para todo mundo que já estudou — inclusive fotos do quarto e
  do rosto de quem nunca soube que existia um feed. Isso não é ajuste de escopo, é o tipo
  de coisa que derruba uma submissão na loja.

  Então entra uma preferência própria, DESLIGADA por padrão, e o feed passa a exigir as
  duas coisas: a sessão continua sendo pública para o grupo pelo `is_public`, mas só sai
  para estranhos se a pessoa tiver pedido. O preço, aceito de propósito, é o feed nascer
  vazio e encher conforme as pessoas optam.
*/

-- ───── 1. A preferência ─────
ALTER TABLE public.preferencias_cronograma
  ADD COLUMN IF NOT EXISTS feed_publico BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.preferencias_cronograma.feed_publico IS
  'Opt-in do feed público (Comunidade → Explorar). Desligado, as fotos de sessão do usuário não saem do grupo dele, mesmo com is_public. Padrão FALSE: publicar para estranhos é escolha, não default.';

/*
  Ausência de linha conta como NÃO participa.

  Isso é o inverso de `aparecer_no_ranking`, onde o COALESCE devolve TRUE para não sumir
  ninguém que nunca abriu as configurações. Aqui a direção segura é a oposta: quem nunca
  abriu as configurações nunca pediu para aparecer no Explorar.
*/
CREATE OR REPLACE FUNCTION public.comunidade_usuario_no_feed(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.preferencias_cronograma p
    WHERE p.usuario_id = p_user_id AND p.feed_publico
  );
$$;

-- ───── 2. Quem é dono de uma publicação ─────
/*
  Esta é a função que as policies de curtida e comentário consultam. Ao acrescentar o
  opt-in aqui, desligar a preferência não só some com o card: também recusa curtida e
  comentário novos na publicação, sem precisar tocar em nenhuma policy.
*/
CREATE OR REPLACE FUNCTION public.comunidade_dono_da_publicacao(
  p_origem public.comunidade_origem,
  p_referencia_id UUID
)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE p_origem
    WHEN 'galeria' THEN (
      SELECT s.user_id FROM public.sessoes_foco s
      WHERE s.id = p_referencia_id
        AND s.foto_path IS NOT NULL
        AND s.is_public
        AND public.comunidade_usuario_no_feed(s.user_id)
        AND COALESCE((SELECT p.perfil_publico FROM public.profiles p WHERE p.id = s.user_id), TRUE)
    )
    -- Arquivo e plano ainda não são publicáveis: nada é dono, então nada é curtível.
    ELSE NULL
  END;
$$;

-- ───── 3. O feed ─────
/*
  Mesma consulta da migration anterior, com o opt-in somado ao WHERE. O índice parcial
  `sessoes_foco_feed_publico_idx` continua servindo: ele filtra o que é caro (foto e
  is_public) e o opt-in é uma checagem por autor, não por linha.
*/
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
  comentarios     BIGINT
)
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH sessoes AS (
    -- DISTINCT ON colapsa a execução multi-matéria numa linha só, ficando com a primeira.
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
      WHERE m.origem = 'galeria' AND m.referencia_id = sessoes.id)
  FROM sessoes
  JOIN public.profiles p ON p.id = sessoes.user_id
  WHERE p_cursor_data IS NULL
     OR (sessoes.criado_em, sessoes.id) < (p_cursor_data, p_cursor_id)
  ORDER BY sessoes.criado_em DESC, sessoes.id DESC
  LIMIT LEAST(GREATEST(p_limite, 1), 30);
$$;
