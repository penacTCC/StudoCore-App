-- Fase 2 da remediação de segurança pré-MVP.
-- A policy de SELECT em `profiles` tinha qual = auth.role() = 'authenticated', sem
-- filtro nenhum de linha/coluna: qualquer conta logada lia celular e data_nascimento
-- de todo mundo. Restringe a "dono lê o próprio perfil" e expõe só nome/apelido de
-- outros usuários via uma função dedicada, para o único call site que precisava disso
-- (services/incentivos.ts, texto da notificação de "força").

DROP POLICY "Perfis são visíveis para todos os usuários logados" ON public.profiles;
CREATE POLICY "Usuário lê o próprio perfil" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE FUNCTION public.perfil_nome_publico(p_user_id uuid)
RETURNS TABLE(nome_usuario text, nome_real text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT nome_usuario, nome_real FROM public.profiles WHERE id = p_user_id;
$$;
GRANT EXECUTE ON FUNCTION public.perfil_nome_publico(uuid) TO authenticated;
