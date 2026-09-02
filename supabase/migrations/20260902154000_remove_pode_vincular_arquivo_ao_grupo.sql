-- `pode_vincular_arquivo_ao_grupo` ficou órfã na migration anterior.
--
-- A única coisa que a chamava era a policy legada "Usuarios inserem grupos em seus
-- arquivos", removida junto com as outras porque seu predicado é idêntico ao de
-- `usuario_dono_arquivo AND usuario_membro_grupo`. Uma função SECURITY DEFINER sem uso
-- não é inerte: ela continua exposta em /rest/v1/rpc para o papel `authenticated`, então
-- fica como superfície de ataque sem nada em troca.
drop function if exists public.pode_vincular_arquivo_ao_grupo(uuid, uuid);
