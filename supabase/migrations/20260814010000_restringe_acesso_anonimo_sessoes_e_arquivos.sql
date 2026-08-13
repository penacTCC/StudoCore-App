-- Fase 1 da remediação de segurança pré-MVP.
-- Causa raiz comum: as policies de SELECT de `sessoes_foco` e `arquivos` tinham
-- roles={public}, então o papel `anon` (sem login, só com a anon key) já satisfazia
-- a policy quando is_public/publico era true. Restringe a `authenticated` e, de quebra,
-- fecha o gap de consentimento: `sessoes_foco.is_public` passa a respeitar os mesmos
-- helpers (`comunidade_usuario_no_feed`, `comunidade_bloqueio_entre`) que a RPC do feed
-- já usava — antes, quem consultava a tabela direto passava por fora do opt-in.

DROP POLICY "Usuários podem ver suas próprias sessões" ON public.sessoes_foco;
CREATE POLICY "Usuários podem ver suas próprias sessões" ON public.sessoes_foco
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR (
      is_public = true
      AND public.comunidade_usuario_no_feed(user_id)
      AND NOT public.comunidade_bloqueio_entre(user_id, auth.uid())
      AND COALESCE((SELECT perfil_publico FROM public.profiles WHERE id = user_id), true)
    )
  );

DROP POLICY "Visualizar arquivos permitidos" ON public.arquivos;
CREATE POLICY "Visualizar arquivos permitidos" ON public.arquivos
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM arquivos_grupos ag JOIN membros m ON m.grupo_id = ag.grupo_id
      WHERE ag.arquivo_id = arquivos.id AND m.user_id = auth.uid()
    )
    OR (publico AND public.comunidade_autor_visivel(user_id))
  );

-- tab_sessao_membros já tem RLS restrita a membros do mesmo grupo; faltava só entrar na
-- publicação para o app parar de depender do polling de 10s como fallback.
ALTER PUBLICATION supabase_realtime ADD TABLE public.tab_sessao_membros;
