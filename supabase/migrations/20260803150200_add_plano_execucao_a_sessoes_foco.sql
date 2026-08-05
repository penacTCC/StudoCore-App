-- Suporte a planos com mais de uma matéria: quando uma execução encadeia vários blocos
-- (matérias diferentes) de um mesmo plano numa sessão contínua, cada matéria vira sua
-- própria linha em sessoes_foco (preserva estatísticas por matéria em profileStats.ts),
-- mas todas compartilham o mesmo `execucao_id` — gerado no cliente (Crypto.randomUUID()),
-- mesmo padrão já usado por planos_blocos.sessao_id pra agrupar linhas sem uma tabela pai.
-- O feed compila as linhas de uma mesma execução num único card (ver services/sessions.ts).
ALTER TABLE public.sessoes_foco
  ADD COLUMN IF NOT EXISTS plano_id UUID REFERENCES public.planos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS execucao_id UUID;

CREATE INDEX IF NOT EXISTS sessoes_foco_plano_idx ON public.sessoes_foco(plano_id) WHERE plano_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sessoes_foco_execucao_idx ON public.sessoes_foco(execucao_id) WHERE execucao_id IS NOT NULL;
