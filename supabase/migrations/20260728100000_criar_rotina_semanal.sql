-- Rotina semanal: a camada base do cronograma. Cada linha é um bloco recorrente
-- em um dia da semana. dia_semana segue a mesma convenção do tipo BlocoSemana
-- no app (0 = segunda ... 6 = domingo), não a convenção do EXTRACT(DOW) do Postgres.
--
-- materia_id referencia materias_usuario em vez de guardar nome/cor soltos: a cor
-- vem por join (coluna cor adicionada em materias_usuario), evitando duplicar dado
-- que fica fora de sincronia se a matéria for renomeada ou recolorida depois.
-- Nullable porque blocos tipo 'descanso'/'outro' não têm matéria.
--
-- antecedencia_min é o lembrete deste bloco específico; NULL usa o padrão global
-- de preferencias_cronograma.antecedencia_min.
CREATE TABLE public.rotina_semanal_blocos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio TIME NOT NULL,
  duracao_min INTEGER NOT NULL CHECK (duracao_min > 0),
  tipo TEXT NOT NULL CHECK (tipo IN ('estudo', 'descanso', 'outro')),
  materia_id UUID REFERENCES public.materias_usuario(id) ON DELETE SET NULL,
  topico TEXT,
  notificar BOOLEAN NOT NULL DEFAULT true,
  antecedencia_min INTEGER CHECK (antecedencia_min IS NULL OR antecedencia_min > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX rotina_semanal_blocos_usuario_dia_idx
  ON public.rotina_semanal_blocos(usuario_id, dia_semana);

CREATE INDEX rotina_semanal_blocos_materia_idx
  ON public.rotina_semanal_blocos(materia_id)
  WHERE materia_id IS NOT NULL;

ALTER TABLE public.rotina_semanal_blocos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem só a própria rotina"
  ON public.rotina_semanal_blocos FOR SELECT
  USING (auth.uid() = usuario_id);

CREATE POLICY "Usuários criam blocos na própria rotina"
  ON public.rotina_semanal_blocos FOR INSERT
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Usuários atualizam blocos da própria rotina"
  ON public.rotina_semanal_blocos FOR UPDATE
  USING (auth.uid() = usuario_id);

CREATE POLICY "Usuários apagam blocos da própria rotina"
  ON public.rotina_semanal_blocos FOR DELETE
  USING (auth.uid() = usuario_id);
