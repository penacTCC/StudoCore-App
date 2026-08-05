-- A análise do anexo passou a contar SÓ questões objetivas (ver
-- supabase/functions/analisar-anexo-sessao): o app não tem como corrigir discursiva, e
-- marcar certo/errado numa dissertativa seria autoavaliação, não correção.
--
-- `questoes_discursivas` guarda quantas foram ignoradas, pra tela poder dizer isso em vez
-- de simplesmente mostrar um número menor do que o aluno vê no PDF.
--
-- `numeros_objetivas` guarda os números como aparecem no documento (["1","2","5"]): numa
-- lista mista a 3ª objetiva pode ser a questão 7, e a grade de correção precisa mostrar o
-- número real, senão o aluno marca a questão errada.
ALTER TABLE public.arquivos
  ADD COLUMN IF NOT EXISTS questoes_discursivas INTEGER,
  ADD COLUMN IF NOT EXISTS numeros_objetivas JSONB;
