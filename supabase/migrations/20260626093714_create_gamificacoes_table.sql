-- Tabela dedicada a estado de gamificação (separada de profiles para não acoplar
-- identidade do usuário com mecânicas de jogo que vão crescer: ofensiva, elo, missões etc.)
CREATE TABLE public.gamificacoes (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  ofensiva INTEGER NOT NULL DEFAULT 0,
  melhor_ofensiva INTEGER NOT NULL DEFAULT 0,
  ultima_data_estudo DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Backfill a partir do que já existia em profiles (ofensiva sempre 0 até aqui, mas preserva o
-- histórico de ultima_data_estudo).
--
-- Roda condicionalmente: `profiles.ofensiva`/`ultima_data_estudo` foram colunas adicionadas
-- direto no banco remoto, sem migration, e por isso não existem numa base criada do zero
-- (`supabase db reset`). Sem o guard, o reset local quebra aqui — e o backfill é um no-op
-- numa base nova, onde `profiles` está vazia.
DO $backfill$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'ofensiva'
  ) THEN
    EXECUTE $sql$
      INSERT INTO public.gamificacoes (user_id, ofensiva, melhor_ofensiva, ultima_data_estudo)
      SELECT id, COALESCE(ofensiva, 0), COALESCE(ofensiva, 0), ultima_data_estudo::date
      FROM public.profiles
    $sql$;
  END IF;
END
$backfill$;

ALTER TABLE public.gamificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gamificação visível para usuários logados"
  ON public.gamificacoes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários podem criar sua própria gamificação"
  ON public.gamificacoes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar sua própria gamificação"
  ON public.gamificacoes FOR UPDATE
  USING (auth.uid() = user_id);
