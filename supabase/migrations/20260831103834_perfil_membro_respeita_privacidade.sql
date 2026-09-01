/*
  "Perfil privado" não era privacidade real fora do duelo.

  Existia hoje, sem migration rastreada (aplicada direto no banco em algum momento), uma
  policy de SELECT em `profiles` que bloqueava a LINHA INTEIRA de quem fechou o perfil
  para qualquer outra pessoa. Isso quebra tudo que precisa só da identidade (nome/foto) de
  alguém, mesmo de perfil fechado — lista de membros do grupo, "quem mandou força"
  (`incentivos.ts`), participante de sala (`salas.ts`), ranking do grupo com ofensiva
  (`grupos.ts` faz join em `gamificacoes`, que também é aberta pra qualquer autenticado
  de propósito). Fechar o perfil não te tira dessas listas — só esconde as ESTATÍSTICAS
  na tela do perfil (member-profile) e no duelo (compare-profile). É essa a promessa que
  a UI faz, e é só essa que o banco precisa cumprir.

  O duelo (`estatisticas_para_duelo`, migration 20260806200000) já resolveu isso direito:
  identidade sempre sai, estatística só sai se `perfil_publico` ou é você mesmo. A tela de
  perfil do membro (`member-profile.tsx`) nunca ganhou o mesmo tratamento — ela buscava
  `profiles.select("*")` + `gamificacoes` direto e só escondia os números NO RENDER. Um
  client alternativo (ou uma chamada REST direta) via a hora total, ofensiva e medalhas de
  qualquer perfil fechado.

  1. Devolve a policy de SELECT de `profiles` ao estado que todo o resto do app já
     depende (linha sempre visível pra autenticado) — sem isso, nome/foto somem em toda
     lista que envolve alguém de perfil fechado.
  2. Nova função, irmã de `estatisticas_para_duelo`, pra alimentar member-profile.tsx sem
     devolver estatística de quem fechou o perfil.
*/

-- ───── 1. Restaura a visibilidade de identidade (linha inteira) ─────
DROP POLICY IF EXISTS "Usuario pode ver o proprio perfil e os perfis publicos" ON public.profiles;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'Perfil visivel para qualquer autenticado'
  ) THEN
    CREATE POLICY "Perfil visivel para qualquer autenticado"
      ON public.profiles FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- ───── 2. Estatísticas do perfil do membro, gated por perfil_publico ─────
CREATE OR REPLACE FUNCTION public.perfil_membro_para_visualizacao(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  nome_usuario TEXT,
  nome_real TEXT,
  foto_usuario TEXT,
  bio TEXT,
  objetivo TEXT,
  created_at TIMESTAMPTZ,
  perfil_publico BOOLEAN,
  mostrar_ofensiva BOOLEAN,
  horas_totais INTEGER,
  minutos_semana INTEGER,
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
    Identidade e customização de perfil (bio/objetivo/data de entrada/interruptor de
    ofensiva) saem sempre: sem isso a tela nem teria como dizer de quem é o perfil
    fechado, e já é visível em qualquer lista de membros.

    Os números saem só quando o perfil é público — ou quando o usuário é você mesmo.
  */
  SELECT
    p.id,
    p.nome_usuario,
    p.nome_real,
    p.foto_usuario,
    p.bio,
    p.objetivo,
    p.created_at,
    p.perfil_publico,
    p.mostrar_ofensiva,
    CASE WHEN p.perfil_publico OR p.id = auth.uid() THEN p.horas_totais END,
    CASE WHEN p.perfil_publico OR p.id = auth.uid() THEN p.minutos_semana END,
    CASE WHEN p.perfil_publico OR p.id = auth.uid() THEN to_jsonb(p.medalhas_desbloqueadas) END,
    CASE WHEN p.perfil_publico OR p.id = auth.uid() THEN g.ofensiva END,
    CASE WHEN p.perfil_publico OR p.id = auth.uid() THEN g.melhor_ofensiva END
  FROM public.profiles p
  LEFT JOIN public.gamificacoes g ON g.user_id = p.id
  WHERE p.id = p_user_id
    -- Mesma guarda do duelo: sem isto a função SECURITY DEFINER abriria os números
    -- públicos para o papel anônimo, que hoje não enxerga profiles.
    AND auth.uid() IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.perfil_membro_para_visualizacao(UUID) TO authenticated;
