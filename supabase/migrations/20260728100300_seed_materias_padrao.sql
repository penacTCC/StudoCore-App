-- Matérias padrão (Matemática, Física...) hoje só existem como array estático no
-- app (constants/mock-data.ts), sem id — o que impede referenciá-las por
-- materia_id em rotina_semanal_blocos/planos_blocos. Viram linhas de verdade
-- aqui, com usuario_id NULL representando "matéria global do sistema".
ALTER TABLE public.materias_usuario ALTER COLUMN usuario_id DROP NOT NULL;

-- UNIQUE(usuario_id, nome_normalizado) não protege duplicatas entre linhas padrão
-- (NULL nunca é igual a NULL em SQL), por isso um índice parcial à parte.
CREATE UNIQUE INDEX materias_usuario_padrao_nome_unico
  ON public.materias_usuario(nome_normalizado)
  WHERE usuario_id IS NULL;

-- A política de SELECT já é "auth.role() = 'authenticated'" (sem filtro de dono),
-- então linhas com usuario_id NULL já ficam visíveis a qualquer usuário logado.
-- As políticas de INSERT/DELETE exigem auth.uid() = usuario_id, que nunca é
-- verdadeiro contra NULL — protegem essas linhas automaticamente.

INSERT INTO public.materias_usuario (usuario_id, nome_exibicao, nome_normalizado, cor) VALUES
  (NULL, 'Matemática', 'matematica', '#7c3aed'),
  (NULL, 'Física', 'fisica', '#e11d48'),
  (NULL, 'Química', 'quimica', '#059669'),
  (NULL, 'Biologia', 'biologia', '#0891b2'),
  (NULL, 'História', 'historia', '#d97706'),
  (NULL, 'Literatura', 'literatura', '#9333ea')
ON CONFLICT (nome_normalizado) WHERE usuario_id IS NULL DO NOTHING;
