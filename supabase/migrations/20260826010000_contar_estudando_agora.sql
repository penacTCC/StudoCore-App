-- Contagem agregada de "quem está estudando agora", para o card de `browse-groups.tsx`.
--
-- Antes esse número vinha de uma sala de Presence GLOBAL (`room:studo_core_global`, ver
-- services/onlineUsers.ts): todo usuário do app entrava nela, e o Presence reenvia o
-- estado completo a cada entrada/saída/heartbeat para TODOS os clientes conectados —
-- O(N²) de tráfego de coordenação, sendo N o total de usuários do app inteiro. Era o
-- maior contribuinte para o app degradar perto de 200 usuários simultâneos.
--
-- A UI só usa `.length` dessa lista (não a lista em si) para esse card. Uma contagem
-- agregada, cacheada por alguns segundos no cliente (ver hooks/useDadosCache.ts), resolve
-- o mesmo problema com uma única query indexada — custo que não cresce com o número de
-- usuários conectados ao Realtime.
--
-- Mesma régua de "sessão viva" já usada em services/sessions.ts (`buscarSessoesAoVivo`,
-- `fecharSessoesAbandonadas`): status em andamento, não encerrada, e com sinal de vida
-- recente — sem essa janela, uma sessão que ficou "ativo" para sempre por app morto
-- inflaria a contagem indefinidamente.
-- Sem isto a contagem varre a tabela inteira (todo estudo já registrado, não só o que
-- está em andamento agora) — cresce mal conforme o histórico de sessões aumenta.
CREATE INDEX IF NOT EXISTS sessoes_foco_em_andamento_idx
  ON public.sessoes_foco (COALESCE(ultimo_inicio, created_at))
  WHERE concluido_em IS NULL AND status IN ('ativo', 'pausado');

CREATE OR REPLACE FUNCTION public.contar_estudando_agora()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT count(DISTINCT user_id)::INTEGER
  FROM public.sessoes_foco
  WHERE status IN ('ativo', 'pausado')
    AND concluido_em IS NULL
    AND COALESCE(ultimo_inicio, created_at) > now() - INTERVAL '20 minutes';
$$;

GRANT EXECUTE ON FUNCTION public.contar_estudando_agora() TO authenticated;
