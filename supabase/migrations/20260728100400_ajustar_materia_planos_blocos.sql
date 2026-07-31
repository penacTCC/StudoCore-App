-- planos_blocos foi criada com materia/cor soltos (TEXT). Ajusta pra mesma
-- decisão já aplicada em rotina_semanal_blocos: materia_id referencia
-- materias_usuario (a cor vem por join, não duplicada aqui), e adiciona
-- antecedencia_min por bloco (NULL = usa o padrão global de
-- preferencias_cronograma.antecedencia_min).
ALTER TABLE public.planos_blocos
  ADD COLUMN materia_id UUID REFERENCES public.materias_usuario(id) ON DELETE SET NULL,
  ADD COLUMN antecedencia_min INTEGER CHECK (antecedencia_min IS NULL OR antecedencia_min > 0);

ALTER TABLE public.planos_blocos
  DROP COLUMN materia,
  DROP COLUMN cor;

CREATE INDEX planos_blocos_materia_idx
  ON public.planos_blocos(materia_id)
  WHERE materia_id IS NOT NULL;
