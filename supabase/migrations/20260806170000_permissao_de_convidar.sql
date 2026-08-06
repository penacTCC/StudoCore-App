-- Permissão de convidar membros.
--
-- Antes, convidar era uma porta sem tranca: qualquer membro via o botão "+" no carrossel de
-- membros e podia espalhar o link do grupo. Agora convidar é do administrador, e ele decide
-- membro a membro quem mais pode fazer isso.
--
-- Duas funções, as duas SECURITY DEFINER, porque nenhum dos dois caminhos existe pelo client:
--
--   * `membros` não tem política de UPDATE nenhuma — ninguém consegue mexer na linha de
--     outra pessoa (é o mesmo motivo de `sair_do_grupo`, migration 20260805210000).
--   * `grupos` só libera UPDATE para administrador, então gravar o `codigo_convite` a partir
--     da tela de convite falhava calado para todo mundo que não fosse admin. Com a permissão
--     nova isso passaria a ser um convite que abre e não funciona.
--
-- Toda checagem é feita contra `auth.uid()` aqui dentro: as funções nunca confiam em quem as
-- chamou, e a tela é só a camada de conveniência que esconde o botão.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. A permissão em si.
-- ─────────────────────────────────────────────────────────────────────────────
-- Default `false`: quem entra num grupo entra sem poder convidar, e o admin concede depois.
-- Administrador não depende desta coluna — ele sempre pode convidar (ver `pode_convidar_no_grupo`).
ALTER TABLE public.membros
  ADD COLUMN IF NOT EXISTS pode_convidar BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.membros.pode_convidar IS
  'Membro comum autorizado pelo admin a convidar gente para o grupo. Admin convida sempre, independente deste valor.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Quem pode convidar neste grupo.
-- ─────────────────────────────────────────────────────────────────────────────
-- Uma regra só, usada pelas duas funções abaixo, para a tela e o banco nunca discordarem
-- sobre quem tem a permissão.
CREATE OR REPLACE FUNCTION public.pode_convidar_no_grupo(p_grupo_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.membros
    WHERE grupo_id = p_grupo_id
      AND user_id = p_user_id
      AND (administrador OR pode_convidar)
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. O admin concede ou tira a permissão de um membro.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.definir_permissao_convite(
  p_grupo_id UUID,
  p_membro_user_id UUID,
  p_pode_convidar BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sou_admin BOOLEAN;
BEGIN
  SELECT administrador INTO v_sou_admin
  FROM public.membros
  WHERE grupo_id = p_grupo_id AND user_id = auth.uid();

  IF NOT FOUND OR NOT v_sou_admin THEN
    RAISE EXCEPTION 'Só o administrador do grupo pode mudar quem convida.';
  END IF;

  /*
    O alvo precisa ser membro DESTE grupo — sem isso, um admin poderia carimbar a permissão
    em qualquer id de usuário que quisesse.
  */
  UPDATE public.membros
  SET pode_convidar = p_pode_convidar
  WHERE grupo_id = p_grupo_id AND user_id = p_membro_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esta pessoa não participa do grupo.';
  END IF;

  RETURN p_pode_convidar;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Gravar o link de convite do grupo.
-- ─────────────────────────────────────────────────────────────────────────────
-- Mesma escrita que a tela de convite já fazia direto em `grupos`, só que liberada para
-- quem tem a permissão — e continuando barrada para o resto do grupo, que antes só recebia
-- um update de zero linhas sem aviso nenhum.
CREATE OR REPLACE FUNCTION public.definir_codigo_convite(
  p_grupo_id UUID,
  p_codigo TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.pode_convidar_no_grupo(p_grupo_id, auth.uid()) THEN
    RAISE EXCEPTION 'Você não tem permissão para convidar neste grupo.';
  END IF;

  UPDATE public.grupos
  SET codigo_convite = p_codigo
  WHERE id = p_grupo_id;

  RETURN p_codigo;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pode_convidar_no_grupo(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.definir_permissao_convite(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.definir_codigo_convite(UUID, TEXT) TO authenticated;
