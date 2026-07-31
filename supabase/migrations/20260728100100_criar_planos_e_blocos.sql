-- Planos: overrides da rotina semanal. agenda_tipo define a especificidade do
-- override (ver docs/project-context.md, seção de cronograma):
--   'data'    -> vence tudo, é a exceção mais explícita (um dia específico).
--   'fixado'  -> vence a rotina semanal nos dias marcados em agenda_dias.
--   'nenhuma' -> plano solto, só entra em vigor quando aplicado manualmente
--                (o "aplicar a hoje" grava isso como um agenda_tipo = 'data' pontual).
-- agenda_dias usa a mesma convenção de dia_semana de rotina_semanal_blocos
-- (0 = segunda ... 6 = domingo).
CREATE TABLE public.planos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  cor TEXT NOT NULL,
  agenda_tipo TEXT NOT NULL DEFAULT 'nenhuma' CHECK (agenda_tipo IN ('fixado', 'data', 'nenhuma')),
  agenda_dias SMALLINT[],
  agenda_data DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT planos_agenda_consistente CHECK (
    (agenda_tipo = 'fixado' AND agenda_dias IS NOT NULL AND agenda_data IS NULL)
    OR (agenda_tipo = 'data' AND agenda_data IS NOT NULL AND agenda_dias IS NULL)
    OR (agenda_tipo = 'nenhuma' AND agenda_dias IS NULL AND agenda_data IS NULL)
  )
);

-- Só um plano pode reivindicar uma data específica por usuário.
CREATE UNIQUE INDEX planos_agenda_data_unica
  ON public.planos(usuario_id, agenda_data)
  WHERE agenda_tipo = 'data';

-- Dois planos 'fixado' não podem compartilhar dia da semana (checado via trigger
-- porque é overlap de array, não dá pra expressar num índice único simples).
CREATE OR REPLACE FUNCTION public.checar_conflito_agenda_fixada()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.planos p
    WHERE p.usuario_id = NEW.usuario_id
      AND p.id <> NEW.id
      AND p.agenda_tipo = 'fixado'
      AND p.agenda_dias && NEW.agenda_dias
  ) THEN
    RAISE EXCEPTION 'Já existe um plano fixado em um dos dias selecionados.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_checar_conflito_agenda_fixada
  BEFORE INSERT OR UPDATE ON public.planos
  FOR EACH ROW
  WHEN (NEW.agenda_tipo = 'fixado')
  EXECUTE FUNCTION public.checar_conflito_agenda_fixada();

ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem só os próprios planos"
  ON public.planos FOR SELECT
  USING (auth.uid() = usuario_id);

CREATE POLICY "Usuários criam os próprios planos"
  ON public.planos FOR INSERT
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Usuários atualizam os próprios planos"
  ON public.planos FOR UPDATE
  USING (auth.uid() = usuario_id);

CREATE POLICY "Usuários apagam os próprios planos"
  ON public.planos FOR DELETE
  USING (auth.uid() = usuario_id);

-- Blocos de um plano (equivalente aos blocos da rotina, mas presos a um plano).
CREATE TABLE public.planos_blocos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id UUID REFERENCES public.planos(id) ON DELETE CASCADE NOT NULL,
  hora_inicio TIME NOT NULL,
  duracao_min INTEGER NOT NULL CHECK (duracao_min > 0),
  tipo TEXT NOT NULL CHECK (tipo IN ('estudo', 'descanso', 'outro')),
  materia TEXT,
  topico TEXT,
  cor TEXT,
  notificar BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX planos_blocos_plano_idx ON public.planos_blocos(plano_id);

ALTER TABLE public.planos_blocos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem blocos dos próprios planos"
  ON public.planos_blocos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.planos p WHERE p.id = plano_id AND p.usuario_id = auth.uid()
  ));

CREATE POLICY "Usuários criam blocos nos próprios planos"
  ON public.planos_blocos FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.planos p WHERE p.id = plano_id AND p.usuario_id = auth.uid()
  ));

CREATE POLICY "Usuários atualizam blocos dos próprios planos"
  ON public.planos_blocos FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.planos p WHERE p.id = plano_id AND p.usuario_id = auth.uid()
  ));

CREATE POLICY "Usuários apagam blocos dos próprios planos"
  ON public.planos_blocos FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.planos p WHERE p.id = plano_id AND p.usuario_id = auth.uid()
  ));
