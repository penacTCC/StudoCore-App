/*
  Notificações do feed público: "fulano curtiu" e "fulano comentou".

  Quem escreve nesta tabela são os GATILHOS de `comunidade_curtidas` e
  `comunidade_comentarios`, nunca o app. Por isso não existe policy de INSERT: se o
  cliente pudesse inserir, qualquer um poderia forjar "alguém curtiu você" — e, pior,
  disparar o push de outra pessoa (ver a Edge Function `avisar-interacao`).

  A curtida DESFEITA não apaga a linha de propósito. A linha é a chave de deduplicação
  (índice único abaixo): sem ela, curtir/descurtir em loop viraria uma notificação — e um
  push — a cada toque. Em vez de apagar, a listagem confere se a curtida ainda existe e
  esconde as que não existem mais. O mesmo vale para publicação que saiu do ar: a
  listagem exige que `comunidade_dono_da_publicacao` ainda devolva o destinatário, que é
  o teste de "ainda é pública e ainda é minha".
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- Tabela
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comunidade_notificacoes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destinatario_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Quem curtiu/comentou. CASCADE porque uma notificação sem ator não tem o que dizer.
  ator_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo           TEXT NOT NULL CHECK (tipo IN ('curtida', 'comentario')),
  origem         public.comunidade_origem NOT NULL,
  referencia_id  UUID NOT NULL,
  -- Só nas de comentário. O CASCADE é o que faz a notificação sumir quando o comentário
  -- é apagado — sem ele sobraria "fulano comentou" apontando para o vazio.
  comentario_id  UUID REFERENCES public.comunidade_comentarios(id) ON DELETE CASCADE,
  lida           BOOLEAN NOT NULL DEFAULT FALSE,
  -- Marcado pela Edge Function que manda o push, para que uma segunda chamada (retry do
  -- app, dois aparelhos) não notifique a mesma coisa duas vezes.
  push_enviado   BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT comunidade_notificacao_nao_reflexiva CHECK (destinatario_id <> ator_id),
  -- Comentário sempre aponta para a linha dele; curtida nunca aponta.
  CONSTRAINT comunidade_notificacao_comentario_coerente CHECK (
    (tipo = 'comentario' AND comentario_id IS NOT NULL)
    OR (tipo = 'curtida' AND comentario_id IS NULL)
  )
);

-- Uma curtida da mesma pessoa na mesma publicação notifica UMA vez, para sempre.
CREATE UNIQUE INDEX IF NOT EXISTS comunidade_notificacoes_curtida_unica
  ON public.comunidade_notificacoes (destinatario_id, ator_id, origem, referencia_id)
  WHERE tipo = 'curtida';

-- A consulta da tela: as minhas, da mais nova para a mais velha (keyset por data + id).
CREATE INDEX IF NOT EXISTS comunidade_notificacoes_caixa_idx
  ON public.comunidade_notificacoes (destinatario_id, criado_em DESC, id DESC);

-- O badge pergunta só "tem não lida?" — índice parcial, que fica pequeno mesmo com
-- anos de histórico lido.
CREATE INDEX IF NOT EXISTS comunidade_notificacoes_nao_lidas_idx
  ON public.comunidade_notificacoes (destinatario_id)
  WHERE NOT lida;

ALTER TABLE public.comunidade_notificacoes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='comunidade_notificacoes' AND policyname='Cada um vê as próprias notificações') THEN
    CREATE POLICY "Cada um vê as próprias notificações"
      ON public.comunidade_notificacoes FOR SELECT
      USING (auth.uid() = destinatario_id);
  END IF;

  -- Só serve para marcar como lida; o WITH CHECK impede repassar a notificação a outra
  -- pessoa em um UPDATE.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='comunidade_notificacoes' AND policyname='Cada um marca as próprias como lidas') THEN
    CREATE POLICY "Cada um marca as próprias como lidas"
      ON public.comunidade_notificacoes FOR UPDATE
      USING (auth.uid() = destinatario_id)
      WITH CHECK (auth.uid() = destinatario_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='comunidade_notificacoes' AND policyname='Cada um limpa as próprias notificações') THEN
    CREATE POLICY "Cada um limpa as próprias notificações"
      ON public.comunidade_notificacoes FOR DELETE
      USING (auth.uid() = destinatario_id);
  END IF;
END $$;

-- Realtime: é o que faz o badge subir com o app aberto, sem ninguém ficar perguntando
-- ao servidor de tempos em tempos.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'comunidade_notificacoes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comunidade_notificacoes;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Os gatilhos que escrevem
--
-- SECURITY DEFINER porque a policy de INSERT não existe: a única porta de entrada da
-- tabela é esta. Nenhum deles lança — uma curtida não pode falhar porque a notificação
-- falhou.
-- ─────────────────────────────────────────────────────────────────────────────
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

  -- Publicação fora do ar, curtida no próprio post, ou bloqueio entre os dois: nada a
  -- avisar. O bloqueio é checado aqui e de novo na leitura, porque bloquear depois não
  -- pode deixar a notificação antiga na caixa.
  IF v_dono IS NULL OR v_dono = NEW.user_id THEN RETURN NEW; END IF;
  IF public.comunidade_bloqueio_entre(v_dono, NEW.user_id) THEN RETURN NEW; END IF;

  INSERT INTO public.comunidade_notificacoes
    (destinatario_id, ator_id, tipo, origem, referencia_id, comentario_id)
  VALUES (
    v_dono,
    NEW.user_id,
    v_tipo,
    NEW.origem,
    NEW.referencia_id,
    CASE WHEN v_tipo = 'comentario' THEN NEW.id ELSE NULL END
  )
  -- Recurtir algo já notificado não gera notificação nova (ver o índice único).
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comunidade_notificar_curtida ON public.comunidade_curtidas;
CREATE TRIGGER comunidade_notificar_curtida
  AFTER INSERT ON public.comunidade_curtidas
  FOR EACH ROW EXECUTE FUNCTION public.comunidade_notificar_interacao('curtida');

DROP TRIGGER IF EXISTS comunidade_notificar_comentario ON public.comunidade_comentarios;
CREATE TRIGGER comunidade_notificar_comentario
  AFTER INSERT ON public.comunidade_comentarios
  FOR EACH ROW EXECUTE FUNCTION public.comunidade_notificar_interacao('comentario');

-- Apagar a publicação leva junto as notificações dela. O gatilho genérico de limpeza já
-- existe (20260807210000) e roda nas três origens; só ganha mais um DELETE.
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
  DELETE FROM public.comunidade_notificacoes
    WHERE origem = v_origem AND referencia_id = OLD.id;
  RETURN OLD;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Leitura
--
-- O filtro de validade aparece duas vezes (lista e contagem) e precisa ser o MESMO: um
-- badge com "3" que abre numa lista de 2 é pior que badge nenhum.
-- ─────────────────────────────────────────────────────────────────────────────

/** A notificação ainda faz sentido? (publicação minha e pública, curtida ainda de pé) */
CREATE OR REPLACE FUNCTION public.comunidade_notificacao_valida(
  p_destinatario_id UUID,
  p_ator_id UUID,
  p_tipo TEXT,
  p_origem public.comunidade_origem,
  p_referencia_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.comunidade_dono_da_publicacao(p_origem, p_referencia_id) = p_destinatario_id
     AND NOT public.comunidade_bloqueio_entre(p_ator_id, p_destinatario_id)
     AND (
       p_tipo <> 'curtida'
       OR EXISTS (
         SELECT 1 FROM public.comunidade_curtidas c
         WHERE c.user_id = p_ator_id
           AND c.origem = p_origem
           AND c.referencia_id = p_referencia_id
       )
     );
$$;

/**
 * A caixa de notificações, paginada por keyset.
 *
 * `resumo` e `foto_path` descrevem a publicação alvo para a linha da lista ("na sua foto
 * de Matemática"). O caminho da foto sai daqui cru: o bucket é privado e quem assina é o
 * app, em lote, como já faz o feed.
 */
CREATE OR REPLACE FUNCTION public.comunidade_notificacoes_listar(
  p_limite INT DEFAULT 20,
  p_cursor_data TIMESTAMPTZ DEFAULT NULL,
  p_cursor_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id            UUID,
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
    n.tipo,
    n.origem,
    n.referencia_id,
    n.ator_id,
    p.nome_usuario,
    p.foto_usuario,
    (SELECT m.texto FROM public.comunidade_comentarios m WHERE m.id = n.comentario_id),
    CASE n.origem
      WHEN 'galeria' THEN (SELECT s.disciplina FROM public.sessoes_foco s WHERE s.id = n.referencia_id)
      WHEN 'arquivo' THEN (SELECT a.titulo FROM public.arquivos a WHERE a.id = n.referencia_id)
      WHEN 'plano'   THEN (SELECT pl.nome FROM public.planos pl WHERE pl.id = n.referencia_id)
    END,
    CASE WHEN n.origem = 'galeria'
      THEN (SELECT s.foto_path FROM public.sessoes_foco s WHERE s.id = n.referencia_id)
    END,
    n.lida,
    n.criado_em
  FROM public.comunidade_notificacoes n
  JOIN public.profiles p ON p.id = n.ator_id
  WHERE n.destinatario_id = auth.uid()
    AND (p_cursor_data IS NULL OR (n.criado_em, n.id) < (p_cursor_data, p_cursor_id))
    AND public.comunidade_notificacao_valida(
          n.destinatario_id, n.ator_id, n.tipo, n.origem, n.referencia_id)
  ORDER BY n.criado_em DESC, n.id DESC
  LIMIT LEAST(GREATEST(p_limite, 1), 50);
$$;

/**
 * Quantas não lidas — o número do badge.
 *
 * O teto de 50 é de propósito: o badge escreve "9+" acima de nove, e varrer um histórico
 * inteiro só para descobrir que são "muitas" seria caro à toa.
 */
CREATE OR REPLACE FUNCTION public.comunidade_notificacoes_nao_lidas()
RETURNS INT
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT count(*)::INT FROM (
    SELECT 1
    FROM public.comunidade_notificacoes n
    WHERE n.destinatario_id = auth.uid()
      AND NOT n.lida
      AND public.comunidade_notificacao_valida(
            n.destinatario_id, n.ator_id, n.tipo, n.origem, n.referencia_id)
    LIMIT 50
  ) recentes;
$$;

/** Marca tudo como lido ao abrir a caixa. Devolve quantas mudaram. */
CREATE OR REPLACE FUNCTION public.comunidade_marcar_notificacoes_lidas()
RETURNS INT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_mudadas INT;
BEGIN
  UPDATE public.comunidade_notificacoes
     SET lida = TRUE
   WHERE destinatario_id = auth.uid()
     AND NOT lida;
  GET DIAGNOSTICS v_mudadas = ROW_COUNT;
  RETURN v_mudadas;
END;
$$;

COMMENT ON TABLE public.comunidade_notificacoes IS
  'Caixa de notificações do feed público. Escrita só por gatilho — o app nunca insere aqui.';
