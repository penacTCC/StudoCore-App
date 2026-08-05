-- Token de push (Expo) de cada usuário, usado pela Edge Function "mandar-forca" pra
-- notificar de verdade (mesmo com o app fechado). Um token por usuário — o mais recente
-- sobrescreve o anterior a cada login/abertura do app (sem suporte a múltiplos aparelhos).
--
-- Fica numa tabela própria, e não em `profiles`, porque `profiles` não tem nenhuma policy
-- de RLS restritiva (é lido livremente via joins em todo o app, ex: feed de sessões) — um
-- token de push ali seria legível por qualquer usuário autenticado, o que permitiria
-- qualquer um mandar push direto pra qualquer pessoa via API do Expo, ignorando o cooldown
-- do app. Aqui só o dono pode ler/escrever; a Edge Function usa a service role key
-- (bypassa RLS) pra ler o token de quem vai receber a força.
CREATE TABLE IF NOT EXISTS public.push_tokens (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'push_tokens' AND policyname = 'Usuários veem só o próprio token'
  ) THEN
    CREATE POLICY "Usuários veem só o próprio token"
      ON public.push_tokens FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'push_tokens' AND policyname = 'Usuários registram o próprio token'
  ) THEN
    CREATE POLICY "Usuários registram o próprio token"
      ON public.push_tokens FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'push_tokens' AND policyname = 'Usuários atualizam o próprio token'
  ) THEN
    CREATE POLICY "Usuários atualizam o próprio token"
      ON public.push_tokens FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;
