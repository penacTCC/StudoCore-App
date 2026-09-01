-- Corrige a recursão infinita introduzida pela migration anterior
-- (`20260831120000_corrigir_select_participantes_sala.sql`).
--
-- A política `selecionar_participantes_da_sala` faz um EXISTS que consulta a PRÓPRIA
-- `tab_sessao_membros` de dentro da política de SELECT dela mesma. O Postgres reavalia a
-- política pra autorizar esse SELECT interno, que dispara a política de novo, e por aí vai —
-- ele detecta e recusa com "infinite recursion detected in policy for relation
-- tab_sessao_membros" em vez de travar, mas o resultado prático é o mesmo: nenhum SELECT
-- (nem o do Realtime) funciona.
--
-- O jeito de quebrar a recursão é o mesmo padrão que `sair_da_sala` e
-- `transferir_anfitriao_sala` (services/salas.ts / `20260806140000_salas_foco.sql`) já usam
-- pra mexer na participação de outros: uma função SECURITY DEFINER. Ela roda com os
-- privilégios de quem a criou, não do usuário conectado, então a consulta interna não é
-- reavaliada pela RLS da própria tabela.
CREATE OR REPLACE FUNCTION public.esta_na_sala(p_sala_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tab_sessao_membros
    WHERE sala_id = p_sala_id AND membro_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.esta_na_sala(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.esta_na_sala(uuid) TO authenticated;

DROP POLICY IF EXISTS selecionar_participantes_da_sala ON public.tab_sessao_membros;

CREATE POLICY selecionar_participantes_da_sala
  ON public.tab_sessao_membros FOR SELECT
  USING (membro_id = auth.uid() OR public.esta_na_sala(sala_id));
