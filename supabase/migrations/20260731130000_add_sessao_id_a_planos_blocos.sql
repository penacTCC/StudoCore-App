-- Blocos gerados de uma vez pelo modo "Sessão de pomodoros" (novo-bloco-plano)
-- ganham uma chave de agrupamento opaca, só pra plano-editor colapsar todos
-- os blocos de uma mesma sessão num único cartão. Não referencia nada — é só
-- um rótulo compartilhado, gerado no cliente (Crypto.randomUUID(), expo-crypto
-- já é dependência do projeto) no momento da criação da sessão. NULL pra
-- blocos do modo "Bloco único" ou criados antes desta mudança.
ALTER TABLE public.planos_blocos
  ADD COLUMN sessao_id UUID;

CREATE INDEX planos_blocos_sessao_idx
  ON public.planos_blocos(sessao_id)
  WHERE sessao_id IS NOT NULL;
