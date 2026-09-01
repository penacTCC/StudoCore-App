-- Corrige o formato da query de `comunidade_feed_galeria` (services/comunidade.ts), que
-- defeituosamente precisava reordenar e deduplicar TODAS as sessões públicas com foto antes de
-- aplicar o LIMIT da página — o cursor só cortava a página depois disso. Com o volume de hoje
-- (poucas dezenas de fotos) o custo é invisível; conforme a galeria cresce, cada página passa a
-- custar proporcional ao tamanho do feed inteiro, não ao tamanho da página.
--
-- A causa era estrutural: a RPC escolhia "1 foto por execução de plano" com um DISTINCT ON
-- calculado NA HORA da consulta — e o Postgres não tem como aplicar um LIMIT antes de terminar
-- de deduplicar um agrupamento assim.
--
-- A correção materializa essa escolha em vez de recalculá-la a cada request:
--   * `galeria_criado_em` é uma coluna gerada (STORED) com o mesmo COALESCE que a RPC já usava
--     pra decidir a data de exibição — agora é uma coluna real, indexável.
--   * `eh_capa_da_execucao` marca, por linha, se ELA é a representante da própria execução na
--     galeria (a de menor `created_at` entre as que têm foto — mesma regra de antes). Um
--     gatilho mantém essa marcação sempre que uma sessão ganha/perde foto ou muda de execução,
--     tocando só as linhas da MESMA execução (grupo pequeno), nunca a tabela inteira.
--
-- Com isso, `comunidade_feed_galeria` vira um scan comum por índice, ordenado e paginável —
-- exatamente como as outras duas RPCs do feed (`comunidade_feed_arquivos`,
-- `comunidade_feed_planos`) já eram.
--
-- Escopo: o gatilho cobre INSERT/UPDATE. Não cobre DELETE porque `sessoes_foco` não tem
-- política de DELETE pro client (usuário não apaga sessão), só serviços administrativos raros.

ALTER TABLE public.sessoes_foco
  ADD COLUMN IF NOT EXISTS galeria_criado_em TIMESTAMPTZ
  GENERATED ALWAYS AS (COALESCE(foto_criada_em, concluido_em, created_at)) STORED;

ALTER TABLE public.sessoes_foco
  ADD COLUMN IF NOT EXISTS eh_capa_da_execucao BOOLEAN NOT NULL DEFAULT false;

-- Backfill: mesma regra que a RPC antiga usava (menor created_at por COALESCE(execucao_id, id)).
WITH candidatos AS (
  SELECT id,
    row_number() OVER (
      PARTITION BY COALESCE(execucao_id, id)
      ORDER BY created_at ASC, id ASC
    ) AS posicao
  FROM public.sessoes_foco
  WHERE foto_path IS NOT NULL
)
UPDATE public.sessoes_foco s
SET eh_capa_da_execucao = true
FROM candidatos c
WHERE s.id = c.id AND c.posicao = 1;

CREATE INDEX IF NOT EXISTS sessoes_foco_capa_execucao_idx
  ON public.sessoes_foco (galeria_criado_em DESC, id DESC)
  WHERE eh_capa_da_execucao AND is_public;

CREATE OR REPLACE FUNCTION public.sessoes_foco_atualizar_capa_execucao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_grupo uuid;
  v_capa_id uuid;
BEGIN
  v_grupo := COALESCE(NEW.execucao_id, NEW.id);

  SELECT id INTO v_capa_id
  FROM public.sessoes_foco
  WHERE COALESCE(execucao_id, id) = v_grupo AND foto_path IS NOT NULL
  ORDER BY created_at ASC, id ASC
  LIMIT 1;

  UPDATE public.sessoes_foco
  SET eh_capa_da_execucao = COALESCE(id = v_capa_id, false)
  WHERE COALESCE(execucao_id, id) = v_grupo
    AND eh_capa_da_execucao IS DISTINCT FROM COALESCE(id = v_capa_id, false);

  -- A linha mudou de execução: o grupo antigo perdeu uma candidata e precisa recalcular também.
  IF TG_OP = 'UPDATE' AND OLD.execucao_id IS DISTINCT FROM NEW.execucao_id THEN
    v_grupo := COALESCE(OLD.execucao_id, OLD.id);

    SELECT id INTO v_capa_id
    FROM public.sessoes_foco
    WHERE COALESCE(execucao_id, id) = v_grupo AND foto_path IS NOT NULL
    ORDER BY created_at ASC, id ASC
    LIMIT 1;

    UPDATE public.sessoes_foco
    SET eh_capa_da_execucao = COALESCE(id = v_capa_id, false)
    WHERE COALESCE(execucao_id, id) = v_grupo
      AND eh_capa_da_execucao IS DISTINCT FROM COALESCE(id = v_capa_id, false);
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sessoes_foco_capa_execucao ON public.sessoes_foco;

-- Não observa `eh_capa_da_execucao` de propósito: o UPDATE acima só mexe nessa coluna, e
-- incluí-la aqui faria o gatilho disparar a si mesmo.
CREATE TRIGGER trg_sessoes_foco_capa_execucao
  AFTER INSERT OR UPDATE OF foto_path, execucao_id, created_at, foto_criada_em, concluido_em
  ON public.sessoes_foco
  FOR EACH ROW
  EXECUTE FUNCTION public.sessoes_foco_atualizar_capa_execucao();

CREATE OR REPLACE FUNCTION public.comunidade_feed_galeria(p_limite integer DEFAULT 6, p_cursor_data timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(sessao_id uuid, autor_id uuid, autor_nome text, autor_foto text, foto_path text, foto_legenda text, disciplina text, tempo_minutos integer, criado_em timestamp with time zone, curtidas bigint, curtido_por_mim boolean, comentarios bigint, salvo_por_mim boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT
    s.id,
    s.user_id,
    p.nome_usuario,
    p.foto_usuario,
    s.foto_path,
    s.foto_legenda,
    s.disciplina,
    s.tempo_minutos,
    s.galeria_criado_em,
    (SELECT count(*) FROM public.comunidade_curtidas c
      WHERE c.origem = 'galeria' AND c.referencia_id = s.id),
    EXISTS (SELECT 1 FROM public.comunidade_curtidas c
      WHERE c.origem = 'galeria' AND c.referencia_id = s.id AND c.user_id = auth.uid()),
    (SELECT count(*) FROM public.comunidade_comentarios m
      WHERE m.origem = 'galeria' AND m.referencia_id = s.id),
    EXISTS (SELECT 1 FROM public.comunidade_salvos sv
      WHERE sv.sessao_id = s.id AND sv.user_id = auth.uid())
  FROM public.sessoes_foco s
  JOIN public.profiles p ON p.id = s.user_id
  WHERE s.eh_capa_da_execucao
    AND s.foto_path IS NOT NULL
    AND s.is_public
    AND COALESCE(p.perfil_publico, TRUE)
    AND public.comunidade_usuario_no_feed(s.user_id)
    AND NOT public.comunidade_bloqueio_entre(s.user_id, auth.uid())
    AND (p_cursor_data IS NULL OR (s.galeria_criado_em, s.id) < (p_cursor_data, p_cursor_id))
  ORDER BY s.galeria_criado_em DESC, s.id DESC
  LIMIT LEAST(GREATEST(p_limite, 1), 30);
$function$;
