-- 1. PERFIS DE USUÁRIOS (Linkado com o Supabase Auth)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nome_real TEXT NOT NULL,
  nome_usuario TEXT UNIQUE NOT NULL,
  foto_usuario TEXT, -- Link da foto
  data_nascimento DATE,
  horas_totais INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL, -- Quando foi criado o registro
  questoes_feitas INTEGER DEFAULT 0
);

-- 2. GRUPOS DE ESTUDO
CREATE TABLE public.grupos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_grupo TEXT NOT NULL,
  descricao TEXT,
  foto_grupo TEXT,
  codigo_convite TEXT UNIQUE,
  meta_horas INTEGER,
  publico BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. MEMBROS DOS GRUPOS (Sua tabela pivô - perfeita)
CREATE TABLE public.membros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  grupo_id UUID REFERENCES public.grupos(id) ON DELETE CASCADE NOT NULL,
  administrador BOOLEAN DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL, -- Quando o usuário entrou no grupo
  UNIQUE(user_id, grupo_id) -- Impede que o usuário entre duas vezes no mesmo grupo
);

-- 4. ARQUIVOS (O Cofre / The Vault)
CREATE TABLE public.arquivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  grupo_id UUID REFERENCES public.grupos(id) ON DELETE CASCADE, -- Opcional: Se apagar o grupo, apaga o arquivo
  titulo TEXT NOT NULL,
  disciplina TEXT NOT NULL,
  storage_path TEXT NOT NULL, -- No Supabase, os arquivos ficam armazenados em seu "próprio" banco de dados. Portanto, nessa tabela, só terá o link apontando para o arquivo.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. SESSÕES DE FOCO: Ao invés de TimeLine, toda vez que uma sessão for terminada, as informações dela viram para cá.
CREATE TABLE public.sessoes_foco (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  disciplina TEXT NOT NULL,
  tempo_minutos INTEGER NOT NULL,
  questoes_respondidas INTEGER DEFAULT 0, -- Quantas a IA gerou (ex: 10)
  questoes_acertadas INTEGER DEFAULT 0,   -- Quantas o usuário acertou (ex: 7)
  data_sessao DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. BANCO DE ERROS: As questões que o usuário errou vêm para cá, para que fiquem salvas no banco de revisão do usuário.
CREATE TABLE public.banco_erros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  sessao_id UUID REFERENCES public.sessoes_foco(id) ON DELETE CASCADE NOT NULL,
  tema TEXT NOT NULL,
  texto_questao TEXT NOT NULL,
  alt_certa TEXT NOT NULL,
  alt_user TEXT NOT NULL, -- Qual alternativa o usuário escolheu
  resolvido BOOLEAN DEFAULT false, -- Usuário pode re-fazer o erro depois
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);