-- Cronograma compartilhado de uma sessão de foco em grupo.
--
-- Até aqui, quem entrava numa sessão pública era jogado no cronômetro simples, mesmo que o
-- anfitrião estivesse em pomodoro: cada um rodava um relógio próprio, e o descanso do
-- anfitrião não acontecia para mais ninguém. "Pomodoro em grupo" era só aparência.
--
-- A correção é publicar o cronograma inteiro na linha da sessão, uma vez, no começo:
--
--   `fila`           — a sequência completa de focos e descansos (o mesmo formato de
--                      ItemFila em types/foco.ts), com matéria e tópico quando a sessão
--                      nasce de um plano;
--   `fila_inicio_em` — o instante em que o primeiro item começou.
--
-- Com esses dois campos, qualquer aparelho calcula sozinho em que item a sessão está agora
-- e quanto falta — não existe "quem manda o próximo passo". Isso é o que faz a sincronia
-- sobreviver ao anfitrião sair, ao app de alguém ser fechado ou à internet cair no meio:
-- ninguém depende de receber um evento na hora certa, todo mundo recalcula a partir da
-- mesma origem.
--
-- Consequência de produto, deliberada: pausar não move o cronograma do grupo. Quem pausa
-- para de contar o próprio tempo, mas os colegas continuam no ritmo combinado — uma pessoa
-- não empurra o descanso de todo mundo.
ALTER TABLE public.sessoes_foco
  ADD COLUMN IF NOT EXISTS modo TEXT,
  ADD COLUMN IF NOT EXISTS fila JSONB,
  ADD COLUMN IF NOT EXISTS fila_inicio_em TIMESTAMPTZ;

COMMENT ON COLUMN public.sessoes_foco.modo IS
  'cronometro | pomodoro — como esta sessão conta o tempo. NULL nas sessões anteriores à coluna, tratadas como cronometro.';
COMMENT ON COLUMN public.sessoes_foco.fila IS
  'Cronograma da sessão (focos e descansos, no formato ItemFila). Preenchido só no pomodoro.';
COMMENT ON COLUMN public.sessoes_foco.fila_inicio_em IS
  'Instante em que o primeiro item da fila começou. Junto com `fila`, define a posição atual da sessão para todos os participantes.';
