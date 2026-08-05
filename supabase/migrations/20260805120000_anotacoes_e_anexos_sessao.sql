-- Anotações da sessão + anexo de formulário externo (PDF de questões).
--
-- Anotações moram na própria linha de `sessoes_foco` (1:1 com a sessão, sem tabela extra).
-- Numa execução de plano com várias matérias, cada linha guarda a anotação da sua matéria.
--
-- As questões do anexo NÃO entram em `questoes_respondidas`: elas vivem em
-- `questoes_externas`/`acertos_externos` pra tela de detalhes conseguir discriminar
-- "quiz: 8/10 · formulário: 24/28", enquanto as Análises somam as duas fontes.

ALTER TABLE public.sessoes_foco
  ADD COLUMN IF NOT EXISTS anotacao_estudo TEXT,
  ADD COLUMN IF NOT EXISTS anotacao_concentracao TEXT,
  ADD COLUMN IF NOT EXISTS anotacao_pendente TEXT,
  ADD COLUMN IF NOT EXISTS anotacao_proximo_passo TEXT,
  ADD COLUMN IF NOT EXISTS anotacoes_atualizado_em TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS questoes_externas INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS acertos_externos INTEGER NOT NULL DEFAULT 0;

-- Switch "Anotar ao fim da sessão" (app/(modals)/settings.tsx). Ligado por padrão:
-- anotar com a sessão fresca na cabeça é o caminho que a gente quer incentivar.
ALTER TABLE public.preferencias_cronograma
  ADD COLUMN IF NOT EXISTS anotar_apos_quiz BOOLEAN NOT NULL DEFAULT TRUE;

-- Anexos reaproveitam a tabela do vault: o PDF anexado a uma sessão continua
-- aparecendo em "Meus Arquivos", só que agora com vínculo e com a análise da IA.
--
-- `correcao` guarda o resultado por questão no formato { "1": true, "2": false, ... },
-- porque saber QUAIS questões erraram é o que vai alimentar o banco de erros depois —
-- só o total de acertos não serviria.
ALTER TABLE public.arquivos
  ADD COLUMN IF NOT EXISTS sessao_id UUID REFERENCES public.sessoes_foco(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS questoes_detectadas INTEGER,
  ADD COLUMN IF NOT EXISTS proximo_passo_ia TEXT,
  ADD COLUMN IF NOT EXISTS resumo_ia TEXT,
  ADD COLUMN IF NOT EXISTS gabarito_ia JSONB,
  ADD COLUMN IF NOT EXISTS correcao JSONB,
  ADD COLUMN IF NOT EXISTS acertos_informados INTEGER;

CREATE INDEX IF NOT EXISTS arquivos_sessao_id_idx ON public.arquivos (sessao_id);
