-- Preferências coletadas no carrossel de onboarding (substitui a tela onboarding-profile).
-- Todas nullable: perfis antigos continuam válidos e usuários de Google preenchem depois.
-- data_nascimento já existe em profiles desde a migration inicial.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS objetivo TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nivel_ensino TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS areas_foco TEXT[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ritmo_estudo TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dificuldade TEXT;
