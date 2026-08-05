-- Membros de uma sessão de foco em grupo: cada linha é a participação de uma pessoa numa
-- sessão (host ou membro), com o cronômetro individual dela (ver services/sessions.ts).
-- Esta tabela já existia no banco remoto (criada fora de banda) — CREATE TABLE IF NOT EXISTS
-- só passa a documentar o schema no repo, sem sobrescrever nada.
CREATE TABLE IF NOT EXISTS public.tab_sessao_membros (
  sessao_id UUID REFERENCES public.sessoes_foco(id) ON DELETE CASCADE NOT NULL,
  membro_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  funcao TEXT NOT NULL DEFAULT 'membro' CHECK (funcao IN ('anfitriao', 'membro')),
  ultimo_inicio TIMESTAMP WITH TIME ZONE,
  tempo_segundos INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'pausado', 'concluido')),
  PRIMARY KEY (sessao_id, membro_id)
);

ALTER TABLE public.tab_sessao_membros ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tab_sessao_membros' AND policyname = 'Membros de sessão visíveis para usuários logados'
  ) THEN
    CREATE POLICY "Membros de sessão visíveis para usuários logados"
      ON public.tab_sessao_membros FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tab_sessao_membros' AND policyname = 'Usuários podem entrar em uma sessão'
  ) THEN
    CREATE POLICY "Usuários podem entrar em uma sessão"
      ON public.tab_sessao_membros FOR INSERT
      WITH CHECK (auth.uid() = membro_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tab_sessao_membros' AND policyname = 'Usuários podem atualizar sua própria participação'
  ) THEN
    CREATE POLICY "Usuários podem atualizar sua própria participação"
      ON public.tab_sessao_membros FOR UPDATE
      USING (auth.uid() = membro_id);
  END IF;
END $$;

-- Necessário para services/sessions.ts -> observarMembrosDaSessao (postgres_changes).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'tab_sessao_membros'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tab_sessao_membros;
  END IF;
END $$;
