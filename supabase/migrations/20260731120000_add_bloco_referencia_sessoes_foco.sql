  -- Liga uma sessão de foco ao bloco de cronograma que a originou (rotina semanal
  -- ou bloco de plano), quando ela começa a partir da aba "Hoje" (via "Iniciar
  -- foco"). Isso permite calcular o status real de cada bloco do dia (cumprido/
  -- parcial/furado) comparando a duração planejada com o tempo realmente
  -- registrado naquele bloco específico, em vez de só casar por dia + matéria.
  -- Nullable e sem preenchimento retroativo: sessões antigas ou iniciadas fora
  -- do cronograma simplesmente não linkam a nenhum bloco.
  ALTER TABLE public.sessoes_foco
    ADD COLUMN bloco_rotina_id UUID REFERENCES public.rotina_semanal_blocos(id) ON DELETE SET NULL,
    ADD COLUMN bloco_plano_id UUID REFERENCES public.planos_blocos(id) ON DELETE SET NULL;

  CREATE INDEX sessoes_foco_bloco_rotina_idx ON public.sessoes_foco(bloco_rotina_id) WHERE bloco_rotina_id IS NOT NULL;
  CREATE INDEX sessoes_foco_bloco_plano_idx ON public.sessoes_foco(bloco_plano_id) WHERE bloco_plano_id IS NOT NULL;
