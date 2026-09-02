-- O duelo passava por cima do perfil privado.
--
-- `perfil_publico` só era consultado na tela de perfil do membro (member-profile), que
-- esconde os números no render. O duelo (compare-profile) buscava a mesma linha de
-- `profiles` e a linha de `gamificacoes` e mostrava tudo: horas, questões, medalhas e as
-- duas ofensivas de quem tinha fechado o perfil. Fechar o perfil só mudava por qual tela
-- a pessoa era vista.
--
-- A correção não pode ser só na tela, porque o vazamento é de dados: `gamificacoes` libera
-- SELECT para qualquer usuário logado (migration 20260626093714), e a linha de `profiles`
-- vinha inteira. Então quem decide o que sai é o banco, e a tela só desenha o que recebeu.

CREATE OR REPLACE FUNCTION public.estatisticas_para_duelo(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  nome_usuario TEXT,
  nome_real TEXT,
  foto_usuario TEXT,
  perfil_publico BOOLEAN,
  horas_totais INTEGER,
  questoes_feitas INTEGER,
  medalhas_desbloqueadas JSONB,
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
