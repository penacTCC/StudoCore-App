-- A matéria favorita sumiu do duelo.
--
-- Antes da migration 20260806200000 a tela lia a linha inteira de `profiles`, então
-- `materia_favorita` vinha de graça. Ao trocar a leitura direta pela RPC, a coluna
-- ficou de fora da lista de retorno e o card passou a mostrar "—" para os dois lados.
--
-- Volta como os outros números: só sai de perfil público (ou do próprio usuário). É
-- informação de estudo, não de identidade — quem fecha o perfil não quer publicá-la.

-- CREATE OR REPLACE não muda a assinatura de retorno; precisa derrubar antes.
DROP FUNCTION IF EXISTS public.estatisticas_para_duelo(UUID);

CREATE FUNCTION public.estatisticas_para_duelo(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  nome_usuario TEXT,
  nome_real TEXT,
  foto_usuario TEXT,
  perfil_publico BOOLEAN,
  horas_totais INTEGER,
  questoes_feitas INTEGER,
  medalhas_desbloqueadas JSONB,
  materia_favorita TEXT,
  ofensiva INTEGER,
  melhor_ofensiva INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  /*
    Identidade sai sempre: sem nome e foto a tela não teria como dizer de quem é o perfil
    fechado, e isso já é visível em qualquer lista de membros.

    Os números saem quando o perfil é público — ou quando o usuário é você mesmo, que é
    metade de todo duelo e obviamente pode ver os próprios dados mesmo de perfil fechado.
  */
  SELECT
    p.id,
    p.nome_usuario,
    p.nome_real,
    p.foto_usuario,
    p.perfil_publico,
    CASE WHEN p.perfil_publico OR p.id = auth.uid() THEN p.horas_totais END,
    CASE WHEN p.perfil_publico OR p.id = auth.uid() THEN p.questoes_feitas END,
    CASE WHEN p.perfil_publico OR p.id = auth.uid() THEN to_jsonb(p.medalhas_desbloqueadas) END,
    CASE WHEN p.perfil_publico OR p.id = auth.uid() THEN p.materia_favorita END,
    CASE WHEN p.perfil_publico OR p.id = auth.uid() THEN g.ofensiva END,
    CASE WHEN p.perfil_publico OR p.id = auth.uid() THEN g.melhor_ofensiva END
  FROM public.profiles p
  LEFT JOIN public.gamificacoes g ON g.user_id = p.id
  WHERE p.id = p_user_id
    -- Só gente logada duela. Sem isto, a função SECURITY DEFINER abriria os números
    -- públicos para o papel anônimo, que hoje não enxerga profiles.
    AND auth.uid() IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.estatisticas_para_duelo(UUID) TO authenticated;
