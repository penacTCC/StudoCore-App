-- Fuso do aparelho junto do token de push.
--
-- As Edge Functions rodam em UTC, mas a janela de "não perturbar" das preferências é
-- horário LOCAL ("22:00"–"07:00"). Sem saber o fuso de quem recebe, o servidor não tem como
-- decidir se são 3h da manhã pra essa pessoa — e uma força chegando de madrugada acorda
-- alguém de verdade, agora que o push funciona com o app fechado.
--
-- Guardar aqui, e não em `profiles`, porque fuso é do APARELHO (a pessoa viaja, o aparelho
-- muda de fuso) e é este o registro que já é reescrito a cada abertura do app.
--
-- Mesma convenção do `Date.prototype.getTimezoneOffset()` do JS, que é quem preenche a
-- coluna: minutos que faltam pro UTC, ou seja, POSITIVO a oeste de Greenwich.
-- Brasília (UTC-3) = 180. Default 180 porque é onde está todo mundo que usa o app hoje;
-- assumir 0 (UTC) jogaria a janela de silêncio 3h pra frente pra quem ainda não reabriu o
-- app depois desta migration.
ALTER TABLE public.push_tokens
  ADD COLUMN IF NOT EXISTS fuso_offset_min INTEGER NOT NULL DEFAULT 180;
