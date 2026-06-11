-- TEM QUE CRIAR no supabase
CREATE TABLE IF NOT EXISTS public.materias_usuario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome_exibicao TEXT NOT NULL,
  nome_normalizado TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(usuario_id, nome_normalizado) 
);
