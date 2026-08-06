-- A participação de cada um no grupo.
--
-- A tela de configurações do grupo só tinha coisa de administrador. Para o membro comum ela
-- era três linhas em modo leitura e um botão de sair: nada do que ele podia ajustar sobre a
-- própria participação, porque nada disso existia.
--
-- Duas colunas, as duas sobre a pessoa e não sobre o grupo:
--
--   * silenciar as notificações deste grupo sem precisar sair dele;
--   * uma meta de horas própria, para quem não consegue (ou não quer) acompanhar a meta
--     coletiva — a do grupo continua valendo para o grupo.
--
-- A escrita passa por uma função SECURITY DEFINER pelo mesmo motivo da migration
-- 20260806170000: `membros` não tem política de UPDATE nenhuma, então um update vindo do
-- client falharia calado. A função só mexe na linha de `auth.uid()`, nunca na de terceiros.

ALTER TABLE public.membros
  ADD COLUMN IF NOT EXISTS silenciar_notificacoes BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS meta_horas_pessoal INTEGER;

COMMENT ON COLUMN public.membros.silenciar_notificacoes IS
  'O membro não recebe avisos deste grupo. Continua membro e continua vendo tudo.';
COMMENT ON COLUMN public.membros.meta_horas_pessoal IS
  'Meta semanal de horas só desta pessoa neste grupo. NULL significa seguir a meta do grupo.';

/*
  Cada parâmetro NULL quer dizer "não mexe neste campo", e não "apaga". Sem isso, salvar o
  silenciar zeraria a meta pessoal junto, já que a tela manda um campo de cada vez.

  A meta pessoal, por outro lado, precisa poder voltar a ser NULL (= seguir a do grupo), e
  é o que `p_limpar_meta` faz — um NULL não teria como expressar essa diferença sozinho.
*/
CREATE OR REPLACE FUNCTION public.definir_participacao_no_grupo(
  p_grupo_id UUID,
  p_silenciar BOOLEAN DEFAULT NULL,
  p_meta_horas_pessoal INTEGER DEFAULT NULL,
  p_limpar_meta BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_meta_horas_pessoal IS NOT NULL AND (p_meta_horas_pessoal < 1 OR p_meta_horas_pessoal > 168) THEN
    RAISE EXCEPTION 'A meta pessoal precisa ficar entre 1 e 168 horas por semana.';
  END IF;

  UPDATE public.membros
  SET
    silenciar_notificacoes = COALESCE(p_silenciar, silenciar_notificacoes),
    meta_horas_pessoal = CASE
      WHEN p_limpar_meta THEN NULL
      ELSE COALESCE(p_meta_horas_pessoal, meta_horas_pessoal)
    END
  WHERE grupo_id = p_grupo_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Você não participa deste grupo.';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.definir_participacao_no_grupo(UUID, BOOLEAN, INTEGER, BOOLEAN) TO authenticated;
