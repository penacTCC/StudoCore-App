-- Saída de grupo com transferência de administração.
--
-- A tela de configurações do grupo já pedia "escolha quem vai assumir" antes de você sair,
-- mas o botão só fechava o modal e navegava: ninguém era promovido e quem saiu continuava
-- no grupo. Isto aqui é o que faltava do outro lado.
--
-- Precisa ser SECURITY DEFINER porque `membros` não tem política de UPDATE nem de DELETE:
-- pelo client ninguém consegue promover outra pessoa nem apagar o próprio vínculo. Toda a
-- checagem de permissão é feita aqui dentro, contra `auth.uid()` — a função nunca confia em
-- quem a chamou.
--
-- Devolve o id de quem ficou como administrador, ou NULL quando o grupo acabou junto (o
-- último membro saiu). Apagar o grupo nesse caso é o que a própria tela promete em texto;
-- `sessoes_foco.grupo_id` é ON DELETE SET NULL, então o histórico de estudo de todo mundo
-- sobrevive à exclusão — só perde o vínculo com o grupo.
CREATE OR REPLACE FUNCTION public.sair_do_grupo(
  p_grupo_id UUID,
  p_novo_admin_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sou_admin BOOLEAN;
  v_novo_admin UUID;
  v_restantes INTEGER;
BEGIN
  SELECT administrador INTO v_sou_admin
  FROM public.membros
  WHERE grupo_id = p_grupo_id AND user_id = auth.uid();

  -- Não é membro: não há o que fazer (e não é um erro que a tela precise tratar).
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Você não participa deste grupo.';
  END IF;

  IF v_sou_admin THEN
    /*
      Sucessor indicado pela tela. Só vale se for outro membro DESTE grupo — sem essa
      checagem, um admin poderia promover qualquer id de usuário que quisesse.
    */
    IF p_novo_admin_id IS NOT NULL AND p_novo_admin_id <> auth.uid() THEN
      SELECT user_id INTO v_novo_admin
      FROM public.membros
      WHERE grupo_id = p_grupo_id AND user_id = p_novo_admin_id;
    END IF;

    /*
      Sem sucessor válido, promove quem está no grupo há mais tempo. É melhor do que
      confiar na tela: um grupo sem administrador nenhum não teria como ser editado,
      renomeado ou excluído por ninguém depois.
    */
    IF v_novo_admin IS NULL THEN
      SELECT user_id INTO v_novo_admin
      FROM public.membros
      WHERE grupo_id = p_grupo_id AND user_id <> auth.uid()
      ORDER BY joined_at ASC
      LIMIT 1;
    END IF;

    IF v_novo_admin IS NOT NULL THEN
      UPDATE public.membros
      SET administrador = TRUE
      WHERE grupo_id = p_grupo_id AND user_id = v_novo_admin;
    END IF;
  END IF;

  DELETE FROM public.membros
  WHERE grupo_id = p_grupo_id AND user_id = auth.uid();

  SELECT COUNT(*) INTO v_restantes
  FROM public.membros
  WHERE grupo_id = p_grupo_id;

  -- Saiu o último: o grupo vai junto (membros e vínculos de arquivo caem por CASCADE).
  IF v_restantes = 0 THEN
    DELETE FROM public.grupos WHERE id = p_grupo_id;
    RETURN NULL;
  END IF;

  RETURN v_novo_admin;
END;
$$;

/*
  Uma função SECURITY DEFINER nasce executável por qualquer um, inclusive pelo papel `anon`
  — ou seja, chamável sem login com a chave pública que vai dentro do app. Aqui isso não
  seria explorável (tudo depende de `auth.uid()`, que é NULL sem sessão), mas deixar a porta
  fechada é o padrão que o linter do Supabase cobra.
*/
REVOKE EXECUTE ON FUNCTION public.sair_do_grupo(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sair_do_grupo(UUID, UUID) TO authenticated;

-- Exclusão do grupo pelo administrador.
--
-- Mesmo problema encontrado junto com o anterior: `grupos` tem políticas de INSERT, SELECT
-- e UPDATE, mas nenhuma de DELETE. Com RLS ligada, um DELETE sem política não é um erro —
-- ele simplesmente não afeta linha nenhuma. O botão "Excluir Grupo" chamava o delete pelo
-- client, recebia sucesso e o grupo continuava lá.
--
-- Devolve TRUE quando apagou. Assim como em `sair_do_grupo`, o histórico de sessões
-- sobrevive (`sessoes_foco.grupo_id` é ON DELETE SET NULL).
CREATE OR REPLACE FUNCTION public.excluir_grupo(p_grupo_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.membros
    WHERE grupo_id = p_grupo_id
      AND user_id = auth.uid()
      AND administrador = TRUE
  ) THEN
    RAISE EXCEPTION 'Só um administrador pode excluir o grupo.';
  END IF;

  DELETE FROM public.grupos WHERE id = p_grupo_id;

  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.excluir_grupo(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.excluir_grupo(UUID) TO authenticated;
