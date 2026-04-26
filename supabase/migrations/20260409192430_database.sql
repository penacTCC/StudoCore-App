-- 1. PERFIS DE USUÁRIOS (Linkado com o Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nome_real TEXT NOT NULL,
  nome_usuario TEXT UNIQUE NOT NULL,
  foto_usuario TEXT, -- Link da foto
  data_nascimento DATE,
  horas_totais INTEGER DEFAULT 0,
  total_hours INTEGER DEFAULT 0,
  questoes_feitas INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  last_study_date text,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL, -- Quando foi criado o registro
  questoes_feitas INTEGER DEFAULT 0
);

-- 1.1 Cria a tabela study_sessions para guardar o histórico do cronômetro
CREATE TABLE IF NOT EXISTS study_sessions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    subject text NOT NULL,
    duration INTEGER NOT NULL, -- será guardado em segundos
    questions_solved INTEGER DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

-- 2. GRUPOS DE ESTUDO
CREATE TABLE IF NOT EXISTS public.grupos (
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
CREATE TABLE IF NOT EXISTS public.membros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  grupo_id UUID REFERENCES public.grupos(id) ON DELETE CASCADE NOT NULL,
  administrador BOOLEAN DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL, -- Quando o usuário entrou no grupo
  UNIQUE(user_id, grupo_id) -- Impede que o usuário entre duas vezes no mesmo grupo
);

-- 4. ARQUIVOS (O Cofre / The Vault)
CREATE TABLE IF NOT EXISTS public.arquivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  disciplina TEXT NOT NULL,
  storage_path TEXT NOT NULL, -- No Supabase, os arquivos ficam armazenados em seu "próprio" banco de dados. Portanto, nessa tabela, só terá o link apontando para o arquivo.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4.1 ARQUIVOS_GRUPOS
create table IF NOT EXISTS public.arquivos_grupos (
  id uuid not null default gen_random_uuid (),
  arquivo_id uuid not null,
  grupo_id uuid not null,
  created_at timestamp with time zone not null default timezone ('utc' :: text, now()),
  constraint arquivos_grupos_pkey primary key (id),
  constraint arquivos_grupos_unique unique (arquivo_id, grupo_id),
  constraint arquivos_grupos_arquivo_id_fkey foreign KEY (arquivo_id) references arquivos (id) on delete CASCADE,
  constraint arquivos_grupos_grupo_id_fkey foreign KEY (grupo_id) references grupos (id) on delete CASCADE
) TABLESPACE pg_default;

-- 5. SESSÕES DE FOCO: Ao invés de TimeLine, toda vez que uma sessão for terminada, as informações dela viram para cá.
CREATE TABLE IF NOT EXISTS public.sessoes_foco (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  disciplina TEXT NOT NULL,
  tempo_minutos INTEGER NOT NULL,
  questoes_respondidas INTEGER DEFAULT 0, -- Quantas a IA gerou (ex: 10)
  questoes_acertadas INTEGER DEFAULT 0,   -- Quantas o usuário acertou (ex: 7)
  data_sessao DATE DEFAULT CURRENT_DATE,
  conteudo_especifico TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'salvo',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. BANCO DE ERROS: As questões que o usuário errou vêm para cá, para que fiquem salvas no banco de revisão do usuário.
CREATE TABLE IF NOT EXISTS public.banco_erros (
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