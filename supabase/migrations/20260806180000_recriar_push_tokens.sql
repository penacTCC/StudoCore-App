-- Recria a tabela de tokens de push do Expo.
--
-- Ela existiu em 20260803150000 e foi derrubada em 20260803200000 porque o push remoto no
-- Android exige credencial do FCM, que o projeto não tinha. Agora tem (chave FCM V1 subida
-- no EAS), então o "mandar força" volta a notificar de verdade, com o app fechado.
--
-- Fica numa tabela própria, e não em `profiles`, porque `profiles` não tem policy de RLS
-- restritiva (é lido livremente via joins em todo o app, ex: feed de sessões) — um token de
-- push ali seria legível por qualquer usuário autenticado, o que permitiria mandar push
-- direto pra qualquer pessoa pela API do Expo, ignorando o cooldown da Edge Function.
-- Aqui só o dono lê/escreve; a Edge Function usa a service role key (bypassa RLS) pra ler o
-- token de quem vai receber a força.
--
-- Um token por usuário (PK em user_id): reinstalar o app ou trocar de aparelho sobrescreve
-- o anterior. Não há suporte a estar logado em dois aparelhos ao mesmo tempo — o push vai
-- pro último que abriu o app.
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

  -- Necessária pro logout: sem ela o token do aparelho continuaria apontando pra conta que
  -- saiu, e uma força mandada pra ela cairia na notificação de quem logar depois no mesmo
  -- aparelho (ver services/pushTokens.ts -> removerTokenPush).
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'push_tokens' AND policyname = 'Usuários apagam o próprio token'
  ) THEN
    CREATE POLICY "Usuários apagam o próprio token"
      ON public.push_tokens FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;
