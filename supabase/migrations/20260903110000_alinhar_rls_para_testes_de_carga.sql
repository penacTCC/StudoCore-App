/*
  Alinha o Supabase local para os testes de carga.

  Esta migration existe porque parte das policies aplicadas em produção nasceu pelo
  dashboard e não estava no histórico versionado. Sem ela, o banco local reconstruído
  por `supabase db reset` ficava com RLS desligada em `profiles`, `grupos`, `membros`
  e `sessoes_foco`, justamente o caminho medido pelos cenários de carga.

  As policies abaixo foram copiadas por SELECT de `pg_policies` do projeto `StudoCore`
  em produção. A única exceção deliberada é `tab_sessao_membros.selecionar_participantes_da_sala`:
  em produção ela chama `esta_na_sala(sala_id)`, mas essa função dentro da policy reproduziu
  segfault no Realtime local durante os testes de carga. Aqui a regra fica inline, sem
  chamada de função, preservando a intenção: o usuário vê a própria participação ou as
  participações de salas cujo grupo ele consegue enxergar.

  Policies de Turma que referenciam `alunos_turmas` e `sclass_professores_turmas` ficam
  propositalmente fora: essas tabelas existem em produção, mas não existem no repositório.
*/

-- ───────────────────────── profiles ─────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Perfil visivel para qualquer autenticado" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem criar seu próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuario pode ver o proprio perfil e os perfis publicos" ON public.profiles;
DROP POLICY IF EXISTS profiles_select_producao_local ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_proprio ON public.profiles;
DROP POLICY IF EXISTS profiles_update_proprio ON public.profiles;

CREATE POLICY "Perfil visivel para qualquer autenticado"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários podem criar seu próprio perfil"
  ON public.profiles FOR INSERT
  TO public
  WITH CHECK (id = auth.uid());

CREATE POLICY "Usuários podem atualizar seu próprio perfil"
  ON public.profiles FOR UPDATE
  TO public
  USING (id = auth.uid())
  WITH CHECK (true);

-- ───────────────────────── grupos ─────────────────────────

ALTER TABLE public.grupos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "administradores editam grupos" ON public.grupos;
DROP POLICY IF EXISTS "criação de grupos" ON public.grupos;
DROP POLICY IF EXISTS "ver grupos publicos" ON public.grupos;
DROP POLICY IF EXISTS grupos_select_producao_local ON public.grupos;
DROP POLICY IF EXISTS grupos_insert_autenticado ON public.grupos;
DROP POLICY IF EXISTS grupos_update_admin ON public.grupos;

CREATE POLICY "ver grupos publicos"
  ON public.grupos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "criação de grupos"
  ON public.grupos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "administradores editam grupos"
  ON public.grupos FOR UPDATE
  TO public
  USING (
    EXISTS (
      SELECT 1
      FROM public.membros
      WHERE membros.grupo_id = grupos.id
        AND membros.user_id = auth.uid()
        AND membros.administrador = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.membros
      WHERE membros.grupo_id = grupos.id
        AND membros.user_id = auth.uid()
        AND membros.administrador = true
    )
  );

-- ───────────────────────── membros ─────────────────────────

ALTER TABLE public.membros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "o usuario se insere num grupo" ON public.membros;
DROP POLICY IF EXISTS "usuario ve seus proprios vinculos" ON public.membros;
DROP POLICY IF EXISTS "visualizar os membros" ON public.membros;
DROP POLICY IF EXISTS membros_select_producao_local ON public.membros;
DROP POLICY IF EXISTS membros_insert_proprio_ou_admin ON public.membros;
DROP POLICY IF EXISTS membros_update_admin_ou_proprio ON public.membros;
DROP POLICY IF EXISTS membros_delete_admin_ou_proprio ON public.membros;

CREATE POLICY "usuario ve seus proprios vinculos"
  ON public.membros FOR SELECT
  TO public
  USING (user_id = auth.uid());

CREATE POLICY "visualizar os membros"
  ON public.membros FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1
      FROM public.grupos g
      WHERE g.id = membros.grupo_id
    )
  );

CREATE POLICY "o usuario se insere num grupo"
  ON public.membros FOR INSERT
  TO public
  WITH CHECK (user_id = auth.uid());

-- ───────────────────────── sessoes_foco ─────────────────────────

ALTER TABLE public.sessoes_foco ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Professor le sessoes da propria turma" ON public.sessoes_foco;
DROP POLICY IF EXISTS "Usuários podem inserir suas próprias sessões" ON public.sessoes_foco;
DROP POLICY IF EXISTS "Usuários podem ver suas próprias sessões" ON public.sessoes_foco;
DROP POLICY IF EXISTS "usuarios editam as sessões ao revisar" ON public.sessoes_foco;
DROP POLICY IF EXISTS sessoes_foco_select_producao_local ON public.sessoes_foco;
DROP POLICY IF EXISTS sessoes_foco_insert_propria ON public.sessoes_foco;
DROP POLICY IF EXISTS sessoes_foco_update_propria ON public.sessoes_foco;
DROP POLICY IF EXISTS sessoes_foco_delete_propria ON public.sessoes_foco;

CREATE POLICY "Usuários podem ver suas próprias sessões"
  ON public.sessoes_foco FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR (
      is_public = true
      AND public.comunidade_usuario_no_feed(user_id)
      AND NOT public.comunidade_bloqueio_entre(user_id, auth.uid())
      AND COALESCE((SELECT profiles.perfil_publico FROM public.profiles WHERE profiles.id = sessoes_foco.user_id), true)
    )
  );

CREATE POLICY "Usuários podem inserir suas próprias sessões"
  ON public.sessoes_foco FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "usuarios editam as sessões ao revisar"
  ON public.sessoes_foco FOR UPDATE
  TO public
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ───────────────────────── sala ao vivo ─────────────────────────

DROP POLICY IF EXISTS "Membros de sessão visíveis para usuários logados" ON public.tab_sessao_membros;
DROP POLICY IF EXISTS selecionar_participantes_da_sala ON public.tab_sessao_membros;
DROP POLICY IF EXISTS membro_insere_propria_sessao ON public.tab_sessao_membros;
DROP POLICY IF EXISTS membro_atualiza_propria_sessao ON public.tab_sessao_membros;
DROP POLICY IF EXISTS dmembro_deleta_propria_sessao ON public.tab_sessao_membros;

CREATE POLICY selecionar_participantes_da_sala
  ON public.tab_sessao_membros FOR SELECT
  TO public
  USING (
    membro_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.salas_foco sa
      WHERE sa.id = tab_sessao_membros.sala_id
        AND EXISTS (
          SELECT 1
          FROM public.membros m
          WHERE m.grupo_id = sa.grupo_id
            AND m.user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Usuários podem entrar em uma sessão" ON public.tab_sessao_membros;
CREATE POLICY membro_insere_propria_sessao
  ON public.tab_sessao_membros FOR INSERT
  TO public
  WITH CHECK (membro_id = auth.uid());

DROP POLICY IF EXISTS "Usuários podem atualizar sua própria participação" ON public.tab_sessao_membros;
CREATE POLICY membro_atualiza_propria_sessao
  ON public.tab_sessao_membros FOR UPDATE
  TO public
  USING (membro_id = auth.uid())
  WITH CHECK (membro_id = auth.uid());

CREATE POLICY dmembro_deleta_propria_sessao
  ON public.tab_sessao_membros FOR DELETE
  TO public
  USING (membro_id = auth.uid());

-- ───────────────────────── saneamento das tabelas já alinhadas ─────────────────────────

ALTER TABLE public.incentivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materias_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salas_foco ENABLE ROW LEVEL SECURITY;
