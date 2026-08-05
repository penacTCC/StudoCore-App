-- Passagem do bastão de anfitrião quando quem criou a sessão em grupo encerra a dele.
--
-- Antes, o anfitrião simplesmente saía e a sessão ficava sem dono: os colegas continuavam
-- focando numa sessão órfã. Agora o anfitrião promove alguém que ainda está lá antes de sair.
--
-- Precisa ser uma função SECURITY DEFINER porque a política de UPDATE de
-- `tab_sessao_membros` só deixa cada pessoa mexer na própria linha
-- (`auth.uid() = membro_id`) — o anfitrião não conseguiria promover outro membro pelo
-- client. A checagem de quem pode chamar é feita aqui dentro, contra `auth.uid()`.
CREATE OR REPLACE FUNCTION public.transferir_anfitriao_sessao(p_sessao_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sucessor UUID;
BEGIN
  -- Só o anfitrião atual da sessão passa o bastão.
  IF NOT EXISTS (
    SELECT 1 FROM public.tab_sessao_membros
    WHERE sessao_id = p_sessao_id
      AND membro_id = auth.uid()
      AND funcao = 'anfitriao'
  ) THEN
    RETURN NULL;
  END IF;

  /*
    Sucessor = quem ainda está na sessão (não concluiu) há mais tempo. `ultimo_inicio` é o
    que existe de mais próximo de uma ordem de chegada nesta tabela; quem nunca começou a
    contar fica por último (NULLS LAST) em vez de furar a fila.
  */
  SELECT membro_id INTO v_sucessor
  FROM public.tab_sessao_membros
  WHERE sessao_id = p_sessao_id
    AND membro_id <> auth.uid()
    AND status <> 'concluido'
  ORDER BY ultimo_inicio ASC NULLS LAST
  LIMIT 1;

  -- Ninguém restou: a sessão acaba junto com o anfitrião, não há o que transferir.
  IF v_sucessor IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.tab_sessao_membros
  SET funcao = 'anfitriao'
  WHERE sessao_id = p_sessao_id AND membro_id = v_sucessor;

  UPDATE public.tab_sessao_membros
  SET funcao = 'membro'
  WHERE sessao_id = p_sessao_id AND membro_id = auth.uid();

  RETURN v_sucessor;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transferir_anfitriao_sessao(UUID) TO authenticated;
