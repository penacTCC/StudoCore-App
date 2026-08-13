-- Correção da Fase 3: `REVOKE ... FROM anon` não removia o acesso real dessas 19
-- funções porque o grant vinha do papel PUBLIC (proacl mostrava "=X/postgres", sem
-- entrada direta pra anon), não de um grant explícito a anon. `authenticated` tem seu
-- próprio grant explícito e independente em todas elas (confirmado via proacl), então
-- revogar de PUBLIC não afeta o app logado.

REVOKE EXECUTE ON FUNCTION public.comunidade_autor_visivel(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.comunidade_bloqueio_entre(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.comunidade_dono_da_publicacao(comunidade_origem, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.comunidade_importar_plano(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.comunidade_publicacao_visivel(comunidade_origem, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.comunidade_usuario_no_feed(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.definir_codigo_convite(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.definir_participacao_no_grupo(uuid, boolean, integer, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.definir_permissao_convite(uuid, uuid, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.encerrar_participacoes_da_sessao(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.encerrar_sala(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.estatisticas_para_duelo(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gerar_alertas_diarios() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gerar_alertas_professor(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gerar_alertas_roadmap(uuid, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pode_convidar_no_grupo(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sair_da_sala(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.transferir_anfitriao_sala(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.transferir_anfitriao_sessao(uuid) FROM PUBLIC;

-- perfil_nome_publico teve o caminho inverso: o projeto tem uma regra de
-- ALTER DEFAULT PRIVILEGES que concede EXECUTE explicitamente a anon/authenticated/
-- service_role em toda função nova — por isso ela nasceu com um grant direto a anon,
-- que o REVOKE ... FROM PUBLIC da rodada anterior não tocava.
REVOKE EXECUTE ON FUNCTION public.perfil_nome_publico(uuid) FROM anon;
