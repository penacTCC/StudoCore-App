-- A ofensiva agora vive em public.gamificacoes (já com backfill aplicado). Essas colunas em
-- profiles nunca chegaram a ser usadas de fato (ofensiva sempre 0) e nenhum código mais as lê/escreve.
ALTER TABLE public.profiles DROP COLUMN IF EXISTS ofensiva;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS ultima_data_estudo;
