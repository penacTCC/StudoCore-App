/*
  A caixa de notificações deixa de ser só da Comunidade.

  A tabela de 20260807230000 já era quase genérica — `destinatario_id`, `ator_id`, `lida`,
  keyset, Realtime filtrado por destinatário: nada disso é de curtida. O que a prendia à
  Comunidade eram três coisas: o nome, o `origem` obrigatório e a regra de validade
  ("publicação ainda pública, curtida ainda de pé"), que só faz sentido para curtida e
  comentário.

  O que entra na caixa e o que NÃO entra
  ─────────────────────────────────────
  Entra o que sobrevive a você não estar olhando: alguém fez algo que te diz respeito e
  ainda vai fazer sentido ler daqui a duas horas. Curtida, comentário, força recebida,
  gente nova no grupo, sala de foco aberta.

  Não entra o que é AVISO — lembrete do cronograma (a agenda já é essa lista), ofensiva em
  risco, fim de fase do pomodoro, cronômetro parado. Todos dependem do relógio do aparelho,
  valem por minutos e viram ruído depois; são notificação local e nada mais.

  Também ficam de fora, por ora, badge desbloqueada e meta do grupo batida: as duas são
  calculadas no cliente a partir das estatísticas, e não existe evento no banco em que um
  gatilho pudesse se pendurar.

  `categoria` é o eixo novo
  ─────────────────────────
  Ela responde às duas perguntas que mudam por tipo de notificação: como validar a linha e
  o que `referencia_id` aponta.

    comunidade  curtida, comentario   -> (origem, referencia_id) = a publicação
    grupo       novo_membro, sala_aberta -> referencia_id = o grupo
    foco        forca                 -> referencia_id = a sessão

  Quem escreve continua sendo só GATILHO, nunca o app: não existe policy de INSERT, e a
  única porta de entrada é `public.notificar` (SECURITY DEFINER). Se o cliente pudesse
  inserir, qualquer um forjaria "alguém curtiu você".

  O push NÃO muda aqui. Força e sala já têm as Edge Functions `mandar-forca` e
  `avisar-sala-aberta`, que continuam sendo quem toca o aparelho; estes gatilhos só
  acrescentam a linha na caixa. Gente nova no grupo entra só na caixa, sem push.
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. O renome
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.comunidade_notificacoes RENAME TO notificacoes;

-- Índices e constraints não seguem o renome da tabela; ficariam com o nome antigo para
-- sempre, e o próximo a ler o schema pensaria que sobrou algo de outra tabela.
ALTER INDEX IF EXISTS comunidade_notificacoes_pkey RENAME TO notificacoes_pkey;
ALTER INDEX IF EXISTS comunidade_notificacoes_curtida_unica RENAME TO notificacoes_curtida_unica;
ALTER INDEX IF EXISTS comunidade_notificacoes_caixa_idx RENAME TO notificacoes_caixa_idx;
ALTER INDEX IF EXISTS comunidade_notificacoes_nao_lidas_idx RENAME TO notificacoes_nao_lidas_idx;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comunidade_notificacao_nao_reflexiva') THEN
    ALTER TABLE public.notificacoes
      RENAME CONSTRAINT comunidade_notificacao_nao_reflexiva TO notificacao_nao_reflexiva;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Categoria, e o que ela afrouxa
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notificacao_categoria') THEN
    CREATE TYPE public.notificacao_categoria AS ENUM ('comunidade', 'grupo', 'foco');
  END IF;
END $$;

ALTER TABLE public.notificacoes
  ADD COLUMN IF NOT EXISTS categoria public.notificacao_categoria;

-- Tudo o que já existia veio de curtida ou comentário.
UPDATE public.notificacoes SET categoria = 'comunidade' WHERE categoria IS NULL;

ALTER TABLE public.notificacoes ALTER COLUMN categoria SET NOT NULL;
-- Sem DEFAULT de propósito: quem insere tem de dizer de que categoria é.

-- Só a Comunidade tem `origem` — o grupo e a sessão se identificam pelo `referencia_id`.
ALTER TABLE public.notificacoes ALTER COLUMN origem DROP NOT NULL;

ALTER TABLE public.notificacoes
  DROP CONSTRAINT IF EXISTS comunidade_notificacoes_tipo_check,
  DROP CONSTRAINT IF EXISTS comunidade_notificacao_comentario_coerente,
  DROP CONSTRAINT IF EXISTS notificacao_tipo_da_categoria,
  DROP CONSTRAINT IF EXISTS notificacao_comentario_coerente,
  DROP CONSTRAINT IF EXISTS notificacao_origem_coerente;

ALTER TABLE public.notificacoes
  -- O par (categoria, tipo) é fechado: tipo novo sem categoria combinando é erro de quem
  -- escreveu o gatilho, e o banco recusa em vez de guardar uma linha que a tela não sabe
  -- desenhar.
  ADD CONSTRAINT notificacao_tipo_da_categoria CHECK (
    (categoria = 'comunidade' AND tipo IN ('curtida', 'comentario'))
    OR (categoria = 'grupo' AND tipo IN ('novo_membro', 'sala_aberta'))
    OR (categoria = 'foco' AND tipo = 'forca')
  ),
  -- Comentário sempre aponta para a linha dele; nenhum outro tipo aponta.
  ADD CONSTRAINT notificacao_comentario_coerente CHECK (
    (tipo = 'comentario') = (comentario_id IS NOT NULL)
  ),
  ADD CONSTRAINT notificacao_origem_coerente CHECK (
    (categoria = 'comunidade') = (origem IS NOT NULL)
  );

-- Sair e voltar ao grupo não reanuncia a mesma pessoa para sempre.
CREATE UNIQUE INDEX IF NOT EXISTS notificacoes_novo_membro_unico
  ON public.notificacoes (destinatario_id, ator_id, referencia_id)
  WHERE tipo = 'novo_membro';

-- Sustenta a janela de 30 min do gatilho de sala aberta (a varredura é por grupo + data).
CREATE INDEX IF NOT EXISTS notificacoes_sala_aberta_idx
  ON public.notificacoes (referencia_id, criado_em DESC)
  WHERE tipo = 'sala_aberta';

COMMENT ON TABLE public.notificacoes IS
  'Caixa de notificações do app (comunidade, grupo, foco). Escrita só por gatilho, via public.notificar — o app nunca insere aqui.';
COMMENT ON COLUMN public.notificacoes.categoria IS
  'Decide como a linha é validada na leitura e o que referencia_id aponta.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. A única porta de entrada
-- ─────────────────────────────────────────────────────────────────────────────

/**
 * Registra uma notificação, se ela fizer sentido.
 *
 * SECURITY DEFINER porque não existe policy de INSERT nesta tabela — é esta função, e só
 * ela, que escreve. Nunca lança: o fato principal (a curtida, a força, a entrada no grupo)
 * não pode falhar porque a notificação falhou.
 *
 * As duas recusas silenciosas — notificar a si mesmo e bloqueio entre as duas pessoas —
 * ficam aqui, e não em cada gatilho, exatamente para não serem esquecidas no próximo tipo
 * que alguém acrescentar. O bloqueio ainda é conferido de novo na LEITURA, porque bloquear
 * depois não pode deixar a notificação antiga na caixa.
 */
CREATE OR REPLACE FUNCTION public.notificar(
  p_destinatario_id UUID,
  p_ator_id         UUID,
  p_categoria       public.notificacao_categoria,
  p_tipo            TEXT,
  p_referencia_id   UUID,
  p_origem          public.comunidade_origem DEFAULT NULL,
  p_comentario_id   UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_destinatario_id IS NULL OR p_ator_id IS NULL OR p_referencia_id IS NULL THEN RETURN; END IF;
  IF p_destinatario_id = p_ator_id THEN RETURN; END IF;
  IF public.comunidade_bloqueio_entre(p_destinatario_id, p_ator_id) THEN RETURN; END IF;

  INSERT INTO public.notificacoes
    (destinatario_id, ator_id, categoria, tipo, origem, referencia_id, comentario_id)
  VALUES
    (p_destinatario_id, p_ator_id, p_categoria, p_tipo, p_origem, p_referencia_id, p_comentario_id)
  -- Recurtir algo já notificado, ou reentrar no grupo, não gera linha nova (ver os índices
  -- únicos parciais acima).
  ON CONFLICT DO NOTHING;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Os gatilhos
-- ─────────────────────────────────────────────────────────────────────────────

-- 4.1 Comunidade — mesma função de antes, agora passando pela porta comum.
CREATE OR REPLACE FUNCTION public.comunidade_notificar_interacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo TEXT := TG_ARGV[0];
  v_dono UUID;
BEGIN
  v_dono := public.comunidade_dono_da_publicacao(NEW.origem, NEW.referencia_id);

  PERFORM public.notificar(
    v_dono,
    NEW.user_id,
    'comunidade',
    v_tipo,
    NEW.referencia_id,
    NEW.origem,
    CASE WHEN v_tipo = 'comentario' THEN NEW.id ELSE NULL END
  );

  RETURN NEW;
END;
$$;

-- 4.2 Força recebida.
--
-- `incentivos` já tem UNIQUE (sessao_id, remetente_id, destinatario_id), então a mesma
-- força não chega duas vezes sem precisar de índice novo aqui.
CREATE OR REPLACE FUNCTION public.notificar_forca()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notificar(
    NEW.destinatario_id, NEW.remetente_id, 'foco', 'forca', NEW.sessao_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notificar_forca ON public.incentivos;
CREATE TRIGGER notificar_forca
  AFTER INSERT ON public.incentivos
  FOR EACH ROW EXECUTE FUNCTION public.notificar_forca();

-- 4.3 Gente nova no grupo — avisa quem já estava lá.
CREATE OR REPLACE FUNCTION public.notificar_novo_membro()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notificar(m.user_id, NEW.user_id, 'grupo', 'novo_membro', NEW.grupo_id)
  FROM public.membros m
  WHERE m.grupo_id = NEW.grupo_id
    AND m.user_id <> NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notificar_novo_membro ON public.membros;
CREATE TRIGGER notificar_novo_membro
  AFTER INSERT ON public.membros
  FOR EACH ROW EXECUTE FUNCTION public.notificar_novo_membro();

-- 4.4 Sala de foco aberta no grupo.
CREATE OR REPLACE FUNCTION public.notificar_sala_aberta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sala sem grupo é sessão solo: não há a quem avisar.
  IF NEW.grupo_id IS NULL OR NEW.anfitriao_id IS NULL THEN RETURN NEW; END IF;

  /*
    Mesma janela de 30 min da Edge Function `avisar-sala-aberta`, e pelo mesmo motivo: num
    grupo ativo, cada pessoa que abre e fecha o app reabre uma sala, e sem o limite a caixa
    de todo mundo vira uma coluna de "sala aberta". A janela é do GRUPO, não de quem abriu
    — o que incomoda é o volume total.
  */
  IF EXISTS (
    SELECT 1 FROM public.notificacoes n
    WHERE n.tipo = 'sala_aberta'
      AND n.referencia_id = NEW.grupo_id
      AND n.criado_em > now() - INTERVAL '30 minutes'
  ) THEN
    RETURN NEW;
  END IF;

  PERFORM public.notificar(m.user_id, NEW.anfitriao_id, 'grupo', 'sala_aberta', NEW.grupo_id)
  FROM public.membros m
  WHERE m.grupo_id = NEW.grupo_id
    AND m.user_id <> NEW.anfitriao_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notificar_sala_aberta ON public.salas_foco;
CREATE TRIGGER notificar_sala_aberta
  AFTER INSERT ON public.salas_foco
  FOR EACH ROW EXECUTE FUNCTION public.notificar_sala_aberta();

-- 4.5 Apagar a publicação leva junto as notificações dela (a tabela mudou de nome).
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
  DELETE FROM public.notificacoes
    WHERE categoria = 'comunidade' AND origem = v_origem AND referencia_id = OLD.id;
  RETURN OLD;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Leitura
--
-- O filtro de validade aparece duas vezes (lista e contagem) e precisa ser o MESMO: um
-- badge com "3" que abre numa lista de 2 é pior que badge nenhum.
-- ─────────────────────────────────────────────────────────────────────────────

/**
 * A notificação ainda faz sentido?
 *
 * O bloqueio vale para todas as categorias. O resto depende da categoria:
 *
 *   comunidade  a publicação ainda é pública e minha, e a curtida ainda existe (curtir e
 *               descurtir em loop não pode virar uma notificação por toque — por isso a
 *               linha da curtida desfeita não é apagada, só escondida aqui)
 *   grupo       eu ainda sou do grupo; saí, some da caixa
 *   foco        sempre — uma força recebida aconteceu e pronto
 */
CREATE OR REPLACE FUNCTION public.notificacao_valida(
  p_destinatario_id UUID,
  p_ator_id         UUID,
  p_categoria       public.notificacao_categoria,
  p_tipo            TEXT,
  p_origem          public.comunidade_origem,
  p_referencia_id   UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT public.comunidade_bloqueio_entre(p_ator_id, p_destinatario_id)
     AND CASE p_categoria
           WHEN 'comunidade' THEN
             public.comunidade_dono_da_publicacao(p_origem, p_referencia_id) = p_destinatario_id
             AND (
               p_tipo <> 'curtida'
               OR EXISTS (
                 SELECT 1 FROM public.comunidade_curtidas c
                 WHERE c.user_id = p_ator_id
                   AND c.origem = p_origem
                   AND c.referencia_id = p_referencia_id
               )
             )
           WHEN 'grupo' THEN
             EXISTS (
               SELECT 1 FROM public.membros m
               WHERE m.grupo_id = p_referencia_id
                 AND m.user_id = p_destinatario_id
             )
           ELSE TRUE
         END;
$$;

DROP FUNCTION IF EXISTS public.comunidade_notificacao_valida(
  UUID, UUID, TEXT, public.comunidade_origem, UUID);

/**
 * A caixa, paginada por keyset.
 *
 * `resumo` é como o alvo se chama na linha da lista, e muda com a categoria: a matéria da
 * foto ou o nome do arquivo/plano na Comunidade, o nome do grupo no grupo, a disciplina da
 * sessão na força. `foto_path` só existe na galeria, e sai daqui CRU: o bucket é privado e
 * quem assina é o app, em lote, como já faz o feed.
 */
CREATE OR REPLACE FUNCTION public.notificacoes_listar(
  p_limite INT DEFAULT 20,
  p_cursor_data TIMESTAMPTZ DEFAULT NULL,
  p_cursor_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id            UUID,
  categoria     public.notificacao_categoria,
  tipo          TEXT,
  origem        public.comunidade_origem,
  referencia_id UUID,
  ator_id       UUID,
  ator_nome     TEXT,
  ator_foto     TEXT,
  texto         TEXT,
  resumo        TEXT,
  foto_path     TEXT,
  lida          BOOLEAN,
  criado_em     TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    n.id,
    n.categoria,
    n.tipo,
    n.origem,
    n.referencia_id,
    n.ator_id,
    p.nome_usuario,
    p.foto_usuario,
    (SELECT m.texto FROM public.comunidade_comentarios m WHERE m.id = n.comentario_id),
    CASE n.categoria
      WHEN 'comunidade' THEN
        CASE n.origem
          WHEN 'galeria' THEN (SELECT s.disciplina FROM public.sessoes_foco s WHERE s.id = n.referencia_id)
          WHEN 'arquivo' THEN (SELECT a.titulo FROM public.arquivos a WHERE a.id = n.referencia_id)
          WHEN 'plano'   THEN (SELECT pl.nome FROM public.planos pl WHERE pl.id = n.referencia_id)
        END
      WHEN 'grupo' THEN (SELECT g.nome_grupo FROM public.grupos g WHERE g.id = n.referencia_id)
      ELSE (SELECT s.disciplina FROM public.sessoes_foco s WHERE s.id = n.referencia_id)
    END,
    CASE WHEN n.categoria = 'comunidade' AND n.origem = 'galeria'
      THEN (SELECT s.foto_path FROM public.sessoes_foco s WHERE s.id = n.referencia_id)
    END,
    n.lida,
    n.criado_em
  FROM public.notificacoes n
  JOIN public.profiles p ON p.id = n.ator_id
  WHERE n.destinatario_id = auth.uid()
    AND (p_cursor_data IS NULL OR (n.criado_em, n.id) < (p_cursor_data, p_cursor_id))
    AND public.notificacao_valida(
          n.destinatario_id, n.ator_id, n.categoria, n.tipo, n.origem, n.referencia_id)
  ORDER BY n.criado_em DESC, n.id DESC
  LIMIT LEAST(GREATEST(p_limite, 1), 50);
$$;

/**
 * Quantas não lidas — o número do badge.
 *
 * O teto de 50 é de propósito: o badge escreve "9+" acima de nove, e varrer um histórico
 * inteiro só para descobrir que são "muitas" seria caro à toa.
 */
CREATE OR REPLACE FUNCTION public.notificacoes_nao_lidas()
RETURNS INT
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT count(*)::INT FROM (
    SELECT 1
    FROM public.notificacoes n
    WHERE n.destinatario_id = auth.uid()
      AND NOT n.lida
      AND public.notificacao_valida(
            n.destinatario_id, n.ator_id, n.categoria, n.tipo, n.origem, n.referencia_id)
    LIMIT 50
  ) recentes;
$$;

/** Marca tudo como lido ao abrir a caixa. Devolve quantas mudaram. */
CREATE OR REPLACE FUNCTION public.notificacoes_marcar_lidas()
RETURNS INT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_mudadas INT;
BEGIN
  UPDATE public.notificacoes
     SET lida = TRUE
   WHERE destinatario_id = auth.uid()
     AND NOT lida;
  GET DIAGNOSTICS v_mudadas = ROW_COUNT;
  RETURN v_mudadas;
END;
$$;

DROP FUNCTION IF EXISTS public.comunidade_notificacoes_listar(INT, TIMESTAMPTZ, UUID);
DROP FUNCTION IF EXISTS public.comunidade_notificacoes_nao_lidas();
DROP FUNCTION IF EXISTS public.comunidade_marcar_notificacoes_lidas();
