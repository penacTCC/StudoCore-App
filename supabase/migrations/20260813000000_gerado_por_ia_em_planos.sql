-- Adiciona o marcador de "gerado por IA" à tabela de planos,
-- usado pela aba Roadmaps do Vault para distinguir um plano de roadmap
-- (pessoal ou de grupo) de um plano criado manualmente no Cronograma.
--
-- Planos de roadmap de grupo já tinham `origem_grupo_id`/`origem_roadmap_plano_id`,
-- mas o roadmap pessoal não tinha marcador nenhum — era indistinguível de um plano
-- comum. Esta coluna resolve os dois casos com uma flag única.

ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS gerado_por_ia BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.planos.gerado_por_ia IS
  'true quando o plano nasceu de uma proposta de IA (roadmap pessoal ou de grupo) — usado
   pela aba Roadmaps do Vault para filtrar sem depender só de origem_grupo_id/
   origem_roadmap_plano_id, que só existem no caso de grupo.';

-- ─────────────────────────────────────────────────────────────────────────────
-- A aba Roadmaps do Vault virou uma visão de progresso de TODOS os planos do
-- usuário, não só os de IA/grupo — e o card precisa dizer de onde o plano veio:
-- importado de alguém da Comunidade, roadmap de grupo, ou criado pela própria pessoa.
-- `comunidade_importar_plano` já copia (não referencia) o plano; faltava guardar
-- quem era o autor original.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS importado_de_usuario_id UUID
    CONSTRAINT planos_importado_de_usuario_id_fkey REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.planos.importado_de_usuario_id IS
  'Preenchido só na cópia que comunidade_importar_plano cria — quem publicou o plano original. ON DELETE SET NULL: se o autor original apagar a conta, a cópia continua existindo, só perde o badge de importado.';

/*
  Mesma função de 20260812000000, só que gravando importado_de_usuario_id = autor
  original. O resto não muda: copiar, não referenciar; agenda nasce 'nenhuma'; matéria
  reconciliada por nome normalizado no acervo de quem importa.
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

  INSERT INTO public.planos (usuario_id, nome, cor, agenda_tipo, importado_de_usuario_id)
  VALUES (v_eu, v_origem.nome, v_origem.cor, 'nenhuma', v_origem.usuario_id)
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
