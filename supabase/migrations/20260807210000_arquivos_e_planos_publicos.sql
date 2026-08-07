/*
  Arquivos e planos públicos — as duas origens que faltavam no feed da Comunidade.

  Até aqui só a galeria saía do banco (ver 20260807170000). Arquivo e plano ficavam
  mockados porque nenhum dos dois tinha o conceito de "público": arquivo só enxergava
  visibilidade por grupo, plano era estritamente pessoal. Esta migration cria esse
  conceito nos dois e ensina as funções auxiliares da Comunidade a enxergá-lo — as
  tabelas de curtida, comentário e denúncia não mudam nada, era esse o ponto da chave
  polimórfica (origem, referencia_id).

  CONSENTIMENTO — por que aqui NÃO entra o opt-in `feed_publico`:

  A preferência criada em 20260807190000 existe porque a foto de sessão era publicada por
  um flag (`is_public`) que sempre significou "o meu grupo vê" e vale TRUE por padrão:
  ninguém tinha escolhido aparecer no Explorar. Aqui é o contrário. `arquivos.publico` e
  `planos.publico` nascem FALSE e só viram TRUE quando a pessoa liga o interruptor no
  upload ou toca em "compartilhar" no editor do plano. O ato já é o consentimento, e
  exigir a preferência global por cima só faria o arquivo que a pessoa acabou de publicar
  não aparecer, sem explicação. O que continua valendo para as três origens é
  `perfil_publico` e o bloqueio entre as duas pessoas.
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. As colunas
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.arquivos
  ADD COLUMN IF NOT EXISTS publico BOOLEAN NOT NULL DEFAULT FALSE,
  -- O card do feed mostra "PDF · 2,5 MB". O tamanho só existia no picker, no momento do
  -- upload, e nunca era gravado; sem esta coluna o card teria de baixar o arquivo para
  -- saber o peso dele. NULL nos arquivos antigos: o card omite o tamanho nesse caso.
  ADD COLUMN IF NOT EXISTS tamanho_bytes BIGINT CHECK (tamanho_bytes IS NULL OR tamanho_bytes >= 0);

ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS publico BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.arquivos.publico IS
  'Arquivo publicado no Explorar (Comunidade → Arquivos). FALSE por padrão: compartilhar com grupo (arquivos_grupos) é outra coisa e continua independente disto.';

COMMENT ON COLUMN public.planos.publico IS
  'Plano compartilhado no Explorar (Comunidade → Planos). FALSE por padrão. Publicar expõe os blocos em leitura para qualquer pessoa, porque é isso que dá sentido ao "importar para meu cronograma".';

-- Os dois feeds ordenam por data desc entre o que é público, e só isso.
CREATE INDEX IF NOT EXISTS arquivos_feed_publico_idx
  ON public.arquivos (created_at DESC) WHERE publico;

CREATE INDEX IF NOT EXISTS planos_feed_publico_idx
  ON public.planos (created_at DESC) WHERE publico;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Leitura pública (RLS)
--
-- As RPCs do feed são SECURITY INVOKER, como a da galeria: quem decide o que a pessoa
-- enxerga é a policy, não a função. Isso também faz o "importar plano" e qualquer tela
-- futura de prévia funcionarem pelo PostgREST normal, sem RPC dedicada para ler.
-- ─────────────────────────────────────────────────────────────────────────────

/** Autor visível no feed: perfil público e sem bloqueio em nenhuma das direções. */
CREATE OR REPLACE FUNCTION public.comunidade_autor_visivel(p_autor_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT p.perfil_publico FROM public.profiles p WHERE p.id = p_autor_id), TRUE)
     AND NOT public.comunidade_bloqueio_entre(p_autor_id, auth.uid());
$$;

/*
  A policy antiga de arquivos (dono OU membro de um grupo com quem foi compartilhado)
  continua igual; o público entra como mais um caminho. Precisa ser DROP + CREATE porque
  policy de SELECT é OR entre as permissivas, e uma segunda policy "arquivos públicos"
  também serviria — mas manter as duas condições no mesmo lugar deixa óbvio, lendo uma
  linha só, tudo que faz um arquivo ser legível.
*/
DROP POLICY IF EXISTS "Visualizar arquivos permitidos" ON public.arquivos;
CREATE POLICY "Visualizar arquivos permitidos"
  ON public.arquivos FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.arquivos_grupos ag
      JOIN public.membros m ON m.grupo_id = ag.grupo_id
      WHERE ag.arquivo_id = arquivos.id AND m.user_id = auth.uid()
    )
    OR (publico AND public.comunidade_autor_visivel(user_id))
  );

DROP POLICY IF EXISTS "Usuários veem só os próprios planos" ON public.planos;
CREATE POLICY "Usuários veem os próprios planos e os públicos"
  ON public.planos FOR SELECT
  USING (
    auth.uid() = usuario_id
    OR (publico AND public.comunidade_autor_visivel(usuario_id))
  );

/*
  Blocos de plano público são legíveis junto com o plano.

  Sem isto o card mostraria "24 blocos" e o importar não teria o que copiar — o plano
  publicado seria uma casca. É a diferença entre plano e arquivo: o arquivo público
  continua atrás do download autenticado do bucket, o plano é o conteúdo em si.
*/
DROP POLICY IF EXISTS "Usuários veem blocos dos próprios planos" ON public.planos_blocos;
CREATE POLICY "Usuários veem blocos dos próprios planos e dos públicos"
  ON public.planos_blocos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.planos p
    WHERE p.id = planos_blocos.plano_id
      AND (
        p.usuario_id = auth.uid()
        OR (p.publico AND public.comunidade_autor_visivel(p.usuario_id))
      )
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Quem é dono de uma publicação
--
-- Esta é a função que as policies de curtida e comentário consultam. Com arquivo e plano
-- respondidos aqui, os dois passam a aceitar interação real sem tocar em nenhuma policy —
-- e despublicar volta a recusar curtida e comentário novos, pelo mesmo caminho.
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
        AND public.comunidade_usuario_no_feed(s.user_id)
        AND COALESCE((SELECT p.perfil_publico FROM public.profiles p WHERE p.id = s.user_id), TRUE)
    )
    WHEN 'arquivo' THEN (
      SELECT a.user_id FROM public.arquivos a
      WHERE a.id = p_referencia_id
        AND a.publico
        AND COALESCE((SELECT p.perfil_publico FROM public.profiles p WHERE p.id = a.user_id), TRUE)
    )
    WHEN 'plano' THEN (
      SELECT pl.usuario_id FROM public.planos pl
      WHERE pl.id = p_referencia_id
        AND pl.publico
        AND COALESCE((SELECT p.perfil_publico FROM public.profiles p WHERE p.id = pl.usuario_id), TRUE)
    )
  END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Os feeds
--
-- Mesma forma da galeria: keyset por (created_at, id), contagens por subconsulta e
-- SECURITY INVOKER. O `arquivos.user_id` é ON DELETE SET NULL, então um arquivo pode
-- ficar sem dono — esses somem do feed pelo JOIN com profiles, que é o certo: card sem
-- autor não tem perfil para abrir nem quem denunciar.
-- ─────────────────────────────────────────────────────────────────────────────
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

/*
  O plano vai para o feed já resumido: quantos blocos, quantas horas e quais matérias.

  Fazer isso no banco em vez de mandar os blocos crus para o app é o que mantém o card
  barato — um plano de 24 blocos viraria 24 linhas por card só para desenhar três tags.
  As matérias saem sem repetição e na ordem em que aparecem no dia, que é a ordem que
  faz sentido para quem lê ("Matemática, Física, Química", não alfabética).
*/
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
    -- Só o estudo conta nas "horas totais": somar o descanso inflaria o plano.
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Importar um plano público
--
-- Copiar, não referenciar: o plano importado passa a ser da pessoa que importou e não
-- muda mais se o original mudar (nem some se o autor despublicar). Um plano do
-- cronograma de alguém que pode sumir debaixo dela seria pior que não importar.
--
-- Entra sempre com agenda 'nenhuma', mesmo que o original estivesse fixado: agenda é
-- disputa de espaço no cronograma de quem importa (só um plano por dia da semana), e
-- herdar a agenda alheia derrubaria o plano que já estava lá. Quem importou fixa depois.
-- ─────────────────────────────────────────────────────────────────────────────
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

  -- A mesma condição do feed, checada de novo: entre o card ser desenhado e o toque no
  -- botão o autor pode ter despublicado ou bloqueado quem está importando.
  IF v_origem.id IS NULL
     OR NOT v_origem.publico
     OR NOT public.comunidade_autor_visivel(v_origem.usuario_id) THEN
    RAISE EXCEPTION 'Esse plano não está mais disponível.';
  END IF;

  INSERT INTO public.planos (usuario_id, nome, cor, agenda_tipo)
  VALUES (v_eu, v_origem.nome, v_origem.cor, 'nenhuma')
  RETURNING id INTO v_novo_id;

  FOR v_bloco IN
    SELECT b.*, m.nome_exibicao, m.nome_normalizado, m.cor AS materia_cor
    FROM public.planos_blocos b
    LEFT JOIN public.materias_usuario m ON m.id = b.materia_id
    WHERE b.plano_id = p_plano_id
  LOOP
    /*
      materia_id aponta para uma linha de `materias_usuario` que é DO AUTOR. Copiar o id
      cru amarraria o bloco à matéria de outra pessoa — que ela pode renomear, recolorir
      ou apagar. Então a matéria é reconciliada por nome normalizado dentro do acervo de
      quem importa (as padrão do sistema, com usuario_id NULL, contam), e só é criada
      quando não existe equivalente.
    */
    v_materia := NULL;

    IF v_bloco.materia_id IS NOT NULL THEN
      SELECT m.id INTO v_materia
      FROM public.materias_usuario m
      WHERE m.nome_normalizado = v_bloco.nome_normalizado
        AND (m.usuario_id = v_eu OR m.usuario_id IS NULL)
      -- Preferir a própria à padrão do sistema: se a pessoa já customizou a cor de
      -- "Matemática", é a dela que o bloco importado deve usar.
      ORDER BY (m.usuario_id IS NULL)
      LIMIT 1;

      IF v_materia IS NULL THEN
        INSERT INTO public.materias_usuario (usuario_id, nome_exibicao, nome_normalizado, cor)
        VALUES (v_eu, v_bloco.nome_exibicao, v_bloco.nome_normalizado, v_bloco.materia_cor)
        RETURNING id INTO v_materia;
      END IF;
    END IF;

    INSERT INTO public.planos_blocos
      (plano_id, hora_inicio, duracao_min, tipo, materia_id, topico, notificar, antecedencia_min)
    VALUES
      (v_novo_id, v_bloco.hora_inicio, v_bloco.duracao_min, v_bloco.tipo, v_materia,
       v_bloco.topico, v_bloco.notificar, v_bloco.antecedencia_min);
  END LOOP;

  RETURN v_novo_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Limpeza das interações órfãs
--
-- A chave polimórfica não tem FK, então apagar a publicação não leva junto curtida e
-- comentário. A galeria já tinha o gatilho dela (20260807170000); aqui ele vira genérico,
-- com a origem passada como argumento, e passa a valer para as três origens.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.comunidade_limpar_interacoes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_origem public.comunidade_origem := TG_ARGV[0]::public.comunidade_origem;
BEGIN
  DELETE FROM public.comunidade_curtidas
    WHERE origem = v_origem AND referencia_id = OLD.id;
  DELETE FROM public.comunidade_comentarios
    WHERE origem = v_origem AND referencia_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS comunidade_limpar_interacoes ON public.sessoes_foco;
CREATE TRIGGER comunidade_limpar_interacoes
  BEFORE DELETE ON public.sessoes_foco
  FOR EACH ROW EXECUTE FUNCTION public.comunidade_limpar_interacoes('galeria');

DROP TRIGGER IF EXISTS comunidade_limpar_interacoes ON public.arquivos;
CREATE TRIGGER comunidade_limpar_interacoes
  BEFORE DELETE ON public.arquivos
  FOR EACH ROW EXECUTE FUNCTION public.comunidade_limpar_interacoes('arquivo');

DROP TRIGGER IF EXISTS comunidade_limpar_interacoes ON public.planos;
CREATE TRIGGER comunidade_limpar_interacoes
  BEFORE DELETE ON public.planos
  FOR EACH ROW EXECUTE FUNCTION public.comunidade_limpar_interacoes('plano');

-- A antiga, específica da galeria, não tem mais gatilho apontando para ela.
DROP FUNCTION IF EXISTS public.comunidade_limpar_interacoes_da_sessao();
