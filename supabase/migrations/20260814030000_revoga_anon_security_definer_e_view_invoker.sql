-- Fase 3 da remediação de segurança pré-MVP.
-- 20 funções SECURITY DEFINER tinham EXECUTE liberado pra `anon`. Busquei todo uso de
-- `.rpc(...)` no app cliente: a única chamada antes do login é `nome_usuario_disponivel`
-- (tela de cadastro); todas as outras só rodam depois de autenticado. Revoga de anon,
-- exceto essa. Também fecha o grant implícito que `perfil_nome_publico` (criada na Fase 2)
-- ganhou do Postgres (CREATE FUNCTION concede EXECUTE a PUBLIC por padrão).

REVOKE EXECUTE ON FUNCTION public.comunidade_autor_visivel(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.comunidade_bloqueio_entre(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.comunidade_dono_da_publicacao(comunidade_origem, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.comunidade_importar_plano(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.comunidade_publicacao_visivel(comunidade_origem, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.comunidade_usuario_no_feed(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.definir_codigo_convite(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.definir_participacao_no_grupo(uuid, boolean, integer, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.definir_permissao_convite(uuid, uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.encerrar_participacoes_da_sessao(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.encerrar_sala(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.estatisticas_para_duelo(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.gerar_alertas_diarios() FROM anon;
REVOKE EXECUTE ON FUNCTION public.gerar_alertas_professor(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.gerar_alertas_roadmap(uuid, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.pode_convidar_no_grupo(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.registrar_ofensiva_grupo(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sair_da_sala(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.transferir_anfitriao_sala(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.transferir_anfitriao_sessao(uuid) FROM anon;

REVOKE EXECUTE ON FUNCTION public.perfil_nome_publico(uuid) FROM PUBLIC;

-- Item 4: única view SECURITY DEFINER do projeto (ERROR no linter). Sem lógica que
-- dependa disso — recriar com security_invoker faz ela herdar a RLS de sessoes_foco
-- (Fase 1) através de quem já a consome (ranking_horas_membros_grupo).
ALTER VIEW public.horas_membros_grupo_por_dia SET (security_invoker = true);
