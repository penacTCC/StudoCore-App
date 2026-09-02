-- Planos passam a aceitar apenas blocos únicos. O agrupador existia somente para
-- sequências de Pomodoros criadas pelo antigo formulário de novo bloco.
DROP INDEX IF EXISTS public.planos_blocos_sessao_idx;

ALTER TABLE public.planos_blocos
  DROP COLUMN IF EXISTS sessao_id;
