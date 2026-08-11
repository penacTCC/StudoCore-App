/*
  Dias por bloco em planos_blocos — ver docs/plano-roadmap-ia.md §2.6.

  O roadmap por IA devolve uma semana com blocos em dias diferentes (Matemática na
  segunda, Física na quarta). Até aqui essa estrutura morria na materialização: o plano
  só conhecia `agenda_dias`, que vale para TODOS os blocos de uma vez, e a agenda e os
  lembretes repetiam cada bloco em todos os dias fixados do plano.

  A coluna `dia_semana` deixa um bloco escolher o dia dele:
    - NULL  = vale em todos os dias da agenda do plano (comportamento de sempre);
    - 0..6  = vale SÓ naquele dia da semana (0 = segunda, mesma convenção de
              `rotina_semanal_blocos.dia_semana` e `planos.agenda_dias`).

  A agenda (services/agenda.ts) e os lembretes (services/lembretes.ts) passam a filtrar
  os blocos por dia. As duas funções de cópia de plano — a da Comunidade
  (`comunidade_importar_plano`) e a do roadmap de grupo (`grupo_copiar_roadmap_para_membro`)
  — são recriadas aqui para carregar o dia junto; são as únicas portas que copiam blocos
  de outro plano no banco.
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. A coluna
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.planos_blocos
  ADD COLUMN IF NOT EXISTS dia_semana INTEGER CHECK (
    dia_semana IS NULL OR (dia_semana BETWEEN 0 AND 6)
  );

COMMENT ON COLUMN public.planos_blocos.dia_semana IS
  'Dia da semana exclusivo do bloco (0 = segunda ... 6 = domingo). NULL = vale em todos os dias da agenda do plano. Preserva a estrutura por dia de um roadmap por IA.';

-- Varredura de agenda por dia de um plano fixado: ajuda a achar rápido os blocos do dia.
CREATE INDEX IF NOT EXISTS planos_blocos_dia_semana_idx
  ON public.planos_blocos (plano_id, dia_semana)
  WHERE dia_semana IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Comunidade: importar plano agora carrega o dia de cada bloco
-- ─────────────────────────────────────────────────────────────────────────────
/*
  Mesma função de 20260807210000, só que copiando `dia_semana`. Se o autor do plano
  compartilhou um roadmap (blocos em dias específicos), quem importa recebe essa
  estrutura em vez de uma lista uniforme. O resto não muda: copiar, não referenciar;
  agenda nasce 'nenhuma'; matéria reconciliada por nome normalizado no acervo de quem
  importa.
*/
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

  INSERT INTO public.planos (usuario_id, nome, cor, agenda_tipo)
  VALUES (v_eu, v_origem.nome, v_origem.cor, 'nenhuma')
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
-- 3. Roadmap de grupo: a cópia de cada membro carrega o dia de cada bloco
-- ─────────────────────────────────────────────────────────────────────────────
/*
  Idem para a cópia do roadmap: sem isto, o bloco chegaria ao membro valendo para todos
  os dias — exatamente o bug de "estrutura por dia descartada" que esta migration corrige.
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
      (plano_id, hora_inicio, duracao_min, tipo, materia_id, topico, notificar, antecedencia_min, dia_semana)
    VALUES
      (v_novo_id, v_bloco.hora_inicio, v_bloco.duracao_min, v_bloco.tipo, v_materia,
       v_bloco.topico, v_bloco.notificar, v_bloco.antecedencia_min, v_bloco.dia_semana);
  END LOOP;

  RETURN v_novo_id;
END;
$$;

-- A cópia de roadmap é função INTERNA (chamada pela RPC do admin e pelo trigger de novo
-- membro) — nunca chamável pela API direta. Reforço idempotente do mesmo REVOKE da
-- migration 20260811090000_roadmap_ia.sql.
REVOKE ALL ON FUNCTION public.grupo_copiar_roadmap_para_membro(UUID, UUID) FROM PUBLIC, anon, authenticated;

