-- "Mandar força" deixou de ser um toggle (mandar/desfazer) por sessão e virou um envio
-- repetível a cada 20min por (remetente, destinatário) — ver Edge Function mandar-forca,
-- que checa o cooldown por timestamp. A constraint abaixo travava 1 força por sessão pra
-- sempre, o que impede reenviar numa sessão longa (>20min). O cooldown agora é a única regra.
ALTER TABLE public.incentivos
  DROP CONSTRAINT IF EXISTS incentivos_unicos;
