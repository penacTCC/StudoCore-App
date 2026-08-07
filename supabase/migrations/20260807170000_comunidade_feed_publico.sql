/*
  Feed público da aba Comunidade → Explorar.

  A primeira origem a sair do mock é a GALERIA (foto de sessão). Ela não ganha tabela
  própria de publicação de propósito: a linha já existe em `sessoes_foco`, e duplicá-la
  numa tabela `publicacoes` criaria duas fontes da verdade para "esta sessão ainda é
  pública?" — pergunta que muda toda vez que alguém edita a sessão. O feed lê a sessão
  direto e as interações apontam para ela por uma chave polimórfica (origem, referencia_id).

  O preço dessa escolha é não haver FK: uma sessão apagada deixaria curtidas órfãs. Por
  isso existe o gatilho de limpeza no fim do arquivo.

  Arquivos e planos ainda não têm o conceito de "público" no banco (arquivo só enxerga
  visibilidade por grupo; plano é estritamente pessoal), então continuam mockados no app.
  Quando ganharem, é só acrescentar o valor em `comunidade_origem` e ensinar as duas
  funções auxiliares a enxergá-los — nada nas tabelas de interação muda.
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- Origem de uma publicação
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'comunidade_origem') THEN
    CREATE TYPE public.comunidade_origem AS ENUM ('galeria', 'arquivo', 'plano');
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Bloqueios
--
-- Vem primeiro porque as policies das outras tabelas dependem dele: bloquear alguém tem
-- de valer no banco, não só na lista que a tela já carregou.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comunidade_bloqueios (
  bloqueador_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bloqueado_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (bloqueador_id, bloqueado_id),
  CONSTRAINT comunidade_bloqueio_nao_reflexivo CHECK (bloqueador_id <> bloqueado_id)
);

-- O feed precisa perguntar "quem me bloqueou?" tão rápido quanto "quem eu bloqueei?".
CREATE INDEX IF NOT EXISTS comunidade_bloqueios_bloqueado_idx
  ON public.comunidade_bloqueios (bloqueado_id);

ALTER TABLE public.comunidade_bloqueios ENABLE ROW LEVEL SECURITY;

/*
  Só o dono da lista lê a própria lista.

  Isso é deliberado e tem consequência: as policies abaixo não conseguem consultar "fulano
  me bloqueou?" pelo caminho normal, porque essa linha pertence ao fulano. Quem faz essa
  checagem é a função `comunidade_bloqueio_entre`, SECURITY DEFINER, que enxerga a tabela
  inteira mas só responde sim/não — nunca devolve a lista de ninguém.
*/
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='comunidade_bloqueios' AND policyname='Usuários veem os próprios bloqueios') THEN
    CREATE POLICY "Usuários veem os próprios bloqueios"
      ON public.comunidade_bloqueios FOR SELECT
      USING (auth.uid() = bloqueador_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='comunidade_bloqueios' AND policyname='Usuários bloqueiam por conta própria') THEN
    CREATE POLICY "Usuários bloqueiam por conta própria"
      ON public.comunidade_bloqueios FOR INSERT
      WITH CHECK (auth.uid() = bloqueador_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='comunidade_bloqueios' AND policyname='Usuários desbloqueiam por conta própria') THEN
    CREATE POLICY "Usuários desbloqueiam por conta própria"
      ON public.comunidade_bloqueios FOR DELETE
      USING (auth.uid() = bloqueador_id);
  END IF;
END $$;

/** Há bloqueio entre as duas pessoas, em qualquer direção? */
CREATE OR REPLACE FUNCTION public.comunidade_bloqueio_entre(p_a UUID, p_b UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.comunidade_bloqueios b
    WHERE (b.bloqueador_id = p_a AND b.bloqueado_id = p_b)
       OR (b.bloqueador_id = p_b AND b.bloqueado_id = p_a)
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Auxiliares: uma publicação existe e está pública? De quem ela é?
--
-- As duas condições da galeria são as MESMAS que a policy de leitura do bucket
-- `sessao-fotos` aplica (ver 20260806090000_fotos_sessao.sql): sessão pública e perfil
-- público. Se divergissem, o feed listaria cards cuja foto não pode ser assinada.
-- ─────────────────────────────────────────────────────────────────────────────
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
        AND COALESCE((SELECT p.perfil_publico FROM public.profiles p WHERE p.id = s.user_id), TRUE)
    )
    -- Arquivo e plano ainda não são publicáveis: nada é dono, então nada é curtível.
    ELSE NULL
  END;
$$;

/** A publicação está visível para quem está chamando (existe, é pública, sem bloqueio)? */
CREATE OR REPLACE FUNCTION public.comunidade_publicacao_visivel(
  p_origem public.comunidade_origem,
  p_referencia_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT dono.id IS NOT NULL
     AND NOT public.comunidade_bloqueio_entre(dono.id, auth.uid())
  FROM (SELECT public.comunidade_dono_da_publicacao(p_origem, p_referencia_id) AS id) dono;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Curtidas
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comunidade_curtidas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  origem        public.comunidade_origem NOT NULL,
  referencia_id UUID NOT NULL,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, origem, referencia_id)
);

-- Contar curtidas de uma publicação é a consulta mais quente do feed.
CREATE INDEX IF NOT EXISTS comunidade_curtidas_publicacao_idx
  ON public.comunidade_curtidas (origem, referencia_id);

ALTER TABLE public.comunidade_curtidas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Leitura ampla: a contagem é pública, como o número embaixo do coração.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='comunidade_curtidas' AND policyname='Curtidas visíveis para usuários logados') THEN
    CREATE POLICY "Curtidas visíveis para usuários logados"
      ON public.comunidade_curtidas FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='comunidade_curtidas' AND policyname='Usuários curtem em nome próprio') THEN
    CREATE POLICY "Usuários curtem em nome próprio"
      ON public.comunidade_curtidas FOR INSERT
      WITH CHECK (
        auth.uid() = user_id
        AND public.comunidade_publicacao_visivel(origem, referencia_id)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='comunidade_curtidas' AND policyname='Usuários descurtem o que curtiram') THEN
    CREATE POLICY "Usuários descurtem o que curtiram"
      ON public.comunidade_curtidas FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Comentários (um nível só — sem respostas aninhadas)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comunidade_comentarios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  origem        public.comunidade_origem NOT NULL,
  referencia_id UUID NOT NULL,
  texto         TEXT NOT NULL CHECK (length(btrim(texto)) BETWEEN 1 AND 1000),
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comunidade_comentarios_publicacao_idx
  ON public.comunidade_comentarios (origem, referencia_id, criado_em);

ALTER TABLE public.comunidade_comentarios ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  /*
    Some da lista o comentário de quem bloqueou você ou de quem você bloqueou — em
    qualquer direção, senão bloquear alguém ainda deixaria a conversa dele na sua tela.
  */
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='comunidade_comentarios' AND policyname='Comentários visíveis em publicação pública') THEN
    CREATE POLICY "Comentários visíveis em publicação pública"
      ON public.comunidade_comentarios FOR SELECT
      USING (
        public.comunidade_publicacao_visivel(origem, referencia_id)
        AND NOT public.comunidade_bloqueio_entre(user_id, auth.uid())
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='comunidade_comentarios' AND policyname='Usuários comentam em nome próprio') THEN
    CREATE POLICY "Usuários comentam em nome próprio"
      ON public.comunidade_comentarios FOR INSERT
      WITH CHECK (
        auth.uid() = user_id
        AND public.comunidade_publicacao_visivel(origem, referencia_id)
      );
  END IF;

  -- Apagar é de quem escreveu E de quem publicou: a moderação da própria publicação é
  -- a primeira linha de defesa, antes de qualquer denúncia chegar em alguém.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='comunidade_comentarios' AND policyname='Autor do comentário ou da publicação apaga') THEN
    CREATE POLICY "Autor do comentário ou da publicação apaga"
      ON public.comunidade_comentarios FOR DELETE
      USING (
        auth.uid() = user_id
        OR auth.uid() = public.comunidade_dono_da_publicacao(origem, referencia_id)
      );
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Denúncias
--
-- Ninguém no app lê esta tabela: ela é caixa de entrada da moderação, olhada pelo painel
-- do Supabase. Por isso o SELECT devolve só as próprias denúncias — o suficiente para a
-- tela dizer "você já denunciou isso" e nada além.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comunidade_denuncias (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  denunciante_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  origem         public.comunidade_origem NOT NULL,
  referencia_id  UUID NOT NULL,
  -- Preenchido quando a denúncia é de um comentário, não da publicação inteira.
  comentario_id  UUID REFERENCES public.comunidade_comentarios(id) ON DELETE CASCADE,
  motivo         TEXT NOT NULL DEFAULT 'nao_informado',
  detalhe        TEXT CHECK (detalhe IS NULL OR length(detalhe) <= 2000),
  status         TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'analisando', 'resolvida', 'descartada')),
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A mesma pessoa denunciando a mesma coisa duas vezes não é sinal novo.
  UNIQUE (denunciante_id, origem, referencia_id, comentario_id)
);

-- A fila da moderação é sempre "o que está aberto, mais antigo primeiro".
CREATE INDEX IF NOT EXISTS comunidade_denuncias_fila_idx
  ON public.comunidade_denuncias (status, criado_em);

ALTER TABLE public.comunidade_denuncias ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='comunidade_denuncias' AND policyname='Usuários veem as próprias denúncias') THEN
    CREATE POLICY "Usuários veem as próprias denúncias"
      ON public.comunidade_denuncias FOR SELECT
      USING (auth.uid() = denunciante_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='comunidade_denuncias' AND policyname='Usuários denunciam em nome próprio') THEN
    CREATE POLICY "Usuários denunciam em nome próprio"
      ON public.comunidade_denuncias FOR INSERT
      WITH CHECK (auth.uid() = denunciante_id);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- O feed da galeria
--
-- Keyset por (criado_em, id) em vez de OFFSET: o feed cresce pela frente, e com OFFSET a
-- publicação nova empurra a página seguinte e faz o scroll infinito repetir card.
--
-- A deduplicação por `execucao_id` não é detalhe: numa execução de plano com várias
-- matérias o app grava o MESMO `foto_path` em todas as linhas (ver a migration da foto),
-- e sem isso a mesma foto apareceria três vezes seguidas no feed.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS sessoes_foco_feed_publico_idx
  ON public.sessoes_foco (created_at DESC)
  WHERE foto_path IS NOT NULL AND is_public;

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

-- ─────────────────────────────────────────────────────────────────────────────
-- Limpeza das interações órfãs
--
-- A chave polimórfica não tem FK, então apagar a sessão não leva junto curtida e
-- comentário. Sem isto, a contagem de uma sessão nova poderia herdar interação de uma
-- antiga se um UUID fosse reaproveitado — e, pior, o dado ficaria lá para sempre.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.comunidade_limpar_interacoes_da_sessao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.comunidade_curtidas
    WHERE origem = 'galeria' AND referencia_id = OLD.id;
  DELETE FROM public.comunidade_comentarios
    WHERE origem = 'galeria' AND referencia_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS comunidade_limpar_interacoes ON public.sessoes_foco;
CREATE TRIGGER comunidade_limpar_interacoes
  BEFORE DELETE ON public.sessoes_foco
  FOR EACH ROW EXECUTE FUNCTION public.comunidade_limpar_interacoes_da_sessao();

COMMENT ON TABLE public.comunidade_denuncias IS
  'Caixa de entrada da moderação do feed público. Nada no app lê esta tabela — a fila é olhada pelo painel do Supabase.';
