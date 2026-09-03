/*
  A policy de SELECT em `public.profiles` era `USING (true)`: qualquer autenticado lia a
  linha inteira de qualquer perfil via REST direto — celular, data_nascimento e as
  estatísticas (horas_totais, medalhas_desbloqueadas, minutos_semana, materia_favorita),
  sem passar pelas RPCs (`perfil_membro_para_visualizacao`, `estatisticas_para_duelo`) que
  já respeitam `perfil_publico`. O toggle "Perfil público" nunca foi privacidade de
  verdade: era só um filtro aplicado nas telas que usam essas RPCs, não uma proteção no
  banco.

  Esta migration fecha a tabela: só o dono lê a própria linha. Quem precisa da identidade
  de OUTRO usuário (nome, nome de usuário, foto — que sempre foram public por design, ver
  `perfil_membro_para_visualizacao`) passa a usar a view `perfis_identidade`, que nunca
  expõe celular, data_nascimento nem estatística nenhuma.
*/

DROP POLICY IF EXISTS "Perfil visivel para qualquer autenticado" ON public.profiles;

CREATE POLICY "Usuários veem o próprio perfil"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- View de identidade pública. Dona é quem rodou a migration (role com BYPASSRLS no
-- Supabase), então a leitura da view não é filtrada pela RLS de `profiles` — é assim que
-- ela consegue mostrar a identidade de QUALQUER usuário mesmo com a policy acima restrita
-- ao dono. Só expõe as 4 colunas abaixo: nunca celular, data_nascimento ou estatística.
CREATE OR REPLACE VIEW public.perfis_identidade
WITH (security_invoker = false)
AS
  SELECT id, nome_real, nome_usuario, foto_usuario
  FROM public.profiles;

/*
  `alter default privileges in schema public` (padrão do Supabase) dá GRANT ALL em toda
  tabela/view nova para anon/authenticated — inclusive INSERT/UPDATE/DELETE. Como esta view
  é uma projeção simples de uma tabela só, o Postgres a torna auto-atualizável: sem os
  REVOKEs abaixo, dava pra escrever em `profiles` através dela. Só leitura, e só para quem
  está logado.
*/
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.perfis_identidade FROM authenticated, anon;
REVOKE ALL ON public.perfis_identidade FROM anon;
GRANT SELECT ON public.perfis_identidade TO authenticated;
