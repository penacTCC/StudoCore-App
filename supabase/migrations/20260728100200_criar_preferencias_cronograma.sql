-- Preferências do cronograma (hoje vivem só em useState em cronograma-config.tsx).
-- Uma linha por usuário, com valores padrão espelhando a constante PADRAO do app.
CREATE TABLE public.preferencias_cronograma (
  usuario_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  foco_min INTEGER NOT NULL DEFAULT 25,
  descanso_curto_min INTEGER NOT NULL DEFAULT 5,
  descanso_longo_min INTEGER NOT NULL DEFAULT 15,
  ciclos_ate_longo INTEGER NOT NULL DEFAULT 4,
  auto_descanso BOOLEAN NOT NULL DEFAULT true,
  auto_foco BOOLEAN NOT NULL DEFAULT false,
  notificacoes_ativas BOOLEAN NOT NULL DEFAULT true,
  antecedencia_min INTEGER NOT NULL DEFAULT 10,
  avisar_fim_de_fase BOOLEAN NOT NULL DEFAULT true,
  resumo_dia_seguinte BOOLEAN NOT NULL DEFAULT false,
  nao_perturbar BOOLEAN NOT NULL DEFAULT true,
  nao_perturbar_inicio TIME NOT NULL DEFAULT '22:00',
  nao_perturbar_fim TIME NOT NULL DEFAULT '07:00',
  som_fim_foco BOOLEAN NOT NULL DEFAULT true,
  vibrar BOOLEAN NOT NULL DEFAULT true,
  manter_tela_ligada BOOLEAN NOT NULL DEFAULT false,
  inicio_semana TEXT NOT NULL DEFAULT 'segunda' CHECK (inicio_semana IN ('domingo', 'segunda')),
  duracao_padrao_bloco_min INTEGER NOT NULL DEFAULT 50,
  duracao_padrao_descanso_min INTEGER NOT NULL DEFAULT 10,
  contar_descanso_como_estudado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.preferencias_cronograma ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem só as próprias preferências"
  ON public.preferencias_cronograma FOR SELECT
  USING (auth.uid() = usuario_id);

CREATE POLICY "Usuários criam as próprias preferências"
  ON public.preferencias_cronograma FOR INSERT
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Usuários atualizam as próprias preferências"
  ON public.preferencias_cronograma FOR UPDATE
  USING (auth.uid() = usuario_id);
