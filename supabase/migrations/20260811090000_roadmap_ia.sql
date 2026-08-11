/*
  Roadmap de estudos por IA — ver docs/plano-roadmap-ia.md.

  Decisão de arquitetura: não existe entidade "roadmap" nova. O roadmap é um plano
  (`planos`/`planos_blocos`) e o de grupo é N cópias de um plano — uma por membro —
  distribuídas de uma vez, no mesmo padrão de cópia da Comunidade (`comunidade_importar_plano`).

  1. Duas colunas novas em `planos` (só metadado, RLS não muda):
     - `origem_grupo_id`         no plano CANÔNICO do admin (a fonte do roadmap de grupo);
     - `origem_roadmap_plano_id` nas cópias de cada membro (aponta pro canônico) — é o que
       amarra "essa cópia pertence a este roadmap" para a agregação de progresso.
  2. Tabela `planos_blocos_concluidos` — o toggle manual "concluí este bloco", por membro.
     RLS igual à de `planos_blocos`: só o dono do plano marca os próprios blocos. A leitura
     coletiva do grupo passa por RPC SECURITY DEFINER (`grupo_progresso_roadmap`).
  3. RPC `grupo_distribuir_roadmap` — copia o canônico para cada membro (exceto o admin,
     que já tem o original), reconcilia matéria por nome normalizado (como
     `comunidade_importar_plano`) e notifica os membros. Só o admin do grupo.
  4. Trigger `grupo_roadmap_para_novo_membro` — quem entra num grupo com roadmap ativo
     recebe a cópia automaticamente (best-effort: só o canônico mais recente).
  5. RPC `grupo_progresso_roadmap` — % de membros atuais que concluíram os blocos de
     estudo da semana atual (sempre cruzando com `membros`, regra de AGENTS.md).
  6. Novo tipo de notificação `roadmap_novo` (categoria grupo).
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Metadado de roadmap em planos
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS origem_grupo_id UUID REFERENCES public.grupos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origem_roadmap_plano_id UUID REFERENCES public.planos(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.planos.origem_grupo_id IS
  'Plano canônico de um roadmap de grupo por IA. Só o plano do admin tem isto; o plano NÃO entra na agenda dele automaticamente.';
COMMENT ON COLUMN public.planos.origem_roadmap_plano_id IS
  'Cópia do roadmap de grupo entregue a um membro. Aponta pro plano canônico (origem_grupo_id) para a agregação de progresso.';

-- "O roadmap ativo do grupo" = o canônico mais recente.
CREATE INDEX IF NOT EXISTS planos_origem_grupo_idx
  ON public.planos (origem_grupo_id, created_at DESC)
  WHERE origem_grupo_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS planos_origem_roadmap_idx
  ON public.planos (origem_roadmap_plano_id)
  WHERE origem_roadmap_plano_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Conclusão de bloco (toggle manual, v1)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.planos_blocos_concluidos (
  bloco_id UUID REFERENCES public.planos_blocos(id) ON DELETE CASCADE NOT NULL,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  concluido_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (bloco_id, usuario_id)
);

COMMENT ON TABLE public.planos_blocos_concluidos IS
  'Marcação manual "concluí este bloco", por membro do plano. Alimenta o progresso coletivo do roadmap de grupo (RPC grupo_progresso_roadmap).';

ALTER TABLE public.planos_blocos_concluidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vejo minhas conclusões de bloco"
  ON public.planos_blocos_concluidos FOR SELECT
  USING (usuario_id = auth.uid());

-- A condição de INSERT inclui "o bloco é de um plano meu": não dá pra marcar bloco alheio.
CREATE POLICY "Marco meus blocos"
  ON public.planos_blocos_concluidos FOR INSERT
  WITH CHECK (
    usuario_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.planos_blocos b
      JOIN public.planos p ON p.id = b.plano_id
      WHERE b.id = bloco_id AND p.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Atualizo minhas conclusões"
  ON public.planos_blocos_concluidos FOR UPDATE
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "Apago minhas conclusões"
  ON public.planos_blocos_concluidos FOR DELETE
  USING (usuario_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. A cópia, um membro por vez (usada pela RPC de distribuição e pelo trigger)
-- ─────────────────────────────────────────────────────────────────────────────
/**
 * Copia um roadmap (plano canônico + blocos) para `p_usuario_destino`.
 *
 * Mesma lógica de `comunidade_importar_plano`: copiar, não referenciar; agenda nasce
 * 'nenhuma' (o membro decide se fixa depois); matéria reconciliada por nome normalizado
 * no acervo do destino, criando quando não existe equivalente. Idempotente — se o destino
 * já tem uma cópia deste mesmo roadmap, não duplica.
 *
 * SECURITY DEFINER porque copia em `planos`/`planos_blocos`/`materias_usuario` do destino,
 * onde o chamador (RPC do admin ou trigger) não tem RLS.
 */
CREATE OR REPLACE FUNCTION public.grupo_copiar_roadmap_para_membro(
  p_plano_id UUID,
  p_usuario_destino UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plano  public.planos%ROWTYPE;
  v_novo_id UUID;
  v_bloco  RECORD;
  v_materia UUID;
BEGIN
  SELECT * INTO v_plano FROM public.planos WHERE id = p_plano_id;
  IF v_plano.id IS NULL THEN RETURN NULL; END IF;

  IF EXISTS (
    SELECT 1 FROM public.planos p
    WHERE p.usuario_id = p_usuario_destino
      AND p.origem_roadmap_plano_id = p_plano_id
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.planos (usuario_id, nome, cor, agenda_tipo, origem_roadmap_plano_id)
  VALUES (p_usuario_destino, v_plano.nome, v_plano.cor, 'nenhuma', p_plano_id)
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
        AND (m.usuario_id = p_usuario_destino OR m.usuario_id IS NULL)
      -- Preferir a própria à padrão do sistema (mesma regra da Comunidade).
      ORDER BY (m.usuario_id IS NULL)
      LIMIT 1;

      IF v_materia IS NULL THEN
        INSERT INTO public.materias_usuario (usuario_id, nome_exibicao, nome_normalizado, cor)
        VALUES (p_usuario_destino, v_bloco.nome_exibicao, v_bloco.nome_normalizado,
                COALESCE(v_bloco.materia_cor, '#6b6e76'))
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
-- 4. RPC do admin: distribuir o roadmap para o grupo
-- ─────────────────────────────────────────────────────────────────────────────
/**
 * Distribui o plano canônico de um roadmap de grupo para todos os membros (exceto o admin).
 *
 * A checagem de admin acontece no BANCO, contra `auth.uid()` — nunca confiar em checagem
 * client-side (mesmo padrão de `definir_codigo_convite`/`sair_do_grupo`). Retorna quantas
 * cópias foram criadas.
 */
CREATE OR REPLACE FUNCTION public.grupo_distribuir_roadmap(p_plano_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
  DECLARE
    v_eu UUID := auth.uid();
    v_plano public.planos%ROWTYPE;
    v_grupo_id UUID;
    v_membro RECORD;
    v_copias INT := 0;
    v_copia UUID;
  BEGIN
  IF v_eu IS NULL THEN
    RAISE EXCEPTION 'Sessão expirada.';
  END IF;

  SELECT * INTO v_plano FROM public.planos WHERE id = p_plano_id;
  IF v_plano.id IS NULL OR v_plano.usuario_id <> v_eu OR v_plano.origem_grupo_id IS NULL THEN
    RAISE EXCEPTION 'Roadmap não encontrado para este grupo.';
  END IF;

  v_grupo_id := v_plano.origem_grupo_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.membros m
    WHERE m.grupo_id = v_grupo_id AND m.user_id = v_eu AND m.administrador
  ) THEN
    RAISE EXCEPTION 'Apenas o administrador do grupo pode distribuir o roadmap.';
  END IF;

  FOR v_membro IN
    SELECT m.user_id FROM public.membros m
    WHERE m.grupo_id = v_grupo_id AND m.user_id <> v_eu
  LOOP
    -- Reenviar o MESMO roadmap não re-notifica: só conta (e avisa) cópia criada agora.
    v_copia := public.grupo_copiar_roadmap_para_membro(p_plano_id, v_membro.user_id);
    IF v_copia IS NOT NULL THEN
      PERFORM public.notificar(v_membro.user_id, v_eu, 'grupo', 'roadmap_novo', v_grupo_id);
      v_copias := v_copias + 1;
    END IF;
  END LOOP;

  RETURN v_copias;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Membro que entra depois herda o roadmap ativo (best-effort)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.grupo_roadmap_para_novo_membro()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plano_id UUID;
  v_admin UUID;
BEGIN
  -- Só o canônico MAIS RECENTE é copiado: se o admin regenerou o roadmap, o antigo não
  -- volta pra quem entrou depois (ver §2.4 do plano).
  SELECT p.id INTO v_plano_id
  FROM public.planos p
  WHERE p.origem_grupo_id = NEW.grupo_id
  ORDER BY p.created_at DESC
  LIMIT 1;

  IF v_plano_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.grupo_copiar_roadmap_para_membro(v_plano_id, NEW.user_id);

  SELECT m.user_id INTO v_admin
  FROM public.membros m
  WHERE m.grupo_id = NEW.grupo_id AND m.administrador
  LIMIT 1;

  IF v_admin IS NOT NULL THEN
    PERFORM public.notificar(NEW.user_id, v_admin, 'grupo', 'roadmap_novo', NEW.grupo_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS grupo_roadmap_para_novo_membro ON public.membros;
CREATE TRIGGER grupo_roadmap_para_novo_membro
  AFTER INSERT ON public.membros
  FOR EACH ROW EXECUTE FUNCTION public.grupo_roadmap_para_novo_membro();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Progresso coletivo (o "ganho coletivo" da feature)
-- ─────────────────────────────────────────────────────────────────────────────
/**
 * Progresso semanal do roadmap de um grupo, cruzando SEMPRE com `membros` (quem saiu não
 * conta). Um membro "completou" a semana quando marcou como concluídos todos os blocos de
 * ESTUDO da cópia dele (referência: o canônico mais recente do grupo), na semana local
 * atual (America/Sao_Paulo). SECURITY DEFINER porque lê as conclusões de todos os membros,
 * que a RLS da tabela esconde — só membros do grupo conseguem chamar.
 */
CREATE OR REPLACE FUNCTION public.grupo_progresso_roadmap(p_grupo_id UUID)
RETURNS TABLE (
  plano_id UUID,
  nome TEXT,
  cor TEXT,
  total_blocos_semana BIGINT,
  total_membros BIGINT,
  membros_completaram BIGINT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH canonicos AS (
    SELECT p.id, p.nome, p.cor
    FROM public.planos p
    WHERE p.origem_grupo_id = p_grupo_id
    ORDER BY p.created_at DESC
    LIMIT 1
  ),
  membros_ativos AS (
    SELECT m.user_id FROM public.membros m WHERE m.grupo_id = p_grupo_id
  ),
  -- O canônico (dono = admin) e as cópias de cada membro. O admin participa do progresso
  -- como qualquer membro, se concluir os blocos do plano canônico dele.
  copias AS (
    SELECT p.id AS plano_id, p.usuario_id,
      (SELECT count(*) FROM public.planos_blocos b
        WHERE b.plano_id = p.id AND b.tipo = 'estudo') AS blocos_estudo
    FROM public.planos p
    JOIN canonicos c ON p.id = c.id OR p.origem_roadmap_plano_id = c.id
  ),
  por_membro AS (
    SELECT cp.usuario_id,
      count(DISTINCT cc.bloco_id) AS concluidos,
      max(cp.blocos_estudo) AS blocos_estudo
    FROM copias cp
    JOIN membros_ativos ma ON ma.user_id = cp.usuario_id
    LEFT JOIN public.planos_blocos_concluidos cc
      ON cc.usuario_id = cp.usuario_id
      AND EXISTS (
        SELECT 1 FROM public.planos_blocos b
        WHERE b.plano_id = cp.plano_id AND b.id = cc.bloco_id
      )
      -- Semana local, não UTC: o toggle antes das 21h de domingo pertence à semana.
      AND (cc.concluido_em at time zone 'America/Sao_Paulo')::date
          >= date_trunc('week', (now() at time zone 'America/Sao_Paulo')::date)
    GROUP BY cp.usuario_id
  )
  SELECT
    c.id,
    c.nome,
    c.cor,
    (SELECT count(*) FROM public.planos_blocos b
      WHERE b.plano_id = c.id AND b.tipo = 'estudo'),
    (SELECT count(*) FROM membros_ativos),
    (SELECT count(*) FROM por_membro pm WHERE pm.concluidos >= pm.blocos_estudo)
  FROM canonicos c
  WHERE EXISTS (
    SELECT 1 FROM public.membros m
    WHERE m.grupo_id = p_grupo_id AND m.user_id = auth.uid()
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Nova notificação "novo roadmap"
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.notificacoes
  DROP CONSTRAINT IF EXISTS notificacao_tipo_da_categoria;

ALTER TABLE public.notificacoes
  ADD CONSTRAINT notificacao_tipo_da_categoria CHECK (
    (categoria = 'comunidade' AND tipo IN ('curtida', 'comentario'))
    OR (categoria = 'grupo' AND tipo IN ('novo_membro', 'sala_aberta', 'roadmap_novo'))
    OR (categoria = 'foco' AND tipo = 'forca')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Fechar as novas funções de escrita à API pública
-- ─────────────────────────────────────────────────────────────────────────────
-- `grupo_distribuir_roadmap` é chamável só por autenticados (o admin); a leitura do
-- progresso também, mas de `anon` não serve. As funções de gatilho/cópia são internas.
REVOKE ALL ON FUNCTION public.grupo_distribuir_roadmap(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grupo_distribuir_roadmap(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.grupo_copiar_roadmap_para_membro(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grupo_roadmap_para_novo_membro() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.grupo_progresso_roadmap(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grupo_progresso_roadmap(UUID) TO authenticated;
