-- Realtime para o feed de sessões do grupo.
--
-- `tab_sessao_membros` já publica (ver 20260803140100), mas `sessoes_foco` não: o feed
-- "ao vivo" da home só se atualizava quando a tela voltava ao foco, então uma sessão
-- pública começada por um colega só aparecia para os outros depois que eles saíam e
-- voltavam da tela. Com a tabela na publicação, services/sessions.ts ->
-- observarSessoesDoGrupo recebe INSERT/UPDATE e o feed entra/sai sozinho.
--
-- REPLICA IDENTITY FULL é necessária para que o payload de UPDATE/DELETE traga as colunas
-- antigas: o filtro do canal é `grupo_id=eq.<id>`, e sem os valores antigos o Realtime não
-- consegue avaliar o filtro para linhas que saem do recorte.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'sessoes_foco'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sessoes_foco;
  END IF;
END $$;

ALTER TABLE public.sessoes_foco REPLICA IDENTITY FULL;
