-- Tira a função SECURITY DEFINER de dentro da política de SELECT de `tab_sessao_membros`.
--
-- Histórico: `20260831120000` criou a política com um EXISTS sobre a PRÓPRIA tabela e o
-- Postgres recusou com "infinite recursion detected in policy". `20260831130000` escondeu a
-- autorreferência atrás de `esta_na_sala()`, uma função SECURITY DEFINER. O erro sumiu nas
-- consultas normais do app — e um problema pior tomou o lugar dele, só visível sob carga.
--
-- O que o teste de carga da sala de foco (scripts/load/cenario-sala.mjs) encontrou: quando o
-- Realtime avalia esta política para VÁRIOS assinantes ao mesmo tempo — exatamente o que
-- acontece com N pessoas numa sala olhando `tab_sessao_membros` —, o backend do Postgres morre
-- com `signal 11: Segmentation fault` dentro da decodificação de WAL. O banco entra em
-- recovery, o PostgREST passa a responder "Could not query the database for the schema cache"
-- e NENHUM evento de participação (entrou, pausou, saiu) é entregue a ninguém.
--
-- Medido com 8 assinantes distintos e 5 updates:
--   política com esta_na_sala()  -> crash reproduzido em 4/4 execuções, 0/80 eventos entregues
--   política removida            -> 0 crashes, entrega normal
--   política reescrita (abaixo)  -> 0 crashes em 3/3 execuções, entrega normal
--
-- O gatilho é a CHAMADA DE FUNÇÃO dentro da política, não a autorreferência: trocar o corpo
-- de `esta_na_sala` por uma consulta a outra tabela mantinha o crash. Escrever o mesmo teste
-- inline, sem função, resolve.
--
-- A regra de acesso continua a mesma na prática: vê os participantes de uma sala quem é do
-- grupo dela (sala é sempre de um grupo — ver services/salas.ts), o anfitrião de uma sala solo
-- e a própria pessoa. `(select auth.uid())` no lugar de `auth.uid()` faz o Postgres avaliar o
-- uid uma vez por consulta em vez de uma vez por linha.

DROP POLICY IF EXISTS selecionar_participantes_da_sala ON public.tab_sessao_membros;

CREATE POLICY selecionar_participantes_da_sala
  ON public.tab_sessao_membros FOR SELECT
  USING (
    membro_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
        FROM public.salas_foco s
       WHERE s.id = tab_sessao_membros.sala_id
         AND (
           s.anfitriao_id = (SELECT auth.uid())
           OR EXISTS (
             SELECT 1 FROM public.membros m
              WHERE m.grupo_id = s.grupo_id AND m.user_id = (SELECT auth.uid())
           )
         )
    )
  );

-- A função fica, porque `services/` ainda pode querer perguntar isso fora de uma política —
-- mas com o aviso de que ela não pode voltar para dentro de uma.
COMMENT ON FUNCTION public.esta_na_sala(uuid) IS
  'NÃO USE DENTRO DE UMA POLÍTICA DE RLS. Chamar uma função SECURITY DEFINER de dentro de uma política faz o Postgres cair com SIGSEGV quando o Realtime avalia essa política para vários assinantes ao mesmo tempo (ver a migration 20260902140000).';
