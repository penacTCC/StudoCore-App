-- Separa a SALA de foco do REGISTRO PESSOAL de estudo.
--
-- Até aqui, a linha do anfitrião em `sessoes_foco` era três coisas ao mesmo tempo:
--
--   1. o registro pessoal de estudo dele (matéria, tempo, questões, `concluido_em`);
--   2. a identidade da sala (`tab_sessao_membros.sessao_id`, `incentivos.sessao_id`);
--   3. o cronograma compartilhado do pomodoro (`fila`, `fila_inicio_em`, `modo`).
--
-- Isso produziu bugs reais, não só feiura de modelagem:
--
--   * O anfitrião encerrava o ESTUDO dele, a linha ganhava `concluido_em`, e a SALA passava a
--     constar encerrada com gente dentro. Era a origem dos cronômetros de 142h e 940h que a
--     migration `20260806120000` teve de limpar.
--   * `transferir_anfitriao_sessao` promovia um sucessor, mas a sala continuava sendo
--     identificada pela linha do anfitrião ORIGINAL, já concluída. A função não tinha como
--     funcionar de verdade.
--   * O cronograma morava no registro pessoal: num plano com várias matérias, cada matéria
--     cria uma linha nova, então o ponto de encontro do grupo mudava no meio do estudo. O
--     `sessaoGrupoFixa` em app/(tabs)/focus.tsx existia só para contornar isso.
--
-- Agora a sala tem ciclo de vida próprio: encerrar o estudo pessoal não a fecha; ela fecha
-- quando o último participante sai.

CREATE TABLE IF NOT EXISTS public.salas_foco (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id       UUID REFERENCES public.grupos(id) ON DELETE CASCADE,
  anfitriao_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_public      BOOLEAN NOT NULL DEFAULT true,
  -- Cronograma da SALA, não de quem a criou (ver utils/pomodoroSequence.ts).
  modo           TEXT,
  fila           JSONB,
  fila_inicio_em TIMESTAMPTZ,
  criada_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- NULL = sala aberta. É este campo, e não o `concluido_em` de ninguém, que fecha a sala.
  encerrada_em   TIMESTAMPTZ
);

COMMENT ON TABLE public.salas_foco IS
  'Sala de foco em grupo: o ponto de encontro. Separada do registro pessoal de estudo de cada participante, que continua em sessoes_foco.';
COMMENT ON COLUMN public.salas_foco.encerrada_em IS
  'Preenchido quando o último participante sai. Encerrar a sessão pessoal do anfitrião NÃO fecha a sala.';

CREATE INDEX IF NOT EXISTS salas_foco_grupo_idx ON public.salas_foco (grupo_id, encerrada_em);

-- ─── Vínculos ────────────────────────────────────────────────────────────────
-- `sessao_id` continua em `tab_sessao_membros` porque faz parte da PK e não dá para dropar
-- sem reescrever a tabela; passa a ser coluna legada, e o app só lê `sala_id`.
ALTER TABLE public.tab_sessao_membros
  ADD COLUMN IF NOT EXISTS sala_id UUID REFERENCES public.salas_foco(id) ON DELETE CASCADE;

ALTER TABLE public.sessoes_foco
  ADD COLUMN IF NOT EXISTS sala_id UUID REFERENCES public.salas_foco(id) ON DELETE SET NULL;

ALTER TABLE public.incentivos
  ADD COLUMN IF NOT EXISTS sala_id UUID REFERENCES public.salas_foco(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.tab_sessao_membros.sessao_id IS
  'LEGADO: sessão do anfitrião de quando a sala e o registro pessoal eram a mesma linha. Use sala_id.';
COMMENT ON COLUMN public.sessoes_foco.sala_id IS
  'Sala em que este registro de estudo foi feito. NULL em estudo solo.';

-- ─── Backfill ────────────────────────────────────────────────────────────────
-- Uma sala por `sessao_id` distinto que já tem participantes, herdando o que a sessão de
-- origem carregava nos três papéis.
--
-- A sala REAPROVEITA o UUID da sessão de origem. Não é economia: é o que torna o backfill
-- determinístico — `tab_sessao_membros.sala_id = sessao_id`, `incentivos.sala_id =
-- sessao_id`, sem precisar correlacionar por timestamp (dois estudos podem começar no mesmo
-- instante). De quebra, o histórico continua rastreável até a linha que originou a sala.
-- Salas novas nascem com `gen_random_uuid()` normal; não há risco de colisão.
INSERT INTO public.salas_foco (
  id, grupo_id, anfitriao_id, is_public, modo, fila, fila_inicio_em, criada_em, encerrada_em
)
SELECT
  s.id,
  s.grupo_id,
  -- O anfitrião registrado manda; sem ele, quem criou a sessão de origem.
  COALESCE(
    (SELECT m2.membro_id FROM public.tab_sessao_membros m2
      WHERE m2.sessao_id = s.id AND m2.funcao = 'anfitriao' LIMIT 1),
    s.user_id
  ),
  COALESCE(s.is_public, true),
  s.modo,
  s.fila,
  s.fila_inicio_em,
  s.created_at,
  s.concluido_em
FROM public.sessoes_foco s
WHERE EXISTS (SELECT 1 FROM public.tab_sessao_membros m WHERE m.sessao_id = s.id)
  AND s.sala_id IS NULL;

-- Com o id reaproveitado, ligar tudo é uma igualdade direta.
UPDATE public.sessoes_foco s
SET sala_id = s.id
WHERE s.sala_id IS NULL
  AND EXISTS (SELECT 1 FROM public.salas_foco sa WHERE sa.id = s.id);

UPDATE public.tab_sessao_membros m
SET sala_id = m.sessao_id
WHERE m.sala_id IS NULL
  AND EXISTS (SELECT 1 FROM public.salas_foco sa WHERE sa.id = m.sessao_id);

UPDATE public.incentivos i
SET sala_id = i.sessao_id
WHERE i.sala_id IS NULL
  AND EXISTS (SELECT 1 FROM public.salas_foco sa WHERE sa.id = i.sessao_id);

-- Salas cujo histórico já estava todo encerrado, mas cuja sessão de origem nunca recebeu
-- `concluido_em` (app fechado à força): fecha pela régua de abandono de utils/tempo.ts.
UPDATE public.salas_foco sa
SET encerrada_em = COALESCE(sa.encerrada_em, sa.criada_em + INTERVAL '12 hours')
WHERE sa.encerrada_em IS NULL
  AND sa.criada_em < now() - INTERVAL '12 hours'
  AND NOT EXISTS (
    SELECT 1 FROM public.tab_sessao_membros m
    WHERE m.sala_id = sa.id AND m.status <> 'concluido'
  );

/*
  A torcida passa a ser da sala. `sessao_id` deixa de ser obrigatório porque uma sala nova
  não tem — e não deve ter — uma linha de `sessoes_foco` que a represente; era justamente
  essa amarra que fazia o registro pessoal do anfitrião valer por todo o encontro.
*/
ALTER TABLE public.incentivos ALTER COLUMN sessao_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS incentivos_unicos_por_sala
  ON public.incentivos (sala_id, remetente_id, destinatario_id)
  WHERE sala_id IS NOT NULL;

-- Uma pessoa tem uma participação por sala. (A PK antiga é por sessão de origem.)
CREATE UNIQUE INDEX IF NOT EXISTS tab_sessao_membros_sala_membro_idx
  ON public.tab_sessao_membros (sala_id, membro_id)
  WHERE sala_id IS NOT NULL;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.salas_foco ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'salas_foco'
      AND policyname = 'Salas visíveis para usuários logados'
  ) THEN
    CREATE POLICY "Salas visíveis para usuários logados"
      ON public.salas_foco FOR SELECT USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'salas_foco'
      AND policyname = 'Usuários podem abrir uma sala'
  ) THEN
    CREATE POLICY "Usuários podem abrir uma sala"
      ON public.salas_foco FOR INSERT WITH CHECK (auth.uid() = anfitriao_id);
  END IF;

  /*
    O anfitrião atualiza a própria sala (publicar/reajustar o cronograma). Fechar a sala e
    trocar de anfitrião passam pelos RPCs abaixo, que são SECURITY DEFINER porque precisam
    mexer na participação dos outros — a RLS de `tab_sessao_membros` não permite isso pelo
    client.
  */
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'salas_foco'
      AND policyname = 'Anfitrião atualiza a própria sala'
  ) THEN
    CREATE POLICY "Anfitrião atualiza a própria sala"
      ON public.salas_foco FOR UPDATE USING (auth.uid() = anfitriao_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'salas_foco'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.salas_foco;
  END IF;
END $$;

-- ─── RPCs ────────────────────────────────────────────────────────────────────

/*
  Sair da sala: fecha a PRÓPRIA participação e, se não sobrar ninguém, fecha a sala.

  É esta função que desacopla o encerramento pessoal do fechamento da sala — o defeito
  central que esta migration corrige. Antes, encerrar o estudo do anfitrião marcava
  `concluido_em` na linha que também identificava a sala, e todo mundo dentro dela virava
  fantasma com o cronômetro correndo.

  Devolve `true` quando a sala foi fechada por esta saída.
*/
CREATE OR REPLACE FUNCTION public.sair_da_sala(p_sala_id UUID, p_tempo_segundos INTEGER DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restantes INTEGER;
BEGIN
  UPDATE public.tab_sessao_membros
  SET
    status = 'concluido',
    tempo_segundos = COALESCE(p_tempo_segundos, tempo_segundos)
  WHERE sala_id = p_sala_id AND membro_id = auth.uid();

  SELECT count(*) INTO v_restantes
  FROM public.tab_sessao_membros
  WHERE sala_id = p_sala_id AND status <> 'concluido';

  IF v_restantes = 0 THEN
    UPDATE public.salas_foco
    SET encerrada_em = COALESCE(encerrada_em, now())
    WHERE id = p_sala_id;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

/*
  Passa o bastão e ATUALIZA `salas_foco.anfitriao_id` — o que a versão antiga
  (`transferir_anfitriao_sessao`) não tinha como fazer, porque a sala era a linha pessoal do
  anfitrião original e continuava sendo dele depois da transferência.
*/
CREATE OR REPLACE FUNCTION public.transferir_anfitriao_sala(p_sala_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sucessor UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tab_sessao_membros
    WHERE sala_id = p_sala_id AND membro_id = auth.uid() AND funcao = 'anfitriao'
  ) THEN
    RETURN NULL;
  END IF;

  -- Quem está na sala há mais tempo assume; quem nunca começou a contar fica por último.
  SELECT membro_id INTO v_sucessor
  FROM public.tab_sessao_membros
  WHERE sala_id = p_sala_id
    AND membro_id <> auth.uid()
    AND status <> 'concluido'
  ORDER BY ultimo_inicio ASC NULLS LAST
  LIMIT 1;

  IF v_sucessor IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.tab_sessao_membros SET funcao = 'anfitriao'
    WHERE sala_id = p_sala_id AND membro_id = v_sucessor;
  UPDATE public.tab_sessao_membros SET funcao = 'membro'
    WHERE sala_id = p_sala_id AND membro_id = auth.uid();

  -- A parte que faltava: a sala passa a ser do sucessor.
  UPDATE public.salas_foco SET anfitriao_id = v_sucessor WHERE id = p_sala_id;

  RETURN v_sucessor;
END;
$$;

/*
  Fecha a sala inteira. Sucessora de `encerrar_participacoes_da_sessao`, com a mesma conta de
  crédito de tempo: o trecho em aberto entra limitado ao corte de 12h de utils/tempo.ts, para
  que quem estava focando não perca tempo e quem abandonou não ganhe os dias de app fechado.
*/
CREATE OR REPLACE FUNCTION public.encerrar_sala(p_sala_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encerradas INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tab_sessao_membros
    WHERE sala_id = p_sala_id AND membro_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Apenas participantes podem encerrar esta sala.';
  END IF;

  UPDATE public.tab_sessao_membros
  SET
    status = 'concluido',
    tempo_segundos = tempo_segundos + CASE
      WHEN status = 'ativo' AND ultimo_inicio IS NOT NULL
        THEN GREATEST(0, LEAST(EXTRACT(EPOCH FROM (now() - ultimo_inicio)), 12 * 3600))::INTEGER
      ELSE 0
    END
  WHERE sala_id = p_sala_id AND status <> 'concluido';

  GET DIAGNOSTICS v_encerradas = ROW_COUNT;

  UPDATE public.salas_foco
  SET encerrada_em = COALESCE(encerrada_em, now())
  WHERE id = p_sala_id;

  RETURN v_encerradas;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sair_da_sala(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transferir_anfitriao_sala(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.encerrar_sala(UUID) TO authenticated;
