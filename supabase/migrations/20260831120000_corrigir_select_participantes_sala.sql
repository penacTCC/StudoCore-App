-- Corrige a política de SELECT de `tab_sessao_membros`, que hoje bloqueia o Realtime da sala.
--
-- A política em produção (`selecionar_membros_mesma_sessao`) foi criada fora de banda — não
-- existe em nenhuma migration deste repositório — e ficou presa ao modelo antigo, de antes da
-- migration `20260806140000_salas_foco.sql` separar a SALA do registro pessoal de estudo:
--
--   * Ela filtra por `sessao_id`, a coluna que `20260806140000` já documenta como legada
--     ("ninguém lê mais" — ver comentário em `tab_sessao_membros.sessao_id`). `sala_id` é o
--     que o app grava e lê hoje (services/salas.ts), então a política nunca correspondia às
--     linhas reais que o client filtra.
--   * Ela nem libera a própria linha da pessoa (`membro_id = auth.uid()`) — só libera por
--     associação indireta a um grupo através da sessão pessoal. Uma sala sem `grupo_id`
--     (`criarSala` aceita `grupoId: string | null`) fica sem visibilidade nenhuma, nem para o
--     próprio anfitrião.
--
-- Como o Realtime do Supabase reexecuta a política de SELECT para decidir se entrega um evento
-- à assinatura, isso zera silenciosamente o Realtime de `observarParticipantesDaSala`
-- (services/salas.ts) em produção: pausar/retomar/entrar/sair não avisa ninguém, mesmo com a
-- inscrição confirmada e o slot de replicação ativo.
DROP POLICY IF EXISTS "selecionar_membros_mesma_sessao" ON public.tab_sessao_membros;

-- Substitui pela política que o modelo novo pede: a própria participação, mais qualquer sala
-- (com ou sem grupo) em que a pessoa também participa. Mantém as políticas de INSERT/UPDATE/
-- DELETE (`membro_insere_propria_sessao`, `membro_atualiza_propria_sessao`,
-- `dmembro_deleta_propria_sessao`) intocadas — só o SELECT estava quebrado.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tab_sessao_membros'
      AND policyname = 'selecionar_participantes_da_sala'
  ) THEN
    CREATE POLICY selecionar_participantes_da_sala
      ON public.tab_sessao_membros FOR SELECT
      USING (
        membro_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.tab_sessao_membros m2
          WHERE m2.sala_id = tab_sessao_membros.sala_id
            AND m2.membro_id = auth.uid()
        )
      );
  END IF;
END $$;
