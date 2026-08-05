-- "Mandar força": torcida por pessoa numa sessão de foco pública (ver services/incentivos.ts).
-- Esta tabela já existia no banco remoto (criada fora de banda, commit a56a822) — CREATE TABLE
-- IF NOT EXISTS só passa a documentar o schema no repo, sem sobrescrever nada.
CREATE TABLE IF NOT EXISTS public.incentivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id UUID REFERENCES public.sessoes_foco(id) ON DELETE CASCADE NOT NULL,
  remetente_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  destinatario_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT incentivos_unicos UNIQUE (sessao_id, remetente_id, destinatario_id)
);

ALTER TABLE public.incentivos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'incentivos' AND policyname = 'Incentivos visíveis para usuários logados'
  ) THEN
    CREATE POLICY "Incentivos visíveis para usuários logados"
      ON public.incentivos FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'incentivos' AND policyname = 'Usuários podem mandar força'
  ) THEN
    CREATE POLICY "Usuários podem mandar força"
      ON public.incentivos FOR INSERT
      WITH CHECK (auth.uid() = remetente_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'incentivos' AND policyname = 'Usuários podem desfazer sua própria força'
  ) THEN
    CREATE POLICY "Usuários podem desfazer sua própria força"
      ON public.incentivos FOR DELETE
      USING (auth.uid() = remetente_id);
  END IF;
END $$;

-- Necessário para services/incentivos.ts -> observarIncentivosDaSessao (postgres_changes).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'incentivos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.incentivos;
  END IF;
END $$;
