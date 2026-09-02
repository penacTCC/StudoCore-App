-- Colunas de `profiles` que existiam só no banco remoto.
--
-- Foram criadas direto pelo dashboard, sem migration, num momento em que o histórico ainda
-- não era levado a sério. Migrations posteriores passaram a referenciá-las (a RPC
-- `estatisticas_para_duelo` lê `medalhas_desbloqueadas` e `materia_favorita`, por exemplo),
-- então a cadeia de migrations não reconstruía o banco do zero: `supabase db reset` quebrava
-- no meio e não havia como levantar um ambiente local fiel para testar.
--
-- Tudo aqui é `IF NOT EXISTS` de propósito: no remoto, onde as colunas já existem, esta
-- migration é um no-op; numa base nova ela fecha o buraco.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS celular TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS materia_favorita TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS minutos_semana INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS medalhas_desbloqueadas TEXT[] DEFAULT '{}';
