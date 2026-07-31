-- Cor por matéria: hoje só existe como tipo (MateriaComCor) sem persistência.
-- Adiciona a coluna com um cinza neutro (HADES.textFaint) como default provisório;
-- a paleta de cores das matérias padrão do app fica pra depois.
ALTER TABLE public.materias_usuario ADD COLUMN IF NOT EXISTS cor TEXT NOT NULL DEFAULT '#6b6e76';
